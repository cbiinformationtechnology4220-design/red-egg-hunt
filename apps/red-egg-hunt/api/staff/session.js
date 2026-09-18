import { getRuntime } from '../../server/runtime.js';
import { requireMethod, runApiHandler, sendJson } from '../../server/http.js';

export default async function staffSessionHandler(request, response) {
  const runtime = getRuntime();
  return runApiHandler(request, response, async () => {
    requireMethod(request, 'GET');
    const principal = runtime.staffIdentity.resolve(request);
    return sendJson(response, 200, runtime.staff.getSession(principal));
  }, { logger: runtime.logger });
}
