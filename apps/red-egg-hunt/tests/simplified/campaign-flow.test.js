import { describe, expect, it } from 'vitest';
import { createTestStack, publicSubmission } from './helpers.js';

describe('simplified public printed-code flow', () => {
  it('keeps the public campaign locked before opening and does not reveal card outcome', async () => {
    const stack = createTestStack({ now: '2026-09-24T09:59:59.999Z' });
    const campaign = await stack.runtime.campaign.getPublicCampaign();
    expect(campaign.state).toBe('locked');
    await expect(stack.runtime.campaign.submit(publicSubmission('80000001'), { ip: '198.51.100.1' })).rejects.toMatchObject({ code: 'CAMPAIGN_LOCKED' });
    await expect(stack.runtime.campaign.submit(publicSubmission('80000026'), { ip: '198.51.100.2' })).rejects.toMatchObject({ code: 'CAMPAIGN_LOCKED' });
  });

  it('records an all-winning printed-code submission and updates durable counters', async () => {
    const stack = createTestStack();
    const winning = await stack.runtime.campaign.submit(publicSubmission('80000001'), { ip: '198.51.100.3' });
    expect(winning.outcome).toBe('winning');
    expect(winning.counters).toEqual({ total: 50, submitted: 1, remaining: 49, claimed: 0 });
    expect(stack.repository.getRecord('80000001')).toEqual(expect.objectContaining({ state: 'submitted-winning' }));
  });

  it('rejects invalid and malformed codes without changing counters', async () => {
    const stack = createTestStack();
    await expect(stack.runtime.campaign.submit(publicSubmission('8000000'), { ip: '198.51.100.5' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(stack.runtime.campaign.submit(publicSubmission('99999999'), { ip: '198.51.100.5' })).rejects.toMatchObject({ code: 'INVALID_CODE' });
    await expect(stack.runtime.campaign.getPublicCampaign()).resolves.toEqual(expect.objectContaining({ counters: { submitted: 0, remaining: 50, claimed: 0 } }));
  });

  it('allows five different codes for one participant and reports 45 remaining', async () => {
    const stack = createTestStack();
    const results = [];
    for (let index = 1; index <= 5; index += 1) {
      results.push(await stack.runtime.campaign.submit(publicSubmission(`8000000${index}`), { ip: '198.51.100.6' }));
    }
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.outcome === 'winning')).toBe(true);
    expect(results.at(-1).counters).toEqual({ total: 50, submitted: 5, remaining: 45, claimed: 0 });
  });

  it('returns a safe already-submitted state for another request and a safe idempotent retry for the same request', async () => {
    const stack = createTestStack();
    const first = publicSubmission('80000006');
    const saved = await stack.runtime.campaign.submit(first, { ip: '198.51.100.7' });
    const retry = await stack.runtime.campaign.submit(first, { ip: '198.51.100.7' });
    const different = await stack.runtime.campaign.submit({ ...first, name: 'Different Person', mobileNumber: '09181234567' }, { ip: '198.51.100.8' });
    expect(saved.outcome).toBe('winning');
    expect(retry).toEqual(expect.objectContaining({ outcome: 'winning', idempotent: true, printedCode: '80000006' }));
    expect(different).toEqual(expect.objectContaining({ outcome: 'already-submitted', printedCode: '80000006' }));
    expect(different).not.toHaveProperty('submittedAt');
    expect(stack.repository.getRecord('80000006')).toEqual(expect.objectContaining({ participantName: 'Maria Santos' }));
  });

  it('allows exactly one concurrent submission for the same code', async () => {
    const stack = createTestStack();
    const attempts = await Promise.all(Array.from({ length: 20 }, (_, index) => stack.runtime.campaign.submit(publicSubmission('80000007', {
      name: `Person ${index}`,
      mobileNumber: `0917123${String(index).padStart(4, '0')}`,
      requestId: `concurrent-${String(index).padStart(8, '0')}`,
    }), { ip: `198.51.100.${index + 10}` })));
    expect(attempts.filter((result) => result.outcome === 'winning')).toHaveLength(1);
    expect(attempts.filter((result) => result.outcome === 'already-submitted')).toHaveLength(19);
    expect((await stack.runtime.campaign.getPublicCampaign()).counters).toEqual({ submitted: 1, remaining: 49, claimed: 0 });
  });

  it('uses server time only and cannot be opened by a client clock field', async () => {
    const stack = createTestStack({ now: '2026-09-24T09:59:59.000Z' });
    await expect(stack.runtime.campaign.submit({ ...publicSubmission('80000008'), clientNow: '2026-09-24T10:01:00.000Z' }, { ip: '198.51.100.9' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    stack.setNow('2026-09-24T10:00:00.000Z');
    await expect(stack.runtime.campaign.submit(publicSubmission('80000008'), { ip: '198.51.100.9' })).resolves.toEqual(expect.objectContaining({ outcome: 'winning' }));
    stack.setNow('2026-10-03T10:00:00.000Z');
    await expect(stack.runtime.campaign.submit(publicSubmission('80000009'), { ip: '198.51.100.9' })).rejects.toMatchObject({ code: 'CAMPAIGN_ENDED' });
  });
});
