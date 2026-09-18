import { describe, expect, it } from 'vitest';
import { createTestStack, publicSubmission, SECRET } from './helpers.js';

const staff = { subject: 'staff.alice', roles: ['red-egg:claim'] };

describe('protected staff code tracker', () => {
  it('reports invalid, unsubmitted, submitted-but-unclaimed, and already-claimed states', async () => {
    const stack = createTestStack();
    await stack.runtime.campaign.submit(publicSubmission('80000010'), { ip: '198.51.100.10' });
    await expect(stack.runtime.staff.lookup(staff, { printedCode: '99999999' })).resolves.toEqual({ status: 'invalid' });
    await expect(stack.runtime.staff.lookup(staff, { printedCode: '80000010' })).resolves.toEqual({ status: 'submitted-but-unclaimed' });
    await expect(stack.runtime.staff.claim(staff, { printedCode: '80000010', requestId: 'staff-claim-1' })).resolves.toEqual(expect.objectContaining({ status: 'claimed' }));
    await expect(stack.runtime.staff.lookup(staff, { printedCode: '80000010' })).resolves.toEqual(expect.objectContaining({ status: 'already-claimed' }));
  });

  it('never claims an unsubmitted code', async () => {
    const stack = createTestStack();
    await expect(stack.runtime.staff.claim(staff, { printedCode: '80000011', requestId: 'staff-claim-3' })).resolves.toEqual({ status: 'available' });
  });

  it('allows only one simultaneous staff claim and records an auditable staff identity', async () => {
    const stack = createTestStack();
    await stack.runtime.campaign.submit(publicSubmission('80000012'), { ip: '198.51.100.12' });
    const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) => stack.runtime.staff.claim({ subject: `staff.${index}`, roles: ['red-egg:claim'] }, {
      printedCode: '80000012',
      requestId: `staff-concurrent-${String(index).padStart(4, '0')}`,
    })));
    expect(attempts.filter((item) => item.status === 'claimed')).toHaveLength(1);
    expect(attempts.filter((item) => item.status === 'already-claimed')).toHaveLength(11);
    const audit = stack.repository.getAuditEvents().filter((item) => item.action === 'staff.claim');
    expect(audit.some((item) => item.staffSubject)).toBe(true);
    expect(audit.every((item) => !JSON.stringify(item).includes('80000012'))).toBe(true);
  });

  it('accepts a signed staff session but rejects expired or missing sessions', async () => {
    const { createStaffSessionToken, resolveStaffPrincipal } = await import('../../server/staffIdentity.js');
    const stack = createTestStack();
    const token = createStaffSessionToken(staff, SECRET, { now: new Date('2026-09-24T10:00:00.000Z') });
    const request = { headers: { cookie: `${stack.config.staff.sessionCookieName}=${encodeURIComponent(token)}` } };
    expect(resolveStaffPrincipal(request, { config: stack.config, now: () => new Date('2026-09-24T10:01:00.000Z') })).toEqual(expect.objectContaining({ subject: 'staff.alice' }));
    expect(() => resolveStaffPrincipal({ headers: {} }, { config: stack.config, now: () => new Date('2026-09-24T10:01:00.000Z') })).toThrow('Staff access');
    const expired = createStaffSessionToken(staff, SECRET, { now: new Date('2026-09-23T10:00:00.000Z'), ttlSeconds: 10 });
    expect(() => resolveStaffPrincipal({ headers: { cookie: `${stack.config.staff.sessionCookieName}=${expired}` } }, { config: stack.config, now: () => new Date('2026-09-24T10:01:00.000Z') })).toThrow();
  });
});
