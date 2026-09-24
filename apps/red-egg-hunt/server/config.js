import { AppError } from './errors.js';

export const CANONICAL_PRODUCTION_URL = 'https://red-egg-hunt.vercel.app';
export const CAMPAIGN_TOTAL_CODES = 60;
const ENVIRONMENTS = new Set(['local', 'preview', 'staging', 'production']);

function optional(value, fallback = undefined) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.trim();
}

function boolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new AppError('INVALID_CONFIGURATION', 'A boolean environment value is invalid.', { status: 500 });
}

function integer(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError('INVALID_CONFIGURATION', 'A numeric environment value is invalid.', { status: 500 });
  }
  return parsed;
}

function parseOrigin(value, environment) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError('INVALID_CONFIGURATION', 'PUBLIC_SITE_URL must be a valid URL.', { status: 500 });
  }

  const host = parsed.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new AppError('INVALID_CONFIGURATION', 'PUBLIC_SITE_URL must contain only an origin.', { status: 500 });
  }
  if (environment === 'local') {
    if (!['http:', 'https:'].includes(parsed.protocol) || (parsed.protocol === 'http:' && !loopback)) {
      throw new AppError('INVALID_CONFIGURATION', 'Local PUBLIC_SITE_URL must use a loopback HTTP or HTTPS origin.', { status: 500 });
    }
  } else if (parsed.protocol !== 'https:' || parsed.port) {
    throw new AppError('INVALID_CONFIGURATION', 'Non-local PUBLIC_SITE_URL must be an HTTPS origin without a port.', { status: 500 });
  }
  return parsed.origin;
}

function parseInstant(value, name) {
  const date = new Date(value);
  if (typeof value !== 'string' || !value.includes('T') || Number.isNaN(date.getTime())) {
    throw new AppError('INVALID_CONFIGURATION', `${name} must be an ISO-8601 timestamp.`, { status: 500 });
  }
  return date;
}

function assertTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
  } catch {
    throw new AppError('INVALID_CONFIGURATION', 'CAMPAIGN_TIMEZONE must be a supported IANA timezone.', { status: 500 });
  }
}

function requireSecret(value, name) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32 || /replace[-_ ]with|example\.(?:com|invalid)/i.test(value)) {
    throw new AppError('INVALID_CONFIGURATION', `${name} must contain at least 32 non-placeholder bytes.`, { status: 500 });
  }
}

function optionalHttpUrl(value, name) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('invalid');
    return parsed.toString();
  } catch {
    throw new AppError('INVALID_CONFIGURATION', `${name} must be a valid HTTP(S) URL.`, { status: 500 });
  }
}

function loadEnvironment(rawEnv) {
  const inferred = rawEnv.APP_ENV || (rawEnv.VERCEL_ENV === 'production' ? 'production' : rawEnv.VERCEL_ENV === 'preview' ? 'preview' : 'local');
  if (!ENVIRONMENTS.has(inferred)) throw new AppError('INVALID_CONFIGURATION', 'APP_ENV is invalid.', { status: 500 });
  return inferred;
}

export function loadConfig(rawEnv = process.env) {
  const environment = loadEnvironment(rawEnv);
  const publicSiteUrl = parseOrigin(optional(rawEnv.PUBLIC_SITE_URL, 'http://localhost:4173'), environment);
  const browserSiteUrl = optional(rawEnv.VITE_PUBLIC_SITE_URL, publicSiteUrl);
  if (environment !== 'local' && browserSiteUrl === publicSiteUrl && !rawEnv.VITE_PUBLIC_SITE_URL) {
    throw new AppError('INVALID_CONFIGURATION', 'VITE_PUBLIC_SITE_URL is required outside local development.', { status: 500 });
  }
  if (parseOrigin(browserSiteUrl, environment) !== publicSiteUrl) {
    throw new AppError('INVALID_CONFIGURATION', 'VITE_PUBLIC_SITE_URL must match PUBLIC_SITE_URL.', { status: 500 });
  }
  if (environment === 'production' && publicSiteUrl !== CANONICAL_PRODUCTION_URL) {
    throw new AppError('INVALID_CONFIGURATION', 'Production must use the approved canonical Red Egg Hunt origin.', { status: 500 });
  }

  const timezone = optional(rawEnv.CAMPAIGN_TIMEZONE, 'Asia/Manila');
  assertTimezone(timezone);
  const startAt = parseInstant(optional(rawEnv.CAMPAIGN_START_AT, '2026-09-24T18:00:00+08:00'), 'CAMPAIGN_START_AT');
  const endAt = parseInstant(optional(rawEnv.CAMPAIGN_END_AT, '2026-10-03T18:00:00+08:00'), 'CAMPAIGN_END_AT');
  if (endAt <= startAt) throw new AppError('INVALID_CONFIGURATION', 'CAMPAIGN_END_AT must be after CAMPAIGN_START_AT.', { status: 500 });

  const databaseProvider = optional(rawEnv.DATABASE_PROVIDER, 'mock');
  if (!['mock', 'google-sheets'].includes(databaseProvider)) throw new AppError('INVALID_CONFIGURATION', 'DATABASE_PROVIDER is invalid.', { status: 500 });
  const googleAppsScriptUrl = optional(rawEnv.GOOGLE_APPS_SCRIPT_URL);
  const googleAppsScriptSharedSecret = optional(rawEnv.GOOGLE_APPS_SCRIPT_SHARED_SECRET);
  if (databaseProvider === 'google-sheets') {
    if (!googleAppsScriptUrl || !googleAppsScriptSharedSecret) throw new AppError('INVALID_CONFIGURATION', 'Google Sheets backend configuration is incomplete.', { status: 500 });
    optionalHttpUrl(googleAppsScriptUrl, 'GOOGLE_APPS_SCRIPT_URL');
    if (environment !== 'local' || googleAppsScriptSharedSecret !== 'local-google-sheets-shared-secret-32-bytes') {
      requireSecret(googleAppsScriptSharedSecret, 'GOOGLE_APPS_SCRIPT_SHARED_SECRET');
    }
  }

  const staffSessionSecret = optional(rawEnv.STAFF_SESSION_SECRET, 'local-red-egg-staff-session-secret-32-bytes');
  const localStaffMode = boolean(rawEnv.STAFF_LOCAL_TEST_MODE, environment === 'local');
  if (environment !== 'local' && localStaffMode) throw new AppError('INVALID_CONFIGURATION', 'Local staff mode is not allowed outside local development.', { status: 500 });
  if (environment === 'production') requireSecret(staffSessionSecret, 'STAFF_SESSION_SECRET');

  const totalCodes = integer(rawEnv.CAMPAIGN_TOTAL_CODES, CAMPAIGN_TOTAL_CODES, { min: CAMPAIGN_TOTAL_CODES, max: CAMPAIGN_TOTAL_CODES });
  const auditHashSecret = optional(rawEnv.AUDIT_HASH_SECRET, staffSessionSecret);
  const rateLimitSecret = optional(rawEnv.RATE_LIMIT_SECRET, staffSessionSecret);
  if (environment === 'production') {
    requireSecret(auditHashSecret, 'AUDIT_HASH_SECRET');
    requireSecret(rateLimitSecret, 'RATE_LIMIT_SECRET');
  }

  return Object.freeze({
    environment,
    publicSiteUrl,
    campaign: Object.freeze({
      id: optional(rawEnv.CAMPAIGN_ID, 'red-egg-hunt-2026'),
      title: optional(rawEnv.CAMPAIGN_TITLE, 'Red Egg Hunt'),
      prizeDescription: optional(rawEnv.CAMPAIGN_PRIZE, 'PHP50 cash voucher'),
      timezone,
      startAt,
      endAt,
      totalCodes,
      instructions: optional(rawEnv.CAMPAIGN_INSTRUCTIONS, 'Find a Red Egg Hunt card, scan the shared QR, and enter the eight-digit code printed beside it. The QR scan does not consume a card; a successful submission does.'),
      screenshotInstructions: optional(rawEnv.CAMPAIGN_SCREENSHOT_INSTRUCTIONS, 'Screenshot this acknowledgement for your records. Do not post your mobile number or other private information publicly.'),
      privacyNotice: optional(rawEnv.CAMPAIGN_PRIVACY_NOTICE, 'We collect your name and mobile number privately to record this entry and support campaign operations. Do not post either detail in a public comment. The approved campaign privacy notice and retention schedule must be in place before launch.'),
      privacyNoticeVersion: optional(rawEnv.PRIVACY_NOTICE_VERSION, 'privacy-notice-draft-1'),
      supportContact: optional(rawEnv.SUPPORT_CONTACT, '09952863665'),
    }),
    database: Object.freeze({ provider: databaseProvider, googleAppsScriptUrl, googleAppsScriptSharedSecret }),
    staff: Object.freeze({
      sessionCookieName: optional(rawEnv.STAFF_SESSION_COOKIE_NAME, 'red_egg_staff_session'),
      localTestMode: localStaffMode,
    }),
    secrets: Object.freeze({ staffSessionSecret, auditHashSecret, rateLimitSecret }),
    public: Object.freeze({ publicSiteUrl, campaignId: optional(rawEnv.CAMPAIGN_ID, 'red-egg-hunt-2026'), campaignTimezone: timezone, environment }),
    optionalLinks: Object.freeze({ supportUrl: optionalHttpUrl(optional(rawEnv.SUPPORT_URL), 'SUPPORT_URL') }),
  });
}

export { parseOrigin };
