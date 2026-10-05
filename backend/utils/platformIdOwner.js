/**
 * One platform listing ID belongs to one Master record. When two records hold the same ID,
 * the oldest record is the owner and the others are duplicates that must not count as live.
 *
 * Input: records as { id, createdAt, platformId }. Output:
 *   owners     - Set of record ids that own their ID (or hold a unique ID)
 *   extras     - Set of record ids that hold an ID already owned by an older record
 *   duplicates - [{ platformId, owner, extras }] for review
 */
function pickOwners(records = []) {
  const byId = new Map();
  for (const r of records) {
    const pid = String(r.platformId || '').trim();
    if (!pid || pid === 'undefined' || pid === 'null') continue;
    if (!byId.has(pid)) byId.set(pid, []);
    byId.get(pid).push(r);
  }

  const owners = new Set();
  const extras = new Set();
  const duplicates = [];
  for (const [pid, arr] of byId) {
    arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    owners.add(String(arr[0].id));
    if (arr.length > 1) {
      const rest = arr.slice(1).map(x => String(x.id));
      rest.forEach(id => extras.add(id));
      duplicates.push({ platformId: pid, owner: String(arr[0].id), extras: rest });
    }
  }
  return { owners, extras, duplicates };
}

module.exports = { pickOwners };
