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
 * Safety: a cluster where two records would both still hold the same platform's ID (a conflict the
 * pairwise matcher did not see directly) is skipped entirely, not guessed at.
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

function platformsOf(doc) {
  return PLATFORMS.filter(p => hasId(doc[`${p}ListingId`]));
}

/**
 * Applies merges for one user. `pairs` is mergeMatcher.suggestPairs() output.
 * Returns a report; writes nothing when `apply` is false.
 */
async function applyMerges(userId, pairs, { apply = true } = {}) {
  const clusters = clusterPairs(pairs);
  const allIds = [...new Set(clusters.flat())];
  const docs = await Listing.find({ _id: { $in: allIds } }).lean();
  const byId = new Map(docs.map(d => [String(d._id), d]));

  const report = { clusters: clusters.length, merged_records: 0, skipped_conflict: [], primaries: [] };
  const ops = [];

  for (const ids of clusters) {
    const members = ids.map(id => byId.get(id)).filter(Boolean);
    if (members.length < 2) continue;

    // Conflict check: across the whole cluster, each platform must appear on at most one record.
    const seenPlatforms = new Map();
    let conflict = null;
    for (const m of members) {
      for (const p of platformsOf(m)) {
        if (seenPlatforms.has(p)) { conflict = p; break; }
        seenPlatforms.set(p, String(m._id));
      }
      if (conflict) break;
    }
    if (conflict) {
      report.skipped_conflict.push({ ids, platform: conflict });
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
    for (const a of absorbed) {
      for (const p of PLATFORMS) {
        if (!hasId(a[`${p}ListingId`])) continue;
        set[`${p}ListingId`] = a[`${p}ListingId`];
        if (a[`${p}Url`]) set[`${p}Url`] = a[`${p}Url`];
        if (a[`${p}Status`]) set[`${p}Status`] = a[`${p}Status`];
        if (a.platformData && a.platformData[p]) set[`platformData.${p}`] = a.platformData[p];
      }
      for (const img of (a.images || [])) images.add(img);
    }
    if (images.size > (primary.images || []).length) set.images = [...images].slice(0, 24);

    if (apply) {
      if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: primary._id }, update: { $set: set } } });
      for (const a of absorbed) {
        ops.push({ updateOne: { filter: { _id: a._id }, update: { $set: { mergedInto: primary._id, updated_at: Date.now() } } } });
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

module.exports = { clusterPairs, applyMerges, PLATFORMS };
