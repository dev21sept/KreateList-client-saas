/**
 * Applies verified merge pairs (from mergeMatcher.suggestPairs) to the Master.
 *
 * Pairs are grouped into clusters (A-B matched, B-C matched -> one cluster of three), because the
 * same physical item can have more than two platform listings. Within a cluster, one record becomes
 * the primary (the one with the most platform IDs already, oldest first on a tie); the rest are
 * folded into it: any platform the primary does not already have is copied over from an absorbed
 * record, and the absorbed record is marked mergedInto instead of being deleted, so it disappears
 * from the Master list but the merge can be undone by clearing that field.
 *
 * Safety: a cluster where two records would both still hold the same platform's ID (e.g. a seller
 * with two physical units cross-listed under the same title/size) is not guessed at by matching
 * logic alone. The conflicting platform's holders are instead ranked by closeness - price first,
 * listing date as a tiebreaker - against the rest of the cluster, and only the closest one stays;
 * the others are set aside as their own separate listings rather than dragging the whole cluster
 * down. A cluster with no way to tell the holders apart (no usable price or date on either side)
 * is still skipped, not guessed at.
 */

const Listing = require('../models/Listing');

const PLATFORMS = ['ebay', 'poshmark', 'mercari', 'etsy', 'depop', 'amazon'];

function find(parent, x) {
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));
    x = parent.get(x);
  }
  return x;
}

function union(parent, a, b) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

/** Groups scored pairs (from mergeMatcher.suggestPairs) into clusters of record ids. */
function clusterPairs(pairs) {
  const parent = new Map();
  const ensure = (id) => { if (!parent.has(id)) parent.set(id, id); };
  for (const p of pairs) {
    ensure(p.a); ensure(p.b);
    union(parent, p.a, p.b);
  }
  const groups = new Map(); // root -> Set of ids
  for (const id of parent.keys()) {
    const root = find(parent, id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(id);
  }
  return [...groups.values()].filter(g => g.size > 1).map(g => [...g]);
}

const hasId = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined' && String(v) !== 'null';

// Live only: a delisted/ended ID left on the document is not a real claim on that platform - it is
// exactly the stale leftover a merge is supposed to replace, not a second holder to pick between.
function platformsOf(doc) {
  return PLATFORMS.filter(p => hasId(doc[`${p}ListingId`]) && doc[`${p}Status`] === 'published');
}

/**
 * How well `m` fits with `others` (the rest of a cluster), for ranking which of several same-
 * platform holders to keep. Returns { price, date }: the average relative price difference (0 =
 * identical) and average days apart from createdAt, each null when there is nothing to compare
 * (missing price/date on either side). Lower is a better fit on both.
 */
function closenessTo(m, others) {
  const mp = parseFloat(m.price);
  const priceDiffs = others
    .map(o => parseFloat(o.price))
    .filter(op => mp && op)
    .map(op => Math.abs(mp - op) / Math.max(mp, op));
  const price = priceDiffs.length ? priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length : null;

  const mDate = m.createdAt ? new Date(m.createdAt).getTime() : null;
  const dateDiffs = others
    .map(o => (o.createdAt ? new Date(o.createdAt).getTime() : null))
    .filter(od => mDate && od)
    .map(od => Math.abs(mDate - od) / 86400000); // days
  const date = dateDiffs.length ? dateDiffs.reduce((a, b) => a + b, 0) / dateDiffs.length : null;

  return { price, date };
}

/** Lexicographic compare: closer price wins; a missing price loses to a present one. Date breaks ties. */
function compareCloseness(a, b) {
  if (a.price !== b.price) {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  }
  if (a.date === b.date) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date - b.date;
}

/**
 * Resolves platform conflicts within a cluster by ranked closeness instead of giving up on the
 * whole thing. Returns { members, setAside }: members is the conflict-free subset to merge (maybe
 * the whole input), setAside is whichever same-platform holders lost the ranking (left as their
 * own separate listings) or - when a conflict has no usable price/date signal on any side - the
 * entire cluster, matching the old all-or-nothing behavior for that unresolvable case.
 */
function resolveConflicts(members) {
  members = members.slice();
  const setAside = [];
  let guard = members.length; // at most one platform resolved per pass, so this always terminates
  while (guard-- > 0) {
    const holdersByPlatform = new Map();
    for (const m of members) {
      for (const p of platformsOf(m)) {
        if (!holdersByPlatform.has(p)) holdersByPlatform.set(p, []);
        holdersByPlatform.get(p).push(m);
      }
    }
    const conflicted = [...holdersByPlatform.entries()].find(([, holders]) => holders.length > 1);
    if (!conflicted) return { members, setAside };

    const [, holders] = conflicted;
    const others = members.filter(m => !holders.includes(m));
    const ranked = holders
      .map(h => ({ member: h, score: closenessTo(h, others) }))
      .sort((a, b) => compareCloseness(a.score, b.score));

    if (ranked[0].score.price === null && ranked[0].score.date === null) {
      // No candidate has any usable signal against the rest of the cluster - nothing to rank by.
      return { members: [], setAside: members };
    }

    const [keep, ...drop] = ranked.map(r => r.member);
    setAside.push(...drop);
    members = members.filter(m => !drop.includes(m));
  }
  return { members, setAside };
}

/**
 * Applies merges for one user. `pairs` is mergeMatcher.suggestPairs() output.
 * Returns a report; writes nothing when `apply` is false.
 */
async function applyMerges(userId, pairs, { apply = true } = {}) {
  const clusters = clusterPairs(pairs);
  const allIds = [...new Set(clusters.flat())];
  // Scoped to this user: a record id that does not belong to them is simply not found, never touched.
  const docs = await Listing.find({ _id: { $in: allIds }, user: userId }).lean();
  const byId = new Map(docs.map(d => [String(d._id), d]));

  const report = { clusters: clusters.length, merged_records: 0, skipped_conflict: [], setAside: [], primaries: [] };
  const ops = [];

  for (const ids of clusters) {
    const rawMembers = ids.map(id => byId.get(id)).filter(Boolean);
    if (rawMembers.length < 2) continue;

    const { members, setAside } = resolveConflicts(rawMembers);
    if (setAside.length) {
      report.setAside.push({ ids, setAside: setAside.map(m => String(m._id)) });
    }
    if (members.length < 2) {
      report.skipped_conflict.push({ ids, reason: 'no usable price/date signal to resolve the conflict' });
      continue;
    }

    // Primary: most platform IDs already, oldest created on a tie.
    members.sort((a, b) => {
      const diff = platformsOf(b).length - platformsOf(a).length;
      if (diff !== 0) return diff;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
    const primary = members[0];
    const absorbed = members.slice(1);

    const set = {};
    const images = new Set(primary.images || []);
    // Per-absorbed-record field clearing: once a platform id moves to the primary, the absorbed
    // record must not keep its own copy, or a duplicate-id check elsewhere (masterStatusSync) could
    // treat the absorbed (often older) record as the "owner" and flip the primary back to unlisted.
    const unsetByAbsorbed = new Map();
    for (const a of absorbed) {
      const unset = {};
      for (const p of PLATFORMS) {
        if (!hasId(a[`${p}ListingId`])) continue;
        set[`${p}ListingId`] = a[`${p}ListingId`];
        if (a[`${p}Url`]) set[`${p}Url`] = a[`${p}Url`];
        if (a[`${p}Status`]) set[`${p}Status`] = a[`${p}Status`];
        if (a.platformData && a.platformData[p]) set[`platformData.${p}`] = a.platformData[p];
        unset[`${p}ListingId`] = '';
        unset[`${p}Url`] = '';
        unset[`${p}Status`] = '';
      }
      unsetByAbsorbed.set(String(a._id), unset);
      for (const img of (a.images || [])) images.add(img);
    }
    if (images.size > (primary.images || []).length) set.images = [...images].slice(0, 24);

    if (apply) {
      if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: primary._id }, update: { $set: set } } });
      for (const a of absorbed) {
        const unset = unsetByAbsorbed.get(String(a._id)) || {};
        const update = { $set: { mergedInto: primary._id, updated_at: Date.now() } };
        if (Object.keys(unset).length) update.$unset = unset;
        ops.push({ updateOne: { filter: { _id: a._id }, update } });
      }
    }
    report.merged_records += absorbed.length;
    report.primaries.push({ primary: String(primary._id), absorbed: absorbed.map(a => String(a._id)) });
  }

  if (apply && ops.length) {
    for (let i = 0; i < ops.length; i += 500) await Listing.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }
  return report;
}

module.exports = { clusterPairs, applyMerges, resolveConflicts, PLATFORMS };
