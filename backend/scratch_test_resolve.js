const axios = require('axios');

const token = 'Bearer c4de3dc9bdda5596218f35ccaec1fb7b3aa6dbu3';

async function run() {
  // Test users/me without v1
  try {
    console.log('Testing users/me (NO v1)...');
    const res1 = await axios.get('https://webapi.depop.com/api/users/me', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me (NO v1) success:', res1.status, res1.data);
  } catch (err) {
    console.log('users/me (NO v1) failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }

  // Test users/me with v1
  try {
    console.log('Testing users/me (WITH v1)...');
    const res2 = await axios.get('https://webapi.depop.com/api/v1/users/me', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me (WITH v1) failed:', res2.response ? res2.response.status : res2.message, res2.response ? res2.response.data : '');
  } catch (err) {
    console.log('users/me (WITH v1) failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

run();
