const mongoose = require('mongoose');

async function testFilterLogic() {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const listings = await mongoose.connection.db.collection('listings').find({}).toArray();
    console.log(`Loaded ${listings.length} listings.`);

    // Simulation helper
    const isPlatformListed = (item, platform) => {
        let id = null;
        if (platform === 'ebay') id = item.ebayListingId;
        else if (platform === 'poshmark') id = item.poshmarkListingId;
        else if (platform === 'depop') id = item.depopListingId;
        else if (platform === 'vinted') id = item.vintedListingId;
        
        return !!id && id !== 'undefined' && id !== 'null' && id !== '';
    };

    const isPlatformDraft = (item, platform) => {
        return item.platform === platform && item.status?.toLowerCase() === 'draft';
    };

    const runFilter = (statusFilter, filterListedOn, filterNoListedOn) => {
        return listings.filter((item) => {
            const statusLower = item.status?.toLowerCase();
            const isPublished = statusLower === 'active' || statusLower === 'published';
            const isUnpublished = statusLower === 'draft' || statusLower === 'failed';

            let matchesStatus = false;
            if (statusFilter === 'all') {
                matchesStatus = true;
            } else if (statusFilter === 'active') {
                matchesStatus = isPublished;
            } else if (statusFilter === 'draft') {
                matchesStatus = statusLower === 'draft';
            } else if (statusFilter === 'failed') {
                matchesStatus = statusLower === 'failed';
            } else if (statusFilter === 'unlisted') {
                matchesStatus = isUnpublished;
            }

            let matchesListedOn = true;
            if (filterListedOn.length > 0) {
                matchesListedOn = filterListedOn.includes(item.platform?.toLowerCase()) && isPublished;
            }

            let matchesNoListedOn = true;
            if (filterNoListedOn.length > 0) {
                matchesNoListedOn = filterNoListedOn.includes(item.platform?.toLowerCase()) && isUnpublished;
            }

            return matchesStatus && matchesListedOn && matchesNoListedOn;
        });
    };

    // Test 1: No Listed On: eBay
    console.log('\n--- Test 1: No Listed On: eBay ---');
    const res1 = runFilter('all', [], ['ebay']);
    console.log(`Results count: ${res1.length}`);
    res1.forEach(l => console.log(`  - "${l.title}" | ebayListingId: ${l.ebayListingId}`));

    // Test 2: No Listed On: Poshmark
    console.log('\n--- Test 2: No Listed On: Poshmark ---');
    const res2 = runFilter('all', [], ['poshmark']);
    console.log(`Results count: ${res2.length}`);
    res2.forEach(l => console.log(`  - "${l.title}" | poshmarkListingId: ${l.poshmarkListingId}`));

    // Test 3: No Listed On: Depop
    console.log('\n--- Test 3: No Listed On: Depop ---');
    const res3 = runFilter('all', [], ['depop']);
    console.log(`Results count: ${res3.length}`);
    res3.forEach(l => console.log(`  - "${l.title}" | depopListingId: ${l.depopListingId}`));

    // Test 4: Listed On: Depop AND No Listed On: Poshmark
    console.log('\n--- Test 4: Listed On: Depop AND No Listed On: Poshmark ---');
    const res4 = runFilter('all', ['depop'], ['poshmark']);
    console.log(`Results count: ${res4.length}`);
    res4.forEach(l => console.log(`  - "${l.title}" | depopListingId: ${l.depopListingId} | poshmarkListingId: ${l.poshmarkListingId}`));

    await mongoose.disconnect();
}

testFilterLogic().catch(console.error);
