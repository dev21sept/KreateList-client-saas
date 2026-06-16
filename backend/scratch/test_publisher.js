const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Attach captured requests to global to share with sandboxed Function context
global.capturedRequests = [];

const mockAxios = async (config) => {
  global.capturedRequests.push(config);
  
  // Mock responses based on URL
  if (config.url.includes('/api/v4/pictures/')) {
    return {
      status: 201,
      data: {
        id: "mock-picture-123",
        url: "https://depop-s3-upload-url.com/123"
      }
    };
  }
  
  if (config.url.includes('/depop-s3-upload-url.com/')) {
    return { status: 200, data: "OK" };
  }
  
  if (config.url.includes('/presentation/api/v1/listing/products/')) {
    return {
      status: 200,
      data: {
        id: 998877,
        slug: "cool-vintage-tee"
      }
    };
  }

  if (config.url.includes('/vm-rest/posts?pm_version=')) {
    return {
      status: 200,
      data: {
        id: "657ab890cdef1234567890aa",
        post: { id: "657ab890cdef1234567890aa" }
      }
    };
  }

  if (config.url.includes('/media/scratch?app_type=web')) {
    return {
      status: 200,
      data: {
        id: "mock-media-poshmark-99"
      }
    };
  }

  if (config.url.includes('/vm-rest/posts/657ab890cdef1234567890aa?pm_version=')) {
    return {
      status: 200,
      data: { success: true }
    };
  }

  if (config.url.includes('/status/published?')) {
    return {
      status: 200,
      data: {
        status: "published"
      }
    };
  }

  return { status: 200, data: {} };
};

// Require our service under test and override its axios dependency
const servicePath = path.join(__dirname, '..', 'services', 'backendPublishService.js');
let serviceContent = fs.readFileSync(servicePath, 'utf8');

// Inject the mock axios into the service content for testing
serviceContent = 'const axios = ' + mockAxios.toString() + ';\n' + serviceContent.replace("const axios = require('axios');", "");

// Evaluate the modified service file in this sandbox context
const sandboxModule = { exports: {} };
const fn = new Function('module', 'exports', 'require', '__dirname', serviceContent);
fn(sandboxModule, sandboxModule.exports, require, path.dirname(servicePath));

const { publishToDepop, publishToPoshmark } = sandboxModule.exports;

async function runTests() {
  console.log('--- RUNNING BACKEND PUBLISHING MOCK TESTS ---');

  // Create a mock listing
  const mockListing = {
    title: "Awesome Nike Hoodie",
    description: "Great condition oversized Nike hoodie.",
    price: "49.99",
    sku: "TEST-SKU-9988",
    category: "Men > Tops > Hoodies",
    categoryId: "shirts",
    images: ["data:image/jpeg;base64,/9j/4AAQSkZJRg=="], // base64 mock image
    brand: "Nike",
    size: "L",
    color: "Black",
    styleTag: "streetwear, vintage",
    shippingPrice: "5.00"
  };

  // 1. Test Depop direct publishing
  console.log('\nTesting direct Depop publishing...');
  global.capturedRequests = [];
  const mockDepopAccount = {
    accessToken: "Bearer mock-token-987654321"
  };
  
  const depopRes = await publishToDepop(mockListing, mockDepopAccount);
  console.log('Depop Publish Result:', depopRes);
  
  assert.strictEqual(depopRes.id, "998877");
  assert.strictEqual(depopRes.url, "https://www.depop.com/products/cool-vintage-tee/");
  
  // Verify captured requests
  const initPicRequest = global.capturedRequests.find(r => r.url.includes('/api/v4/pictures/'));
  assert.ok(initPicRequest);
  assert.strictEqual(initPicRequest.headers.authorization, "Bearer mock-token-987654321");
  
  const createListingRequest = global.capturedRequests.find(r => r.url.includes('/presentation/api/v1/listing/products/'));
  assert.ok(createListingRequest);
  assert.strictEqual(createListingRequest.data.brand, "nike");
  assert.strictEqual(createListingRequest.data.price_amount, "49.99");
  console.log('✅ Depop direct backend publishing test: PASSED');

  // 2. Test Poshmark direct publishing
  console.log('\nTesting direct Poshmark publishing...');
  global.capturedRequests = [];
  const mockPoshmarkAccount = {
    sessionCookie: "_poshmark_session=mock-cookie-123",
    csrfToken: "mock-csrf-token-abc"
  };

  const poshmarkRes = await publishToPoshmark(mockListing, mockPoshmarkAccount);
  console.log('Poshmark Publish Result:', poshmarkRes);

  assert.strictEqual(poshmarkRes.id, "657ab890cdef1234567890aa");
  assert.strictEqual(poshmarkRes.url, "https://poshmark.com/listing/657ab890cdef1234567890aa");

  // Verify captured requests
  const draftRequest = global.capturedRequests.find(r => r.url.includes('/vm-rest/posts?pm_version='));
  assert.ok(draftRequest);
  assert.strictEqual(draftRequest.headers.cookie, "io_token=mock-csrf-token-abc; _poshmark_session=mock-cookie-123");
  assert.strictEqual(draftRequest.headers['x-xsrf-token'], "mock-csrf-token-abc");

  const saveDetailsRequest = global.capturedRequests.find(r => r.url.includes('/vm-rest/posts/657ab890cdef1234567890aa?pm_version='));
  assert.ok(saveDetailsRequest);
  assert.strictEqual(saveDetailsRequest.data.post.title, "Awesome Nike Hoodie");
  assert.strictEqual(saveDetailsRequest.data.post.brand, "Nike");
  assert.strictEqual(saveDetailsRequest.data.post.price_amount.val, 49.99);

  const activateRequest = global.capturedRequests.find(r => r.url.includes('/status/published?'));
  assert.ok(activateRequest);
  assert.strictEqual(activateRequest.method, "PUT");
  console.log('✅ Poshmark direct backend publishing test: PASSED');

  // 3. Test Poshmark direct publishing with structured IDs
  console.log('\nTesting direct Poshmark publishing with structured IDs...');
  global.capturedRequests = [];
  const mockListingWithIds = {
    ...mockListing,
    departmentId: "000e8975d97b4e80ef00a955", // Women
    categoryId: "00248975d97b4e80ef00a955", // Bags
    subcategoryIds: ["00d89287d97b4e80ef00a955"] // Baby Bags
  };

  const poshmarkRes2 = await publishToPoshmark(mockListingWithIds, mockPoshmarkAccount);
  assert.strictEqual(poshmarkRes2.id, "657ab890cdef1234567890aa");

  // Verify that the payload sent to Poshmark contains our custom structured IDs
  const saveDetailsRequest2 = global.capturedRequests.find(r => 
    r.url.includes('/vm-rest/posts/657ab890cdef1234567890aa?pm_version=') &&
    r.data.post.title === "Awesome Nike Hoodie" &&
    r.data.post.catalog && r.data.post.catalog.department === "000e8975d97b4e80ef00a955" &&
    r.data.post.catalog.category_features && r.data.post.catalog.category_features.length > 0
  );
  assert.ok(saveDetailsRequest2, "Poshmark details save payload with department ID should be captured");
  assert.strictEqual(saveDetailsRequest2.data.post.catalog.category, "00248975d97b4e80ef00a955");
  assert.deepStrictEqual(saveDetailsRequest2.data.post.catalog.category_features, ["00d89287d97b4e80ef00a955"]);
  console.log('✅ Poshmark direct backend publishing with structured IDs test: PASSED');
  
  console.log('\n--- ALL PUBLISHING VALIDATION TESTS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test validation failed:', err);
  process.exit(1);
});
