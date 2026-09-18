import { randomUUID } from 'node:crypto';
import { AppError, publicError } from './errors.js';

export function requireMethod(request, method) {
  if ((request?.method || 'GET').toUpperCase() !== method) throw new AppError('METHOD_NOT_ALLOWED', undefined, { status: 405 });
}

export function getHeader(request, name) {
  const headers = request?.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || null;
}

export function getRequestContext(request) {
  const forwarded = getHeader(request, 'x-forwarded-for');
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim().slice(0, 80) : getHeader(request, 'x-real-ip') || 'unknown';
  return Object.freeze({ ip: String(ip || 'unknown') });
}

export async function readJsonBody(request) {
  if (request?.body && typeof request.body === 'object') return request.body;
  if (!request || typeof request.on !== 'function') return {};
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 16 * 1024) throw new AppError('VALIDATION_ERROR', undefined, { status: 413 });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('VALIDATION_ERROR', undefined, { status: 400 }); }
}

export function assertSameOrigin(request, config, { required = false } = {}) {
  const origin = getHeader(request, 'origin');
  if (!origin) {
    if (required) throw new AppError('FORBIDDEN', undefined, { status: 403 });
    return;
  }
  let parsed;
  try { parsed = new URL(origin); } catch { throw new AppError('FORBIDDEN', undefined, { status: 403 }); }
  if (parsed.origin !== config.publicSiteUrl) throw new AppError('FORBIDDEN', undefined, { status: 403 });
}

export function sendJson(response, status, body) {
  response.status(status).setHeader('Cache-Control', 'no-store').json(body);
  return response;
}

export async function runApiHandler(request, response, handler, { logger = null } = {}) {
  const correlationId = randomUUID();
  try {
    return await handler({ correlationId });
  } catch (error) {
    const safe = publicError(error);
    logger?.warn('red_egg_api_request_failed', { correlationId, errorCode: safe.body.error.code, status: safe.status });
    return sendJson(response, safe.status, safe.body);
  }
}

export function parseCookies(request) {
  const value = getHeader(request, 'cookie');
  if (typeof value !== 'string') return {};
  return Object.fromEntries(value.split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const separator = item.indexOf('=');
    if (separator === -1) return [item, ''];
    return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
  }));
}
