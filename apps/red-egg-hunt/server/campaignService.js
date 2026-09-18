import { AppError } from './errors.js';
import { getCampaignState, serializeCampaignState } from './campaignTime.js';
import { hashRequestId, hashSubmissionPayload, validateSubmission } from './validation.js';

export class CampaignService {
  constructor({ repository, config, now = () => new Date(), rateLimiter }) {
    this.repository = repository;
    this.config = config;
    this.now = now;
    this.rateLimiter = rateLimiter;
  }

  async getPublicCampaign() {
    if (typeof this.repository.getPublicCampaign === 'function') return this.repository.getPublicCampaign();
    const now = this.now();
    const counters = await this.repository.getPublicCounters();
    return Object.freeze({
      title: this.config.campaign.title,
      prizeDescription: this.config.campaign.prizeDescription,
      ...serializeCampaignState(this.config.campaign, now),
      total: this.config.campaign.totalCodes,
      counters: {
        submitted: counters.submitted,
        remaining: counters.remaining,
        claimed: counters.claimed,
      },
      instructions: this.config.campaign.instructions,
      screenshotInstructions: this.config.campaign.screenshotInstructions,
      privacyNotice: this.config.campaign.privacyNotice,
      privacyNoticeVersion: this.config.campaign.privacyNoticeVersion,
      supportContact: this.config.campaign.supportContact,
    });
  }

  async submit(input, requestContext = {}) {
    const data = validateSubmission(input);
    this.rateLimiter?.check({ scope: 'submission-ip', key: requestContext.ip || 'unknown', limit: 20, windowMs: 60_000 });
    // The inventory row and database lock are the duplicate-submission guard.
    // Keep this abuse limit above a legitimate opening-time burst so it never
    // replaces the atomic state transition with a process-local decision.
    this.rateLimiter?.check({ scope: 'submission-code', key: data.printedCode, limit: 100, windowMs: 60_000 });
    if (this.config.database.provider !== 'google-sheets') {
      const state = getCampaignState(this.config.campaign, this.now());
      if (state === 'locked') throw new AppError('CAMPAIGN_LOCKED', undefined, { status: 409 });
      if (state === 'ended') throw new AppError('CAMPAIGN_ENDED', undefined, { status: 410 });
    }

    const requestIdHash = hashRequestId(data.requestId, this.config.secrets.auditHashSecret);
    const payloadHash = hashSubmissionPayload(data, this.config.secrets.auditHashSecret);
    return this.repository.submitCode({
      ...data,
      requestIdHash,
      payloadHash,
      now: this.now(),
    });
  }
}
