const axios = require('axios');

const token = 'Bearer c4de3dc9bdda5596218f35ccaec1fb7b3aa6dbu3';

async function run() {
  try {
    console.log('Testing users/me/ endpoint...');
    const res1 = await axios.get('https://webapi.depop.com/api/v1/users/me/', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me/ success:', res1.status, res1.data);
  } catch (err) {
    console.log('users/me/ failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }

  try {
    console.log('Testing auth/session/ endpoint...');
    const res2 = await axios.get('https://webapi.depop.com/api/v1/auth/session/', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('auth/session/ success:', res2.status, res2.data);
  } catch (err) {
    console.log('auth/session/ failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }

  try {
    console.log('Testing users/me/settings/ endpoint...');
    const res3 = await axios.get('https://webapi.depop.com/presentation/api/v1/users/me/settings/', {
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });
    console.log('users/me/settings/ success:', res3.status, res3.data);
  } catch (err) {
    console.log('users/me/settings/ failed:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

run();
