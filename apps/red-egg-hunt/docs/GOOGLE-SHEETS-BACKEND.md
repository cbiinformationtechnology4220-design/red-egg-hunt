# Google Sheets backend setup

This is the operator runbook for the approved Google-based backend. Do not use a personal employee account for the production spreadsheet. Use an approved resort-controlled Google account with a documented backup owner.

## 1. Create the private spreadsheet

1. Create a new Google Sheet named `Red Egg Hunt 2026 - Production`.
2. Restrict sharing to approved campaign operators.
3. Do not publish the spreadsheet or enable response-summary sharing.
4. Open Extensions, then Apps Script.
5. Replace the default script with `google-apps-script/Code.gs`.
6. Set the project time zone to `Asia/Manila`.
7. Add the `google-apps-script/appsscript.json` manifest if the editor requires it.

## 2. Initialize the workbook

Run `initializeWorkbook()` once from the Apps Script editor and authorize it as the approved owner. It creates these tabs without deleting existing data:

- `Settings`
- `Codes`
- `Audit`

The script also formats the printed-code column as text so leading zeroes are preserved.

## 3. Set Script Properties

In Apps Script Project Settings, add:

```text
SPREADSHEET_ID=<the private spreadsheet ID>
RED_EGG_SHARED_SECRET=<at least 32 random bytes>
```

Do not put the shared secret in a Sheet cell or source file.

## 4. Populate the Settings tab

Use two columns named `key` and `value`. Add these keys:

```text
campaign_id                 red-egg-hunt-2026
title                       Red Egg Hunt
prize_description           PHP50 cash voucher
timezone                    Asia/Manila
starts_at                   2026-09-24T18:00:00+08:00
ends_at                     2026-10-03T18:00:00+08:00
total_codes                 60
instructions                Find a Red Egg Hunt card, scan the shared QR, and enter the eight-digit code printed beside it.
screenshot_instructions     Screenshot this acknowledgement for your records. Do not post your mobile number or other private information publicly.
privacy_notice              Use the approved campaign privacy notice here.
privacy_notice_version      approved-version-1
support_contact             09952863665
```

Replace the privacy notice and version with the approved text before launch.

## 5. Populate the Codes tab

The first row must contain these headers:

```text
printed_code, outcome, state, participant_name, mobile_number, submission_request_hash, submission_payload_hash, submitted_at, claimed_at, claimed_by
```

Load exactly 60 approved unique eight-digit codes. For every row:

```text
outcome = winning
state = available
```

Leave participant and claim columns blank. Independently verify the count and printed-code mapping. Never paste real codes into Git, chat, screenshots, or public documents.

## 6. Deploy the Apps Script web app

1. Click Deploy, then New deployment.
2. Select Web app.
3. Execute as the approved owner.
4. Choose the narrowest responder access that still permits the Vercel server to call it.
5. Copy the deployment URL into the server-only Vercel variable `GOOGLE_APPS_SCRIPT_URL`.
6. Do not expose the URL or shared secret to the browser.

The shared secret is the application-level trust boundary between Vercel and Apps Script. Test failed or missing secrets before accepting any production traffic.

## 7. Protect and back up the workbook

- Protect the `Codes`, `Audit`, and `Settings` tabs from ordinary editing.
- Limit editor access to named operators.
- Keep a documented backup owner.
- Export a protected backup before loading production codes and after campaign close.
- Do not use ordinary chat or personal notes for participant data.

## 8. Rehearse before production

Use a separate staging spreadsheet and Apps Script deployment to verify:

- Before-opening lock
- Valid submission
- Invalid code
- Same-request retry
- Different-request duplicate
- Five submissions produce 45 remaining
- Concurrent submissions for one code produce exactly one success
- Staff lookup and one-time claim
- Concurrent staff claims produce exactly one claim
- Claim after the public submission closing time
- No participant details in public responses or logs

Local source tests do not replace this deployed Apps Script rehearsal.
