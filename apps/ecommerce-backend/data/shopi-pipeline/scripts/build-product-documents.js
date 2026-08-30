#!/usr/bin/env node

/**
 * Product Document Generator for Semantic Embeddings (Phase 2 & 3)
 *
 * Constructs retrieval-optimized, factual textual representations of all 76 canonical products.
 * Uses ONLY factual data stored in Supabase / canonical outputs.
 * Computes deterministic SHA-256 content hashes for change detection.
 *
 * Output:
 *   apps/ecommerce-backend/data/shopi-pipeline/output/documents.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = path.resolve(PIPELINE_DIR, 'output');

function computeHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function buildDocumentForProduct(p, attrs, variants, tags, summary, scores) {
  const parts = [];

  // 1. Identity & Classification
  if (p.name || p.title) parts.push(`Title: ${p.name || p.title}`);
  if (p.brand) parts.push(`Brand: ${p.brand}`);
  if (p.category) {
    const catStr = p.subcategory ? `${p.category} > ${p.subcategory}` : p.category;
    parts.push(`Category: ${catStr}`);
  }
  if (p.gender) parts.push(`Gender: ${p.gender}`);

  // 2. Commercial Pricing
  if (p.selling_price) {
    const mrpStr = p.mrp ? `, MRP: ₹${p.mrp}` : '';
    const discountStr = p.discount_percentage ? `, Discount: ${p.discount_percentage}% off` : '';
    parts.push(`Price: ₹${p.selling_price} (${p.currency || 'INR'}${mrpStr}${discountStr})`);
  }

  // 3. Physical Attributes (Factual only)
  const attrParts = [];
  if (attrs.material) attrParts.push(`Material: ${attrs.material}`);
  if (attrs.fabric && attrs.fabric !== attrs.material) attrParts.push(`Fabric: ${attrs.fabric}`);
  if (attrs.fit) attrParts.push(`Fit: ${attrs.fit}`);
  if (attrs.pattern) attrParts.push(`Pattern: ${attrs.pattern}`);
  if (attrs.sleeve || attrs.sleeve_type) attrParts.push(`Sleeve: ${attrs.sleeve || attrs.sleeve_type}`);
  if (attrs.collar || attrs.collar_type) attrParts.push(`Collar: ${attrs.collar || attrs.collar_type}`);
  if (attrs.shoe_type) attrParts.push(`Shoe Type: ${attrs.shoe_type}`);
  if (attrs.sole_material) attrParts.push(`Sole: ${attrs.sole_material}`);
  if (attrs.closure || attrs.closure_type) attrParts.push(`Closure: ${attrs.closure || attrs.closure_type}`);
  if (attrs.capacity) attrParts.push(`Capacity: ${attrs.capacity}`);
  if (attrs.laptop_compatible !== undefined && attrs.laptop_compatible !== null) {
    attrParts.push(`Laptop Compatible: ${attrs.laptop_compatible ? 'Yes' : 'No'}`);
  }
  if (attrParts.length > 0) {
    parts.push(`Attributes: ${attrParts.join(' | ')}`);
  }

  // 4. Occasion & Style
  if (attrs.occasion || attrs.occasions) {
    parts.push(`Occasions: ${attrs.occasion || attrs.occasions}`);
  }
  if (attrs.style) {
    parts.push(`Style: ${attrs.style}`);
  }
  if (attrs.season) {
    parts.push(`Season: ${attrs.season}`);
  }

  // 5. Variants (Colors & Sizes)
  const colors = Array.from(new Set(variants.filter(v => v.variant_type === 'color' || v.color).map(v => v.variant_value || v.color))).filter(Boolean);
  const sizes = Array.from(new Set(variants.filter(v => v.variant_type === 'size' || v.size).map(v => v.variant_value || v.size))).filter(Boolean);

  const varParts = [];
  if (colors.length > 0) varParts.push(`Colors: ${colors.join(', ')}`);
  if (sizes.length > 0) varParts.push(`Sizes: ${sizes.join(', ')}`);
  if (varParts.length > 0) {
    parts.push(`Available Options: ${varParts.join(' | ')}`);
  }

  // 6. Semantic Tags & Use Cases
  if (tags && tags.length > 0) {
    const uniqueTags = Array.from(new Set(tags.map(t => (t.tag || t).toLowerCase()))).slice(0, 15);
    parts.push(`Tags & Use Cases: ${uniqueTags.join(', ')}`);
  }

  // 7. Product Description (Truncated concise summary)
  if (p.description && p.description !== p.name && p.description !== p.title) {
    const desc = p.description.replace(/\s+/g, ' ').trim();
    if (desc.length > 0) {
      parts.push(`Description: ${desc.length > 250 ? desc.substring(0, 247) + '...' : desc}`);
    }
  }

  // 8. Review Intelligence & Customer Sentiment
  if (summary) {
    const ratingStr = summary.average_rating ? `${summary.average_rating}★` : '';
    const countStr = summary.review_count ? ` across ${summary.review_count} ratings` : '';
    if (ratingStr) {
      parts.push(`Customer Rating: ${ratingStr}${countStr}`);
    }
    if (summary.pros && summary.pros.length > 0) {
      parts.push(`Key Strengths: ${summary.pros.slice(0, 4).join(', ')}`);
    }
    if (summary.cons && summary.cons.length > 0) {
      parts.push(`Customer Considerations: ${summary.cons.slice(0, 3).join(', ')}`);
    }
    if (summary.fit_feedback || summary.fit_summary) {
      parts.push(`Fit Feedback: ${summary.fit_feedback || summary.fit_summary}`);
    }
    if (summary.comfort_feedback || summary.comfort_summary) {
      parts.push(`Comfort Feedback: ${summary.comfort_feedback || summary.comfort_summary}`);
    }
    if (summary.buying_advice || summary.recommendation_summary) {
      parts.push(`Buying Advice: ${summary.buying_advice || summary.recommendation_summary}`);
    }
  }

  // 9. AI Scoring & Best-For Recommendations
  if (scores) {
    if (scores.best_for && scores.best_for.length > 0) {
      parts.push(`Best For: ${scores.best_for.slice(0, 4).join(', ')}`);
    }
    if (scores.avoid_for || scores.not_ideal_for) {
      const avoid = scores.avoid_for || scores.not_ideal_for;
      if (avoid.length > 0) parts.push(`Not Ideal For: ${avoid.slice(0, 3).join(', ')}`);
    }
  }

  const documentText = parts.join('\n');
  return {
    document_text: documentText,
    content_hash: computeHash(documentText)
  };
}

function generateAllDocuments() {
  console.log('\n===============================================================');
  console.log('       GENERATING DETERMINISTIC PRODUCT EMBEDDING DOCUMENTS    ');
  console.log('===============================================================');

  const products = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'products.json'), 'utf8'));
  const rawAttributes = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'attributes.json'), 'utf8'));
  const rawVariants = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'variants.json'), 'utf8'));
  const rawTags = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'tags.json'), 'utf8'));
  const rawSummaries = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'review-summary.json'), 'utf8'));
  const rawScores = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'scores.json'), 'utf8'));

  // Group child entities by product_id (SKU)
  const attrBySku = new Map();
  rawAttributes.forEach(a => {
    if (!attrBySku.has(a.product_id)) attrBySku.set(a.product_id, {});
    attrBySku.get(a.product_id)[a.attribute_name] = a.attribute_value;
  });

  const variantsBySku = new Map();
  rawVariants.forEach(v => {
    if (!variantsBySku.has(v.product_id)) variantsBySku.set(v.product_id, []);
    variantsBySku.get(v.product_id).push(v);
  });

  const tagsBySku = new Map();
  rawTags.forEach(t => {
    if (!tagsBySku.has(t.product_id)) tagsBySku.set(t.product_id, []);
    tagsBySku.get(t.product_id).push(t);
  });

  const summaryBySku = new Map();
  rawSummaries.forEach(s => summaryBySku.set(s.product_id, s));

  const scoresBySku = new Map();
  rawScores.forEach(sc => scoresBySku.set(sc.product_id, sc));

  const documents = [];

  products.forEach(p => {
    const sku = p.product_id;
    const attrs = attrBySku.get(sku) || {};
    const vars = variantsBySku.get(sku) || [];
    const tags = tagsBySku.get(sku) || [];
    const summary = summaryBySku.get(sku) || null;
    const scores = scoresBySku.get(sku) || null;

    const docResult = buildDocumentForProduct(p, attrs, vars, tags, summary, scores);

    documents.push({
      product_id: sku,
      sku: sku,
      title: p.name || p.title,
      category: p.category,
      selling_price: p.selling_price,
      mrp: p.mrp,
      document_text: docResult.document_text,
      content_hash: docResult.content_hash,
      char_count: docResult.document_text.length,
      created_at: new Date().toISOString()
    });
  });

  const outPath = path.join(OUTPUT_DIR, 'documents.json');
  fs.writeFileSync(outPath, JSON.stringify(documents, null, 2), 'utf8');

  console.log(`Generated ${documents.length} factual product documents.`);
  console.log(`Saved to: ${outPath}`);

  // Print 2 sample documents
  console.log('\n--- SAMPLE 1 (SHIRT-001) ---');
  console.log(documents.find(d => d.sku === 'SHIRT-001')?.document_text);
  console.log('\n--- SAMPLE 2 (FORMAL-SHOE-006 - Factual only, no invented fields) ---');
  console.log(documents.find(d => d.sku === 'FORMAL-SHOE-006')?.document_text);
  console.log('---------------------------------------------------------------\n');

  return documents;
}

if (require.main === module) {
  generateAllDocuments();
}

module.exports = { buildDocumentForProduct, generateAllDocuments };
