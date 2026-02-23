# 독서 인증 관리 시스템

텔레그램 그룹 인증 사진을 Firestore에 저장하고, GitHub Actions 스케줄로 주간 현황/벌금 정산 메시지를 전송합니다.

모노레포 구성:

- `apps/functions`: Firebase Functions (텔레그램 웹훅 수신 + DB 저장 전용)
- `apps/jobs`: GitHub Actions에서 실행되는 일/주간 집계 잡
- `packages/shared`: 공통 도메인 로직/Firestore 접근

## 기능

1. Firebase Function 웹훅이 들어온 Telegram update 중 인증 조건을 만족한 사진만 `cert_events`에 저장
2. GitHub Actions(일간, 화~일 KST 02:01)에서 KST 02:00 종료 / 02:01 시작 기준으로 이번 주 인증 횟수 집계 후 그룹 메시지 전송
3. GitHub Actions(주간, 월 KST 02:01)에서 KST 02:00 종료 / 02:01 시작 기준으로 지난주 인증 횟수 벌금 정산 메시지 전송

## 환경 변수

Functions 배포용 env는 프로젝트별 파일로 분리해서 관리합니다.

- `apps/functions/.env.extensive-reading-dev`
- `apps/functions/.env.extensive-reading-prod`

초기 설정은 샘플 파일을 복사해서 만드세요.

```bash
cp apps/functions/.env.sample apps/functions/.env.extensive-reading-dev
cp apps/functions/.env.sample apps/functions/.env.extensive-reading-prod
```

Firebase CLI는 `--project`로 지정한 프로젝트 ID에 맞는 env 파일을 자동으로 로드합니다.

- 공통
  - `TELEGRAM_GROUP_CHAT_ID` (필수)
- Firebase webhook function
- GitHub Actions jobs
  - `TELEGRAM_BOT_TOKEN` (필수)

로컬에서 jobs를 돌릴 때는 루트 `.env`를 사용합니다.

```bash
cp .env.sample .env
```

## 로컬 실행

```bash
npm install
npm run build
npm run job:daily
npm run job:weekly
npm run job:participants
npm run job:user:add -- --id <user_id> --name <display_name>
npm run job:user:remove -- --id <user_id>
npm run job:user:sync -- --id <user_id>
```

`job:participants`는 Telegram `getChatAdministrators` + Firestore `cert_events`를 합쳐 `id:name,id:name` 형식 사용자 목록 초안을 출력합니다.
`job:user:add`/`job:user:remove`/`job:user:sync`는 Firestore `users` 컬렉션을 수동 보정할 때 사용합니다.

## Firebase Functions 배포

```bash
npm run deploy:functions:dev
npm run deploy:functions:prod
```

## 배포 후 Telegram webhook 설정

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<REGION>-<PROJECT_ID>.cloudfunctions.net/telegramWebhook"}'
```
