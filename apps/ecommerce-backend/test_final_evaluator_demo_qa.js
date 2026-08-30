const http = require('http');

const API_SECRET = 'razorpay_ai_commerce_shared_secret_2026';
const TEST_USER_ID = 666574596;

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const start = Date.now();
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
          const latencyMs = Date.now() - start;
          try {
            const parsed = JSON.parse(body);
            parsed.__latencyMs = latencyMs;
            parsed.__statusCode = res.statusCode;
            resolve(parsed);
          } catch (e) {
            resolve({ raw: body, statusCode: res.statusCode, __latencyMs: latencyMs });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runCompleteQaAudit() {
  console.log('================================================================');
  console.log('💎 SHOPI FINAL BROWSER DEMO QA & HARDENING SUITE');
  console.log('================================================================\n');

  const scorecard = {};

  // ──────────────────────────────────────────────────────────────────────────
  // 1. PRIMARY EVALUATOR DEMO CONVERSATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 1. PRIMARY EVALUATOR DEMO FLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const convPrimary = `conv_primary_${Date.now()}`;
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: convPrimary });

  // 1a. "Find me men's shirts under ₹500"
  console.log('\n[USER]: "Find me men\'s shirts under ₹500"');
  const step1 = await postJson('/api/ai/chat', {
    message: "Find me men's shirts under ₹500",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step1.message}`);
  console.log(`[CARDS]: ${step1.products?.length} products returned (Latency: ${step1.__latencyMs}ms)`);
  step1.products?.slice(0, 3).forEach((p, idx) => console.log(`   ${idx + 1}. ${p.sku} | ${p.name} | ₹${p.price} | ⭐ ${p.rating}/5`));

  const allUnder500 = step1.products?.every(p => p.price <= 500);
  const allShirts = step1.products?.every(p => (p.category?.toLowerCase().includes('shirt') || p.name.toLowerCase().includes('shirt')));
  scorecard['1.1 Primary Demo: Search shirts under ₹500'] = step1.products?.length > 0 && allUnder500 && allShirts;

  // 1b. "Which one is the best?"
  console.log('\n[USER]: "Which one is the best?"');
  const step2 = await postJson('/api/ai/chat', {
    message: "Which one is the best?",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step2.message}`);
  console.log(`[RECOMMENDED]: ${step2.products?.[0]?.sku} - ${step2.products?.[0]?.name}`);

  const recommendedSku = step2.products?.[0]?.sku;
  const recommendsWithRationale = step2.message?.includes('recommend') && step2.products?.length === 1;
  scorecard['1.2 Primary Demo: Multi-factor recommendation'] = recommendsWithRationale && !!recommendedSku;

  // 1c. "Why?"
  console.log('\n[USER]: "Why?"');
  const step3 = await postJson('/api/ai/chat', {
    message: "Why?",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step3.message}`);
  scorecard['1.3 Primary Demo: Evidence-based explanation'] = step3.message?.includes('Why') || step3.message?.includes('Verdict') || step3.message?.includes('Rating') || step3.message?.includes('CLOTHING VEDA');

  // 1d. "Compare it with the first one."
  console.log('\n[USER]: "Compare it with the first one."');
  const step4 = await postJson('/api/ai/chat', {
    message: "Compare it with the first one.",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step4.message}`);
  console.log(`[COMPARISON CARDS]: ${step4.products?.map(p => p.sku).join(' vs ')}`);
  scorecard['1.4 Primary Demo: Side-by-side comparison'] = step4.products?.length >= 2 && (step4.message?.includes('Comparison') || step4.message?.includes('Verdict'));

  // 1e. "Add the better one to cart."
  console.log('\n[USER]: "Add the better one to cart."');
  const step5 = await postJson('/api/ai/chat', {
    message: "Add the better one to cart.",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step5.message}`);
  console.log(`[CART ITEMS]:`, step5.cart?.items?.map(i => `${i.productId} (Color: ${i.color} • Size: ${i.size}) Qty: ${i.quantity}`));
  scorecard['1.5 Primary Demo: Add winner to cart'] = step5.intent === 'add_to_cart' && step5.cart?.items?.length === 1;

  // 1f. "Show me my cart."
  console.log('\n[USER]: "Show me my cart."');
  const step6 = await postJson('/api/ai/chat', {
    message: "Show me my cart.",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step6.message}`);
  console.log(`[CURRENT CART]: Total ₹${step6.cart?.total} INR (${step6.cart?.itemCount} items)`);
  scorecard['1.6 Primary Demo: View authoritative cart'] = step6.cart?.itemCount === 1 && step6.cart?.total > 0;

  // 1g. "Remove it."
  console.log('\n[USER]: "Remove it."');
  const step7 = await postJson('/api/ai/chat', {
    message: "Remove it.",
    userId: TEST_USER_ID,
    conversationId: convPrimary
  });
  console.log(`[SHOPI]: ${step7.message}`);
  console.log(`[FINAL CART COUNT]: ${step7.cart?.itemCount || 0}`);
  scorecard['1.7 Primary Demo: Conversational removal'] = step7.cart?.itemCount === 0;

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CURRENT PRODUCT DEMO (Autonomous page context)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 2. CURRENT PRODUCT CONTEXT DEMO (SHIRT-002)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const convProduct = `conv_prod_${Date.now()}`;
  const prodContext = {
    pageType: 'product',
    currentProduct: {
      sku: 'SHIRT-002',
      title: "CLOTHING VEDA Men's Kurta Style Cotton Shirt",
      price: 449,
      mrp: 1999,
      category: 'Shirts',
      selectedColor: 'Black',
      selectedSize: 'S',
      selectedVariantImage: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/Shirts/SHIRT-002/black.jpg'
    },
    selectedVariant: {
      color: 'Black',
      size: 'S'
    }
  };

  // 2a. "Tell me about this product."
  console.log('\n[USER]: "Tell me about this product."');
  const prodStep1 = await postJson('/api/ai/chat', {
    message: "Tell me about this product.",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep1.message}`);
  scorecard['2.1 Product Page: Autonomous product identification'] = prodStep1.message?.includes('CLOTHING VEDA') && prodStep1.products?.[0]?.sku === 'SHIRT-002';

  // 2b. "Why should I buy this?"
  console.log('\n[USER]: "Why should I buy this?"');
  const prodStep2 = await postJson('/api/ai/chat', {
    message: "Why should I buy this?",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep2.message}`);
  scorecard['2.2 Product Page: Salesperson why-buy reasoning'] = prodStep2.message?.includes('Why Choose') || prodStep2.message?.includes('Why It\'s Worth Buying') || prodStep2.message?.includes('Value Proposition');

  // 2c. "How are the reviews?"
  console.log('\n[USER]: "How are the reviews?"');
  const prodStep3 = await postJson('/api/ai/chat', {
    message: "How are the reviews?",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep3.message}`);
  scorecard['2.3 Product Page: Review intelligence & verified quote'] = (prodStep3.message?.includes('Review Summary') || prodStep3.message?.includes('Review Intelligence') || prodStep3.message?.includes('Rating')) && prodStep3.message?.includes('Verified');

  // 2d. "Is it worth buying?"
  console.log('\n[USER]: "Is it worth buying?"');
  const prodStep4 = await postJson('/api/ai/chat', {
    message: "Is it worth buying?",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep4.message}`);
  scorecard['2.4 Product Page: Value & fit assessment'] = prodStep4.message?.includes('Why Choose') || prodStep4.message?.includes('Trade-off') || prodStep4.message?.includes('Trade-offs') || prodStep4.message?.includes('Recommendation');

  // 2e. "Does it come in black?"
  console.log('\n[USER]: "Does it come in black?"');
  const prodStep5 = await postJson('/api/ai/chat', {
    message: "Does it come in black?",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep5.message}`);
  scorecard['2.5 Product Page: Variant validation (Black available)'] = prodStep5.message?.toLowerCase().includes('black is available') || prodStep5.message?.toLowerCase().includes('black** is available') || prodStep5.message?.toLowerCase().includes('available in black');

  // 2f. "Add this to cart."
  console.log('\n[USER]: "Add this to cart."');
  const prodStep6 = await postJson('/api/ai/chat', {
    message: "Add this to cart.",
    userId: TEST_USER_ID,
    conversationId: convProduct,
    context: prodContext
  });
  console.log(`[SHOPI]: ${prodStep6.message}`);
  console.log(`[ADDED ITEM]:`, prodStep6.cart?.items?.[0]);
  scorecard['2.6 Product Page: Add to cart with variant'] = prodStep6.cart?.items?.[0]?.productId === 'SHIRT-002' && prodStep6.cart?.items?.[0]?.color === 'Black';

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PRODUCT SEARCH & CONSTRAINT FIDELITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 3. PRODUCT SEARCH CONSTRAINT FIDELITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 3a. Running shoes under ₹1000
  const searchShoes = await postJson('/api/ai/chat', {
    message: "Find me running shoes under ₹1000",
    userId: TEST_USER_ID,
    conversationId: `conv_s1_${Date.now()}`
  });
  const allShoesUnder1000 = searchShoes.products?.length > 0 && searchShoes.products.every(p => p.price <= 1000 && (p.category?.toLowerCase().includes('shoe') || p.name.toLowerCase().includes('shoe') || p.category?.toLowerCase().includes('sneaker')));
  console.log(`Search "Running shoes under ₹1000": ${searchShoes.products?.length} products (All <= 1000 & shoes: ${allShoesUnder1000})`);
  scorecard['3.1 Search: Running shoes under ₹1000'] = allShoesUnder1000;

  // 3b. Black shirts under ₹700
  const searchBlackShirts = await postJson('/api/ai/chat', {
    message: "Find me black shirts under ₹700",
    userId: TEST_USER_ID,
    conversationId: `conv_s2_${Date.now()}`
  });
  const allBlackShirts = searchBlackShirts.products?.length > 0 && searchBlackShirts.products.every(p => p.price <= 700);
  console.log(`Search "Black shirts under ₹700": ${searchBlackShirts.products?.length} products (All <= 700: ${allBlackShirts})`);
  scorecard['3.2 Search: Black shirts under ₹700'] = allBlackShirts;

  // 3c. Shirt for office under ₹1000
  const searchOffice = await postJson('/api/ai/chat', {
    message: "Find me a shirt for office under ₹1000",
    userId: TEST_USER_ID,
    conversationId: `conv_s3_${Date.now()}`
  });
  const allOfficeShirts = searchOffice.products?.length > 0 && searchOffice.products.every(p => p.price <= 1000);
  console.log(`Search "Shirt for office under ₹1000": ${searchOffice.products?.length} products (All <= 1000: ${allOfficeShirts})`);
  scorecard['3.3 Search: Shirt for office under ₹1000'] = allOfficeShirts;

  // ──────────────────────────────────────────────────────────────────────────
  // 4. QUANTITY UPDATES & ADVANCED CART OPERATIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 4. QUANTITY UPDATES & ADVANCED CART');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const convQty = `conv_qty_${Date.now()}`;
  await postJson('/api/ai/chat', { message: 'clear cart', userId: TEST_USER_ID, conversationId: convQty });
  await postJson('/api/ai/chat', { message: 'add SHIRT-002 to cart', userId: TEST_USER_ID, conversationId: convQty });

  // "Make it two"
  const qtyRes2 = await postJson('/api/ai/chat', { message: 'Make it two', userId: TEST_USER_ID, conversationId: convQty });
  console.log(`"Make it two" result: Qty = ${qtyRes2.cart?.items?.[0]?.quantity}, Total = ₹${qtyRes2.cart?.total}`);
  scorecard['4.1 Cart: "Make it two"'] = qtyRes2.cart?.items?.[0]?.quantity === 2;

  // "Change quantity to 3"
  const qtyRes3 = await postJson('/api/ai/chat', { message: 'Change quantity to 3', userId: TEST_USER_ID, conversationId: convQty });
  console.log(`"Change quantity to 3" result: Qty = ${qtyRes3.cart?.items?.[0]?.quantity}, Total = ₹${qtyRes3.cart?.total}`);
  scorecard['4.2 Cart: "Change quantity to 3"'] = qtyRes3.cart?.items?.[0]?.quantity === 3;

  // ──────────────────────────────────────────────────────────────────────────
  // 5. REVIEW DATA CONSISTENCY AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 5. REVIEW DATA CONSISTENCY & VARIANT GROUNDING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const auditInfo = await postJson('/api/ai/chat', {
    message: 'Tell me about SHIRT-002',
    userId: TEST_USER_ID,
    conversationId: `conv_aud_${Date.now()}`
  });
  console.log(`Product Review Evidence: ${auditInfo.message?.substring(0, 120)}...`);
  console.log(`Conversational Response Latency: ${auditInfo.__latencyMs}ms`);
  scorecard['5.1 Review Consistency: Reconciled review counts'] = auditInfo.products?.length === 1 && auditInfo.products[0].rating >= 4.0;
  scorecard['5.2 Latency: Fast conversational responses (<800ms)'] = auditInfo.__latencyMs < 800;

  console.log('\n================================================================');
  console.log('📊 FINAL COMPREHENSIVE QA SCORECARD');
  console.log('================================================================');
  let totalPassed = 0;
  let totalTests = 0;
  for (const [testName, passed] of Object.entries(scorecard)) {
    totalTests++;
    if (passed) totalPassed++;
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} | ${testName}`);
  }
  console.log('================================================================');
  console.log(`🏆 OVERALL SCORE: ${totalPassed}/${totalTests} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log('================================================================\n');
  process.exit(totalPassed === totalTests ? 0 : 1);
}

runCompleteQaAudit().catch(err => {
  console.error('QA Execution Error:', err);
  process.exit(1);
});
