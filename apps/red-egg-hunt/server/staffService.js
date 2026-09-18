import { validateCodeInput } from './validation.js';

export class StaffService {
  constructor({ repository, config, now = () => new Date(), rateLimiter }) {
    this.repository = repository;
    this.config = config;
    this.now = now;
    this.rateLimiter = rateLimiter;
  }

  getSession(principal) {
    return Object.freeze({ authenticated: true, staffSubject: principal.subject, roles: principal.roles });
  }

  async lookup(principal, input) {
    const data = validateCodeInput(input);
    this.rateLimiter?.check({ scope: 'staff-lookup', key: principal.subject, limit: 60, windowMs: 60_000 });
    return this.repository.lookupStaffCode({ printedCode: data.printedCode, staffSubject: principal.subject, now: this.now() });
  }

  async claim(principal, input) {
    const data = validateCodeInput(input);
    this.rateLimiter?.check({ scope: 'staff-claim', key: principal.subject, limit: 30, windowMs: 60_000 });
    return this.repository.claimCode({ printedCode: data.printedCode, staffSubject: principal.subject, now: this.now() });
  }
}
