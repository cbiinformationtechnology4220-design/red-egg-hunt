export class ClientApiError extends Error {
  constructor(message, { code = 'CLIENT_ERROR', status = 0, network = false } = {}) {
    super(message);
    this.name = 'ClientApiError';
    this.code = code;
    this.status = status;
    this.network = network;
  }
}

export async function requestApi(path, { method = 'GET', body, timeoutMs = 15_000, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const options = {
    method,
    signal: controller.signal,
    headers: { Accept: 'application/json', ...headers },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    throw new ClientApiError(error?.name === 'AbortError' ? 'The request timed out. Retry using the same form.' : 'The promotion service could not be reached. Check your connection and retry.', {
      code: error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      network: true,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  let payload = null;
  try { payload = await response.json(); } catch { /* Keep the response generic. */ }
  if (!response.ok) {
    throw new ClientApiError(payload?.error?.message || 'The promotion service returned an error.', {
      code: payload?.error?.code || 'SERVER_ERROR',
      status: response.status,
      network: response.status >= 500,
    });
  }
  if (!payload) throw new ClientApiError('The promotion service returned an invalid response.', { code: 'SERVER_ERROR', network: true });
  return payload;
}

export function requestStaffApi(path, options = {}) { return requestApi(path, options); }
