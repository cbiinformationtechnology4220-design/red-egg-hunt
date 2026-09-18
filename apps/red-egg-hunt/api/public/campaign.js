import { getRuntime } from '../../server/runtime.js';
import { requireMethod, runApiHandler, sendJson } from '../../server/http.js';

export default async function campaignHandler(request, response) {
  const runtime = getRuntime();
  return runApiHandler(request, response, async () => {
    requireMethod(request, 'GET');
    return sendJson(response, 200, await runtime.campaign.getPublicCampaign());
  }, { logger: runtime.logger });
}
