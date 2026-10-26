/**
 * Randomized, human-like delays between automated Poshmark actions (share, follow, offer).
 *
 * A fixed-interval loop (e.g. exactly one share every 3 seconds) is itself a strong automation
 * signal - real sellers pause, read, get distracted, come back. This gives each action a randomized
 * gap within a configured range, plus an occasional longer "break" to mimic a person stepping away,
 * and a per-session action cap so one run never looks like a bot working through a list top to
 * bottom without pause.
 */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns the delay (ms) to wait before the NEXT action, given how many actions have run so far
 * in this job. minMs/maxMs bound the normal gap; every `breakEvery` actions, there's a `breakChance`
 * probability of a much longer pause (breakMinMs-breakMaxMs) instead, simulating a person stepping
 * away mid-session.
 */
function nextDelayMs(actionsSoFar, {
  minMs = 8000,
  maxMs = 45000,
  breakEvery = 12,
  breakChance = 0.35,
  breakMinMs = 3 * 60000,
  breakMaxMs = 12 * 60000
} = {}) {
  if (actionsSoFar > 0 && actionsSoFar % breakEvery === 0 && Math.random() < breakChance) {
    return randomInt(breakMinMs, breakMaxMs);
  }
  return randomInt(minMs, maxMs);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * How many actions a single job run is allowed to take before stopping for this cycle, regardless
 * of how many eligible items remain. A real seller does not share/follow/offer on hundreds of items
 * in one sitting; the rest carry over to the next scheduled run instead of all firing in one burst.
 */
function dailyActionCap(feature) {
  const caps = {
    share_closet: 80,
    follow_users: 40,
    relist: 25,
    offers_to_likers: 30
  };
  return caps[feature] || 30;
}

module.exports = { nextDelayMs, sleep, dailyActionCap, randomInt };
