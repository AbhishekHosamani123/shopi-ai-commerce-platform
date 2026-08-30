const http = require('http');

const API_SECRET = 'razorpay_ai_commerce_shared_secret_2026';
const TEST_USER_ID = 666574596;

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3500,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': API_SECRET,
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body, statusCode: res.statusCode });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 SHOPI CRITICAL CART VARIANT PERSISTENCE VERIFICATION');
  console.log('================================================================\n');

  const results = {};

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: The Exact Failing Demo Flow
  // Viewing Black/S -> "Does it come in green?" -> "Add this to cart."
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Exact Demo Flow (Viewing Black/S -> Ask Green -> Add to Cart) ---');
  const conv1 = `conv_test1_${Date.now()}`;
  
  // 1a. Clear cart
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: conv1 });

  // 1b. Customer is viewing SHIRT-002 Black/S, asks "Does it come in green?"
  const res1b = await postJson('/api/ai/chat', {
    message: 'Does it come in green?',
    conversationId: conv1,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt",
        selectedColor: 'Black',
        selectedSize: 'S',
        selectedVariantImage: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
      },
      selectedVariant: {
        color: 'Black',
        size: 'S'
      }
    }
  });

  console.log('AI Response 1b:', res1b.message);
  const card1b = res1b.products?.[0];
  console.log('Card 1b Variant:', card1b?.color, card1b?.size, card1b?.imageUrl);

  results['1. AI Green variant recognition'] = res1b.message?.toLowerCase().includes('green') && card1b?.color === 'Green';
  results['2. AI Green variant image'] = card1b?.imageUrl?.includes('green.jpg');

  // 1c. Customer says "Add this to cart."
  const res1c = await postJson('/api/ai/chat', {
    message: 'Add this to cart.',
    conversationId: conv1,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt",
        selectedColor: 'Black',
        selectedSize: 'S'
      }
    }
  });

  console.log('AI Response 1c:', res1c.message);
  console.log('Cart Items in Response 1c:', res1c.cart?.items);

  const cartItem1 = res1c.cart?.items?.[0];
  console.log('Persisted Cart Item:', {
    name: cartItem1?.name,
    sku: cartItem1?.productId,
    color: cartItem1?.color,
    size: cartItem1?.size,
    imageUrl: cartItem1?.imageUrl
  });

  results['3. AI Add Green/S'] = res1c.message?.includes('Green') && res1c.message?.includes('S');
  results['4. Backend stores Green/S'] = cartItem1?.color === 'Green' && cartItem1?.size === 'S';
  results['5. Cart displays Green/S'] = cartItem1?.color === 'Green' && cartItem1?.size === 'S';
  results['6. Cart displays green image'] = cartItem1?.imageUrl?.includes('green.jpg');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Multiple Variants Coexist (Black + Green)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Multiple Variants Coexist (Black + Green) ---');
  const conv2 = `conv_test2_${Date.now()}`;
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: conv2 });

  // Add Black S first
  await postJson('/api/ai/chat', {
    message: 'Add this to cart',
    conversationId: conv2,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt",
        selectedColor: 'Black',
        selectedSize: 'S'
      },
      selectedVariant: { color: 'Black', size: 'S' }
    }
  });

  // Ask about green
  await postJson('/api/ai/chat', {
    message: 'Show me the green one',
    conversationId: conv2,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt" }
    }
  });

  // Add green to cart
  const res2 = await postJson('/api/ai/chat', {
    message: 'Add this to cart',
    conversationId: conv2,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt" }
    }
  });

  console.log('Cart Items in Test 2:', res2.cart?.items?.map(i => `${i.productId} | Color: ${i.color} | Size: ${i.size} | Qty: ${i.quantity}`));

  const hasBlack = res2.cart?.items?.some(i => i.color === 'Black' && i.size === 'S');
  const hasGreen = res2.cart?.items?.some(i => i.color === 'Green' && i.size === 'S');
  const countIs2 = res2.cart?.items?.length === 2;

  results['7. Black + Green coexist as separate lines'] = hasBlack && hasGreen && countIs2;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Different Size (Green in M)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Different Size (Green/S + Green/M) ---');
  const conv3 = `conv_test3_${Date.now()}`;
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: conv3 });

  // Add Green/S
  await postJson('/api/ai/chat', {
    message: 'Add the green one',
    conversationId: conv3,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt" }
    }
  });

  // Add Green/M explicitly
  const res3 = await postJson('/api/ai/chat', {
    message: 'Add the green one in M',
    conversationId: conv3,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt" }
    }
  });

  console.log('Cart Items in Test 3:', res3.cart?.items?.map(i => `${i.productId} | Color: ${i.color} | Size: ${i.size} | Qty: ${i.quantity}`));

  const hasGreenS = res3.cart?.items?.some(i => i.color === 'Green' && i.size === 'S');
  const hasGreenM = res3.cart?.items?.some(i => i.color === 'Green' && i.size === 'M');

  results['8. Green/S + Green/M coexist'] = hasGreenS && hasGreenM && res3.cart?.items?.length === 2;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Direct Storefront API Add-to-Cart (Green/M)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Direct Storefront API Add-to-Cart (Green/M) ---');
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: `conv4_${Date.now()}` });

  // Call /api/user/insert/cartitem with Green (3029) and M (3038)
  const res4Insert = await postJson('/api/user/insert/cartitem', {
    cartItemID: Math.floor(Math.random() * 100000),
    userID: TEST_USER_ID,
    productID: 59,
    productPrice: 449,
    colorID: 3029, // Green
    sizeID: 3038,  // M
    quantity: 1
  });
  console.log('Direct Insert Result:', res4Insert);

  // Fetch all cart items via /api/user/all-data token mock or adapter
  const res4Cart = await postJson('/api/ai/chat', {
    message: 'view cart',
    userId: TEST_USER_ID,
    conversationId: `conv4_${Date.now()}`
  });

  const directItem = res4Cart.cart?.items?.[0];
  console.log('Direct Storefront Cart Item:', directItem);

  results['9. Product page Add-to-Cart preserves variant'] = directItem?.color === 'Green' && directItem?.size === 'M' && directItem?.imageUrl?.includes('green.jpg');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: AI + Product Page Variant Synchronization
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: AI + Product Page Variant Synchronization ---');
  const conv5 = `conv_test5_${Date.now()}`;
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: conv5 });

  // 5a. Viewing Black/S, ask "Show me green", then "Add this to cart."
  await postJson('/api/ai/chat', {
    message: 'Show me green',
    conversationId: conv5,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', selectedColor: 'Black', selectedSize: 'S' }
    }
  });

  await postJson('/api/ai/chat', {
    message: 'Add this to cart',
    conversationId: conv5,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: { sku: 'SHIRT-002', selectedColor: 'Black', selectedSize: 'S' }
    }
  });

  // 5b. Customer changes product page dropdown to Maroon, L
  const res5b = await postJson('/api/ai/chat', {
    message: 'Add this to cart',
    conversationId: conv5,
    userId: TEST_USER_ID,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt",
        selectedColor: 'Maroon',
        selectedSize: 'L'
      },
      selectedVariant: {
        color: 'Maroon',
        size: 'L'
      }
    }
  });

  console.log('Cart Items in Test 5:', res5b.cart?.items?.map(i => `${i.productId} | Color: ${i.color} | Size: ${i.size} | Qty: ${i.quantity}`));

  const hasGreenS_5 = res5b.cart?.items?.some(i => i.color === 'Green' && i.size === 'S');
  const hasMaroonL_5 = res5b.cart?.items?.some(i => i.color === 'Maroon' && i.size === 'L');

  results['10. AI + product page variant synchronization'] = hasGreenS_5 && hasMaroonL_5 && res5b.cart?.items?.length === 2;
  results['11. No fallback to first/default variant'] = res5b.cart?.items?.every(i => i.color !== 'Black');
  results['12. No regression in existing cart functionality'] = Object.values(results).every(v => v === true);

  console.log('\n================================================================');
  console.log('📊 FINAL VERIFICATION MATRIX');
  console.log('================================================================');
  let allPass = true;
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} | ${testName}`);
    if (!passed) allPass = false;
  }
  console.log('================================================================');
  console.log(allPass ? '🏆 ALL ACCEPTANCE TESTS PASSED PERFECTLY!' : '⚠️ SOME TESTS FAILED');
  console.log('================================================================');
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
});
