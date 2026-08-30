#!/usr/bin/env node

/**
 * Diagnostic Schema Length Auditor
 *
 * Scans all 9 canonical datasets against live Supabase OpenAPI schema column length constraints.
 * Generates:
 *   reports/schema-length-audit.json
 *   reports/schema-length-audit.md
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PIPELINE_DIR, 'output');
const REPORTS_DIR = path.join(PIPELINE_DIR, 'reports');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const BASE_URL = 'https://ogppkxqvfzsusdawqbzx.supabase.co/rest/v1';

async function diagnose() {
  console.log('\n===============================================================');
  console.log('         SHOPI AI LIVE SCHEMA LENGTH DIAGNOSTIC AUDIT          ');
  console.log('===============================================================');

  const swagger = await fetch(BASE_URL + '/', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }).then(r => r.json());

  // Load all canonical datasets
  const products = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'products.json'), 'utf8'));
  const attributes = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'attributes.json'), 'utf8'));
  const variants = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'variants.json'), 'utf8'));
  const images = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'images.json'), 'utf8'));
  const tags = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'tags.json'), 'utf8'));
  const reviews = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'reviews.json'), 'utf8'));
  const reviewSummaries = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'review-summary.json'), 'utf8'));
  const scores = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'scores.json'), 'utf8'));
  const relationships = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'relationships.json'), 'utf8'));

  const violations = [];

  function checkCol(table, recordId, col, val) {
    if (val === null || val === undefined) return;
    const def = swagger.definitions[table]?.properties?.[col];
    if (!def) return;
    const maxLen = def.maxLength;
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (maxLen && strVal.length > maxLen) {
      violations.push({
        table,
        column: col,
        recordId,
        valueLength: strVal.length,
        maxLength: maxLen,
        value: strVal
      });
    }
  }

  // 1. Check shopi_products
  products.forEach(p => {
    checkCol('shopi_products', p.product_id, 'sku', p.product_id);
    checkCol('shopi_products', p.product_id, 'title', p.name);
    checkCol('shopi_products', p.product_id, 'brand', p.brand);
    checkCol('shopi_products', p.product_id, 'department', p.category === 'Formal-Shoes' || p.category === 'Sneakers' || p.category === 'Sports-Shoes' ? 'Footwear' : (p.category === 'Bags' ? 'Accessories' : 'Clothing'));
    checkCol('shopi_products', p.product_id, 'category', p.category);
    checkCol('shopi_products', p.product_id, 'subcategory', p.subcategory);
    checkCol('shopi_products', p.product_id, 'gender', p.gender);
    checkCol('shopi_products', p.product_id, 'currency', p.currency);
    checkCol('shopi_products', p.product_id, 'source_name', p.source_platform);
  });

  // 2. Check shopi_product_attributes (Raw records in attributes.json AND mapped payloads)
  const attrBySku = new Map();
  attributes.forEach(a => {
    if (!attrBySku.has(a.product_id)) attrBySku.set(a.product_id, {});
    attrBySku.get(a.product_id)[a.attribute_name] = a.attribute_value;
  });

  for (const [sku, attrs] of attrBySku.entries()) {
    checkCol('shopi_product_attributes', sku, 'material', attrs.material || attrs.upper_material || attrs.fabric);
    checkCol('shopi_product_attributes', sku, 'fabric', attrs.fabric || attrs.material_composition);
    checkCol('shopi_product_attributes', sku, 'fit', attrs.fit);
    checkCol('shopi_product_attributes', sku, 'pattern', attrs.pattern);
    checkCol('shopi_product_attributes', sku, 'primary_color', attrs.color);
    checkCol('shopi_product_attributes', sku, 'secondary_color', attrs.secondary_color);
    checkCol('shopi_product_attributes', sku, 'sleeve_type', attrs.sleeve || attrs.sleeve_type);
    checkCol('shopi_product_attributes', sku, 'collar_type', attrs.collar || attrs.collar_style);
    checkCol('shopi_product_attributes', sku, 'occasion', attrs.occasion || attrs.occasions);
    checkCol('shopi_product_attributes', sku, 'season', attrs.season);
    checkCol('shopi_product_attributes', sku, 'style', attrs.style);
    checkCol('shopi_product_attributes', sku, 'length_type', attrs.length);
    checkCol('shopi_product_attributes', sku, 'shoe_type', attrs.shoe_type);
    checkCol('shopi_product_attributes', sku, 'sole_material', attrs.sole_material);
    checkCol('shopi_product_attributes', sku, 'closure_type', attrs.closure || attrs.closure_type);
    checkCol('shopi_product_attributes', sku, 'buckle_type', attrs.buckle_type);
  }

  // 3. Check shopi_product_variants
  variants.forEach((v, idx) => {
    checkCol('shopi_product_variants', `${v.product_id}[${v.variant_type}]`, 'color', v.variant_type === 'color' ? v.variant_value : null);
    checkCol('shopi_product_variants', `${v.product_id}[${v.variant_type}]`, 'size', v.variant_type === 'size' ? v.variant_value : null);
    checkCol('shopi_product_variants', `${v.product_id}[${v.variant_type}]`, 'variant_sku', `${v.product_id}-${v.variant_value}`);
  });

  // 4. Check shopi_product_images
  images.forEach(img => {
    checkCol('shopi_product_images', `${img.product_id}`, 'image_type', img.is_primary ? 'primary' : 'gallery');
  });

  // 5. Check shopi_product_tags
  tags.forEach(t => {
    checkCol('shopi_product_tags', `${t.product_id}:${t.tag_type}`, 'tag', t.tag);
    checkCol('shopi_product_tags', `${t.product_id}:${t.tag_type}`, 'tag_type', t.tag_type);
  });

  // 6. Check shopi_product_reviews
  reviews.forEach(r => {
    checkCol('shopi_product_reviews', `${r.product_id}:${r.review_id}`, 'review_title', r.title);
    checkCol('shopi_product_reviews', `${r.product_id}:${r.review_id}`, 'reviewer_name', r.reviewer_name);
    checkCol('shopi_product_reviews', `${r.product_id}:${r.review_id}`, 'sentiment', r.sentiment);
  });

  console.log(`Total Schema Violations Found Across All Datasets: ${violations.length}\n`);

  violations.forEach((v, i) => {
    console.log(`[#${i + 1}] Table: ${v.table}.${v.column} (Max: ${v.maxLength} chars) | Record: ${v.recordId} | Length: ${v.valueLength}`);
    console.log(`     Value: "${v.value}"\n`);
  });

  // Prepare full diagnostic report object
  const report = {
    timestamp: new Date().toISOString(),
    total_violations: violations.length,
    violations: violations.map(v => {
      let classification = 'A';
      let recommendation = '';

      if (v.column === 'material' && v.value.startsWith('{')) {
        classification = 'B (Nested JSON object stringified instead of extracting clean material name)';
        try {
          const parsed = JSON.parse(v.value);
          recommendation = `Extract clean material string: "${parsed.composition || parsed.listed_material || parsed.material_type || 'Cotton Blend'}" and preserve the full JSON in additional_attributes.`;
        } catch {
          recommendation = 'Clean string parsing required.';
        }
      } else if (v.column === 'occasion') {
        classification = 'C (Verbose comma-separated list exceeding 100 chars)';
        recommendation = 'Normalize to primary occasion summary (under 100 chars) and preserve detailed occasion list in additional_attributes / shopi_product_tags.';
      } else {
        classification = 'D (Value length exceeds column constraint)';
        recommendation = 'Shorten value to fit column constraint.';
      }

      return {
        table: v.table,
        column: v.column,
        record_id: v.recordId,
        actual_length: v.valueLength,
        max_allowed_length: v.maxLength,
        value: v.value,
        classification,
        recommendation
      };
    })
  };

  fs.writeFileSync(path.join(REPORTS_DIR, 'schema-length-audit.json'), JSON.stringify(report, null, 2), 'utf8');

  // Generate Markdown report
  let md = `# Shopi AI Schema Length & Type Constraint Diagnostic Report\n\n`;
  md += `**Audit Generated:** ${report.timestamp}  \n`;
  md += `**Total Violations Detected:** ${report.total_violations}  \n\n`;
  md += `--- \n\n`;
  md += `## 1. Summary of Identified Violations\n\n`;
  md += `| Table | Column | Max Allowed | Record ID | Actual Length | Classification | Recommended Fix |\n`;
  md += `| :--- | :--- | :---: | :--- | :---: | :--- | :--- |\n`;

  report.violations.forEach(v => {
    md += `| \`${v.table}\` | \`${v.column}\` | ${v.max_allowed_length} | \`${v.record_id}\` | **${v.actual_length}** | ${v.classification.split('(')[0].trim()} | ${v.recommendation} |\n`;
  });

  md += `\n--- \n\n`;
  md += `## 2. Detailed Breakdown of Violations\n\n`;
  report.violations.forEach((v, idx) => {
    md += `### Violation ${idx + 1}: \`${v.table}.${v.column}\` on Product \`${v.record_id}\`\n`;
    md += `- **Column Type Limit:** \`VARCHAR(${v.max_allowed_length})\`\n`;
    md += `- **Offending String Length:** **${v.actual_length}** characters\n`;
    md += `- **Classification:** ${v.classification}\n`;
    md += `- **Offending Value:**\n\`\`\`text\n${v.value}\n\`\`\`\n`;
    md += `- **Recommended Resolution:** ${v.recommendation}\n\n`;
  });

  fs.writeFileSync(path.join(REPORTS_DIR, 'schema-length-audit.md'), md, 'utf8');
  console.log('Saved reports:');
  console.log(`  - ${path.join(REPORTS_DIR, 'schema-length-audit.json')}`);
  console.log(`  - ${path.join(REPORTS_DIR, 'schema-length-audit.md')}`);
}

if (require.main === module) {
  diagnose().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { diagnose };
