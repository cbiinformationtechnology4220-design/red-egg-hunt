import { AppError } from './errors.js';

const BACKEND_ERROR_CODES = new Set([
  'CAMPAIGN_LOCKED',
  'CAMPAIGN_ENDED',
  'INVALID_CODE',
  'ALREADY_SUBMITTED',
  'DATABASE_ERROR',
  'INVENTORY_NOT_READY',
]);

function mapBackendError(code, details = null) {
  if (BACKEND_ERROR_CODES.has(code)) {
    const status = code === 'CAMPAIGN_ENDED'
      ? 410
      : code === 'CAMPAIGN_LOCKED'
        ? 409
        : code === 'DATABASE_ERROR' || code === 'INVENTORY_NOT_READY'
          ? 503
          : 400;
    return new AppError(code, undefined, { status, details });
  }
  return new AppError('DATABASE_ERROR', undefined, { status: 503, details });
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

export class GoogleSheetsRedEggRepository {
  constructor({ config, fetchImpl = globalThis.fetch, timeoutMs = 12_000 } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    if (typeof this.fetchImpl !== 'function') throw new AppError('INVALID_CONFIGURATION', undefined, { status: 500 });
  }

  async call(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(this.config.database.googleAppsScriptUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          campaignId: this.config.campaign.id,
          sharedSecret: this.config.database.googleAppsScriptSharedSecret,
          payload,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new AppError('DATABASE_ERROR', undefined, { status: 503, cause: error });
    } finally {
      clearTimeout(timeout);
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      throw new AppError('DATABASE_ERROR', undefined, { status: 503, cause: error });
    }
    if (!response.ok || body?.ok !== true) {
      throw mapBackendError(body?.error?.code, body?.error?.details);
    }
    return body.data;
  }

  async getPublicCounters() {
    const counters = firstRow(await this.call('counters'));
    if (!counters) throw new AppError('DATABASE_ERROR', undefined, { status: 503 });
    return Object.freeze({
      total: Number(counters.total),
      submitted: Number(counters.submitted),
      remaining: Number(counters.remaining),
      claimed: Number(counters.claimed),
    });
  }

  async getPublicCampaign() {
    const campaign = firstRow(await this.call('campaign'));
    if (!campaign || !campaign.counters) throw new AppError('DATABASE_ERROR', undefined, { status: 503 });
    return Object.freeze(campaign);
  }

  async submitCode({ printedCode, name, mobileNumber, requestIdHash, payloadHash }) {
    const result = await this.call('submit', {
      printedCode,
      name,
      mobileNumber,
      requestIdHash,
      payloadHash,
    });
    if (!result) throw new AppError('DATABASE_ERROR', undefined, { status: 503 });
    const outcome = result.status === 'already-submitted' ? 'already-submitted' : result.outcome;
    return {
      outcome,
      printedCode,
      submittedAt: result.submittedAt || null,
      idempotent: result.retry === true,
      counters: Object.freeze({
        total: Number(result.counters.total),
        submitted: Number(result.counters.submitted),
        remaining: Number(result.counters.remaining),
        claimed: Number(result.counters.claimed),
      }),
    };
  }

  async lookupStaffCode({ printedCode, staffSubject }) {
    return this.call('staffLookup', { printedCode, staffSubject });
  }

  async claimCode({ printedCode, staffSubject }) {
    return this.call('staffClaim', { printedCode, staffSubject });
  }
}

export { mapBackendError };
