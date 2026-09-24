import { createRuntime } from '../../server/runtime.js';
import { InMemoryRedEggRepository } from '../../server/inMemoryRepository.js';

const SECRET = 'test-red-egg-secret-with-at-least-32-bytes';

export function testConfig(overrides = {}) {
  const startAt = new Date('2026-09-24T10:00:00.000Z');
  const endAt = new Date('2026-10-03T10:00:00.000Z');
  return {
    environment: 'local',
    publicSiteUrl: 'http://localhost:4173',
    campaign: {
      id: 'red-egg-hunt-test',
      title: 'Red Egg Hunt',
      prizeDescription: 'PHP50 cash voucher',
      timezone: 'Asia/Manila',
      startAt,
      endAt,
      totalCodes: 60,
      instructions: 'Test instructions',
      screenshotInstructions: 'Test screenshot instructions',
      privacyNotice: 'Test privacy notice',
      privacyNoticeVersion: 'test-1',
      supportContact: 'test support',
    },
    database: { provider: 'mock', googleAppsScriptUrl: null, googleAppsScriptSharedSecret: null },
    staff: { sessionCookieName: 'red_egg_staff_session', localTestMode: true },
    secrets: { staffSessionSecret: SECRET, auditHashSecret: SECRET, rateLimitSecret: SECRET },
    public: { publicSiteUrl: 'http://localhost:4173', campaignId: 'red-egg-hunt-test', campaignTimezone: 'Asia/Manila', environment: 'local' },
    ...overrides,
  };
}

export function inventory() {
  return Array.from({ length: 60 }, (_, index) => ({
    printedCode: String(80000001 + index),
    outcome: 'winning',
  }));
}

export function createTestStack({ now = '2026-09-24T10:01:00.000Z', config = testConfig() } = {}) {
  let current = new Date(now);
  const clock = () => new Date(current);
  const repository = new InMemoryRedEggRepository({ config, now: clock });
  repository.seedInventory(inventory());
  const runtime = createRuntime({ config, now: clock, repository });
  return {
    config,
    repository,
    runtime,
    setNow(value) { current = new Date(value); },
  };
}

export function publicSubmission(printedCode, overrides = {}) {
  return {
    name: 'Maria Santos',
    mobileNumber: '09171234567',
    printedCode,
    requestId: `request-${printedCode}`,
    ...overrides,
  };
}

export { SECRET };
