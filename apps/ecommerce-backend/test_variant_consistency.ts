import axios from 'axios';

const BACKEND_URL = 'http://localhost:3500';

async function runScenarioTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING SHOPI VARIANT-AWARE AI VISUAL CONTEXT VERIFICATION');
  console.log('================================================================\n');

  const conversationId = `test_variant_${Date.now()}`;
  const userId = 666574596;

  let results: { [key: string]: boolean } = {};

  // Scenario 1: Customer viewing SHIRT-002 with Color: Black, Size: S
  console.log('--- SCENARIO 1: Open Shopi on /product/SHIRT-002 (Black, S) ---');
  const res1 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Tell me about this shirt',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt',
        price: 449,
        mrp: 2398,
        category: 'Shirts',
        selectedColor: 'Black',
        selectedSize: 'S',
        selectedVariantImage: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
      },
      selectedVariant: {
        color: 'Black',
        size: 'S',
        imageUrl: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
      }
    }
  });

  const card1 = res1.data.products?.[0];
  console.log('Response Intent:', res1.data.intent);
  console.log('Card SKU:', card1?.sku);
  console.log('Card Color:', card1?.color);
  console.log('Card Size:', card1?.size);
  console.log('Card Image:', card1?.imageUrl);

  results['1. Active Page Variant Image Black'] = card1?.imageUrl?.includes('black.jpg');
  results['2. Active Page Variant Badges (Black, S)'] = card1?.color === 'Black' && card1?.size === 'S';

  // Scenario 2: "Is there a Brown variant?"
  console.log('\n--- SCENARIO 2: Query "Is there a Brown variant?" ---');
  const res2 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Is there a Brown variant?',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt',
        selectedColor: 'Black',
        selectedSize: 'S'
      }
    }
  });

  const card2 = res2.data.products?.[0];
  console.log('Response Message:', res2.data.message);
  console.log('Card Color:', card2?.color);
  console.log('Card Image:', card2?.imageUrl);

  results['3. Brown Query mentions Maroon'] = res2.data.message?.toLowerCase().includes('maroon');
  results['4. Brown Query returns Maroon Card & Image'] = card2?.color === 'Maroon' && card2?.imageUrl?.includes('Maroon.jpg');

  // Scenario 3: "Does it come in Blue?"
  console.log('\n--- SCENARIO 3: Query "Does it come in Blue?" ---');
  const res3 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Does it come in Blue?',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt',
        selectedColor: 'Black',
        selectedSize: 'S'
      }
    }
  });

  console.log('Response Message:', res3.data.message);
  console.log('Product Cards Count:', res3.data.products?.length);
  res3.data.products?.forEach((c: any, idx: number) => {
    console.log(`  Card ${idx + 1}: ${c.color} -> ${c.imageUrl}`);
  });

  results['5. Blue Query identifies Navy Blue & Sky Blue'] = res3.data.message?.includes('Navy Blue') && res3.data.message?.includes('Sky Blue');
  results['6. Blue Query returns 2 distinct color cards'] = res3.data.products?.length === 2 &&
    res3.data.products.some((c: any) => c.color === 'Navy Blue' && c.imageUrl?.includes('Navy%20Blue.jpg')) &&
    res3.data.products.some((c: any) => c.color === 'Sky Blue' && c.imageUrl?.includes('sky%20blue.jpg'));

  // Scenario 4: "Show me the Navy Blue one"
  console.log('\n--- SCENARIO 4: Query "Show me the Navy Blue one" ---');
  const res4 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Show me the Navy Blue one',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt',
        selectedColor: 'Black',
        selectedSize: 'S'
      }
    }
  });

  const card4 = res4.data.products?.[0];
  console.log('Response Message:', res4.data.message);
  console.log('Card Count:', res4.data.products?.length);
  console.log('Card Color:', card4?.color);
  console.log('Card Image:', card4?.imageUrl);

  results['7. Navy Blue Query returns 1 Card'] = res4.data.products?.length === 1 && card4?.color === 'Navy Blue';
  results['8. Navy Blue Image URL is canonical Navy Blue.jpg'] = card4?.imageUrl?.includes('Navy%20Blue.jpg');

  // Scenario 5: "Add this to cart" (should add Navy Blue variant)
  console.log('\n--- SCENARIO 5: Query "Add this to cart" ---');
  const res5 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Add this to cart',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt'
      }
    }
  });

  const card5 = res5.data.products?.[0];
  console.log('Response Message:', res5.data.message);
  console.log('Cart Items:', res5.data.cart?.items?.map((i: any) => `${i.name} (Qty: ${i.quantity})`));
  console.log('Card Color:', card5?.color);
  console.log('Card Image:', card5?.imageUrl);

  results['9. Add to Cart captures requested Navy Blue variant'] = res5.data.message?.includes('Navy Blue') || card5?.color === 'Navy Blue';
  results['10. Add to Cart returns matching variant card image'] = card5?.imageUrl?.includes('Navy%20Blue.jpg');

  // Scenario 6: Customer switches color to Black on product page, asks "Why should I buy this?"
  console.log('\n--- SCENARIO 6: Switch back to Black on page, ask "Why should I buy this?" ---');
  const res6 = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
    message: 'Why should I buy this?',
    conversationId,
    userId,
    context: {
      pageType: 'product',
      currentProduct: {
        sku: 'SHIRT-002',
        title: 'Snitch Men Regular Fit Solid Spread Collar Casual Shirt',
        price: 449,
        mrp: 2398,
        category: 'Shirts',
        selectedColor: 'Black',
        selectedSize: 'S',
        selectedVariantImage: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
      },
      selectedVariant: {
        color: 'Black',
        size: 'S',
        imageUrl: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
      }
    }
  });

  const card6 = res6.data.products?.[0];
  console.log('Card Color:', card6?.color);
  console.log('Card Image:', card6?.imageUrl);

  results['11. Page Context Overrides Memory back to Black'] = card6?.color === 'Black' && card6?.imageUrl?.includes('black.jpg');
  results['12. Full End-to-End Visual Consistency Matrix'] = Object.values(results).every(v => v === true);

  console.log('\n================================================================');
  console.log('📊 FINAL 12-POINT VERIFICATION MATRIX');
  console.log('================================================================');
  let allPass = true;
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} | ${testName}`);
    if (!passed) allPass = false;
  }
  console.log('================================================================');
  console.log(allPass ? '🏆 ALL 12 TESTS PASSED PERFECTLY!' : '⚠️ SOME TESTS FAILED');
  console.log('================================================================');
}

runScenarioTests().catch(err => {
  console.error('Error running test scenarios:', err.message);
  if (err.response) {
    console.error('Response data:', err.response.data);
  }
});
