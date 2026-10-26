/**
 * Capability-gated Poshmark Automation adapter (Share / Follow / Relist / Offers).
 *
 * Poshmark has no public partner API for these actions. This calls the same vm-rest endpoints
 * Poshmark's own web app calls, server-side, using the seller's own stored session cookie - the
 * same mechanism already used in backendPublishService.js for publish/delist/reactivate. The share
 * endpoint below was confirmed from a real, user-captured browser request (PUT
 * /vm-rest/users/self/shared_posts/{id}), not guessed.
 *
 * Only implement a method here once its real request shape has been confirmed this way. An
 * unconfirmed capability must return CAPABILITY_NOT_AVAILABLE rather than a best-effort guess -
 * a wrong guess either silently no-ops or, worse, hits some other real endpoint.
 */

const axios = require('axios');
const {
  getPoshmarkHeaders,
  getDomainFromCookie
} = require('./backendPublishService');

const PM_VERSION = '2026.43.00';

class CapabilityNotAvailableError extends Error {
  constructor(capability) {
    super(`CAPABILITY_NOT_AVAILABLE: ${capability} has no confirmed Poshmark endpoint yet.`);
    this.code = 'CAPABILITY_NOT_AVAILABLE';
    this.capability = capability;
  }
}

function getCapabilities() {
  return [
    { action: 'share', available: true },
    { action: 'follow', available: false },
    { action: 'relist', available: false },
    { action: 'offer', available: false }
  ];
}

/**
 * Shares one listing to the seller's own followers (the "Share to Followers" action on the
 * listing/closet page). Confirmed request: PUT /vm-rest/users/self/shared_posts/{postId}, body {}.
 */
async function shareListing(poshmarkListingId, poshmarkAccount) {
  const { sessionCookie, csrfToken } = poshmarkAccount;
  if (!sessionCookie || !csrfToken) {
    throw new Error('Poshmark cookies are missing. Please reconnect your Poshmark account.');
  }

  const domain = getDomainFromCookie(sessionCookie) || 'poshmark.com';
  const headers = getPoshmarkHeaders(sessionCookie, csrfToken);
  headers.Referer = `https://${domain}/closet/self`;

  // Poshmark does not block this server's IP (confirmed throughout this app's existing, reliably-
  // working closet-scrape code, which also connects directly) - only Mercari needs the proxy, for
  // its Cloudflare check. Routing Poshmark calls through the proxy too just adds an extra point of
  // failure (the proxy itself is intermittently unavailable) for no benefit here.
  try {
    const res = await axios.put(
      `https://${domain}/vm-rest/users/self/shared_posts/${poshmarkListingId}?pm_version=${PM_VERSION}`,
      {},
      { headers, timeout: 20000 }
    );
    return { success: true, status: res.status, data: res.data };
  } catch (err) {
    const status = err.response?.status;
    // 404/410: the listing is gone from Poshmark (sold/deleted elsewhere) - a confirmed "can't share
    // this", not a transient failure worth retrying.
    if (status === 404 || status === 410) {
      return { success: false, permanent: true, status, message: 'Listing not found on Poshmark.' };
    }
    // 401/403: session is no longer valid - the whole account needs reconnecting, not a per-item retry.
    if (status === 401 || status === 403) {
      const authErr = new Error('Poshmark session expired or rejected. Please reconnect your account.');
      authErr.code = 'AUTH_INVALID';
      throw authErr;
    }
    // Anything else (timeout, 5xx, network) is transient: let the caller decide whether to retry.
    return { success: false, permanent: false, status: status || null, message: err.message };
  }
}

async function followUser() {
  throw new CapabilityNotAvailableError('follow');
}

async function submitRelist() {
  throw new CapabilityNotAvailableError('relist');
}

async function submitOffer() {
  throw new CapabilityNotAvailableError('offer');
}

module.exports = {
  CapabilityNotAvailableError,
  getCapabilities,
  shareListing,
  followUser,
  submitRelist,
  submitOffer
};
