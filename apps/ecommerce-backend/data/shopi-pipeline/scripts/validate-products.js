#!/usr/bin/env node

/**
 * Shopi AI Product Dataset Validator
 *
 * Recursively inspects product JSON files and local assets in:
 * apps/ecommerce-backend/data/shopi-data/products/
 *
 * Generates:
 * apps/ecommerce-backend/data/shopi-pipeline/reports/validation-report.json
 */

const fs = require('fs');
const path = require('path');

// Dynamically resolve paths relative to current script or workspace
const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const PRODUCTS_DIR = path.resolve(PIPELINE_DIR, '..', 'shopi-data', 'products');
const REPORTS_DIR = path.resolve(PIPELINE_DIR, 'reports');

// Ensure output directories exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function runValidation() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error(`[ERROR] Products directory not found: ${PRODUCTS_DIR}`);
    process.exit(1);
  }

  const report = {
    generated_at: new Date().toISOString(),
    source_directory: PRODUCTS_DIR,
    total_files: 0,
    valid_json: 0,
    invalid_json: 0,
    empty_files: 0,
    empty_file_list: [],
    unique_product_ids: 0,
    duplicate_product_ids: [],
    duplicate_product_names: [],
    category_counts: {},
    schema_variants: [],
    missing_fields: {
      missing_name: [],
      missing_brand: [],
      missing_pricing: [],
      missing_mrp: [],
      missing_selling_price: [],
      missing_images: [],
      missing_variants: [],
      missing_colors: [],
      missing_sizes: [],
      missing_ratings: [],
      missing_reviews: [],
      missing_review_summary: []
    },
    image_statistics: {
      total_product_folders: 0,
      total_disk_images: 0,
      folders_with_images: 0,
      folders_without_images: 0,
      images_by_category: {},
      image_formats: {}
    },
    variant_statistics: {
      total_color_variants_found: 0,
      total_size_variants_found: 0,
      products_with_variants: 0,
      products_without_variants: 0
    },
    review_statistics: {
      products_with_reviews: 0,
      products_without_reviews: 0,
      total_individual_reviews: 0,
      products_with_review_summary: 0,
      products_without_review_summary: 0
    }
  };

  const idToFilesMap = new Map();
  const nameToProductsMap = new Map();
  const schemaSignaturesMap = new Map();

  // 1. Discover all categories
  const categoryEntries = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  for (const category of categoryEntries) {
    const categoryPath = path.join(PRODUCTS_DIR, category);
    report.category_counts[category] = {
      json_files: 0,
      valid_json: 0,
      empty_files: 0,
      product_folders: 0,
      images_on_disk: 0
    };
    report.image_statistics.images_by_category[category] = 0;

    const entries = fs.readdirSync(categoryPath, { withFileTypes: true });

    // Track subdirectories (product folders for images)
    const productSubdirs = entries.filter(e => e.isDirectory());
    report.category_counts[category].product_folders = productSubdirs.length;
    report.image_statistics.total_product_folders += productSubdirs.length;

    for (const subdir of productSubdirs) {
      const folderPath = path.join(categoryPath, subdir.name);
      const imgFiles = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(f => f.isFile() && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));

      const count = imgFiles.length;
      report.category_counts[category].images_on_disk += count;
      report.image_statistics.total_disk_images += count;
      report.image_statistics.images_by_category[category] += count;

      if (count > 0) {
        report.image_statistics.folders_with_images++;
      } else {
        report.image_statistics.folders_without_images++;
      }

      for (const img of imgFiles) {
        const ext = path.extname(img.name).toLowerCase();
        report.image_statistics.image_formats[ext] = (report.image_statistics.image_formats[ext] || 0) + 1;
      }
    }

    // Process all JSON files in category
    const jsonFiles = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json'));
    report.category_counts[category].json_files = jsonFiles.length;

    for (const jsonFile of jsonFiles) {
      report.total_files++;
      const fullPath = path.join(categoryPath, jsonFile.name);
      const relativePath = path.join('products', category, jsonFile.name).replace(/\\/g, '/');
      const fileStats = fs.statSync(fullPath);

      if (fileStats.size === 0) {
        report.empty_files++;
        report.category_counts[category].empty_files++;
        report.empty_file_list.push(relativePath);
        continue;
      }

      let parsedData;
      try {
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        parsedData = JSON.parse(rawContent);
        report.valid_json++;
        report.category_counts[category].valid_json++;
      } catch (err) {
        report.invalid_json++;
        report.missing_fields.corrupt_files = report.missing_fields.corrupt_files || [];
        report.missing_fields.corrupt_files.push({ file: relativePath, error: err.message });
        continue;
      }

      // Extract ID
      const extractedId = parsedData.product_id ||
        parsedData.productId ||
        parsedData.product?.id ||
        parsedData.product?.product_id ||
        parsedData.sku ||
        parsedData.product?.sku ||
        parsedData.id ||
        jsonFile.name.replace(/\.json$/i, '');

      if (!idToFilesMap.has(extractedId)) {
        idToFilesMap.set(extractedId, []);
      }
      idToFilesMap.get(extractedId).push(relativePath);

      // Extract Name
      const extractedName = parsedData.name ||
        parsedData.product?.name ||
        parsedData.product?.title ||
        parsedData.title ||
        parsedData.basic_info?.name ||
        parsedData.catalog?.name ||
        null;

      if (extractedName) {
        const normName = extractedName.trim().toLowerCase();
        if (!nameToProductsMap.has(normName)) {
          nameToProductsMap.set(normName, []);
        }
        nameToProductsMap.get(normName).push({ id: extractedId, name: extractedName, file: relativePath });
      } else {
        report.missing_fields.missing_name.push({ id: extractedId, file: relativePath });
      }

      // Extract Brand
      const extractedBrand = parsedData.brand ||
        parsedData.product?.brand ||
        parsedData.basic_info?.brand ||
        parsedData.catalog?.brand ||
        parsedData.brand_information?.brand_name ||
        parsedData.brand_info?.brand ||
        null;

      if (!extractedBrand) {
        report.missing_fields.missing_brand.push({ id: extractedId, file: relativePath });
      }

      // Extract Pricing
      const pricingObj = parsedData.pricing || parsedData.product?.pricing || parsedData.catalog?.pricing || null;
      const sizePrices = parsedData.size_prices || null;
      const hasPricing = !!(pricingObj || sizePrices);

      if (!hasPricing) {
        report.missing_fields.missing_pricing.push({ id: extractedId, file: relativePath });
        report.missing_fields.missing_mrp.push({ id: extractedId, file: relativePath });
        report.missing_fields.missing_selling_price.push({ id: extractedId, file: relativePath });
      } else {
        const mrp = pricingObj?.mrp ?? (sizePrices && sizePrices[0]?.mrp) ?? null;
        const sellingPrice = pricingObj?.selling_price ?? pricingObj?.current_price ?? pricingObj?.listing_price ?? (sizePrices && sizePrices[0]?.price) ?? null;
        if (mrp === null || mrp === undefined) {
          report.missing_fields.missing_mrp.push({ id: extractedId, file: relativePath });
        }
        if (sellingPrice === null || sellingPrice === undefined) {
          report.missing_fields.missing_selling_price.push({ id: extractedId, file: relativePath });
        }
      }

      // Extract Images
      const imagesRaw = parsedData.images || parsedData.product?.images || parsedData.catalog?.images || null;
      const hasJsonImages = !!(imagesRaw && (Array.isArray(imagesRaw) ? imagesRaw.length > 0 : Object.keys(imagesRaw).length > 0));
      const correspondingFolder = path.join(categoryPath, jsonFile.name.replace(/\.json$/i, ''));
      let diskImgCount = 0;
      if (fs.existsSync(correspondingFolder)) {
        diskImgCount = fs.readdirSync(correspondingFolder).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length;
      }

      if (!hasJsonImages && diskImgCount === 0) {
        report.missing_fields.missing_images.push({ id: extractedId, file: relativePath });
      }

      // Extract Variants
      let colorCount = 0;
      let sizeCount = 0;

      // Color extraction check
      if (Array.isArray(parsedData.colors)) colorCount += parsedData.colors.length;
      if (Array.isArray(parsedData.available_colors)) colorCount += parsedData.available_colors.length;
      if (Array.isArray(parsedData.variants?.colors)) colorCount += parsedData.variants.colors.length;
      if (Array.isArray(parsedData.product?.variants?.colors)) colorCount += parsedData.product.variants.colors.length;

      // Size extraction check
      if (Array.isArray(parsedData.sizes)) sizeCount += parsedData.sizes.length;
      if (Array.isArray(parsedData.available_sizes)) sizeCount += parsedData.available_sizes.length;
      if (Array.isArray(parsedData.variants?.sizes)) sizeCount += parsedData.variants.sizes.length;
      if (Array.isArray(parsedData.product?.variants?.sizes)) sizeCount += parsedData.product.variants.sizes.length;

      // General variants array check
      if (Array.isArray(parsedData.variants)) {
        parsedData.variants.forEach(v => {
          if (v.color) colorCount++;
          if (v.size || v.uk_size || v.size_label) sizeCount++;
        });
      }

      if (colorCount === 0) report.missing_fields.missing_colors.push({ id: extractedId, file: relativePath });
      if (sizeCount === 0) report.missing_fields.missing_sizes.push({ id: extractedId, file: relativePath });

      if (colorCount === 0 && sizeCount === 0) {
        report.missing_fields.missing_variants.push({ id: extractedId, file: relativePath });
        report.variant_statistics.products_without_variants++;
      } else {
        report.variant_statistics.products_with_variants++;
        report.variant_statistics.total_color_variants_found += colorCount;
        report.variant_statistics.total_size_variants_found += sizeCount;
      }

      // Extract Ratings & Reviews
      const ratingObj = parsedData.rating || parsedData.ratings || parsedData.product?.rating || null;
      if (!ratingObj) {
        report.missing_fields.missing_ratings.push({ id: extractedId, file: relativePath });
      }

      const reviewsArr = Array.isArray(parsedData.reviews) ? parsedData.reviews :
        (Array.isArray(parsedData.customer_reviews) ? parsedData.customer_reviews :
          (Array.isArray(parsedData.reviews?.representative_reviews) ? parsedData.reviews.representative_reviews : []));

      if (reviewsArr.length > 0) {
        report.review_statistics.products_with_reviews++;
        report.review_statistics.total_individual_reviews += reviewsArr.length;
      } else {
        report.review_statistics.products_without_reviews++;
        report.missing_fields.missing_reviews.push({ id: extractedId, file: relativePath });
      }

      const hasReviewSummary = !!(
        parsedData.review_summary ||
        parsedData.review_insights ||
        parsedData.ai_review_analysis ||
        parsedData.reviews?.average_rating !== undefined ||
        parsedData.sales_intelligence?.recommendation_profile ||
        (parsedData.pros && parsedData.cons)
      );

      if (hasReviewSummary) {
        report.review_statistics.products_with_review_summary++;
      } else {
        report.review_statistics.products_without_review_summary++;
        report.missing_fields.missing_review_summary.push({ id: extractedId, file: relativePath });
      }

      // Group by schema signature (sorted top-level keys)
      const topKeys = Object.keys(parsedData).sort().join(',');
      if (!schemaSignaturesMap.has(topKeys)) {
        schemaSignaturesMap.set(topKeys, {
          sample_file: relativePath,
          category,
          top_level_keys: Object.keys(parsedData),
          count: 0,
          matched_files: []
        });
      }
      const schemaEntry = schemaSignaturesMap.get(topKeys);
      schemaEntry.count++;
      schemaEntry.matched_files.push(relativePath);
    }
  }

  // Summary calculations
  report.unique_product_ids = idToFilesMap.size;
  for (const [id, files] of idToFilesMap.entries()) {
    if (files.length > 1) {
      report.duplicate_product_ids.push({ id, files });
    }
  }

  for (const [name, prods] of nameToProductsMap.entries()) {
    if (prods.length > 1) {
      report.duplicate_product_names.push({
        normalized_name: name,
        instances: prods
      });
    }
  }

  report.schema_variants = Array.from(schemaSignaturesMap.values());

  // Save report to reports/validation-report.json
  const reportPath = path.join(REPORTS_DIR, 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // Print concise human-readable summary to console
  printTerminalSummary(report, reportPath);

  return report;
}

function printTerminalSummary(report, reportPath) {
  console.log('\n===============================================================');
  console.log('         SHOPI AI PRODUCT DATASET VALIDATION REPORT            ');
  console.log('===============================================================');
  console.log(`Generated At         : ${report.generated_at}`);
  console.log(`Total Files Discovered: ${report.total_files}`);
  console.log(`  - Valid JSON Files  : ${report.valid_json}`);
  console.log(`  - Empty Files (0-B) : ${report.empty_files}`);
  console.log(`  - Corrupt Files     : ${report.invalid_json}`);
  console.log(`Unique Product IDs   : ${report.unique_product_ids}`);
  console.log(`Duplicate IDs        : ${report.duplicate_product_ids.length}`);
  console.log(`Duplicate Names      : ${report.duplicate_product_names.length}`);
  console.log('---------------------------------------------------------------');
  console.log('CATEGORY BREAKDOWN:');
  console.table(Object.entries(report.category_counts).map(([cat, stats]) => ({
    Category: cat,
    'Total JSON': stats.json_files,
    'Valid JSON': stats.valid_json,
    'Empty (0-B)': stats.empty_files,
    'Image Folders': stats.product_folders,
    'Images on Disk': stats.images_on_disk
  })));
  console.log('---------------------------------------------------------------');
  console.log('DATASET METRICS:');
  console.log(`  - Total Disk Images             : ${report.image_statistics.total_disk_images}`);
  console.log(`  - Total Individual Reviews      : ${report.review_statistics.total_individual_reviews}`);
  console.log(`  - Products with Reviews         : ${report.review_statistics.products_with_reviews} / ${report.valid_json}`);
  console.log(`  - Products with Review Summaries: ${report.review_statistics.products_with_review_summary} / ${report.valid_json}`);
  console.log(`  - Products with Variants        : ${report.variant_statistics.products_with_variants} / ${report.valid_json}`);
  console.log(`  - Schema Variants Discovered    : ${report.schema_variants.length}`);
  console.log('---------------------------------------------------------------');
  console.log('MISSING FIELD HIGHLIGHTS:');
  console.log(`  - Missing Name      : ${report.missing_fields.missing_name.length} products (${report.missing_fields.missing_name.map(p => p.id).join(', ') || 'None'})`);
  console.log(`  - Missing Brand     : ${report.missing_fields.missing_brand.length} products (${report.missing_fields.missing_brand.map(p => p.id).join(', ') || 'None'})`);
  console.log(`  - Missing Pricing   : ${report.missing_fields.missing_pricing.length} products (${report.missing_fields.missing_pricing.map(p => p.id).join(', ') || 'None'})`);
  console.log(`  - Empty JSON Files  : ${report.empty_files} (${report.empty_file_list.slice(0, 4).join(', ')}...)`);
  console.log('---------------------------------------------------------------');
  console.log(`Full JSON Report Saved to:\n${reportPath}`);
  console.log('===============================================================\n');
}

if (require.main === module) {
  runValidation();
}

module.exports = { runValidation };
