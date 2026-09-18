const SENSITIVE_KEY = /(authorization|cookie|mobile|name|phone|printed.?code|request.?id|secret|token|payload)/i;
const MAX_STRING_LENGTH = 300;

function sanitize(value, key = '', depth = 0) {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (depth > 3) return '[truncated]';
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey, depth + 1)]));
  return '[unsupported]';
}

export function sanitizeLogFields(fields = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return sanitize(fields);
}

export function createPrivacySafeLogger({ sink = (line) => console.log(line), clock = () => new Date() } = {}) {
  const write = (level, message, fields = {}) => sink(JSON.stringify({
    timestamp: clock().toISOString(),
    level,
    message: typeof message === 'string' ? message.slice(0, MAX_STRING_LENGTH) : 'event',
    ...sanitizeLogFields(fields),
  }));
  return Object.freeze({
    info(message, fields) { write('info', message, fields); },
    warn(message, fields) { write('warn', message, fields); },
    error(message, fields) { write('error', message, fields); },
  });
}

export { SENSITIVE_KEY };
