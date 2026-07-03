const axios = require('axios');

const token = 'Bearer 3a4e20dfd66ef490ae640b87016888648a72a948';

const headers = {
  'Accept': 'application/json',
  'Authorization': token,
  'User-Agent': 'Partner'
};

async function run() {
  const url = 'https://api.depop.com/api/v3/attributes/';
  try {
    console.log(`Querying: ${url}`);
    const res = await axios.get(url, { headers });
    console.log(`Success! Response keys:`, Object.keys(res.data));
    const fs = require('fs');
    fs.writeFileSync(__dirname + '/depop_attributes_response.json', JSON.stringify(res.data, null, 2));
    console.log('Saved response to depop_attributes_response.json');
  } catch (err) {
    console.error(`Failed ${url}:`, err.message, err.response ? err.response.status : '');
    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data).substring(0, 500));
    }
  }
}

run();
