const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ebayService = require('../services/ebayService');

async function testAspects() {
  const token = await ebayService.getAppToken();
  console.log('App Token length:', token ? token.length : 0);
  const data = await ebayService.getItemAspectsForCategory(token, '57989');
  console.log('Aspects for 57989 count:', data?.aspects?.length);
  if (data?.aspects) {
    console.log('Sample aspects:', data.aspects.slice(0, 5).map(a => ({
      name: a.localizedAspectName,
      usage: a.aspectConstraint?.aspectUsage,
      valuesCount: a.aspectValues?.length,
      sampleValues: a.aspectValues?.slice(0, 5).map(v => v.localizedValue)
    })));
  }
}
testAspects().catch(console.error);
