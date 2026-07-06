const originalAxios = require('axios');
const axiosPath = require.resolve('axios');

let lastAxiosRequest = null;

const mockAxios = async (config) => {
  lastAxiosRequest = config;
  if (config.method === 'PUT') {
    return {
      status: 200,
      data: {
        product_id: 12345678,
        slug: 'vintage-nike-t-shirt-12345678'
      }
    };
  }
  if (config.method === 'DELETE') {
    return { status: 200, data: {} };
  }
  if (config.method === 'GET') {
    return {
      status: 200,
      data: {
        data: [
          {
            product_id: 12345678,
            title: 'Vintage Nike T-Shirt',
            description: 'Awesome t-shirt',
            price_amount: '25.00',
            sku: 'MOCK-SKU-1',
            brand: 'Nike',
            pictures: [{ url: 'https://images.example.com/img1.jpg' }],
            slug: 'vintage-nike-t-shirt-12345678'
          }
        ]
      }
    };
  }
  if (config.method === 'POST') {
    return { status: 200, data: {} };
  }
  return { status: 200, data: {} };
};

// Inject mock in cache before requiring the service
require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: mockAxios
};

const { 
  publishToDepopPartner, 
  deleteFromDepopPartner, 
  getListingsFromDepopPartner, 
  markAsSoldOnDepopPartner 
} = require('../services/depopPartnerService');

async function runTests() {
  console.log('--- STARTING DEPOP PARTNER API MAPPING TESTS ---');

  const mockListing = {
    _id: { toString: () => '123456789012345678901234' },
    sku: 'NIKE-TEE-001',
    categoryId: 'tshirts', // maps to menswear / tshirts
    size: '54.4-US',      // size_set_id: 54, size_id: 4
    condition: 'Excellent',
    brand: 'Nike',
    color: 'Black, White',
    styleTag: 'Streetwear, Retro',
    description: '<b>Vintage Nike T-Shirt</b> in excellent condition. #nike #vintage #streetwear',
    price: 25.99,
    shippingPrice: 4.99,
    intlShippingPrice: 15.00,
    images: ['https://images.example.com/image1.jpg'],
    country: 'United States',
    state: 'California'
  };

  const apiKey = 'test_partner_api_key_123';

  // 1. Test Publish Mapping
  console.log('\n[Test 1] Testing publishToDepopPartner mapping...');
  const publishResult = await publishToDepopPartner(mockListing, apiKey);
  
  console.log('Publish result:', publishResult);
  console.log('Request Config sent to Axios:');
  console.log('- Method:', lastAxiosRequest.method);
  console.log('- URL:', lastAxiosRequest.url);
  console.log('- Auth Header:', lastAxiosRequest.headers['Authorization']);
  console.log('- Payload:', JSON.stringify(lastAxiosRequest.data, null, 2));

  // Assertions
  if (lastAxiosRequest.method !== 'PUT') throw new Error('Expected PUT method');
  if (lastAxiosRequest.data.address.country_code !== 'US') throw new Error('Expected US country code');
  if (lastAxiosRequest.data.department !== 'menswear') throw new Error('Expected menswear department');
  if (lastAxiosRequest.data.product_type !== 'tshirts') throw new Error('Expected tshirts product type');
  if (lastAxiosRequest.data.size_set_id !== 54) throw new Error('Expected size_set_id to be 54');
  if (lastAxiosRequest.data.size_id !== 4) throw new Error('Expected size_id to be 4');
  if (lastAxiosRequest.data.condition !== 'used_excellent') throw new Error('Expected used_excellent condition');
  if (lastAxiosRequest.data.description.includes('<b>')) throw new Error('Expected HTML tags to be stripped');
  if (lastAxiosRequest.data.price_amount !== '25.99') throw new Error('Expected price_amount to be 25.99');
  if (lastAxiosRequest.data.national_shipping_cost !== '4.99') throw new Error('Expected national_shipping_cost to be 4.99');
  if (lastAxiosRequest.data.international_shipping_cost !== '15.00') throw new Error('Expected international_shipping_cost to be 15.00');
  if (JSON.stringify(lastAxiosRequest.data.colour) !== JSON.stringify(['black', 'white'])) throw new Error('Expected color mapping mismatch');
  if (JSON.stringify(lastAxiosRequest.data.style) !== JSON.stringify(['streetwear', 'retro'])) throw new Error('Expected style mapping mismatch');

  console.log('✔ Publish mapping verified successfully!');

  // 2. Test Delete Call
  console.log('\n[Test 2] Testing deleteFromDepopPartner...');
  await deleteFromDepopPartner('NIKE-TEE-001', apiKey);
  console.log('Request Config sent to Axios:');
  console.log('- Method:', lastAxiosRequest.method);
  console.log('- URL:', lastAxiosRequest.url);
  if (lastAxiosRequest.method !== 'DELETE') throw new Error('Expected DELETE method');
  console.log('✔ Delete endpoint call verified successfully!');

  // 3. Test Get Listings Call
  console.log('\n[Test 3] Testing getListingsFromDepopPartner...');
  const listings = await getListingsFromDepopPartner(apiKey);
  console.log('Mapped Listings:', listings);
  if (listings.length !== 1 || listings[0].sku !== 'MOCK-SKU-1') throw new Error('Expected mapped listings mismatch');
  console.log('✔ Get Listings call verified successfully!');

  // 4. Test Mark As Sold Call
  console.log('\n[Test 4] Testing markAsSoldOnDepopPartner...');
  await markAsSoldOnDepopPartner('NIKE-TEE-001', apiKey);
  console.log('Request Config sent to Axios:');
  console.log('- Method:', lastAxiosRequest.method);
  console.log('- URL:', lastAxiosRequest.url);
  if (lastAxiosRequest.method !== 'POST') throw new Error('Expected POST method');
  console.log('✔ Mark As Sold call verified successfully!');

  console.log('\nALL DEPOP PARTNER API INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err.message);
  process.exit(1);
});
