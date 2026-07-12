const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ebayService = require('../services/ebayService');

async function run() {
  try {
    console.log("Getting eBay App Token...");
    const appToken = await ebayService.getAppToken();
    console.log("App Token acquired successfully!");
    
    console.log("Fetching item aspects for category 206...");
    const aspectsData = await ebayService.getItemAspectsForCategory(appToken, '206');
    console.log("Aspects data success:", !!aspectsData);
    if (aspectsData) {
      console.log("Aspects count:", aspectsData.aspects ? aspectsData.aspects.length : 0);
      if (aspectsData.aspects) {
        console.log("First 5 aspect names:", aspectsData.aspects.slice(0, 5).map(a => a.localizedAspectName));
      } else {
        console.log("Full response keys:", Object.keys(aspectsData));
      }
    }
  } catch (err) {
    console.error("Error fetching eBay aspects:", err.message);
    if (err.response) {
      console.error("Response:", err.response.status, err.response.data);
    }
  }
}

run();
