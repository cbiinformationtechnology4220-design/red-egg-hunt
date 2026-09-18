# Environment contract

The server-side `PUBLIC_SITE_URL` is authoritative. `VITE_PUBLIC_SITE_URL` is browser configuration and must match it outside local development. Preview, staging, and production require HTTPS. Production must use exactly `https://red-egg-hunt.vercel.app`.

## Environment matrix

| Environment | Site URL | Backend | Inventory |
| --- | --- | --- | --- |
| Local | Loopback HTTP or HTTPS | In-memory fixture | Synthetic all-winning codes |
| Preview | Dedicated HTTPS preview origin | Nonproduction Apps Script and private Google Sheet | Test inventory |
| Staging | Approved HTTPS rehearsal origin | Dedicated staging Apps Script and private Google Sheet | Rehearsal inventory |
| Production | `https://red-egg-hunt.vercel.app` | Production Apps Script and private Google Sheet | Exactly 50 approved winning codes |

## Browser-visible values

- `VITE_PUBLIC_SITE_URL`
- `VITE_APP_ENV`
- `VITE_CAMPAIGN_TIMEZONE`

The browser never receives the Apps Script shared secret, Google Sheet ID, participant records, inventory records, staff-session secret, audit secret, or rate-limit secret.

## Server-only values

- `PUBLIC_SITE_URL`
- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`
- `STAFF_SESSION_SECRET` and `STAFF_SESSION_COOKIE_NAME`
- `AUDIT_HASH_SECRET` and `RATE_LIMIT_SECRET`
- Campaign schedule, prize description, privacy notice, support contact, and backend settings

`STAFF_LOCAL_TEST_MODE=true` is accepted only for local development. Production staff access must come from an approved authenticated session carrying the `red-egg:claim` role.

## Validation rules

- Campaign start and end are ISO-8601 instants; the end is later than the start.
- Campaign timezone is `Asia/Manila`.
- Total inventory is exactly 50.
- Every durable printed code is exactly eight digits and has the `winning` outcome.
- Unknown codes are invalid; there are no production bokya rows.
- Name and mobile are stored only in the private Google Sheet and never returned through counters, acknowledgement, staff status, URLs, logs, or browser storage.
- The Google Sheet is the source of truth for code state and counters. Apps Script locks the critical read-update-write path.
- The shared secret is stored in Apps Script Script Properties and Vercel server-only environment variables.
