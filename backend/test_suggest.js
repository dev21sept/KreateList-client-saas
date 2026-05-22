require('dotenv').config();
const ebayService = require('./services/ebayService');

async function testSuggest() {
  try {
    console.log("Fetching App Token...");
    const appToken = await ebayService.getAppToken();
    console.log("App Token fetched successfully:", appToken.substring(0, 30) + "...");
    
    console.log("Requesting Category Suggestions for 'shoes'...");
    const suggestions = await ebayService.getCategorySuggestions(appToken, 'shoes');
    console.log("Suggestions result count:", suggestions.length);
    console.log("Suggestions preview:", JSON.stringify(suggestions.slice(0, 3), null, 2));
  } catch (err) {
    console.error("Test suggest failed with error:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

testSuggest();
