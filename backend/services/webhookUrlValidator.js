const dns = require('dns').promises;
const net = require('net');

// Blocks private, loopback, link-local and metadata IP ranges per the SSRF
// guardrail in the eLister Connect spec. Re-run at delivery time too, not just registration.
function isBlockedIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127) return true; // loopback
    if (parts[0] === 10) return true; // private
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local / cloud metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // private
    if (parts[0] === 192 && parts[1] === 168) return true; // private
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true; // link-local / unique-local
    return false;
  }
  return true; // unparsable - treat as blocked
}

async function assertSafeWebhookUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Webhook URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS.');
  }

  let addresses;
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error('Webhook URL hostname could not be resolved.');
  }
  if (addresses.some(a => isBlockedIp(a.address))) {
    throw new Error('Webhook URL resolves to a disallowed private/internal address.');
  }
  return parsed;
}

module.exports = { assertSafeWebhookUrl, isBlockedIp };
