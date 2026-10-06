import * as cheerio from 'cheerio';

const RESTAURANT_NAME = '동원관';

export default {
	// 1. Cron Trigger (매일 정해진 시각 실행)
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(runWorkflow(env));
	},

	// 2. HTTP 테스트용 핸들러 (브라우저로 접속해 동작 확인 가능)
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname === '/test') {
			const result = await runWorkflow(env);
			return new Response(result, { status: 200 });
		}
		return new Response('동원관 식단 알림 Worker 동작 중', { status: 200 });
	},
};

/**
 * 전체 워크플로우 실행
 */
async function runWorkflow(env) {
	try {
		const menu = await fetchTodayMenu(env);

		if (!menu) {
			const noMenuMsg = `[동원관] 오늘은 점심 식단 정보가 없거나 휴무일입니다.`;
			await sendTelegramMessage(noMenuMsg, env);
			return noMenuMsg;
		}

		const today = getTodayDateString();
		const message = `🍱 [${today}] 서울대 동원관 점심 메뉴\n\n${menu}`;

		await sendTelegramMessage(message, env);
		return `발송 완료:\n${message}`;
	} catch (error) {
		console.error('워크플로우 실행 중 오류:', error);
		return `오류 발생: ${error.message}`;
	}
}

/**
 * KST(Asia/Seoul) 기준 오늘 날짜 'YYYY-MM-DD'
 */
function getTodayDateString() {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/**
 * 셀 내부 <br> 태그 처리 및 텍스트 추출
 */
function extractCellText($, cell) {
	const html = ($(cell).html() || '').replace(/<br\s*\/?>/gi, '\n');
	const text = cheerio.load(`<div>${html}</div>`)('div').text();

	return text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join('\n');
}

/**
 * 서울대 생협 식단 크롤링
 */
async function fetchTodayMenu(env) {
	const date = getTodayDateString();
	const baseUrl = env.MENU_URL || 'https://snuco.snu.ac.kr/foodmenu/';
	const url = `${baseUrl}?date=${date}&orderby=DESC`;

	const response = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0' },
	});

	if (!response.ok) {
		throw new Error(`식단 페이지 로드 실패 (HTTP status: ${response.status})`);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	let lunchText = null;

	$('td.title').each((_, el) => {
		const title = $(el).text().trim();

		if (title.includes(RESTAURANT_NAME)) {
			const row = $(el).closest('tr');
			const lunchCell = row.find('td.lunch');
			lunchText = extractCellText($, lunchCell);
		}
	});

	if (!lunchText) return null;

	const closedKeywords = ['공휴일', '휴무', '임시휴무', '개교기념일', '기념일'];
	if (closedKeywords.some((keyword) => lunchText.includes(keyword))) {
		return null;
	}

	return lunchText;
}

/**
 * 텔레그램 메시지 발송
 */
async function sendTelegramMessage(text, env) {
	const botToken = env.TELEGRAM_BOT_TOKEN;
	const chatId = env.TELEGRAM_CHAT_ID;

	if (!botToken || !chatId) {
		throw new Error('TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경 변수가 설정되지 않았습니다.');
	}

	const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

	const res = await fetch(telegramUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text: text,
		}),
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`텔레그램 발송 실패: ${errText}`);
	}

	return await res.json();
}
