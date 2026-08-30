#!/usr/bin/env node

/**
 * Shopi AI Supabase Importer (Phase 14 - Production Ready)
 *
 * Idempotently ingests normalized canonical data into live Supabase tables:
 *   1. shopi_products
 *   2. shopi_product_attributes
 *   3. shopi_product_variants
 *   4. shopi_product_images
 *   5. shopi_product_tags
 *   6. shopi_product_reviews
 *   7. shopi_product_review_summary
 *   8. shopi_product_scores
 *   9. shopi_product_relationships (initialized empty)
 *
 * Enforces strict schema length & relational integrity constraints:
 *   - material VARCHAR(100): Clean canonical material extracted; full analysis in additional_attributes JSONB
 *   - occasion VARCHAR(100): High-signal concise occasions; granular tags in shopi_product_tags
 *   - sentiment VARCHAR(20): Standardized to 'positive' | 'negative' | 'mixed'
 *   - True idempotency for all 76 canonical products while preserving seed row SHOPI-TEST-001
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = path.resolve(PIPELINE_DIR, 'output');
const REPORTS_DIR = path.resolve(PIPELINE_DIR, 'reports');

// Try loading .env from multiple potential locations
const envPaths = [
  path.resolve(SCRIPT_DIR, '..', '..', '..', '.env'), // apps/ecommerce-backend/.env
  path.resolve(SCRIPT_DIR, '..', '..', '..', '..', '..', '.env'), // project root .env
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
  console.error('\n===============================================================');
  console.error('[ERROR] Missing required Supabase environment variables!');
  console.error('===============================================================');
  console.error(`SUPABASE_URL               : ${SUPABASE_URL ? 'CONFIGURED' : 'MISSING'}`);
  console.error(`SUPABASE_SERVICE_ROLE_KEY  : ${SUPABASE_KEY ? 'CONFIGURED' : 'MISSING'}`);
  console.error('\nPlease set these variables in apps/ecommerce-backend/.env or .env\n');
  process.exit(1);
}

const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');

async function supabaseRequest(endpoint, method, body = null, headers = {}) {
  const url = `${cleanBaseUrl}/rest/v1/${endpoint}`;
  const reqHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...headers
  };

  const options = { method, headers: reqHeaders };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const err = new Error(`Supabase [${response.status} ${response.statusText}] ${endpoint}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return { status: response.status, data, headers: response.headers };
}

// Extraction Helpers for Schema Compliance
function extractCanonicalMaterial(rawMaterial, rawFabric) {
  if (!rawMaterial && !rawFabric) return null;
  const val = rawMaterial || rawFabric;
  if (typeof val === 'string') {
    if (val.startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        const name = parsed.composition || parsed.listed_material || parsed.material_type || parsed.description_material || parsed.listed_composition || parsed.listing_highlight || 'Cotton Blend';
        return name.length > 100 ? name.substring(0, 100) : name;
      } catch {
        return val.substring(0, 100);
      }
    }
    return val.length > 100 ? val.substring(0, 100) : val;
  }
  if (typeof val === 'object' && val !== null) {
    const name = val.composition || val.listed_material || val.material_type || val.description_material || val.listed_composition || val.listing_highlight || 'Cotton Blend';
    return name.length > 100 ? name.substring(0, 100) : name;
  }
  return String(val).substring(0, 100);
}

function extractCanonicalOccasion(rawOccasion) {
  if (!rawOccasion) return null;
  const str = String(rawOccasion);
  if (str.length <= 100) return str;
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  const result = [];
  let currentLen = 0;
  for (const part of parts) {
    const nextLen = currentLen === 0 ? part.length : currentLen + 2 + part.length;
    if (nextLen <= 95) {
      result.push(part);
      currentLen = nextLen;
    }
  }
  return result.join(', ');
}

function extractCanonicalSentiment(rawSentiment) {
  if (!rawSentiment) return 'mixed';
  const s = String(rawSentiment).toLowerCase();
  if (s.startsWith('positive') || (s.includes('positive') && !s.includes('negative'))) {
    return 'positive';
  }
  if (s.startsWith('negative') || (s.includes('negative') && !s.includes('positive'))) {
    return 'negative';
  }
  return 'mixed';
}

function truncateStr(str, maxLen) {
  if (!str) return null;
  const s = String(str);
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

async function runImport() {
  const startTime = Date.now();
  console.log('\n===============================================================');
  console.log('         SHOPI AI SUPABASE LIVE DATA INGESTION PIPELINE        ');
  console.log('===============================================================');
  console.log(`Supabase Host : ${cleanBaseUrl}`);
  console.log('---------------------------------------------------------------');

  // Load canonical output JSON files
  const products = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'products.json'), 'utf8'));
  const attributes = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'attributes.json'), 'utf8'));
  const variants = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'variants.json'), 'utf8'));
  const images = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'images.json'), 'utf8'));
  const tags = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'tags.json'), 'utf8'));
  const reviews = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'reviews.json'), 'utf8'));
  const reviewSummaries = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'review-summary.json'), 'utf8'));
  const scores = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'scores.json'), 'utf8'));

  console.log(`Loaded ${products.length} canonical products to ingest.`);

  // -------------------------------------------------------------
  // 1. INGEST shopi_products
  // -------------------------------------------------------------
  console.log('\n[1/8] Ingesting shopi_products...');
  const productPayloads = products.map(p => ({
    sku: p.product_id,
    title: truncateStr(p.name, 255),
    brand: truncateStr(p.brand, 100),
    department: truncateStr(p.category === 'Formal-Shoes' || p.category === 'Sneakers' || p.category === 'Sports-Shoes' ? 'Footwear' : (p.category === 'Bags' ? 'Accessories' : 'Clothing'), 50),
    category: truncateStr(p.category, 100),
    subcategory: truncateStr(p.subcategory, 100),
    gender: truncateStr(p.gender, 30),
    short_description: p.description ? p.description.substring(0, 200) : null,
    description: p.description,
    mrp: p.mrp,
    selling_price: p.selling_price,
    discount_percentage: p.discount_percentage,
    currency: p.currency || 'INR',
    stock_quantity: 50,
    is_available: true,
    source_name: truncateStr(p.source_platform || 'Amazon India', 100),
    source_url: p.source_url
  }));

  // Upsert products matching on sku
  await supabaseRequest('shopi_products?on_conflict=sku', 'POST', productPayloads, {
    'Prefer': 'resolution=merge-duplicates, return=representation'
  });

  // Query all live products to build sku -> product_id map
  const { data: liveProducts } = await supabaseRequest('shopi_products?select=product_id,sku', 'GET');
  const skuToIdMap = new Map();
  const canonicalIntIds = [];

  liveProducts.forEach(p => {
    if (p.sku) {
      skuToIdMap.set(p.sku, p.product_id);
      if (p.sku !== 'SHOPI-TEST-001') {
        canonicalIntIds.push(p.product_id);
      }
    }
  });

  console.log(`  -> Synced ${liveProducts.length} live products (${canonicalIntIds.length} canonical SKUs mapped, SHOPI-TEST-001 preserved).`);

  // Clear previous child records for canonical products to ensure clean, idempotent re-runs
  const idFilter = `in.(${canonicalIntIds.join(',')})`;
  await supabaseRequest(`shopi_product_variants?product_id=${idFilter}`, 'DELETE');
  await supabaseRequest(`shopi_product_images?product_id=${idFilter}`, 'DELETE');
  await supabaseRequest(`shopi_product_tags?product_id=${idFilter}`, 'DELETE');
  await supabaseRequest(`shopi_product_reviews?product_id=${idFilter}`, 'DELETE');

  // -------------------------------------------------------------
  // 2. INGEST shopi_product_attributes
  // -------------------------------------------------------------
  console.log('\n[2/8] Ingesting shopi_product_attributes...');
  const attrBySku = new Map();
  attributes.forEach(a => {
    if (!attrBySku.has(a.product_id)) attrBySku.set(a.product_id, {});
    attrBySku.get(a.product_id)[a.attribute_name] = a.attribute_value;
  });

  const attributePayloads = [];
  for (const [sku, attrs] of attrBySku.entries()) {
    const intId = skuToIdMap.get(sku);
    if (!intId) continue;

    attributePayloads.push({
      product_id: intId,
      material: extractCanonicalMaterial(attrs.material, attrs.upper_material || attrs.fabric),
      fabric: truncateStr(attrs.fabric || attrs.material_composition, 100),
      fit: truncateStr(attrs.fit, 50),
      pattern: truncateStr(attrs.pattern, 100),
      primary_color: truncateStr(attrs.color, 50),
      secondary_color: null,
      sleeve_type: truncateStr(attrs.sleeve || attrs.sleeve_type, 100),
      collar_type: truncateStr(attrs.collar || attrs.collar_style, 100),
      occasion: extractCanonicalOccasion(attrs.occasion || attrs.occasions),
      season: truncateStr(attrs.season, 100),
      style: truncateStr(attrs.style, 100),
      comfort_level: 5,
      quality_level: 4,
      care_instructions: attrs.care || attrs.care_instructions || null,
      length_type: truncateStr(attrs.length, 50),
      stretchable: attrs.stretch ? !attrs.stretch.toLowerCase().includes('no') : null,
      shoe_type: truncateStr(attrs.shoe_type, 100),
      sole_material: truncateStr(attrs.sole_material, 100),
      closure_type: truncateStr(attrs.closure || attrs.closure_type, 100),
      buckle_type: truncateStr(attrs.buckle_type, 100),
      width_cm: null,
      additional_attributes: attrs // Full original object preserved in JSONB
    });
  }

  await supabaseRequest('shopi_product_attributes?on_conflict=product_id', 'POST', attributePayloads, {
    'Prefer': 'resolution=merge-duplicates, return=minimal'
  });
  console.log(`  -> Ingested ${attributePayloads.length} product attribute records.`);

  // -------------------------------------------------------------
  // 3. INGEST shopi_product_variants
  // -------------------------------------------------------------
  console.log('\n[3/8] Ingesting shopi_product_variants...');
  const variantPayloads = [];
  variants.forEach((v, idx) => {
    const intId = skuToIdMap.get(v.product_id);
    if (!intId) return;
    const cleanVal = v.variant_value ? v.variant_value.replace(/[^a-zA-Z0-9]/g, '-') : `V${idx}`;

    variantPayloads.push({
      product_id: intId,
      color: v.variant_type === 'color' ? truncateStr(v.variant_value, 50) : null,
      size: v.variant_type === 'size' ? truncateStr(v.variant_value, 50) : null,
      variant_sku: truncateStr(`${v.product_id}-${cleanVal}`, 100),
      stock_quantity: 10,
      is_available: v.available,
      additional_options: (v.image_path || v.image_url) ? { image_path: v.image_path, image_url: v.image_url } : {}
    });
  });

  for (let i = 0; i < variantPayloads.length; i += 100) {
    const chunk = variantPayloads.slice(i, i + 100);
    await supabaseRequest('shopi_product_variants', 'POST', chunk, {
      'Prefer': 'return=minimal'
    });
  }
  console.log(`  -> Ingested ${variantPayloads.length} variant records.`);

  // -------------------------------------------------------------
  // 4. INGEST shopi_product_images
  // -------------------------------------------------------------
  console.log('\n[4/8] Ingesting shopi_product_images...');
  const imagePayloads = [];
  images.forEach(img => {
    const intId = skuToIdMap.get(img.product_id);
    if (!intId) return;

    imagePayloads.push({
      product_id: intId,
      image_url: img.image_url || img.image_path,
      image_type: img.is_primary ? 'primary' : 'gallery',
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      sort_order: img.sort_order
    });
  });

  for (let i = 0; i < imagePayloads.length; i += 100) {
    const chunk = imagePayloads.slice(i, i + 100);
    await supabaseRequest('shopi_product_images', 'POST', chunk, {
      'Prefer': 'return=minimal'
    });
  }
  console.log(`  -> Ingested ${imagePayloads.length} image records.`);

  // -------------------------------------------------------------
  // 5. INGEST shopi_product_tags
  // -------------------------------------------------------------
  console.log('\n[5/8] Ingesting shopi_product_tags...');
  const seenTags = new Set();
  const tagPayloads = [];
  tags.forEach(t => {
    const intId = skuToIdMap.get(t.product_id);
    if (!intId) return;
    const cleanTag = truncateStr(t.tag, 100);
    const key = `${intId}:::${cleanTag.toLowerCase()}`;
    if (!seenTags.has(key)) {
      seenTags.add(key);
      tagPayloads.push({
        product_id: intId,
        tag: cleanTag,
        tag_type: truncateStr(t.tag_type, 50)
      });
    }
  });

  for (let i = 0; i < tagPayloads.length; i += 100) {
    const chunk = tagPayloads.slice(i, i + 100);
    await supabaseRequest('shopi_product_tags?on_conflict=product_id,tag', 'POST', chunk, {
      'Prefer': 'resolution=merge-duplicates, return=minimal'
    });
  }
  console.log(`  -> Ingested ${tagPayloads.length} unique semantic tag records.`);

  // -------------------------------------------------------------
  // 6. INGEST shopi_product_reviews
  // -------------------------------------------------------------
  console.log('\n[6/8] Ingesting shopi_product_reviews...');
  const reviewPayloads = [];
  reviews.forEach(r => {
    const intId = skuToIdMap.get(r.product_id);
    if (!intId) return;

    reviewPayloads.push({
      product_id: intId,
      rating: r.rating,
      review_title: truncateStr(r.title || 'Customer Review', 255),
      review_text: r.comment || r.title || 'Verified Customer Review',
      reviewer_name: truncateStr(r.reviewer_name || 'Verified Customer', 100),
      verified_purchase: r.verified_purchase ?? true,
      review_date: r.created_at ? r.created_at.split('T')[0] : null,
      helpful_count: 0,
      sentiment: extractCanonicalSentiment(r.sentiment),
      source_name: 'Amazon India'
    });
  });

  for (let i = 0; i < reviewPayloads.length; i += 100) {
    const chunk = reviewPayloads.slice(i, i + 100);
    await supabaseRequest('shopi_product_reviews', 'POST', chunk, {
      'Prefer': 'return=minimal'
    });
  }
  console.log(`  -> Ingested ${reviewPayloads.length} review records.`);

  // -------------------------------------------------------------
  // 7. INGEST shopi_product_review_summary
  // -------------------------------------------------------------
  console.log('\n[7/8] Ingesting shopi_product_review_summary...');
  const summaryPayloads = [];
  reviewSummaries.forEach(s => {
    const intId = skuToIdMap.get(s.product_id);
    if (!intId) return;

    summaryPayloads.push({
      product_id: intId,
      review_count: s.review_count || 0,
      average_rating: s.average_rating || 0,
      positive_percentage: s.positive_percentage,
      neutral_percentage: s.neutral_percentage,
      negative_percentage: s.negative_percentage,
      pros: s.pros,
      cons: s.cons,
      common_positive_topics: s.common_positive_themes,
      common_negative_topics: s.common_negative_themes,
      fit_summary: s.fit_feedback,
      comfort_summary: s.comfort_feedback,
      quality_summary: s.quality_feedback,
      recommendation_summary: s.buying_advice
    });
  });

  await supabaseRequest('shopi_product_review_summary?on_conflict=product_id', 'POST', summaryPayloads, {
    'Prefer': 'resolution=merge-duplicates, return=minimal'
  });
  console.log(`  -> Ingested ${summaryPayloads.length} review summary records.`);

  // -------------------------------------------------------------
  // 8. INGEST shopi_product_scores
  // -------------------------------------------------------------
  console.log('\n[8/8] Ingesting shopi_product_scores...');
  const scorePayloads = [];
  scores.forEach(sc => {
    const intId = skuToIdMap.get(sc.product_id);
    if (!intId) return;

    scorePayloads.push({
      product_id: intId,
      overall_score: sc.source_score ? (sc.source_score > 10 ? sc.source_score / 20 : sc.source_score) : 4.0,
      value_score: sc.value_score,
      quality_score: sc.quality_score,
      style_score: sc.style_score,
      review_confidence: sc.review_confidence,
      best_for: sc.best_for,
      not_ideal_for: sc.avoid_for,
      buying_advice: sc.source_recommendation
    });
  });

  await supabaseRequest('shopi_product_scores?on_conflict=product_id', 'POST', scorePayloads, {
    'Prefer': 'resolution=merge-duplicates, return=minimal'
  });
  console.log(`  -> Ingested ${scorePayloads.length} product score records.`);

  const durationMs = Date.now() - startTime;
  console.log('\n===============================================================');
  console.log(`✅ LIVE SUPABASE INGESTION COMPLETED in ${durationMs}ms`);
  console.log('===============================================================\n');
}

if (require.main === module) {
  runImport().catch(err => {
    console.error('\n[FATAL IMPORT ERROR]:', err.message);
    process.exit(1);
  });
}

module.exports = { runImport };
