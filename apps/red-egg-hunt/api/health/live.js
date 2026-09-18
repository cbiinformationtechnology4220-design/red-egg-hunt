import { getRuntime } from '../../server/runtime.js';
import { requireMethod, runApiHandler, sendJson } from '../../server/http.js';

export default async function liveHandler(request, response) {
  const runtime = getRuntime();
  return runApiHandler(request, response, async () => {
    requireMethod(request, 'GET');
    return sendJson(response, 200, { ok: true, service: 'red-egg-hunt', environment: runtime.config.environment });
  }, { logger: runtime.logger });
}
