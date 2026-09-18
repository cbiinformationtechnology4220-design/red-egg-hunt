# Vercel project settings

This document records the later authorized Vercel setup. No Vercel project, deployment, DNS record, environment credential, or production inventory is created by the local source change.

## Project

- Repository: existing Balai Assist Git repository.
- Root Directory: `apps/red-egg-hunt`.
- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Install command: `npm install` or the approved lockfile-aware equivalent.
- Production URL: exactly `https://red-egg-hunt.vercel.app`.

## Server environment variables

Production requires:

```text
APP_ENV=production
DATABASE_PROVIDER=google-sheets
PUBLIC_SITE_URL=https://red-egg-hunt.vercel.app
VITE_PUBLIC_SITE_URL=https://red-egg-hunt.vercel.app
GOOGLE_APPS_SCRIPT_URL=<private Apps Script web-app URL>
GOOGLE_APPS_SCRIPT_SHARED_SECRET=<server-only random secret>
STAFF_SESSION_COOKIE_NAME=red_egg_staff_session
STAFF_SESSION_SECRET=<server-only random secret>
STAFF_LOCAL_TEST_MODE=false
AUDIT_HASH_SECRET=<server-only random secret>
RATE_LIMIT_SECRET=<server-only random secret>
CAMPAIGN_ID=red-egg-hunt-2026
CAMPAIGN_TITLE=Red Egg Hunt
CAMPAIGN_PRIZE=PHP50 cash voucher
CAMPAIGN_TIMEZONE=Asia/Manila
CAMPAIGN_START_AT=2026-09-24T18:00:00+08:00
CAMPAIGN_END_AT=2026-10-03T18:00:00+08:00
CAMPAIGN_TOTAL_CODES=50
SUPPORT_CONTACT=09952863665
```

The Google Apps Script URL and shared secret are server-only. Do not add either under a `VITE_` prefix.

## Deployment order

1. Complete the private Google Sheet and Apps Script setup.
2. Test the Apps Script backend with a nonproduction inventory.
3. Configure Vercel Preview with the nonproduction Apps Script URL and secret.
4. Test public submission, duplicate handling, counters, and staff claims.
5. Configure Production only after legal, privacy, staff, inventory, and proof-card approvals.

## Final checks

Before producing QR materials, verify:

1. The Vercel project owns and resolves the canonical URL over HTTPS.
2. The Google Sheet is private and owned by an approved resort account.
3. Apps Script deployment runs as the approved owner and uses the shared secret.
4. The `Codes` tab contains exactly 50 unique eight-digit winning codes.
5. Public submissions, duplicate retries, counters, and staff claims work against the deployed Preview.
6. The staff identity/session integration is approved and tested.
7. Backup, retention, privacy, legal, support, and training evidence is recorded.
