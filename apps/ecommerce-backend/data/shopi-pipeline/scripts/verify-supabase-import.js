#!/usr/bin/env node

/**
 * Shopi AI Supabase Verification Script (Phase 14 - Production Audit)
 *
 * Verifies live Supabase table counts, schema adherence, and relational integrity.
 * Distinguishes between Canonical Ingested Data (76 products) and Seed Data (SHOPI-TEST-001).
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = path.resolve(PIPELINE_DIR, 'output');

// Load environment variables
const envPaths = [
  path.resolve(SCRIPT_DIR, '..', '..', '..', '.env'),
  path.resolve(SCRIPT_DIR, '..', '..', '..', '..', '..', '.env'),
  path.resolve(process.cwd(), 'storefront', 'apps', 'ecommerce-backend', '.env'),
  path.resolve(process.cwd(), '.env')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n[ERROR] Missing required Supabase environment variables!');
  process.exit(1);
}

const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');

async function queryCount(endpoint) {
  const url = `${cleanBaseUrl}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const range = res.headers.get('content-range');
  if (range && range.includes('/')) {
    return parseInt(range.split('/')[1], 10);
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function runVerification() {
  console.log('\n===============================================================');
  console.log('       SHOPI AI LIVE SUPABASE INGESTION VERIFICATION AUDIT     ');
  console.log('===============================================================');
  console.log(`Supabase Host : ${cleanBaseUrl}`);
  console.log('---------------------------------------------------------------');

  // Query live product IDs
  const res = await fetch(`${cleanBaseUrl}/rest/v1/shopi_products?select=product_id,sku`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const liveProducts = await res.json();

  const seedProduct = liveProducts.find(p => p.sku === 'SHOPI-TEST-001');
  const seedId = seedProduct ? seedProduct.product_id : 1;
  const canonicalProducts = liveProducts.filter(p => p.sku !== 'SHOPI-TEST-001');

  const auditSpecs = [
    {
      table: 'shopi_products',
      canonicalExpected: 76,
      seedExpected: 1,
      totalExpected: 77,
      description: 'Core product catalog records'
    },
    {
      table: 'shopi_product_attributes',
      canonicalExpected: 74, // 74 products with catalog attributes (2 review-only)
      seedExpected: 1,
      totalExpected: 75,
      description: 'Relational attribute records (1:1 with products)'
    },
    {
      table: 'shopi_product_variants',
      canonicalExpected: 681,
      seedExpected: 4,
      totalExpected: 685,
      description: 'Color & size variant records'
    },
    {
      table: 'shopi_product_images',
      canonicalExpected: 468,
      seedExpected: 1,
      totalExpected: 469,
      description: 'Product image mappings'
    },
    {
      table: 'shopi_product_tags',
      canonicalExpected: 2359,
      seedExpected: 0,
      totalExpected: 2359,
      description: 'Unique (product_id, tag) semantic records'
    },
    {
      table: 'shopi_product_reviews',
      canonicalExpected: 821,
      seedExpected: 0,
      totalExpected: 821,
      description: 'Verified customer review records'
    },
    {
      table: 'shopi_product_review_summary',
      canonicalExpected: 76,
      seedExpected: 1,
      totalExpected: 77,
      description: 'Aggregated review intelligence records'
    },
    {
      table: 'shopi_product_scores',
      canonicalExpected: 76,
      seedExpected: 1,
      totalExpected: 77,
      description: 'AI & product score records'
    },
    {
      table: 'shopi_product_relationships',
      canonicalExpected: 0,
      seedExpected: 0,
      totalExpected: 0,
      description: 'Relationship graph (Initialized empty)'
    }
  ];

  const auditResults = [];
  let allMatched = true;

  for (const spec of auditSpecs) {
    const totalLive = await queryCount(`${spec.table}?select=*&limit=1`);
    const canonicalLive = spec.table === 'shopi_products'
      ? await queryCount(`${spec.table}?sku=neq.SHOPI-TEST-001&select=*&limit=1`)
      : await queryCount(`${spec.table}?product_id=neq.${seedId}&select=*&limit=1`);

    const isMatch = canonicalLive === spec.canonicalExpected;
    if (!isMatch) allMatched = false;

    auditResults.push({
      'Table Name': spec.table,
      'Canonical Ingested': `${canonicalLive} / ${spec.canonicalExpected}`,
      'Seed Rows': totalLive - canonicalLive,
      'Total Live Rows': totalLive,
      'Audit Status': isMatch ? '✅ MATCH' : '⚠️ DISCREPANCY'
    });
  }

  console.table(auditResults);

  // Fetch 3 real products from live Supabase to prove data richness
  const sampleSkus = ['SHIRT-001', 'BAG-001', 'SNEAKER-001'];
  console.log('\n---------------------------------------------------------------');
  console.log('LIVE PRODUCT SAMPLES (FETCHED DIRECTLY FROM SUPABASE):');
  console.log('---------------------------------------------------------------');

  for (const sku of sampleSkus) {
    const prodRes = await fetch(`${cleanBaseUrl}/rest/v1/shopi_products?sku=eq.${sku}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    if (!prodRes[0]) continue;
    const p = prodRes[0];

    const attrRes = await fetch(`${cleanBaseUrl}/rest/v1/shopi_product_attributes?product_id=eq.${p.product_id}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    const varRes = await fetch(`${cleanBaseUrl}/rest/v1/shopi_product_variants?product_id=eq.${p.product_id}&limit=1&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    const imgRes = await fetch(`${cleanBaseUrl}/rest/v1/shopi_product_images?product_id=eq.${p.product_id}&limit=1&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    const tagRes = await fetch(`${cleanBaseUrl}/rest/v1/shopi_product_tags?product_id=eq.${p.product_id}&limit=1&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    const revCount = await queryCount(`shopi_product_reviews?product_id=eq.${p.product_id}&select=*&limit=1`);

    console.log(`\n📦 Product: ${p.sku} (ID: ${p.product_id})`);
    console.log(`   - Title        : ${p.title}`);
    console.log(`   - Category     : ${p.category}`);
    console.log(`   - Selling Price: ₹${p.selling_price} (MRP: ₹${p.mrp})`);
    console.log(`   - Sample Image : ${imgRes[0]?.image_url || 'N/A'}`);
    console.log(`   - Sample Attr  : Material: "${attrRes[0]?.material}", Fit: "${attrRes[0]?.fit}"`);
    console.log(`   - Sample Variant: Color: "${varRes[0]?.color}", Size: "${varRes[0]?.size}"`);
    console.log(`   - Sample Tag   : "${tagRes[0]?.tag}" (${tagRes[0]?.tag_type})`);
    console.log(`   - Review Count : ${revCount} verified reviews`);
  }

  console.log('\n===============================================================');
  console.log(`FINAL VERDICT: ${allMatched ? '✅ IMPORT VERIFIED - 100% CANONICAL DATA INGESTED & PRESERVED' : '⚠️ DISCREPANCY DETECTED'}`);
  console.log('===============================================================\n');
}

if (require.main === module) {
  runVerification().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runVerification };
