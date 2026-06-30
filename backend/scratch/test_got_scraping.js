(async () => {
  try {
    console.log('Testing got-scraping import...');
    const { gotScraping } = await import('got-scraping');
    console.log('Import successful! gotScraping type:', typeof gotScraping);
    
    console.log('Testing basic GET request to Depop...');
    const res = await gotScraping({
      url: 'https://webapi.depop.com/api/v1/countries/',
      method: 'GET',
      responseType: 'json',
      throwHttpErrors: false
    });
    console.log('Response status:', res.statusCode);
    console.log('Response body length:', JSON.stringify(res.body).length);
  } catch (err) {
    console.error('Error occurred:', err);
  }
})();
