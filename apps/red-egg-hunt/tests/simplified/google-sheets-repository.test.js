import { describe, expect, it } from 'vitest';
import { GoogleSheetsRedEggRepository } from '../../server/googleSheetsRepository.js';
import { testConfig } from './helpers.js';

function fakeFetch(calls, body, { ok = true, status = 200 } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    return { ok, status, json: async () => body };
  };
}

function config() {
  return testConfig({
    database: {
      provider: 'google-sheets',
      googleAppsScriptUrl: 'https://script.google.com/macros/s/example/exec',
      googleAppsScriptSharedSecret: 'g'.repeat(40),
    },
  });
}

describe('Google Sheets durable adapter', () => {
  it('uses the server-side Apps Script endpoint and does not return participant fields', async () => {
    const calls = [];
    const repository = new GoogleSheetsRedEggRepository({
      config: config(),
      fetchImpl: fakeFetch(calls, {
        ok: true,
        data: {
          status: 'submitted',
          printedCode: '80000001',
          outcome: 'winning',
          submittedAt: '2026-09-24T10:01:00.000Z',
          retry: false,
          counters: { total: 60, submitted: 1, remaining: 59, claimed: 0 },
        },
      }),
    });
    const result = await repository.submitCode({
      printedCode: '80000001',
      name: 'Maria Santos',
      mobileNumber: '+639171234567',
      requestIdHash: 'a'.repeat(64),
      payloadHash: 'b'.repeat(64),
    });
    expect(result).toEqual(expect.objectContaining({ outcome: 'winning', printedCode: '80000001' }));
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('mobileNumber');
    expect(calls[0].url).toContain('script.google.com');
    const request = JSON.parse(calls[0].options.body);
    expect(request).toEqual(expect.objectContaining({ action: 'submit', campaignId: 'red-egg-hunt-test', sharedSecret: 'g'.repeat(40) }));
    expect(request.payload).toEqual(expect.objectContaining({ requestIdHash: 'a'.repeat(64), payloadHash: 'b'.repeat(64) }));
  });

  it('maps an Apps Script backend error without exposing backend details', async () => {
    const repository = new GoogleSheetsRedEggRepository({
      config: config(),
      fetchImpl: fakeFetch([], { ok: false, error: { code: 'DATABASE_ERROR', details: 'private sheet path' } }, { ok: true }),
    });
    await expect(repository.getPublicCounters()).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
  });
});
