import { getRuntime } from '../../server/runtime.js';
import { assertSameOrigin, getRequestContext, readJsonBody, requireMethod, runApiHandler, sendJson } from '../../server/http.js';

export default async function submitHandler(request, response) {
  const runtime = getRuntime();
  return runApiHandler(request, response, async () => {
    requireMethod(request, 'POST');
    assertSameOrigin(request, runtime.config, { required: runtime.config.environment !== 'local' });
    const result = await runtime.campaign.submit(await readJsonBody(request), getRequestContext(request));
    return sendJson(response, 200, result);
  }, { logger: runtime.logger });
}
