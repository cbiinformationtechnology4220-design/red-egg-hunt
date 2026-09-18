import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Google Sheets backend source contract', () => {
  it('defines exactly 50 winning codes, locked submission, one-time claim, counters, and private audit storage', async () => {
    const script = await readFile('google-apps-script/Code.gs', 'utf8');
    expect(script).toContain('var TOTAL_CODES = 50;');
    expect(script).toContain("var CODE_HEADERS = [");
    expect(script).toContain("'printed_code'");
    expect(script).toContain("'participant_name'");
    expect(script).toContain("'mobile_number'");
    expect(script).toContain("LockService.getScriptLock()");
    expect(script).toContain("state = 'submitted-winning'");
    expect(script).toContain("state = 'claimed'");
    expect(script).toContain('publicCounters');
    expect(script).toContain('appendAudit');
    expect(script).not.toMatch(/bokya|supabase|otp|\bpos\b|comment_verification/i);
  });
});
