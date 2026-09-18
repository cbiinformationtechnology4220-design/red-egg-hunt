const LOCAL_ORIGIN = 'http://localhost:4173';
const CANONICAL_PRODUCTION_ORIGIN = 'https://red-egg-hunt.vercel.app';

function normalizeOrigin(value, environment = 'local') {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('The public site URL is invalid.'); }
  const host = parsed.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('The public site URL must contain only an origin.');
  if (environment === 'local') {
    if (!['http:', 'https:'].includes(parsed.protocol) || (parsed.protocol === 'http:' && !loopback)) throw new Error('Local public URLs must use a loopback origin.');
  } else if (parsed.protocol !== 'https:' || parsed.port) {
    throw new Error('Non-local public URLs must use HTTPS without a port.');
  }
  return parsed.origin;
}

export function getPublicConfig(raw = import.meta.env || {}) {
  const environment = raw.VITE_APP_ENV || (typeof __RED_EGG_BUILD_ENV__ !== 'undefined' ? __RED_EGG_BUILD_ENV__ : 'local');
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : LOCAL_ORIGIN;
  const publicSiteUrl = normalizeOrigin(raw.VITE_PUBLIC_SITE_URL || currentOrigin, environment);
  if (environment === 'production' && publicSiteUrl !== CANONICAL_PRODUCTION_ORIGIN) throw new Error('The production origin is not the approved Red Egg Hunt URL.');
  return Object.freeze({ publicSiteUrl, environment, campaignTimezone: raw.VITE_CAMPAIGN_TIMEZONE || 'Asia/Manila' });
}

export { CANONICAL_PRODUCTION_ORIGIN, normalizeOrigin };
