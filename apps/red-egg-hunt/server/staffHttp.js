import { getRuntime } from './runtime.js';
import { assertSameOrigin, readJsonBody, requireMethod, runApiHandler, sendJson } from './http.js';

export async function runStaffApiHandler(request, response, { method = 'GET', mutating = false } = {}, handler) {
  const runtime = getRuntime();
  return runApiHandler(request, response, async ({ correlationId }) => {
    requireMethod(request, method);
    if (mutating) assertSameOrigin(request, runtime.config, { required: true });
    const principal = runtime.staffIdentity.resolve(request);
    const body = method === 'GET' ? {} : await readJsonBody(request);
    return sendJson(response, 200, await handler({ runtime, principal, body, correlationId }));
  }, { logger: runtime.logger });
}
