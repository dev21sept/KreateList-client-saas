const cheerio = require('cheerio');

// Recursive helper to find anything resembling a product array inside NextData JSON
function findProductsInNextData(obj) {
  let products = [];
  
  function recurse(current) {
    if (!current || typeof current !== 'object') return;
    
    // Check if current is an array
    if (Array.isArray(current)) {
      // Check if first element in array looks like a product (has key indicators)
      const hasIndicators = current.length > 0 && current[0] && typeof current[0] === 'object' &&
        (('id' in current[0] || 'slug' in current[0]) && 
         ('price' in current[0] || 'priceAmount' in current[0] || 'price_amount' in current[0]) &&
         ('images' in current[0] || 'pictures' in current[0] || 'picture_ids' in current[0]));
      
      if (hasIndicators) {
        products = current;
        return;
      }
      for (const item of current) {
        recurse(item);
      }
    } else {
      // Check for common array keys
      if (current.products && Array.isArray(current.products)) {
        products = current.products;
        return;
      }
      if (current.results && Array.isArray(current.results) && current.results.length > 0 && current.results[0].slug) {
        products = current.results;
        return;
      }
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          recurse(current[key]);
        }
      }
    }
  }
  
  recurse(obj);
  return products;
}

// Depop Parser logic from service
function parseDepopHtml(htmlString) {
  const $ = cheerio.load(htmlString);
  const listings = [];

  // 1. Try __NEXT_DATA__ JSON parsing
  const nextDataScript = $('#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const rawProducts = findProductsInNextData(nextData);
      
      if (rawProducts && rawProducts.length > 0) {
        for (const item of rawProducts) {
          const slug = item.slug || '';
          const title = item.title || item.slug?.replace(/-/g, ' ') || 'Depop Item';
          const description = item.description || item.body || title;
          const depopId = String(item.id || item.productId || '');
          const depopUrl = slug ? `https://www.depop.com/products/${slug}/` : `https://www.depop.com/products/${depopId}/`;
          
          let imageUrls = [];
          if (item.images && Array.isArray(item.images)) {
            imageUrls = item.images.map(img => img.url || img.src || (typeof img === 'string' ? img : '')).filter(Boolean);
          } else if (item.pictures && Array.isArray(item.pictures)) {
            imageUrls = item.pictures.map(p => p.url || (Array.isArray(p) ? p[0]?.url : '')).filter(Boolean);
          }
          
          let priceVal = '0.00';
          if (item.price && typeof item.price === 'object') {
            priceVal = item.price.priceAmount || item.price.amount || String(item.price.value || '0.00');
          } else if (item.priceAmount || item.price_amount) {
            priceVal = String(item.priceAmount || item.price_amount);
          }
          
          const timestamp = Date.now().toString().substring(8);
          const generatedSku = `D-${depopId || timestamp}`;

          listings.push({
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(priceVal).toFixed(2),
            sku: generatedSku,
            category: item.categoryName || item.category?.name || 'Tops',
            categoryId: String(item.categoryId || item.category?.id || ''),
            images: imageUrls,
            thumbnail: imageUrls[0] || '',
            platform: 'depop',
            depopListingId: depopId,
            depopUrl: depopUrl,
            brand: item.brandName || item.brand?.name || '',
            size: item.sizeName || item.size?.name || '',
            color: item.colour || item.color || '',
            quantity: item.quantity || 1,
            status: 'draft'
          });
        }
        return listings;
      }
    } catch (jsonErr) {
      console.warn(`Failed to parse __NEXT_DATA__:`, jsonErr.message);
    }
  }

  // 2. DOM Fallback
  $('a[href*="/products/"]').each((i, el) => {
    const href = $(el).attr('href');
    const fullUrl = href.startsWith('http') ? href : `https://www.depop.com${href}`;
    const imgEl = $(el).find('img');
    const imgUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
    const title = imgEl.attr('alt') || '';
    
    let priceText = '0.00';
    const textVal = $(el).text();
    const priceMatch = textVal.match(/[\$\£\€\¥]\s?(\d+(\.\d{2})?)/);
    if (priceMatch) {
      priceText = priceMatch[1];
    }

    if (imgUrl && !listings.some(l => l.depopUrl === fullUrl)) {
      const slugMatch = href.match(/\/products\/([^\/]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      const timestamp = Date.now().toString().substring(8);

      listings.push({
        title: title.replace(/Image for/i, '').trim() || 'Depop Product',
        description: title.replace(/Image for/i, '').trim(),
        price: parseFloat(priceText).toFixed(2),
        sku: `D-${slug.substring(0, 15) || timestamp}`,
        category: 'Tops',
        images: [imgUrl],
        thumbnail: imgUrl,
        platform: 'depop',
        depopUrl: fullUrl,
        quantity: 1,
        status: 'draft'
      });
    }
  });

  return listings;
}

// Poshmark Parser logic from service
function parsePoshmarkHtml(htmlString) {
  const $ = cheerio.load(htmlString);
  const listings = [];

  // 1. Try parsing JSON-LD scripts
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const text = $(el).html();
      if (!text) return;
      const schema = JSON.parse(text);
      
      if (schema && (schema['@type'] === 'ItemList' || schema.itemListElement)) {
        const items = schema.itemListElement || [];
        for (const listEl of items) {
          const item = listEl.item || listEl;
          if (item && item['@type'] === 'Product') {
            const title = item.name || '';
            const description = item.description || title;
            const link = item.url || item['@id'] || '';
            const fullUrl = link.startsWith('http') ? link : `https://poshmark.com${link}`;
            const imgUrl = item.image || '';
            
            let priceVal = '0.00';
            if (item.offers) {
              priceVal = String(item.offers.price || item.offers[0]?.price || '0.00');
            }
            
            const listingIdMatch = fullUrl.match(/-([a-f0-9]{24})$/);
            const poshmarkId = listingIdMatch ? listingIdMatch[1] : '';
            const generatedSku = `P-${poshmarkId || Date.now().toString().substring(8)}`;

            listings.push({
              title: title.trim(),
              description: description.trim(),
              price: parseFloat(priceVal).toFixed(2),
              sku: generatedSku,
              category: 'Tops',
              images: imgUrl ? [imgUrl] : [],
              thumbnail: imgUrl || '',
              platform: 'poshmark',
              poshmarkListingId: poshmarkId,
              poshmarkUrl: fullUrl,
              brand: item.brand?.name || item.brand || '',
              size: item.size || '',
              quantity: 1,
              status: 'draft'
            });
          }
        }
      }
    } catch (schemaErr) {
      // Ignored
    }
  });

  if (listings.length > 0) return listings;

  // 2. Fallback: DOM scraper
  $('.tile').each((i, el) => {
    const titleEl = $(el).find('.title, a.tile__title');
    const title = titleEl.text().trim();
    const href = titleEl.attr('href') || $(el).find('a').attr('href') || '';
    const fullUrl = href.startsWith('http') ? href : `https://poshmark.com${href}`;
    
    const imgEl = $(el).find('img.tile__image, img');
    const imgUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || '';
    
    const priceText = $(el).find('.price, .tile__price').text().trim();
    const cleanPrice = priceText.replace(/[^\d.]/g, '') || '0.00';

    const listingIdMatch = fullUrl.match(/-([a-f0-9]{24})$/);
    const poshmarkId = listingIdMatch ? listingIdMatch[1] : '';
    const generatedSku = `P-${poshmarkId || Date.now().toString().substring(8)}`;

    if (title && !listings.some(l => l.poshmarkUrl === fullUrl)) {
      listings.push({
        title: title,
        description: title,
        price: parseFloat(cleanPrice).toFixed(2),
        sku: generatedSku,
        category: 'Tops',
        images: imgUrl ? [imgUrl] : [],
        thumbnail: imgUrl || '',
        platform: 'poshmark',
        poshmarkListingId: poshmarkId,
        poshmarkUrl: fullUrl,
        quantity: 1,
        status: 'draft'
      });
    }
  });

  return listings;
}

// Verification Tests
function runTests() {
  console.log('--- RUNNING PARSER VERIFICATION TESTS ---');

  // Test 1: Depop JSON-LD / NEXT_DATA Scraper
  const mockDepopNextData = `
    <html>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
          {
            "props": {
              "pageProps": {
                "dehydratedState": {
                  "queries": [
                    {
                      "state": {
                        "data": {
                          "products": [
                            {
                              "id": 123456,
                              "slug": "vintage-90s-nike-sweatshirt",
                              "title": "Vintage 90s Nike Sweatshirt",
                              "description": "Awesome vintage oversized Nike sweatshirt.",
                              "price": { "priceAmount": "45.00" },
                              "images": [{ "url": "https://img.depop.com/123.jpg" }],
                              "brandName": "Nike",
                              "sizeName": "XL",
                              "quantity": 1
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        </script>
      </body>
    </html>
  `;

  const depopItems = parseDepopHtml(mockDepopNextData);
  console.log('Depop Items parsed:', depopItems);
  if (depopItems.length === 1 && depopItems[0].title === 'Vintage 90s Nike Sweatshirt' && depopItems[0].price === '45.00') {
    console.log('✅ Depop NEXT_DATA Scraper Test: PASSED');
  } else {
    console.error('❌ Depop NEXT_DATA Scraper Test: FAILED');
  }

  // Test 2: Depop DOM Scraper Fallback
  const mockDepopDom = `
    <html>
      <body>
        <div>
          <a href="/products/vintage-levis-jeans-blue/">
            <img src="https://img.depop.com/jeans.jpg" alt="Vintage Levis Jeans Blue" />
            <span>$35.00</span>
          </a>
        </div>
      </body>
    </html>
  `;
  const depopDomItems = parseDepopHtml(mockDepopDom);
  console.log('Depop DOM Fallback parsed:', depopDomItems);
  if (depopDomItems.length === 1 && depopDomItems[0].title === 'Vintage Levis Jeans Blue' && depopDomItems[0].price === '35.00') {
    console.log('✅ Depop DOM Scraper Fallback Test: PASSED');
  } else {
    console.error('❌ Depop DOM Scraper Fallback Test: FAILED');
  }

  // Test 3: Poshmark JSON-LD Scraper
  const mockPoshmarkJsonLd = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "ItemList",
            "itemListElement": [
              {
                "item": {
                  "@type": "Product",
                  "name": "Gucci Leather Belt",
                  "description": "Authentic Gucci belt in black leather.",
                  "url": "/listing/Gucci-Leather-Belt-657ab890cdef1234567890ab",
                  "image": "https://img.poshmark.com/gucci.jpg",
                  "offers": { "price": "180.00" },
                  "brand": { "name": "Gucci" },
                  "size": "M"
                }
              }
            ]
          }
        </script>
      </body>
    </html>
  `;
  const poshmarkItems = parsePoshmarkHtml(mockPoshmarkJsonLd);
  console.log('Poshmark Items parsed:', poshmarkItems);
  if (poshmarkItems.length === 1 && poshmarkItems[0].title === 'Gucci Leather Belt' && poshmarkItems[0].price === '180.00' && poshmarkItems[0].poshmarkListingId === '657ab890cdef1234567890ab') {
    console.log('✅ Poshmark JSON-LD Scraper Test: PASSED');
  } else {
    console.error('❌ Poshmark JSON-LD Scraper Test: FAILED');
  }

  // Test 4: Poshmark DOM Scraper Fallback
  const mockPoshmarkDom = `
    <html>
      <body>
        <div class="tile">
          <a class="tile__title" href="/listing/Zara-Floral-Dress-657ab890cdef1234567890ac">Zara Floral Dress</a>
          <img class="tile__image" src="https://img.poshmark.com/zara.jpg" />
          <span class="tile__price">$29</span>
        </div>
      </body>
    </html>
  `;
  const poshmarkDomItems = parsePoshmarkHtml(mockPoshmarkDom);
  console.log('Poshmark DOM Fallback parsed:', poshmarkDomItems);
  if (poshmarkDomItems.length === 1 && poshmarkDomItems[0].title === 'Zara Floral Dress' && poshmarkDomItems[0].price === '29.00') {
    console.log('✅ Poshmark DOM Scraper Fallback Test: PASSED');
  } else {
    console.error('❌ Poshmark DOM Scraper Fallback Test: FAILED');
  }
}

runTests();
