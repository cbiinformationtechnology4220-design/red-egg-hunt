import { describe, expect, it } from 'vitest';
import { assertSameOrigin, parseCookies } from '../../server/http.js';
import { testConfig } from './helpers.js';

describe('HTTP security boundary', () => {
  it('accepts the configured origin and rejects cross-origin staff mutations', () => {
    const config = testConfig();
    expect(() => assertSameOrigin({ headers: { origin: config.publicSiteUrl } }, config, { required: true })).not.toThrow();
    expect(() => assertSameOrigin({ headers: { origin: 'https://example.invalid' } }, config, { required: true })).toThrow();
    expect(() => assertSameOrigin({ headers: {} }, config, { required: true })).toThrow();
  });

  it('parses only cookies and never treats a participant-style value as staff identity', () => {
    expect(parseCookies({ headers: { cookie: 'red_egg_staff_session=signed-value; other=one' } })).toEqual({ red_egg_staff_session: 'signed-value', other: 'one' });
  });
});
