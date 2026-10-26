/**
 * Registry of per-platform automation adapters (Share / Follow / Relist / Offers).
 *
 * Each platform's automation actions go through its own real website calls - there is no shared
 * cross-platform API. An adapter is only wired in here once its actions have a confirmed real
 * request shape (captured from the platform's own web app, never guessed). Until then, the platform
 * is registered with the shared "all capabilities unavailable" stub below so the rest of the
 * automation module (settings, jobs, worker, UI) already understands the platform exists and can
 * show it as "coming soon" instead of 404-ing.
 */

const poshmarkAdapter = require('./poshmarkAutomationService');

class CapabilityNotAvailableError extends Error {
  constructor(platform, capability) {
    super(`CAPABILITY_NOT_AVAILABLE: ${capability} has no confirmed ${platform} endpoint yet.`);
    this.code = 'CAPABILITY_NOT_AVAILABLE';
    this.platform = platform;
    this.capability = capability;
  }
}

function unavailableAdapter(platform) {
  const notAvailable = (capability) => async () => { throw new CapabilityNotAvailableError(platform, capability); };
  return {
    getCapabilities: () => [
      { action: 'share', available: false },
      { action: 'follow', available: false },
      { action: 'relist', available: false },
      { action: 'offer', available: false }
    ],
    shareListing: notAvailable('share'),
    followUser: notAvailable('follow'),
    submitRelist: notAvailable('relist'),
    submitOffer: notAvailable('offer')
  };
}

const ADAPTERS = {
  poshmark: poshmarkAdapter,
  ebay: unavailableAdapter('ebay'),
  mercari: unavailableAdapter('mercari'),
  etsy: unavailableAdapter('etsy'),
  amazon: unavailableAdapter('amazon')
};

function getAdapter(platform) {
  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`Unknown automation platform: ${platform}`);
  return adapter;
}

module.exports = { ADAPTERS, getAdapter, CapabilityNotAvailableError };
