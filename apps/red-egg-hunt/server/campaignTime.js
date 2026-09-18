export const CAMPAIGN_STATES = Object.freeze({ LOCKED: 'locked', LIVE: 'live', ENDED: 'ended' });

export function getCampaignState(campaign, now = new Date()) {
  const instant = new Date(now).getTime();
  if (Number.isNaN(instant)) throw new TypeError('A valid server time is required.');
  if (instant < new Date(campaign.startAt).getTime()) return CAMPAIGN_STATES.LOCKED;
  if (instant >= new Date(campaign.endAt).getTime()) return CAMPAIGN_STATES.ENDED;
  return CAMPAIGN_STATES.LIVE;
}

export function serializeCampaignState(campaign, now = new Date()) {
  return Object.freeze({
    state: getCampaignState(campaign, now),
    serverNow: new Date(now).toISOString(),
    startsAt: new Date(campaign.startAt).toISOString(),
    endsAt: new Date(campaign.endAt).toISOString(),
    timezone: campaign.timezone,
  });
}
