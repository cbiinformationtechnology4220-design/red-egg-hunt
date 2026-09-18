export class ClientApiError extends Error {
  constructor(message, { code = 'CLIENT_ERROR', status = 0, network = false } = {}) {
    super(message);
    this.name = 'ClientApiError';
    this.code = code;
    this.status = status;
    this.network = network;
  }
}

const CLIENT_ERROR_MESSAGES = Object.freeze({
  REQUEST_TIMEOUT: 'Masyadong mabagal ang request. Subukan ulit kapag stable ang internet.',
  NETWORK_ERROR: 'Hindi maabot ang promo service. Check ang internet at subukan ulit.',
  VALIDATION_ERROR: 'May kulang o maling field. Paki-check ang form.',
  CAMPAIGN_LOCKED: 'Hindi pa bukas ang Red Egg Hunt.',
  CAMPAIGN_ENDED: 'Closed na ang Red Egg Hunt para sa bagong submissions.',
  INVALID_CODE: 'Hindi valid ang printed code na iyan.',
  ALREADY_SUBMITTED: 'Na-submit na ang printed code na iyan.',
  DATABASE_ERROR: 'May aberya sa promo service. Subukan ulit mamaya.',
  INTERNAL_ERROR: 'May aberya sa promo service. Subukan ulit mamaya.',
});

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
    throw new ClientApiError(error?.name === 'AbortError' ? CLIENT_ERROR_MESSAGES.REQUEST_TIMEOUT : CLIENT_ERROR_MESSAGES.NETWORK_ERROR, {
      code: error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      network: true,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  let payload = null;
  try { payload = await response.json(); } catch { /* Keep the response generic. */ }
  if (!response.ok) {
    const code = payload?.error?.code || 'SERVER_ERROR';
    throw new ClientApiError(CLIENT_ERROR_MESSAGES[code] || payload?.error?.message || 'May aberya sa promo service. Subukan ulit mamaya.', {
      code,
      status: response.status,
      network: response.status >= 500,
    });
  }
  if (!payload) throw new ClientApiError('Hindi kumpleto ang response ng promo service. Subukan ulit.', { code: 'SERVER_ERROR', network: true });
  return payload;
}

export function requestStaffApi(path, options = {}) { return requestApi(path, options); }
