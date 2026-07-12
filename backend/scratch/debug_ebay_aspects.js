const axios = require('axios');

async function run() {
  try {
    // Let's call our local server API since it has the token and handles eBay calls
    const port = process.env.PORT || 5000;
    const url = `http://localhost:${port}/api/ebay/categories/206/aspects`;
    console.log("Fetching from:", url);
    const res = await axios.get(url);
    console.log("Success:", res.data.success);
    console.log("Data length:", res.data.data ? res.data.data.length : null);
    if (res.data.data) {
      console.log("First 3 aspects:", res.data.data.slice(0, 3).map(a => ({
        name: a.localizedAspectName,
        required: a.aspectConstraint?.aspectRequired,
        valuesCount: a.aspectValues?.length
      })));
    }
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
  }
}

run();
