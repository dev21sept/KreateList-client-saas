const axios = require('axios');

const token = 'Bearer c4de3dc9bdda5596218f35ccaec1fb7b3aa6dbu3';

async function run() {
  // Test users/me without trailing slash
  try {
    console.log('Testing users/me (NO trailing slash)...');
    const res1 = await axios.get('https://webapi.depop.com/api/v1/users/me', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me (NO slash) success:', res1.status, res1.data);
  } catch (err) {
    console.log('users/me (NO slash) failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }

  // Test users/me/ with trailing slash
  try {
    console.log('Testing users/me/ (WITH trailing slash)...');
    const res2 = await axios.get('https://webapi.depop.com/api/v1/users/me/', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me/ (WITH slash) success:', res2.status, res2.data);
  } catch (err) {
    console.log('users/me/ (WITH slash) failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

run();
