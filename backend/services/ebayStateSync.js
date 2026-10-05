/**
 * Keeps eBay product records in line with eBay's own lists.
 *
 * eBay's GetMyeBaySelling returns three lists: ActiveList, SoldList and UnsoldList (ended without sale).
 * For every app record with an eBay listing ID:
 *   - in ActiveList  -> ebayState "active"
 *   - in SoldList    -> ebayState "sold"
 *   - in UnsoldList  -> ebayState "ended"
 *   - in none        -> ebayState "removed" (not on eBay any more)
 * Records without an eBay listing ID are local-only and are marked "removed" so the eBay tab does not show them.
 * Nothing is deleted; "removed" records are hidden from the eBay inventory list.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const TRADING_API_URL = 'https://api.ebay.com/ws/api.dll';

const ID_SELECTOR = {
  ActiveList: 'ActiveList > ItemArray > Item > ItemID',
  UnsoldList: 'UnsoldList > ItemArray > Item > ItemID',
  SoldList: 'SoldList > OrderTransactionArray > OrderTransaction > Transaction > Item > ItemID',
};

function buildRequest(token, listType, page) {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <${listType}><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></${listType}>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
}

/**
 * Reads every page of one list. Returns a Set of item IDs, or null if eBay returned an error.
 * Never returns a partial set silently: a failed page makes the whole read null.
 */
async function readListIds(token, listType) {
  const ids = new Set();
  let page = 1;
  let totalPages = 1;
  do {
    const res = await axios.post(TRADING_API_URL, buildRequest(token, listType, page), {
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-IAF-TOKEN': token,
        'Content-Type': 'text/xml'
      },
      timeout: 30000
    });
    const $ = cheerio.load(res.data, { xmlMode: true });
    if (!/Success|Warning/i.test($('Ack').first().text())) return null;
    totalPages = parseInt($(`${listType} > PaginationResult > TotalNumberOfPages`).first().text() || '1', 10);
    $(ID_SELECTOR[listType]).each((_, el) => ids.add($(el).text().trim()));
    page++;
  } while (page <= totalPages && page <= 50);
  return ids;
}

/**
 * Reads Active, Sold and Unsold lists for one eBay token.
 * Returns null if any list could not be read, so the caller changes nothing.
 */
async function readEbayLists(token) {
  const active = await readListIds(token, 'ActiveList');
  const sold = active ? await readListIds(token, 'SoldList') : null;
  const unsold = sold ? await readListIds(token, 'UnsoldList') : null;
  if (!active || !sold || !unsold) return null;
  return { active, sold, unsold };
}

/** Maps one eBay listing ID to its state using the three lists. */
function stateForEbayId(id, lists) {
  if (lists.active.has(id)) return 'active';
  if (lists.sold.has(id)) return 'sold';
  if (lists.unsold.has(id)) return 'ended';
  return 'removed';
}

/**
 * Applies the eBay states to one user's records (and the records of other Elister users linked to the same eBay account).
 * Returns counts, or null if eBay lists could not be read (nothing is changed then).
 */
async function reconcileEbayStates(db, userIds, token) {
  const lists = await readEbayLists(token);
  if (!lists) return null;

  const prodCol = db.collection('products');
  const docs = await prodCol.find(
    { user: { $in: userIds }, $or: [{ source: 'ebay' }, { source: { $exists: false } }] },
    { projection: { ebayListingId: 1, updated_at: 1, createdAt: 1, status: 1 } }
  ).toArray();

  // One eBay ID may have several records: keep the most recent, retire the rest.
  const byId = new Map();
  for (const d of docs) {
    const k = String(d.ebayListingId || '').trim();
    if (!k) continue;
    if (!byId.has(k)) byId.set(k, []);
    byId.get(k).push(d);
  }
  const retire = new Set();
  for (const arr of byId.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => new Date(b.updated_at || b.createdAt || 0) - new Date(a.updated_at || a.createdAt || 0));
    for (const extra of arr.slice(1)) retire.add(String(extra._id));
  }

  const counts = { active: 0, sold: 0, ended: 0, removed: 0 };
  const now = Date.now();
  const ops = docs.map(d => {
    const id = String(d.ebayListingId || '').trim();
    let state = id && !retire.has(String(d._id)) ? stateForEbayId(id, lists) : 'removed';
    counts[state]++;
    return {
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { ebayState: state, status: state === 'active' ? 'active' : 'inactive', updated_at: now } }
      }
    };
  });
  if (ops.length) await prodCol.bulkWrite(ops, { ordered: false });

  return { lists: { active: lists.active.size, sold: lists.sold.size, unsold: lists.unsold.size }, records: docs.length, counts };
}

module.exports = { readEbayLists, reconcileEbayStates, stateForEbayId };
