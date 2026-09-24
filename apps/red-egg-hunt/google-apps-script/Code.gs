/*
 * Red Egg Hunt Google Sheets backend.
 *
 * Bind this Apps Script project to the private campaign spreadsheet. The web
 * app receives only server-proxied requests from the Vercel API. The shared
 * secret is stored in Script Properties, never in the spreadsheet or browser.
 *
 * Required Script Properties:
 * - SPREADSHEET_ID
 * - RED_EGG_SHARED_SECRET
 *
 * Run initializeWorkbook() once from the bound script editor before deployment.
 * It creates missing sheets and headers without deleting existing data.
 */

var SHEET_NAMES = Object.freeze({
  SETTINGS: 'Settings',
  CODES: 'Codes',
  AUDIT: 'Audit',
});

var SETTINGS_HEADERS = ['key', 'value'];
var CODE_HEADERS = [
  'printed_code',
  'outcome',
  'state',
  'participant_name',
  'mobile_number',
  'submission_request_hash',
  'submission_payload_hash',
  'submitted_at',
  'claimed_at',
  'claimed_by',
];
var AUDIT_HEADERS = ['occurred_at', 'action', 'outcome', 'code_hash', 'staff_subject'];
var TOTAL_CODES = 60;

function doGet() {
  return jsonResponse({ ok: true, data: { service: 'red-egg-hunt-google-sheets' } });
}

function doPost(event) {
  try {
    var request = parseRequest(event);
    authorizeRequest(request);
    var data = dispatch(request.action, request.campaignId, request.payload || {});
    return jsonResponse({ ok: true, data: data });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: {
        code: error.code || 'DATABASE_ERROR',
        message: publicMessage(error.code),
      },
    });
  }
}

function initializeWorkbook() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Run this function from a spreadsheet-bound Apps Script project.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  ensureSheet(spreadsheet, SHEET_NAMES.SETTINGS, SETTINGS_HEADERS);
  var codesSheet = ensureSheet(spreadsheet, SHEET_NAMES.CODES, CODE_HEADERS);
  codesSheet.getRange('A:A').setNumberFormat('@');
  ensureSheet(spreadsheet, SHEET_NAMES.AUDIT, AUDIT_HEADERS);
  spreadsheet.setSpreadsheetTimeZone('Asia/Manila');
  return 'Workbook initialized. Add approved settings and exactly 60 winning codes before deployment.';
}

function dispatch(action, campaignId, payload) {
  if (action === 'health') return { service: 'red-egg-hunt-google-sheets' };
  var settings = readSettings();
  assertCampaignId(settings, campaignId);
  // Public reads do not mutate inventory. Avoid queueing them behind a slow
  // submission or staff claim; a brief counter staleness is safer than making
  // the participant page wait for the ten-second script-lock timeout.
  if (action === 'counters') return publicCounters(settings);
  if (action === 'campaign') return publicCampaign(settings);
  if (action === 'submit') return withScriptLock(function () { return submitCode(settings, payload); });
  if (action === 'staffLookup') return withScriptLock(function () { return staffLookup(settings, payload); });
  if (action === 'staffClaim') return withScriptLock(function () { return staffClaim(settings, payload); });
  throw backendError('DATABASE_ERROR');
}

function parseRequest(event) {
  var raw = event && event.postData && event.postData.contents;
  if (!raw) throw backendError('DATABASE_ERROR');
  var request;
  try {
    request = JSON.parse(raw);
  } catch (error) {
    throw backendError('DATABASE_ERROR');
  }
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') throw backendError('DATABASE_ERROR');
  return request;
}

function authorizeRequest(request) {
  var expected = PropertiesService.getScriptProperties().getProperty('RED_EGG_SHARED_SECRET');
  if (!expected || !safeEqual(String(request.sharedSecret || ''), String(expected))) throw backendError('DATABASE_ERROR');
}

function assertCampaignId(settings, campaignId) {
  if (!campaignId || campaignId !== settings.campaign_id) throw backendError('DATABASE_ERROR');
}

function publicCampaign(settings) {
  var counters = publicCounters(settings);
  var now = new Date();
  return {
    title: settings.title,
    prizeDescription: settings.prize_description,
    state: campaignState(settings, now),
    serverNow: now.toISOString(),
    startsAt: new Date(settings.starts_at).toISOString(),
    endsAt: new Date(settings.ends_at).toISOString(),
    timezone: settings.timezone,
    total: TOTAL_CODES,
    counters: counters,
    instructions: settings.instructions,
    screenshotInstructions: settings.screenshot_instructions,
    privacyNotice: settings.privacy_notice,
    privacyNoticeVersion: settings.privacy_notice_version,
    supportContact: settings.support_contact,
  };
}

function publicCounters(settings) {
  var rows = readCodeRecords();
  assertInventory(rows);
  var submitted = rows.filter(function (row) { return row.state !== 'available'; }).length;
  var claimed = rows.filter(function (row) { return row.state === 'claimed'; }).length;
  return {
    total: TOTAL_CODES,
    submitted: submitted,
    remaining: TOTAL_CODES - submitted,
    claimed: claimed,
  };
}

function submitCode(settings, payload) {
  assertCampaignOpen(settings);
  var printedCode = normalizeCode(payload.printedCode);
  var name = normalizeText(payload.name, 120);
  var mobileNumber = normalizeMobile(payload.mobileNumber);
  var requestIdHash = normalizeHash(payload.requestIdHash);
  var payloadHash = normalizeHash(payload.payloadHash);
  var sheet = getSheet(SHEET_NAMES.CODES);
  var rows = readCodeRecords(sheet);
  assertInventory(rows);
  var record = findCode(rows, printedCode);
  if (!record) {
    appendAudit('submission.reject', 'rejected', sha256Hex(printedCode), '');
    throw backendError('INVALID_CODE');
  }
  if (record.state !== 'available') {
    if (record.submission_request_hash === requestIdHash && record.submission_payload_hash === payloadHash) {
      appendAudit('submission.retry', 'success', sha256Hex(printedCode), '');
      return {
        status: 'submitted',
        printedCode: printedCode,
        outcome: 'winning',
        submittedAt: record.submitted_at,
        retry: true,
        counters: publicCounters(settings),
      };
    }
    appendAudit('submission.reject', 'rejected', sha256Hex(printedCode), '');
    return { status: 'already-submitted', printedCode: printedCode, retry: false, counters: publicCounters(settings) };
  }

  record.state = 'submitted-winning';
  record.participant_name = name;
  record.mobile_number = mobileNumber;
  record.submission_request_hash = requestIdHash;
  record.submission_payload_hash = payloadHash;
  record.submitted_at = new Date().toISOString();
  writeCodeRecord(sheet, record);
  appendAudit('submission.record', 'success', sha256Hex(printedCode), '');
  return {
    status: 'submitted',
    printedCode: printedCode,
    outcome: 'winning',
    submittedAt: record.submitted_at,
    retry: false,
    counters: publicCounters(settings),
  };
}

function staffLookup(settings, payload) {
  var printedCode = normalizeCode(payload.printedCode);
  var staffSubject = normalizeText(payload.staffSubject, 160);
  var rows = readCodeRecords();
  assertInventory(rows);
  var record = findCode(rows, printedCode);
  var result = { status: 'invalid' };
  if (record && record.state === 'claimed') result = { status: 'already-claimed', claimedAt: record.claimed_at };
  else if (record && record.state === 'submitted-winning') result = { status: 'submitted-but-unclaimed' };
  else if (record) result = { status: 'available' };
  appendAudit('staff.lookup', result.status === 'invalid' ? 'rejected' : 'success', record ? sha256Hex(printedCode) : '', staffSubject);
  return result;
}

function staffClaim(settings, payload) {
  var printedCode = normalizeCode(payload.printedCode);
  var staffSubject = normalizeText(payload.staffSubject, 160);
  var sheet = getSheet(SHEET_NAMES.CODES);
  var rows = readCodeRecords(sheet);
  assertInventory(rows);
  var record = findCode(rows, printedCode);
  if (!record) {
    appendAudit('staff.claim', 'rejected', sha256Hex(printedCode), staffSubject);
    return { status: 'invalid' };
  }
  if (record.state === 'claimed') {
    appendAudit('staff.claim', 'rejected', sha256Hex(printedCode), staffSubject);
    return { status: 'already-claimed', claimedAt: record.claimed_at };
  }
  if (record.state !== 'submitted-winning') {
    appendAudit('staff.claim', 'rejected', sha256Hex(printedCode), staffSubject);
    return { status: 'available' };
  }
  record.state = 'claimed';
  record.claimed_at = new Date().toISOString();
  record.claimed_by = staffSubject;
  writeCodeRecord(sheet, record);
  appendAudit('staff.claim', 'success', sha256Hex(printedCode), staffSubject);
  return { status: 'claimed', claimedAt: record.claimed_at };
}

function campaignState(settings, now) {
  var instant = now.getTime();
  if (instant < new Date(settings.starts_at).getTime()) return 'locked';
  if (instant >= new Date(settings.ends_at).getTime()) return 'ended';
  return 'live';
}

function assertCampaignOpen(settings) {
  var state = campaignState(settings, new Date());
  if (state === 'locked') throw backendError('CAMPAIGN_LOCKED');
  if (state === 'ended') throw backendError('CAMPAIGN_ENDED');
}

function readSettings() {
  var rows = getSheet(SHEET_NAMES.SETTINGS).getDataRange().getDisplayValues();
  var settings = {};
  rows.slice(1).forEach(function (row) {
    if (row[0]) settings[String(row[0]).trim()] = String(row[1] || '').trim();
  });
  var required = ['campaign_id', 'title', 'prize_description', 'timezone', 'starts_at', 'ends_at', 'instructions', 'screenshot_instructions', 'privacy_notice', 'privacy_notice_version', 'support_contact'];
  required.forEach(function (key) { if (!settings[key]) throw backendError('DATABASE_ERROR'); });
  if (settings.timezone !== 'Asia/Manila' || settings.total_codes !== String(TOTAL_CODES)) throw backendError('INVENTORY_NOT_READY');
  var startsAt = new Date(settings.starts_at).getTime();
  var endsAt = new Date(settings.ends_at).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) throw backendError('INVENTORY_NOT_READY');
  return settings;
}

function readCodeRecords(sheet) {
  var target = sheet || getSheet(SHEET_NAMES.CODES);
  var values = target.getDataRange().getDisplayValues();
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ''; }); }).map(function (row, index) {
    var record = {};
    CODE_HEADERS.forEach(function (header, column) { record[header] = String(row[column] || '').trim(); });
    record.rowNumber = index + 2;
    return record;
  });
}

function assertInventory(rows) {
  if (rows.length !== TOTAL_CODES) throw backendError('INVENTORY_NOT_READY');
  var seen = {};
  rows.forEach(function (row) {
    if (!/^\d{8}$/.test(row.printed_code) || row.outcome !== 'winning' || seen[row.printed_code] || !['available', 'submitted-winning', 'claimed'].includes(row.state)) throw backendError('INVENTORY_NOT_READY');
    seen[row.printed_code] = true;
  });
}

function findCode(rows, printedCode) {
  return rows.filter(function (row) { return row.printed_code === printedCode; })[0] || null;
}

function writeCodeRecord(sheet, record) {
  var values = CODE_HEADERS.map(function (header) { return record[header] || ''; });
  sheet.getRange(record.rowNumber, 1, 1, CODE_HEADERS.length).setValues([values]);
}

function appendAudit(action, outcome, codeHash, staffSubject) {
  getSheet(SHEET_NAMES.AUDIT).appendRow([new Date().toISOString(), action, outcome, codeHash || '', staffSubject || '']);
}

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw backendError('DATABASE_ERROR');
  return SpreadsheetApp.openById(id);
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw backendError('DATABASE_ERROR');
  return sheet;
}

function ensureSheet(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function withScriptLock(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function normalizeCode(value) {
  var code = String(value || '').trim();
  if (!/^\d{8}$/.test(code)) throw backendError('INVALID_CODE');
  return code;
}

function normalizeText(value, maxLength) {
  var text = String(value || '').trim();
  if (!text || text.length > maxLength) throw backendError('DATABASE_ERROR');
  return text;
}

function normalizeMobile(value) {
  var mobile = normalizeText(value, 32).replace(/[\s().-]/g, '');
  if (!/^\+639\d{9}$/.test(mobile)) throw backendError('DATABASE_ERROR');
  return mobile;
}

function normalizeHash(value) {
  var hash = String(value || '').trim();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw backendError('DATABASE_ERROR');
  return hash;
}

function sha256Hex(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0'); }).join('');
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  var difference = 0;
  for (var index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function backendError(code) {
  var error = new Error(code);
  error.code = code;
  return error;
}

function publicMessage(code) {
  var messages = {
    CAMPAIGN_LOCKED: 'The Red Egg Hunt is not open yet.',
    CAMPAIGN_ENDED: 'The Red Egg Hunt is closed for new submissions.',
    INVALID_CODE: 'That printed code is not valid.',
    ALREADY_SUBMITTED: 'This printed code has already been submitted.',
    INVENTORY_NOT_READY: 'The campaign inventory is not ready.',
    DATABASE_ERROR: 'The promotion service is temporarily unavailable.',
  };
  return messages[code] || messages.DATABASE_ERROR;
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
