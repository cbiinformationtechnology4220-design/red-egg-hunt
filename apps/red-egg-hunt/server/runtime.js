import { loadConfig } from './config.js';
import { CampaignService } from './campaignService.js';
import { GoogleSheetsRedEggRepository } from './googleSheetsRepository.js';
import { InMemoryRedEggRepository, createLocalInventory } from './inMemoryRepository.js';
import { createPrivacySafeLogger } from './logging.js';
import { InMemoryRateLimitStore, RateLimitCoordinator } from './rateLimit.js';
import { resolveStaffPrincipal } from './staffIdentity.js';
import { StaffService } from './staffService.js';

let sharedRuntime = null;

function createRepository(config, now, override) {
  if (override) return override;
  if (config.database.provider === 'google-sheets') return new GoogleSheetsRedEggRepository({ config });
  const repository = new InMemoryRedEggRepository({ config, now });
  repository.seedInventory(createLocalInventory(config.campaign.totalCodes));
  return repository;
}

export function createRuntime({ config = loadConfig(), now = () => new Date(), repository: repositoryOverride = null, rateLimiter: rateLimiterOverride = null } = {}) {
  const repository = createRepository(config, now, repositoryOverride);
  const rateLimiter = rateLimiterOverride || new RateLimitCoordinator({
    store: new InMemoryRateLimitStore({ now: () => now().getTime() }),
    now: () => now().getTime(),
  });
  const campaign = new CampaignService({ repository, config, now, rateLimiter });
  const staff = new StaffService({ repository, config, now, rateLimiter });
  return Object.freeze({
    config,
    repository,
    campaign,
    staff,
    staffIdentity: Object.freeze({ resolve: (request) => resolveStaffPrincipal(request, { config, now }) }),
    logger: createPrivacySafeLogger(),
  });
}

export function getRuntime() {
  if (!sharedRuntime) sharedRuntime = createRuntime();
  return sharedRuntime;
}

export function resetRuntime() { sharedRuntime = null; }
