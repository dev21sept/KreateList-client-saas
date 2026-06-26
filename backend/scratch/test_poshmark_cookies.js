const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating to poshmark.com...');
  await page.goto('https://poshmark.com/login', { waitUntil: 'networkidle2' });
  
  const cookies = await page.cookies();
  console.log('Cookies set on Poshmark.com login page load:');
  cookies.forEach(c => {
    console.log(`- ${c.name}: domain=${c.domain}, value=${c.value.substring(0, 15)}...`);
  });
  
  await browser.close();
}

run();
