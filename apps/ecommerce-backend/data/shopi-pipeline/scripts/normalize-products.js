#!/usr/bin/env node

/**
 * Shopi AI Product Normalization Pipeline
 *
 * Normalizes raw product JSON files and asset folders from:
 * apps/ecommerce-backend/data/shopi-data/products/
 *
 * Outputs canonical relational datasets into:
 * apps/ecommerce-backend/data/shopi-pipeline/output/
 *   - products.json
 *   - attributes.json
 *   - variants.json
 *   - images.json
 *   - tags.json
 *   - reviews.json
 *   - review-summary.json
 *   - scores.json
 *   - relationships.json
 *
 * Generates audit report in:
 * apps/ecommerce-backend/data/shopi-pipeline/reports/normalization-report.json
 */

const fs = require('fs');
const path = require('path');

// Resolve paths
const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const PRODUCTS_DIR = path.resolve(PIPELINE_DIR, '..', 'shopi-data', 'products');
const OUTPUT_DIR = path.resolve(PIPELINE_DIR, 'output');
const REPORTS_DIR = path.resolve(PIPELINE_DIR, 'reports');

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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ogppkxqvfzsusdawqbzx.supabase.co';
const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');

function getStoragePublicUrl(imagePath) {
  if (!imagePath) return null;
  const storagePath = imagePath.replace(/^products\//, '');
  return `${cleanBaseUrl}/storage/v1/object/public/shopi-product-images/${encodeURI(storagePath)}`;
}

// Helper: Clean string
function cleanStr(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.length > 0 ? val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v).trim()).join(', ') : null;
    }
    return JSON.stringify(val);
  }
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

// Helper: Clean number
function cleanNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// Helper: Format color name from filename
function deriveColorFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  // Remove trailing digits e.g. "dark blue-2" -> "Dark Blue", "white5" -> "White"
  const cleaned = base.replace(/[-_]/g, ' ').replace(/\d+$/, '').trim();
  if (!cleaned) return 'Standard';
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Helper: Extract string feedback from insight note/sentiment
function extractInsightText(insight) {
  if (!insight) return null;
  if (typeof insight === 'string') return insight.trim();
  if (typeof insight === 'object') {
    if (insight.note) return String(insight.note).trim();
    if (insight.sentiment) return `Sentiment: ${insight.sentiment}${insight.confidence ? ` (confidence: ${insight.confidence})` : ''}`;
    return JSON.stringify(insight);
  }
  return null;
}

function runNormalization() {
  const startTime = Date.now();

  const report = {
    generated_at: new Date().toISOString(),
    total_source_products: 0,
    total_normalized_products: 0,
    products_rejected: 0,
    rejection_reasons: [],
    attributes_generated: 0,
    variants_generated: 0,
    images_generated: 0,
    tags_generated: 0,
    reviews_generated: 0,
    review_summaries_generated: 0,
    scores_generated: 0,
    relationships_generated: 0,
    warnings: [],
    errors: []
  };

  const canonicalProducts = [];
  const canonicalAttributes = [];
  const canonicalVariants = [];
  const canonicalImages = [];
  const canonicalTags = [];
  const canonicalReviews = [];
  const canonicalReviewSummaries = [];
  const canonicalScores = [];
  const canonicalRelationships = []; // Foundation table

  // Discover all categories dynamically
  const categories = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const category of categories) {
    const categoryPath = path.join(PRODUCTS_DIR, category);
    const jsonFiles = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.json'))
      .map(f => f.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const jsonFileName of jsonFiles) {
      report.total_source_products++;
      const fullJsonPath = path.join(categoryPath, jsonFileName);
      const relativeJsonPath = path.join('products', category, jsonFileName).replace(/\\/g, '/');
      const fileStats = fs.statSync(fullJsonPath);

      // Check empty files
      if (fileStats.size === 0) {
        report.products_rejected++;
        report.rejection_reasons.push({
          file: relativeJsonPath,
          category,
          reason: 'Source JSON file is empty (0 bytes). Preserved as placeholder.'
        });
        report.warnings.push(`Skipped empty 0-byte file: ${relativeJsonPath}`);
        continue;
      }

      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));
      } catch (e) {
        report.products_rejected++;
        report.rejection_reasons.push({
          file: relativeJsonPath,
          category,
          reason: `Invalid JSON syntax: ${e.message}`
        });
        report.errors.push(`Error parsing ${relativeJsonPath}: ${e.message}`);
        continue;
      }

      // -------------------------------------------------------------
      // 1. EXTRACT PRODUCT IDENTITY & CORE COMMERCIAL FIELDS
      // -------------------------------------------------------------
      const productId = cleanStr(
        raw.product_id ||
        raw.productId ||
        raw.product?.id ||
        raw.product?.product_id ||
        raw.sku ||
        raw.product?.sku ||
        raw.id ||
        jsonFileName.replace(/\.json$/i, '')
      );

      const name = cleanStr(
        raw.name ||
        raw.product?.name ||
        raw.product?.title ||
        raw.title ||
        raw.basic_info?.name ||
        raw.catalog?.name ||
        (raw.brand && raw.subcategory ? `${raw.brand} ${raw.subcategory}` : null) ||
        productId
      );

      const brand = cleanStr(
        raw.brand ||
        raw.product?.brand ||
        raw.basic_info?.brand ||
        raw.catalog?.brand ||
        raw.brand_information?.brand_name ||
        raw.brand_info?.brand ||
        null
      );

      const subcategory = cleanStr(
        raw.subcategory ||
        raw.product?.subcategory ||
        raw.basic_info?.subcategory ||
        raw.catalog?.subcategory ||
        raw.catalog?.generic_name ||
        null
      );

      const gender = cleanStr(
        raw.gender ||
        raw.product?.gender ||
        raw.basic_info?.gender ||
        raw.catalog?.gender ||
        raw.department ||
        raw.catalog?.department ||
        'Unisex'
      );

      const productType = cleanStr(
        raw.product_type ||
        raw.product?.product_type ||
        raw.basic_info?.product_type ||
        raw.catalog?.generic_name ||
        category
      );

      const description = cleanStr(
        raw.description ||
        raw.product?.description ||
        raw.basic_info?.description ||
        raw.catalog?.description ||
        null
      );

      // Pricing extraction
      const pricingObj = raw.pricing || raw.product?.pricing || raw.catalog?.pricing || null;
      const sizePrices = Array.isArray(raw.size_prices) ? raw.size_prices : null;

      let mrp = cleanNum(pricingObj?.mrp ?? (sizePrices && sizePrices[0]?.mrp));
      let sellingPrice = cleanNum(
        pricingObj?.selling_price ??
        pricingObj?.current_price ??
        pricingObj?.listing_price ??
        (sizePrices && sizePrices[0]?.price)
      );

      // Verified dataset pricing corrections for specific SKUs with missing raw JSON pricing
      const PRICE_CORRECTIONS = {
        'FORMAL-SHOE-006': { mrp: 999, selling_price: 399 },
        'SHIRT-004': { mrp: 999, selling_price: 398 },
        'SHIRT-010': { mrp: 1799, selling_price: 503 },
        'SHIRT-011': { mrp: 2099, selling_price: 1179 },
        'SHIRT-012': { mrp: 1999, selling_price: 495 },
        'SHIRT-013': { mrp: 1999, selling_price: 395 },
        'SPORTS-SHOE-001': { mrp: 1499, selling_price: 599 },
        'SPORTS-SHOE-002': { mrp: 1299, selling_price: 494 },
        'SPORTS-SHOE-003': { mrp: 2499, selling_price: 999 },
        'SPORTS-SHOE-004': { mrp: 1499, selling_price: 499 },
        'SPORTS-SHOE-006': { mrp: 2499, selling_price: 999 },
        'SPORTS-SHOE-007': { mrp: 1499, selling_price: 499 }
      };

      if (PRICE_CORRECTIONS[productId]) {
        mrp = PRICE_CORRECTIONS[productId].mrp;
        sellingPrice = PRICE_CORRECTIONS[productId].selling_price;
      }

      const currency = cleanStr(pricingObj?.currency) || 'INR';

      let discountPercentage = cleanNum(
        (mrp && sellingPrice && mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : null) ??
        pricingObj?.discount_percentage ??
        pricingObj?.discount_percent
      );

      // Availability extraction
      const availability = cleanStr(
        raw.availability?.status ||
        raw.catalog?.availability ||
        (raw.inventory_signals?.in_stock ? 'In Stock' : null) ||
        'In Stock'
      );

      // Source metadata
      const sourcePlatform = cleanStr(raw.source?.platform || raw.source_metadata?.platform || 'Amazon India');
      const sourceUrl = cleanStr(raw.source?.url || raw.source_metadata?.url || null);

      canonicalProducts.push({
        product_id: productId,
        name,
        brand,
        category,
        subcategory,
        gender,
        product_type: productType,
        description,
        mrp,
        selling_price: sellingPrice,
        currency,
        discount_percentage: discountPercentage,
        availability,
        source_platform: sourcePlatform,
        source_url: sourceUrl
      });
      report.total_normalized_products++;

      // -------------------------------------------------------------
      // 2. EXTRACT ATTRIBUTES (EAV flexible schema)
      // -------------------------------------------------------------
      const seenAttributeKeys = new Set();

      function addAttribute(attrName, attrValue) {
        if (attrValue === null || attrValue === undefined) return;
        const cleanName = cleanStr(attrName).toLowerCase().replace(/[\s-]+/g, '_');
        if (seenAttributeKeys.has(cleanName)) return;

        let formattedValue;
        if (Array.isArray(attrValue)) {
          if (attrValue.length === 0) return;
          formattedValue = attrValue.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v).trim()).join(', ');
        } else if (typeof attrValue === 'object') {
          formattedValue = JSON.stringify(attrValue);
        } else {
          formattedValue = String(attrValue).trim();
        }

        if (formattedValue.length === 0) return;

        canonicalAttributes.push({
          product_id: productId,
          attribute_name: cleanName,
          attribute_value: formattedValue
        });
        seenAttributeKeys.add(cleanName);
        report.attributes_generated++;
      }

      // Collect attributes from all category containers
      const attributeSources = [
        raw.attributes,
        raw.product?.attributes,
        raw.product,
        raw.basic_info,
        raw.product_details,
        raw.physical_details,
        raw.materials,
        raw.comfort_and_features,
        raw.storage,
        raw.carrying,
        raw.features ? { key_features: raw.features } : null,
        raw.ai_search_attributes,
        raw.brand_information,
        raw.brand_info
      ];

      // Ignore core entity keys that belong in products.json
      const ignoredAttrKeys = new Set([
        'id', 'product_id', 'productid', 'sku', 'name', 'title', 'brand',
        'category', 'subcategory', 'gender', 'product_type', 'description',
        'pricing', 'variants', 'images', 'rating', 'ratings', 'reviews',
        'review_summary', 'review_insights', 'tags', 'source', 'source_metadata',
        'colors', 'sizes', 'available_colors', 'available_sizes', 'color_options',
        'pros', 'cons', 'buying_advice', 'ai_matching', 'shopi_ai_rules',
        'data_quality', 'occasions', 'use_cases', 'pairing', 'ai_signals',
        'inventory_signals', 'variant'
      ]);

      for (const source of attributeSources) {
        if (source && typeof source === 'object' && !Array.isArray(source)) {
          for (const [k, v] of Object.entries(source)) {
            if (!ignoredAttrKeys.has(k.toLowerCase())) {
              addAttribute(k, v);
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 3. EXTRACT VARIANTS (Colors & Sizes)
      // -------------------------------------------------------------
      const seenVariants = new Set();

      function addVariant(variantType, variantValue, available = true, imagePath = null) {
        const valStr = cleanStr(variantValue);
        if (!valStr) return;
        const key = `${productId}|${variantType}|${valStr.toLowerCase()}`;
        if (seenVariants.has(key)) return;

        canonicalVariants.push({
          product_id: productId,
          variant_type: variantType,
          variant_value: valStr,
          available: available !== false,
          image_path: cleanStr(imagePath)
        });
        seenVariants.add(key);
        report.variants_generated++;
      }

      // Extract colors from all source representations
      const colorSources = [
        raw.colors,
        raw.available_colors,
        raw.color_options,
        raw.product?.colors,
        raw.product?.available_colors,
        raw.product?.color_options,
        raw.product?.color,
        raw.variant?.color,
        raw.variants?.colors,
        raw.product?.variants?.colors,
        raw.default_color
      ];

      for (const colList of colorSources) {
        if (typeof colList === 'string') {
          addVariant('color', colList, true);
        } else if (Array.isArray(colList)) {
          colList.forEach(c => {
            if (typeof c === 'string') {
              addVariant('color', c, true);
            } else if (c && typeof c === 'object') {
              const cName = c.name || c.color_name || c.color || c.label;
              const cAvail = c.available ?? c.in_stock ?? true;
              const cImg = c.image ? (c.image.includes('/') ? c.image : `products/${category}/${productId}/${c.image}`) : null;
              addVariant('color', cName, cAvail, cImg);
            }
          });
        }
      }

      // Extract sizes from all source representations
      const sizeSources = [
        raw.sizes,
        raw.available_sizes,
        raw.product?.sizes,
        raw.product?.available_sizes,
        raw.variant?.available_sizes,
        raw.variants?.sizes,
        raw.product?.variants?.sizes,
        raw.sizes?.available_uk_sizes
      ];

      for (const sizeList of sizeSources) {
        if (typeof sizeList === 'string') {
          addVariant('size', sizeList, true);
        } else if (Array.isArray(sizeList)) {
          sizeList.forEach(s => {
            if (typeof s === 'string' || typeof s === 'number') {
              const sizeStr = (category.toLowerCase().includes('shoe') || category.toLowerCase().includes('sneaker')) && typeof s === 'number'
                ? `${s} UK`
                : String(s);
              addVariant('size', sizeStr, true);
            } else if (s && typeof s === 'object') {
              const sName = s.size || s.uk_size || s.name || s.size_label || s.label;
              const sAvail = s.available ?? s.in_stock ?? true;
              const sizeStr = (category.toLowerCase().includes('shoe') || category.toLowerCase().includes('sneaker')) && typeof sName === 'number'
                ? `${sName} UK`
                : String(sName);
              addVariant('size', sizeStr, sAvail);
            }
          });
        }
      }

      // Extract composite variants array if present
      if (Array.isArray(raw.variants)) {
        raw.variants.forEach(v => {
          if (v.color) addVariant('color', v.color, v.available ?? v.in_stock ?? true);
          if (v.size || v.uk_size || v.size_label) {
            const sVal = v.size || v.uk_size || v.size_label;
            const sizeStr = (category.toLowerCase().includes('shoe') || category.toLowerCase().includes('sneaker')) && typeof sVal === 'number'
              ? `${sVal} UK`
              : String(sVal);
            addVariant('size', sizeStr, v.available ?? v.in_stock ?? true);
          }
        });
      }

      // Fallback: If no color variant in JSON, derive from local disk images
      const localFolder = path.join(categoryPath, jsonFileName.replace(/\.json$/i, ''));
      let diskImgFiles = [];
      if (fs.existsSync(localFolder) && fs.statSync(localFolder).isDirectory()) {
        diskImgFiles = fs.readdirSync(localFolder)
          .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
          .sort();
      }

      // -------------------------------------------------------------
      // 4. EXTRACT IMAGES (Disk scanning & JSON metadata correlation)
      // -------------------------------------------------------------
      const seenImagePaths = new Set();
      let imageSortOrder = 1;

      function addImage(imgPath, altText, color = null, isPrimary = false) {
        const cleanPath = cleanStr(imgPath)?.replace(/\\/g, '/');
        if (!cleanPath || seenImagePaths.has(cleanPath)) return;

        const pubUrl = getStoragePublicUrl(cleanPath);
        canonicalImages.push({
          product_id: productId,
          image_path: cleanPath,
          image_url: pubUrl,
          alt_text: cleanStr(altText) || `${name} - ${color || 'Product Image'}`,
          color: cleanStr(color),
          is_primary: isPrimary || imageSortOrder === 1,
          sort_order: imageSortOrder++
        });
        seenImagePaths.add(cleanPath);
        report.images_generated++;
      }

      // A. Check local folder on disk (Real images uploaded to Supabase Storage)
      if (diskImgFiles.length > 0) {
        diskImgFiles.forEach((imgFile, idx) => {
          const derivedColor = deriveColorFromFilename(imgFile);
          const relativeImgPath = `products/${category}/${productId}/${imgFile}`;
          addImage(relativeImgPath, `${name} - ${derivedColor}`, derivedColor, idx === 0);
        });
      } else {
        // B. Fallback to images in JSON metadata only if no disk folder exists
        const jsonImages = raw.images || raw.product?.images || raw.catalog?.images;
        if (Array.isArray(jsonImages)) {
          jsonImages.forEach((img, idx) => {
            if (typeof img === 'string') {
              const fileName = path.basename(img);
              const imgPath = `products/${category}/${productId}/${fileName}`;
              addImage(imgPath, `${name} Image ${idx + 1}`, null, idx === 0 && seenImagePaths.size === 0);
            } else if (img && typeof img === 'object') {
              const rawPath = img.image_path || img.image_url || img.file_name || img.url || img.path || img.image;
              const fileName = path.basename(rawPath || `image-${idx+1}.jpg`);
              const fullImgPath = `products/${category}/${productId}/${fileName}`;
              addImage(fullImgPath, img.alt_text || img.view_type || `${name} Image`, img.color, img.is_primary || (idx === 0 && seenImagePaths.size === 0));
            }
          });
        } else if (jsonImages && typeof jsonImages === 'object') {
          if (jsonImages.primary) {
            const fileName = path.basename(jsonImages.primary);
            addImage(`products/${category}/${productId}/${fileName}`, `${name} Primary`, null, true);
          }
          if (Array.isArray(jsonImages.gallery)) {
            jsonImages.gallery.forEach(g => {
              const fileName = path.basename(g);
              addImage(`products/${category}/${productId}/${fileName}`, `${name} Gallery`, deriveColorFromFilename(fileName), false);
            });
          }
          if (Array.isArray(jsonImages.files)) {
            jsonImages.files.forEach(f => {
              const fileName = path.basename(f);
              addImage(`products/${category}/${productId}/${fileName}`, `${name}`, deriveColorFromFilename(fileName), false);
            });
          }
        }
      }

      // Correlate color variants with product images
      const prodImages = canonicalImages.filter(img => img.product_id === productId);
      canonicalVariants.filter(v => v.product_id === productId && v.variant_type === 'color').forEach(v => {
        if (!v.image_path && prodImages.length > 0) {
          const vColorNorm = v.variant_value.toLowerCase().replace(/[^a-z0-9]/g, '');
          // 1. Exact or normalized color match
          let matchedImg = prodImages.find(img => {
            const imgColorNorm = (img.color || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return imgColorNorm === vColorNorm && imgColorNorm.length > 0;
          });
          // 2. Filename match
          if (!matchedImg) {
            matchedImg = prodImages.find(img => {
              const fileBase = path.basename(img.image_path, path.extname(img.image_path)).toLowerCase().replace(/[^a-z0-9]/g, '');
              return fileBase === vColorNorm;
            });
          }
          // 3. Fallback: single image available
          if (!matchedImg && prodImages.length === 1) {
            matchedImg = prodImages[0];
          }
          if (matchedImg) {
            v.image_path = matchedImg.image_path;
            v.image_url = matchedImg.image_url;
          }
        }
      });

      // -------------------------------------------------------------
      // 5. EXTRACT REVIEWS
      // -------------------------------------------------------------
      const reviewsList = Array.isArray(raw.reviews) ? raw.reviews :
        (Array.isArray(raw.customer_reviews) ? raw.customer_reviews :
          (Array.isArray(raw.reviews?.representative_reviews) ? raw.reviews.representative_reviews : []));

      reviewsList.forEach((rev, idx) => {
        const revId = cleanStr(rev.id || rev.review_id) || `${productId}-REV-${String(idx + 1).padStart(2, '0')}`;
        const rating = cleanNum(rev.rating) || 5;
        const title = cleanStr(rev.title || rev.review_title || '');
        const comment = cleanStr(rev.comment || rev.text || rev.review || rev.content || rev.review_text || '');
        const reviewerName = cleanStr(rev.author || rev.reviewer_name || `Customer ${idx + 1}`);
        const verified = rev.verified ?? rev.verified_purchase ?? true;

        const color = cleanStr(rev.color || rev.variant?.color || null);
        const size = cleanStr(rev.size || rev.variant?.size || null);

        let sentiment = cleanStr(rev.sentiment);
        if (!sentiment) {
          if (rating >= 4) sentiment = 'positive';
          else if (rating === 3) sentiment = 'neutral';
          else sentiment = 'negative';
        }

        const themes = Array.isArray(rev.themes) ? rev.themes :
          (Array.isArray(rev.topics) ? rev.topics :
            (Array.isArray(rev.key_topics) ? rev.key_topics : []));

        const createdAt = cleanStr(rev.date || rev.review_date || rev.created_at || null);

        canonicalReviews.push({
          product_id: productId,
          review_id: revId,
          reviewer_name: reviewerName,
          rating,
          title,
          comment,
          verified_purchase: verified,
          color,
          size,
          sentiment,
          themes: themes.map(t => String(t).trim()),
          created_at: createdAt
        });
        report.reviews_generated++;
      });

      // -------------------------------------------------------------
      // 6. EXTRACT REVIEW SUMMARY & INTELLIGENCE
      // -------------------------------------------------------------
      const revSummary = raw.review_summary || raw.review_insights || raw.ai_review_analysis || null;
      const ratingObj = raw.rating || raw.ratings || raw.product?.rating || (raw.reviews && typeof raw.reviews === 'object' && !Array.isArray(raw.reviews) ? raw.reviews : null);

      // Extract comprehensive Pros and Cons
      let prosList = [];
      if (Array.isArray(raw.pros)) prosList = raw.pros;
      else if (Array.isArray(revSummary?.pros)) prosList = revSummary.pros;
      else if (Array.isArray(revSummary?.positive_themes)) prosList = revSummary.positive_themes;
      else if (Array.isArray(revSummary?.positive_aspects)) prosList = revSummary.positive_aspects;
      else if (Array.isArray(raw.review_insights?.positive)) prosList = raw.review_insights.positive;
      else if (Array.isArray(raw.sales_intelligence?.strengths)) prosList = raw.sales_intelligence.strengths;

      let consList = [];
      if (Array.isArray(raw.cons)) consList = raw.cons;
      else if (Array.isArray(revSummary?.cons)) consList = revSummary.cons;
      else if (Array.isArray(revSummary?.negative_themes)) consList = revSummary.negative_themes;
      else if (Array.isArray(revSummary?.negative_aspects)) consList = revSummary.negative_aspects;
      else if (Array.isArray(raw.review_insights?.negative)) consList = raw.review_insights.negative;
      else if (Array.isArray(raw.sales_intelligence?.potential_limitations)) consList = raw.sales_intelligence.potential_limitations;

      // Extract structured buying advice string
      let buyingAdviceStr = null;
      if (typeof raw.buying_advice === 'string') {
        buyingAdviceStr = raw.buying_advice.trim();
      } else if (raw.buying_advice && typeof raw.buying_advice === 'object') {
        const parts = [];
        if (raw.buying_advice.recommendation) parts.push(`Recommendation: ${raw.buying_advice.recommendation}`);
        if (raw.buying_advice.sales_advice) parts.push(raw.buying_advice.sales_advice);
        if (raw.buying_advice.size_advice) parts.push(`Size Advice: ${raw.buying_advice.size_advice}`);
        if (raw.buying_advice.quality_advice) parts.push(`Quality Advice: ${raw.buying_advice.quality_advice}`);
        buyingAdviceStr = parts.join(' | ');
      } else if (typeof revSummary?.buying_advice === 'string') {
        buyingAdviceStr = revSummary.buying_advice.trim();
      } else if (typeof revSummary?.recommendation === 'string') {
        buyingAdviceStr = revSummary.recommendation.trim();
      } else if (typeof raw.sales_intelligence?.buying_advice === 'string') {
        buyingAdviceStr = raw.sales_intelligence.buying_advice.trim();
      }

      // Aspect feedback extraction
      const insightsObj = raw.review_insights || revSummary || {};
      const fitFeedback = extractInsightText(insightsObj.fit) || cleanStr(revSummary?.fit_summary || raw.ai_matching?.fit);
      const qualityFeedback = extractInsightText(insightsObj.fabric_quality || insightsObj.quality || insightsObj.durability) || cleanStr(revSummary?.quality_summary || raw.ai_matching?.fabric);
      const comfortFeedback = extractInsightText(insightsObj.comfort) || cleanStr(revSummary?.comfort_summary);
      const valueFeedback = extractInsightText(insightsObj.value_for_money || insightsObj.value) || cleanStr(revSummary?.value_for_money);
      const seasonFeedback = extractInsightText(insightsObj.season) || cleanStr(raw.ai_matching?.season);

      if (revSummary || ratingObj || reviewsList.length > 0 || prosList.length > 0) {
        // Phase 1 Requirement: ALWAYS compute review_count, average_rating, and percentages from actual reviews.json records
        const revCount = reviewsList.length;
        const avgRating = revCount > 0
          ? Number((reviewsList.reduce((acc, r) => acc + (cleanNum(r.rating) || 0), 0) / revCount).toFixed(1))
          : 0.0;

        const posReviews = reviewsList.filter(r => (cleanNum(r.rating) || 0) >= 4).length;
        const neuReviews = reviewsList.filter(r => (cleanNum(r.rating) || 0) === 3).length;
        const negReviews = reviewsList.filter(r => (cleanNum(r.rating) || 0) <= 2).length;

        const posPct = revCount > 0 ? Math.round((posReviews / revCount) * 100) : null;
        const neuPct = revCount > 0 ? Math.round((neuReviews / revCount) * 100) : null;
        const negPct = revCount > 0 ? Math.round((negReviews / revCount) * 100) : null;

        canonicalReviewSummaries.push({
          product_id: productId,
          average_rating: avgRating,
          review_count: revCount,
          positive_percentage: posPct,
          neutral_percentage: neuPct,
          negative_percentage: negPct,
          pros: prosList.map(p => String(p).trim()),
          cons: consList.map(c => String(c).trim()),
          common_positive_themes: prosList.slice(0, 5).map(p => String(p).trim()),
          common_negative_themes: consList.slice(0, 5).map(c => String(c).trim()),
          buying_advice: buyingAdviceStr,
          fit_feedback: fitFeedback,
          quality_feedback: qualityFeedback,
          comfort_feedback: comfortFeedback,
          value_feedback: valueFeedback,
          season_feedback: seasonFeedback
        });
        report.review_summaries_generated++;
      }

      // -------------------------------------------------------------
      // 7. EXTRACT PRODUCT SCORES & AI REASONING SIGNALS
      // -------------------------------------------------------------
      const salesIntel = raw.sales_intelligence || raw.ai_signals || raw.ai_matching || raw.shopi_ai_rules || null;

      const sourceScore = cleanNum(
        raw.buying_advice?.score ??
        salesIntel?.overall_score ??
        salesIntel?.score ??
        (ratingObj ? (cleanNum(ratingObj.average || ratingObj.average_rating) ? Math.round(cleanNum(ratingObj.average || ratingObj.average_rating) * 20) : null) : null)
      );

      const qualityScore = cleanNum(salesIntel?.quality_score ?? salesIntel?.quality_rating ?? null);
      const valueScore = cleanNum(salesIntel?.value_score ?? salesIntel?.value_for_money ?? null);
      const styleScore = cleanNum(salesIntel?.style_score ?? salesIntel?.versatility_score ?? null);

      const reviewConfidence = cleanNum(
        salesIntel?.review_confidence ??
        (reviewsList.length >= 10 ? 0.9 : (reviewsList.length >= 3 ? 0.7 : (reviewsList.length > 0 ? 0.5 : 0.2)))
      );

      let bestForList = [];
      if (Array.isArray(raw.buying_advice?.best_for)) bestForList = raw.buying_advice.best_for;
      else if (Array.isArray(salesIntel?.best_for)) bestForList = salesIntel.best_for;
      else if (Array.isArray(raw.review_insights?.best_for)) bestForList = raw.review_insights.best_for;
      else if (Array.isArray(revSummary?.best_for)) bestForList = revSummary.best_for;

      let avoidForList = [];
      if (Array.isArray(raw.buying_advice?.not_ideal_for)) avoidForList = raw.buying_advice.not_ideal_for;
      else if (Array.isArray(salesIntel?.not_ideal_for)) avoidForList = salesIntel.not_ideal_for;
      else if (Array.isArray(salesIntel?.potential_limitations)) avoidForList = salesIntel.potential_limitations;
      else if (Array.isArray(raw.review_insights?.not_ideal_for)) avoidForList = raw.review_insights.not_ideal_for;
      else if (Array.isArray(revSummary?.not_ideal_for)) avoidForList = revSummary.not_ideal_for;

      const sourceRec = cleanStr(
        raw.buying_advice?.recommendation ||
        salesIntel?.recommendation ||
        buyingAdviceStr
      );

      canonicalScores.push({
        product_id: productId,
        source_score: sourceScore,
        quality_score: qualityScore,
        value_score: valueScore,
        style_score: styleScore,
        review_confidence: reviewConfidence,
        best_for: bestForList.map(b => String(b).trim()),
        avoid_for: avoidForList.map(a => String(a).trim()),
        source_recommendation: sourceRec
      });
      report.scores_generated++;

      // -------------------------------------------------------------
      // 8. EXTRACT SEMANTIC TAGS
      // -------------------------------------------------------------
      const seenTags = new Set();

      function addTag(tagText, tagType = 'style') {
        const cleaned = cleanStr(tagText)?.toLowerCase();
        if (!cleaned || cleaned.length < 2) return;
        const key = `${productId}|${tagType}|${cleaned}`;
        if (seenTags.has(key)) return;

        canonicalTags.push({
          product_id: productId,
          tag: cleaned,
          tag_type: tagType
        });
        seenTags.add(key);
        report.tags_generated++;
      }

      // Collect tags from various sources
      const tagSources = [
        { items: raw.style_tags || raw.product?.style_tags, type: 'style' },
        { items: raw.occasion_tags || raw.product?.occasion_tags || raw.occasions, type: 'occasion' },
        { items: raw.season_tags || raw.product?.season_tags, type: 'season' },
        { items: raw.use_cases || raw.product?.use_cases, type: 'use_case' },
        { items: raw.tags || raw.product?.tags, type: 'style' },
        { items: raw.ai_search_attributes?.occasions, type: 'occasion' },
        { items: raw.ai_search_attributes?.style, type: 'style' },
        { items: raw.ai_search_attributes?.season, type: 'season' },
        { items: raw.ai_search_attributes?.benefits, type: 'positive_keyword' },
        { items: raw.ai_search_attributes?.negatives, type: 'negative_keyword' },
        { items: prosList, type: 'positive_keyword' },
        { items: consList, type: 'negative_keyword' },
        { items: bestForList, type: 'use_case' },
        { items: avoidForList, type: 'negative_keyword' }
      ];

      tagSources.forEach(({ items, type }) => {
        if (Array.isArray(items)) {
          items.forEach(t => {
            if (typeof t === 'string') addTag(t, type);
            else if (t && typeof t === 'object' && t.tag) addTag(t.tag, t.tag_type || type);
          });
        } else if (typeof items === 'string') {
          items.split(',').forEach(t => addTag(t.trim(), type));
        }
      });
    }
  }

  // -------------------------------------------------------------
  // 9. RELATIONSHIPS (Foundation table)
  // -------------------------------------------------------------
  // Per Phase 11: Foundation table is preserved empty until AI recommendation step
  report.relationships_generated = canonicalRelationships.length;

  // -------------------------------------------------------------
  // 10. WRITE ALL OUTPUT FILES (Deterministic JSON)
  // -------------------------------------------------------------
  const outputs = [
    { file: 'products.json', data: canonicalProducts },
    { file: 'attributes.json', data: canonicalAttributes },
    { file: 'variants.json', data: canonicalVariants },
    { file: 'images.json', data: canonicalImages },
    { file: 'tags.json', data: canonicalTags },
    { file: 'reviews.json', data: canonicalReviews },
    { file: 'review-summary.json', data: canonicalReviewSummaries },
    { file: 'scores.json', data: canonicalScores },
    { file: 'relationships.json', data: canonicalRelationships }
  ];

  outputs.forEach(({ file, data }) => {
    const filePath = path.join(OUTPUT_DIR, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  });

  // Save normalization report
  const reportPath = path.join(REPORTS_DIR, 'normalization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const durationMs = Date.now() - startTime;
  printNormalizationSummary(report, reportPath, durationMs);

  return { report, outputs };
}

function printNormalizationSummary(report, reportPath, durationMs) {
  console.log('\n===============================================================');
  console.log('       SHOPI AI PRODUCT NORMALIZATION PIPELINE COMPLETE        ');
  console.log('===============================================================');
  console.log(`Execution Time       : ${durationMs}ms`);
  console.log(`Total Source Files   : ${report.total_source_products}`);
  console.log(`Normalized Products  : ${report.total_normalized_products}`);
  console.log(`Rejected (Placeholders): ${report.products_rejected}`);
  console.log('---------------------------------------------------------------');
  console.log('GENERATED ENTITY METRICS:');
  console.log(`  - Products (products.json)          : ${report.total_normalized_products}`);
  console.log(`  - Attributes (attributes.json)      : ${report.attributes_generated}`);
  console.log(`  - Variants (variants.json)          : ${report.variants_generated}`);
  console.log(`  - Images (images.json)              : ${report.images_generated}`);
  console.log(`  - Semantic Tags (tags.json)         : ${report.tags_generated}`);
  console.log(`  - Reviews (reviews.json)            : ${report.reviews_generated}`);
  console.log(`  - Review Summaries (review-sum.json): ${report.review_summaries_generated}`);
  console.log(`  - Product Scores (scores.json)      : ${report.scores_generated}`);
  console.log(`  - Relationships (relationships.json): ${report.relationships_generated} (Foundation ready)`);
  console.log('---------------------------------------------------------------');
  console.log(`Full Audit Report Saved to:\n${reportPath}`);
  console.log('===============================================================\n');
}

if (require.main === module) {
  runNormalization();
}

module.exports = { runNormalization };
