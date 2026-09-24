import { AppError } from './errors.js';
import { createAuditEvent } from './audit.js';
import { getCampaignState, CAMPAIGN_STATES } from './campaignTime.js';
import { hashRequestId, hashSubmissionPayload } from './validation.js';

const VALID_OUTCOMES = new Set(['winning']);
const AVAILABLE = 'available';

export function createLocalInventory(totalCodes = 60) {
  return Array.from({ length: totalCodes }, (_, index) => ({
    printedCode: String(70000001 + index),
    outcome: 'winning',
  }));
}

function cloneCounters(totalCodes, records) {
  let submitted = 0;
  let claimed = 0;
  for (const record of records.values()) {
    if (record.state !== AVAILABLE) submitted += 1;
    if (record.state === 'claimed') claimed += 1;
  }
  return Object.freeze({
    total: totalCodes,
    submitted,
    remaining: Math.max(0, totalCodes - submitted),
    claimed,
  });
}

export class InMemoryRedEggRepository {
  constructor({ config, now = () => new Date() } = {}) {
    this.config = config;
    this.now = now;
    this.codes = new Map();
    this.auditEvents = [];
  }

  seedInventory(inventory) {
    if (!Array.isArray(inventory) || inventory.length !== this.config.campaign.totalCodes) {
      throw new Error(`Exactly ${this.config.campaign.totalCodes} inventory codes are required.`);
    }
    this.codes.clear();
    for (const item of inventory) {
      if (!/^\d{8}$/.test(item.printedCode) || !VALID_OUTCOMES.has(item.outcome) || this.codes.has(item.printedCode)) {
        throw new Error('Inventory contains an invalid or duplicate printed code.');
      }
      this.codes.set(item.printedCode, {
        printedCode: item.printedCode,
        outcome: item.outcome,
        state: AVAILABLE,
        participantName: null,
        mobileNumber: null,
        requestIdHash: null,
        payloadHash: null,
        submittedAt: null,
        claimedAt: null,
        claimedBy: null,
      });
    }
  }

  async getPublicCounters() {
    return cloneCounters(this.config.campaign.totalCodes, this.codes);
  }

  _requireCampaignState(now) {
    const state = getCampaignState(this.config.campaign, now);
    if (state === CAMPAIGN_STATES.LOCKED) throw new AppError('CAMPAIGN_LOCKED', undefined, { status: 409 });
    if (state === CAMPAIGN_STATES.ENDED) throw new AppError('CAMPAIGN_ENDED', undefined, { status: 410 });
  }

  _audit(input) {
    this.auditEvents.push(createAuditEvent({ ...input, secret: this.config.secrets.auditHashSecret }));
  }

  async submitCode({ printedCode, name, mobileNumber, requestId, now = this.now() }) {
    this._requireCampaignState(now);
    const record = this.codes.get(printedCode);
    if (!record) {
      this._audit({ action: 'submission.reject', outcome: 'rejected', printedCode, occurredAt: now });
      throw new AppError('INVALID_CODE', undefined, { status: 400 });
    }

    const requestIdHash = hashRequestId(requestId, this.config.secrets.auditHashSecret);
    const payloadHash = hashSubmissionPayload({ name, mobileNumber, printedCode }, this.config.secrets.auditHashSecret);
    if (record.state !== AVAILABLE) {
      if (record.requestIdHash === requestIdHash && record.payloadHash === payloadHash) {
        this._audit({ action: 'submission.retry', outcome: 'success', printedCode, occurredAt: now });
        return {
          outcome: record.outcome,
          printedCode,
          submittedAt: record.submittedAt,
          idempotent: true,
          counters: await this.getPublicCounters(),
        };
      }
      this._audit({ action: 'submission.reject', outcome: 'rejected', printedCode, occurredAt: now });
      return { outcome: 'already-submitted', printedCode, counters: await this.getPublicCounters() };
    }

    record.state = 'submitted-winning';
    record.participantName = name;
    record.mobileNumber = mobileNumber;
    record.requestIdHash = requestIdHash;
    record.payloadHash = payloadHash;
    record.submittedAt = new Date(now).toISOString();
    this._audit({ action: 'submission.record', outcome: 'success', printedCode, occurredAt: now });
    return {
      outcome: record.outcome,
      printedCode,
      submittedAt: record.submittedAt,
      idempotent: false,
      counters: await this.getPublicCounters(),
    };
  }

  _staffStatus(record) {
    if (!record) return Object.freeze({ status: 'invalid' });
    if (record.state === 'claimed') return Object.freeze({ status: 'already-claimed', claimedAt: record.claimedAt });
    if (record.state === 'submitted-winning') return Object.freeze({ status: 'submitted-but-unclaimed' });
    return Object.freeze({ status: 'available' });
  }

  async lookupStaffCode({ printedCode, staffSubject, now = this.now() }) {
    const result = this._staffStatus(this.codes.get(printedCode));
    this._audit({ action: 'staff.lookup', outcome: result.status === 'invalid' ? 'rejected' : 'success', printedCode, staffSubject, occurredAt: now });
    return result;
  }

  async claimCode({ printedCode, staffSubject, now = this.now() }) {
    const record = this.codes.get(printedCode);
    if (!record) {
      this._audit({ action: 'staff.claim', outcome: 'rejected', printedCode, staffSubject, occurredAt: now });
      return Object.freeze({ status: 'invalid' });
    }
    if (record.state === 'claimed') {
      this._audit({ action: 'staff.claim', outcome: 'rejected', printedCode, staffSubject, occurredAt: now });
      return Object.freeze({ status: 'already-claimed', claimedAt: record.claimedAt });
    }
    if (record.state !== 'submitted-winning') {
      this._audit({ action: 'staff.claim', outcome: 'rejected', printedCode, staffSubject, occurredAt: now });
      return Object.freeze({ status: 'available' });
    }

    record.state = 'claimed';
    record.claimedAt = new Date(now).toISOString();
    record.claimedBy = staffSubject;
    this._audit({ action: 'staff.claim', outcome: 'success', printedCode, staffSubject, occurredAt: now });
    return Object.freeze({ status: 'claimed', claimedAt: record.claimedAt });
  }

  getRecord(printedCode) {
    return this.codes.get(printedCode) || null;
  }

  getAuditEvents() {
    return this.auditEvents.slice();
  }
}
