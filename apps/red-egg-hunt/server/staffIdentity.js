import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

const MAX_TOKEN_BYTES = 16 * 1024;
const REQUIRED_ROLE = 'red-egg:claim';

function encode(value) { return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url'); }
function decode(value) { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
function sign(value, secret) { return createHmac('sha256', secret).update(value, 'utf8').digest('base64url'); }
function equal(left, right) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createStaffSessionToken({ subject, roles = [REQUIRED_ROLE], expiresAt = null }, secret, { now = new Date(), ttlSeconds = 8 * 60 * 60 } = {}) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw new Error('A staff session secret is required.');
  const issuedAt = Math.floor(new Date(now).getTime() / 1000);
  const payload = encode({ subject, roles, iat: issuedAt, exp: expiresAt || issuedAt + ttlSeconds });
  return `${payload}.${sign(payload, secret)}`;
}

function readCookies(request) {
  const header = request?.headers?.cookie || request?.headers?.Cookie || '';
  return Object.fromEntries(header.split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const separator = item.indexOf('=');
    return separator === -1 ? [item, ''] : [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
  }));
}

function verifyToken(token, secret, now) {
  if (typeof token !== 'string' || Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) throw new AppError('UNAUTHORIZED', undefined, { status: 401 });
  const separator = token.lastIndexOf('.');
  if (separator <= 0) throw new AppError('UNAUTHORIZED', undefined, { status: 401 });
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!equal(sign(payload, secret), signature)) throw new AppError('UNAUTHORIZED', undefined, { status: 401 });
  let claims;
  try { claims = decode(payload); } catch { throw new AppError('UNAUTHORIZED', undefined, { status: 401 }); }
  const current = Math.floor(new Date(now).getTime() / 1000);
  if (typeof claims.subject !== 'string' || !claims.subject || !Array.isArray(claims.roles) || !claims.roles.includes(REQUIRED_ROLE) || !Number.isInteger(claims.exp) || claims.exp <= current || claims.iat > current + 60) {
    throw new AppError('UNAUTHORIZED', undefined, { status: 401 });
  }
  return Object.freeze({ subject: claims.subject, roles: claims.roles, expiresAt: new Date(claims.exp * 1000).toISOString() });
}

export function resolveStaffPrincipal(request, { config, now = () => new Date() } = {}) {
  const cookies = readCookies(request);
  const token = cookies[config.staff.sessionCookieName];
  if (token) return verifyToken(token, config.secrets.staffSessionSecret, now());
  if (config.environment === 'local' && config.staff.localTestMode) {
    const localSubject = request?.headers?.['x-red-egg-staff-id'] || request?.headers?.['X-Red-Egg-Staff-Id'];
    if (typeof localSubject === 'string' && /^[A-Za-z0-9._-]{2,80}$/.test(localSubject)) {
      return Object.freeze({ subject: localSubject, roles: [REQUIRED_ROLE], expiresAt: null });
    }
  }
  throw new AppError('UNAUTHORIZED', undefined, { status: 401 });
}

export { REQUIRED_ROLE, verifyToken };
