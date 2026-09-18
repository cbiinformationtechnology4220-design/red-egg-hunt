import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createTestStack, publicSubmission } from './helpers.js';

describe('public privacy and simplified scope contracts', () => {
  it('returns counters and acknowledgement data without participant records or internal identifiers', async () => {
    const stack = createTestStack();
    const result = await stack.runtime.campaign.submit(publicSubmission('80000013'), { ip: '198.51.100.13' });
    const publicCampaign = await stack.runtime.campaign.getPublicCampaign();
    expect(result).toEqual(expect.objectContaining({ outcome: 'winning', printedCode: '80000013' }));
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('mobileNumber');
    expect(result).not.toHaveProperty('participantName');
    expect(publicCampaign).not.toHaveProperty('codes');
    expect(publicCampaign).not.toHaveProperty('records');
    expect(JSON.stringify(result)).not.toContain('09171234567');
    expect(JSON.stringify(publicCampaign)).not.toContain('Maria Santos');
  });

  it('does not retain raw code in audit output or logs', async () => {
    const stack = createTestStack();
    await stack.runtime.campaign.submit(publicSubmission('80000014'), { ip: '198.51.100.14' });
    const events = stack.repository.getAuditEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain('80000014');
    expect(JSON.stringify(events)).not.toContain('Maria Santos');
    expect(JSON.stringify(events)).not.toContain('09171234567');
  });

  it('contains no legacy authentication, POS, private-code, or personal-data URL flow in app source', async () => {
    const files = [
      'src/App.jsx',
      'src/staffApp.jsx',
      'src/api.js',
      'server/campaignService.js',
      'server/staffService.js',
      'server/runtime.js',
    ];
    const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
    const source = contents.join('\n');
    expect(source).not.toMatch(/OTP|one-time password|\bPOS\b|private voucher|participant account/i);
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(source).not.toMatch(/window\.location\.(?:search|hash)/);
  });
});
