# Local development and verification

## Prerequisites

- Node.js 20.19 or a later compatible Node release.
- npm.
- An approved Google account is not required for local mock mode.
- No production credentials, participant data, or production printed-code inventory.

## Setup

```sh
cd /Users/jaimexcarlos/balai-assist-prototype/apps/red-egg-hunt
npm install
cp .env.example .env.local
```

Local defaults use `DATABASE_PROVIDER=mock` and a synthetic all-winning 50-code inventory. This fixture must never be printed or used as production inventory.

## Commands

```sh
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run build
npm run dev
```

The Vite dev server serves the browser interface. API functions require the Vercel function runner or an equivalent serverless runner. The browser uses `/api/...` relative routes and does not receive Google Sheet credentials or the Apps Script shared secret.

## Google backend rehearsal

The Apps Script backend cannot be proven by local Node tests alone. Use a separate nonproduction Google Sheet and Apps Script deployment for rehearsal. Do not point local development at the production Sheet.

## Safe development rules

1. Keep `PUBLIC_SITE_URL` and `VITE_PUBLIC_SITE_URL` aligned. Non-local origins must be HTTPS; production must be exactly `https://red-egg-hunt.vercel.app`.
2. Never add a server secret under a `VITE_` prefix.
3. Do not return name, mobile number, raw inventory, or audit data from public routes.
4. Keep request identifiers transient in memory. Do not put participant data or codes in URLs, analytics, or browser storage.
5. Do not generate or print production QR materials in local development.
6. Treat local tests and builds as local evidence only. They do not prove Google account ownership, Sheet protection, Apps Script deployment, staff provisioning, privacy approval, legal treatment, backup/restore, or launch readiness.
