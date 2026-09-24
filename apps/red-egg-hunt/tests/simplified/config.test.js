import { describe, expect, it } from 'vitest';
import { CANONICAL_PRODUCTION_URL, loadConfig, parseOrigin } from '../../server/config.js';

describe('environment contract', () => {
  it('uses loopback local defaults and rejects path-bearing origins', () => {
    const config = loadConfig({ APP_ENV: 'local', PUBLIC_SITE_URL: 'http://localhost:4173' });
    expect(config.publicSiteUrl).toBe('http://localhost:4173');
    expect(config.campaign.totalCodes).toBe(60);
    expect(config.campaign.prizeDescription).toBe('PHP50 cash voucher');
    expect(config.campaign.supportContact).toBe('09952863665');
    expect(() => parseOrigin('https://red-egg-hunt.vercel.app/printed-code', 'production')).toThrow();
  });

  it('requires the canonical production origin and dedicated Google Sheets configuration', () => {
    const base = {
      APP_ENV: 'production',
      PUBLIC_SITE_URL: CANONICAL_PRODUCTION_URL,
      VITE_PUBLIC_SITE_URL: CANONICAL_PRODUCTION_URL,
      DATABASE_PROVIDER: 'google-sheets',
      GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/example/exec',
      GOOGLE_APPS_SCRIPT_SHARED_SECRET: 'g'.repeat(40),
      STAFF_SESSION_SECRET: 't'.repeat(40),
      AUDIT_HASH_SECRET: 'a'.repeat(40),
      RATE_LIMIT_SECRET: 'r'.repeat(40),
      STAFF_LOCAL_TEST_MODE: 'false',
    };
    expect(loadConfig(base).publicSiteUrl).toBe(CANONICAL_PRODUCTION_URL);
    expect(() => loadConfig({ ...base, PUBLIC_SITE_URL: 'https://wrong.example.com', VITE_PUBLIC_SITE_URL: 'https://wrong.example.com' })).toThrow();
  });
});
