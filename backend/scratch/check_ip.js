(async () => {
  try {
    console.log('Checking the IP address that Node.js is using...');
    const { gotScraping } = await import('got-scraping');
    const res = await gotScraping({
      url: 'https://api.ipify.org?format=json',
      method: 'GET',
      responseType: 'json'
    });
    console.log('IP Address used by Node.js:', res.body.ip);
  } catch (err) {
    console.error('Error checking IP:', err);
  }
})();
