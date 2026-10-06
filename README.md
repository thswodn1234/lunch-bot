# lunch-bot

서울대학교 동원관식당의 오늘 점심 메뉴를 평일마다 텔레그램으로 보내주는 Cloudflare Workers 봇입니다.

## 동작 방식

1. Cloudflare Workers의 Cron Trigger가 평일(월~금) 정해진 시각에 `scheduled` 핸들러를 실행합니다.
2. 서울대 생활협동조합 식단 페이지([snuco.snu.ac.kr/foodmenu](https://snuco.snu.ac.kr/foodmenu))에서 동원관식당의 점심 메뉴를 가져옵니다.
3. 텔레그램 Bot API로 지정한 채팅에 메뉴를 발송합니다.

## 기술 스택

- Cloudflare Workers (JavaScript)
- Cron Triggers
- Telegram Bot API
- Wrangler CLI

## 프로젝트 구조

```
lunch-bot/
├── src/
│   └── index.js        # Worker 진입점 (scheduled / fetch 핸들러)
├── wrangler.jsonc      # Worker 및 Cron 설정
├── .dev.vars           # 로컬 전용 시크릿 (Git에 올리지 않음)
└── package.json
```

## 사전 준비

- Node.js 18 이상
- Cloudflare 계정
- 텔레그램 봇 토큰: [@BotFather](https://t.me/BotFather)에서 `/newbot`으로 생성
- 텔레그램 채팅 ID: 봇에게 먼저 메시지를 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates`에서 `chat.id` 확인

## 설치

```bash
git clone https://github.com/<사용자명>/lunch-bot.git
cd lunch-bot
npm install
```

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather에서 발급받은 봇 토큰 |
| `TELEGRAM_CHAT_ID` | 메시지를 받을 채팅 ID |

### 로컬 개발

프로젝트 루트에 `.dev.vars` 파일을 만듭니다. 따옴표나 꺾쇠 없이 `KEY=value` 형식으로 씁니다.

```
TELEGRAM_BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=987654321
```

> `.dev.vars`에는 실제 토큰이 들어가므로 반드시 `.gitignore`에 포함하세요.

### 배포 환경

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

## 로컬 테스트

```bash
npx wrangler dev --test-scheduled
```

서버가 뜨면 아래 주소로 요청을 보내 `scheduled` 핸들러를 한 번 실행할 수 있습니다.

```
http://localhost:8787/__scheduled
```

## 배포

```bash
npx wrangler login     # 최초 1회
npx wrangler deploy
```

배포 후 Cloudflare 대시보드의 Workers & Pages → `lunch-bot` → Settings → Triggers에서 Cron 값을 확인할 수 있습니다. 실시간 로그는 다음 명령으로 봅니다.

```bash
npx wrangler tail
```

## 발송 시각 변경

`wrangler.jsonc`의 cron 표현식을 수정한 뒤 다시 배포합니다. Cron은 **UTC 기준**이며, 한국 시간(KST)은 UTC+9입니다.

```jsonc
"triggers": {
  "crons": [
    "15 2 * * MON-FRI" // 월~금 UTC 02:15 (KST 11:15)
  ]
}
```

> Cloudflare Workers의 Cron은 요일 숫자가 일반 리눅스 cron과 다릅니다(`1`=일요일). 숫자 대신 `MON-FRI`처럼 요일 이름을 쓰면 헷갈리지 않습니다.

## 보안 참고

- 토큰과 채팅 ID는 코드에 직접 쓰지 않고 시크릿으로만 관리합니다.
- 외부 HTTP 접근이 필요 없어 `wrangler.jsonc`에 `"workers_dev": false`를 설정해 `workers.dev` 주소를 비활성화했습니다. 따라서 `*.workers.dev` 주소로는 더 이상 접근할 수 없습니다.
- 토큰이 노출되었다면 BotFather에서 `/revoke`로 재발급하세요.

## 문제 해결

| 증상 | 원인 및 해결 |
| --- | --- |
| `환경 변수가 설정되지 않았습니다` | 로컬에서는 `.dev.vars`, 배포 환경에서는 `wrangler secret put`으로 값을 등록했는지 확인 |
| `401 Unauthorized` | 봇 토큰이 잘못됨. 꺾쇠, 따옴표, 공백, `bot` 접두사가 섞이지 않았는지 확인하고 `getMe`로 검증 |
| `400 chat not found` | 채팅 ID가 틀렸거나, 봇에게 먼저 메시지를 보내지 않음 |
| 정해진 시각에 메시지가 오지 않음 | Triggers의 Cron 값과 UTC/KST 변환 확인, `wrangler tail`로 로그 확인 |

## 라이선스

[MIT](LICENSE)
