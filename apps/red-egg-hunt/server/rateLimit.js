import { AppError } from './errors.js';

export class InMemoryRateLimitStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.buckets = new Map();
  }

  get(key) { return this.buckets.get(key) || null; }
  set(key, value) { this.buckets.set(key, value); }
}

export class RateLimitCoordinator {
  constructor({ store, now = () => Date.now() } = {}) {
    this.store = store || new InMemoryRateLimitStore({ now });
    this.now = now;
  }

  check({ scope, key, limit, windowMs }) {
    const safeKey = `${scope}:${String(key || 'unknown').slice(0, 160)}`;
    const current = this.now();
    const existing = this.store.get(safeKey);
    const bucket = existing && existing.expiresAt > current
      ? existing
      : { count: 0, expiresAt: current + windowMs };
    if (bucket.count >= limit) throw new AppError('RATE_LIMITED', undefined, { status: 429 });
    this.store.set(safeKey, { count: bucket.count + 1, expiresAt: bucket.expiresAt });
    return Object.freeze({ remaining: Math.max(0, limit - bucket.count - 1) });
  }
}
