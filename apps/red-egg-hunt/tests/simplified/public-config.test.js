import { describe, expect, it } from 'vitest';
import { CANONICAL_PRODUCTION_ORIGIN, normalizeOrigin } from '../../src/publicConfig.js';

describe('browser public origin contract', () => {
  it('allows loopback local origin and exact canonical production origin only', () => {
    expect(normalizeOrigin('http://localhost:4173', 'local')).toBe('http://localhost:4173');
    expect(normalizeOrigin(CANONICAL_PRODUCTION_ORIGIN, 'production')).toBe(CANONICAL_PRODUCTION_ORIGIN);
    expect(() => normalizeOrigin('https://red-egg-hunt.vercel.app/printed-code', 'production')).toThrow();
  });
});
