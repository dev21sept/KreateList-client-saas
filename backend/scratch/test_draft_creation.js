const mongoose = require('mongoose');
const axios = require('axios');

function getDomainFromCookie(sessionCookie) {
  if (!sessionCookie) return 'poshmark.com';
  const match = sessionCookie.match(/elister_domain=([^;]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return 'poshmark.com';
}

function cleanCookieHeader(sessionCookie) {
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

function getPoshmarkHeaders(sessionCookie, csrfToken) {
  const domain = getDomainFromCookie(sessionCookie);
  const cleanCookie = cleanCookieHeader(sessionCookie);
  return {
    'accept': 'application/json',
    'content-type': 'application/json',
    'cookie': cleanCookie,
    'x-xsrf-token': csrfToken,
    'x-csrf-token': csrfToken,
    'origin': `https://${domain}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': `https://${domain}/create-listing`
  };
}

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.findOne({ 'poshmarkAccount.username': { $exists: true, $ne: '' } });
    if (!u) {
      console.log('No user found');
      process.exit(0);
    }

    const { sessionCookie, csrfToken } = u.poshmarkAccount;
    const domain = getDomainFromCookie(sessionCookie);
    const cleanCookie = cleanCookieHeader(sessionCookie);
    console.log('Cookies being sent:', cleanCookie);
    let activeCookie = sessionCookie;
    console.log('Fetching create-listing page...');
    let draftId = null;
    try {
      const pageRes = await axios.get(`https://${domain}/create-listing`, {
        headers: getPoshmarkHeaders(activeCookie, csrfToken)
      });
      console.log('Page fetch status:', pageRes.status);
      console.log('Final URL:', pageRes.request?.res?.responseUrl || `https://${domain}/create-listing`);
      const html = pageRes.data;
      console.log('HTML length:', html.length);
      console.log('HTML preview:', html.substring(0, 1000));
      
      // Apply the exact extension regex
      const regex = /(?:"?postId"?|"?post_id"?|"?listingId"?|"?listing_id"?|"?draftId"?|"?draft_id"?)\s*[:=]\s*['"]([a-f0-9]{24})['"]/gi;
      let match;
      const regexMatches = [];
      while ((match = regex.exec(html)) !== null) {
        const id = match[1];
        if (id && !id.endsWith('8c10d97b4e1245005764')) {
          regexMatches.push(id);
        }
      }
      console.log('Regex matches found:', regexMatches);
      if (regexMatches.length > 0) {
        draftId = regexMatches[0];
      }
    } catch (pageErr) {
      console.error('Failed to load create-listing page:', pageErr.message);
    }

    if (!draftId) {
      console.log('Fallback: Sending POST to api/v1/posts to generate draft ID...');
      try {
        const res = await axios.post(`https://${domain}/api/v1/posts`, 
          { post: { autolist_draft: false } },
          {
            headers: getPoshmarkHeaders(activeCookie, csrfToken)
          }
        );
        draftId = res.data.post?.id || res.data.id;
        console.log('Fallback api/v1/posts Success. Draft ID:', draftId);
      } catch (err1) {
        console.error('api/v1/posts failed:', err1.response?.status, JSON.stringify(err1.response?.data || err1.message));
        
        console.log('Trying fallback: api/posts...');
        try {
          const res = await axios.post(`https://${domain}/api/posts`, 
            { post: { autolist_draft: false } },
            {
              headers: getPoshmarkHeaders(activeCookie, csrfToken)
            }
          );
          draftId = res.data.post?.id || res.data.id;
          console.log('Fallback api/posts Success. Draft ID:', draftId);
        } catch (err2) {
          console.error('api/posts failed:', err2.response?.status, JSON.stringify(err2.response?.data || err2.message));
        }
      }
    }

    console.log('SUCCESS:', res.status, res.data);
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Headers:', err.response.headers);
      console.error('Response Data:', JSON.stringify(err.response.data));
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
