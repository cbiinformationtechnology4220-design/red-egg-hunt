import { createHmac } from 'node:crypto';

const AUDIT_ACTIONS = new Set(['submission.record', 'submission.retry', 'submission.reject', 'staff.lookup', 'staff.claim']);

export function hashPrintedCode(printedCode, secret) {
  return createHmac('sha256', secret).update(printedCode, 'utf8').digest('hex');
}

export function createAuditEvent({ action, outcome, printedCode = null, staffSubject = null, occurredAt = new Date(), secret }) {
  if (!AUDIT_ACTIONS.has(action)) throw new TypeError('Audit action is invalid.');
  if (!['success', 'rejected', 'failure'].includes(outcome)) throw new TypeError('Audit outcome is invalid.');
  return Object.freeze({
    action,
    outcome,
    codeHash: printedCode ? hashPrintedCode(printedCode, secret) : null,
    staffSubject: staffSubject || null,
    occurredAt: new Date(occurredAt).toISOString(),
  });
}
