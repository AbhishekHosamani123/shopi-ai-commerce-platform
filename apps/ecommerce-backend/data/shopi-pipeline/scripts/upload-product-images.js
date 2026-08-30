#!/usr/bin/env node

/**
 * Shopi Product Images Supabase Storage Ingestion (Phase 2 & 3)
 *
 * 1. Creates/verifies public bucket 'shopi-product-images'.
 * 2. Recursively scans 'apps/ecommerce-backend/data/shopi-data/products/'.
 * 3. Uploads all valid image files (.jpg, .jpeg, .png, .webp) with x-upsert: true.
 * 4. Preserves directory structure (e.g. Shirts/SHIRT-001/black.jpg).
 * 5. Generates detailed upload report.
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PIPELINE_DIR = path.resolve(SCRIPT_DIR, '..');
const PRODUCTS_DIR = path.resolve(PIPELINE_DIR, '..', 'shopi-data', 'products');
const REPORTS_DIR = path.resolve(PIPELINE_DIR, 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

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
const BUCKET_NAME = 'shopi-product-images';

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

async function ensureBucket() {
  console.log(`Checking bucket '${BUCKET_NAME}'...`);
  const checkRes = await fetch(`${cleanBaseUrl}/storage/v1/bucket/${BUCKET_NAME}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (checkRes.status === 200) {
    const bucket = await checkRes.json();
    console.log(`Bucket '${BUCKET_NAME}' exists (Public: ${bucket.public})`);
    if (!bucket.public) {
      console.log(`Updating bucket '${BUCKET_NAME}' to public...`);
      await fetch(`${cleanBaseUrl}/storage/v1/bucket/${BUCKET_NAME}`, {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ public: true })
      });
    }
    return;
  }

  console.log(`Creating public bucket '${BUCKET_NAME}'...`);
  const createRes = await fetch(`${cleanBaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: BUCKET_NAME,
      name: BUCKET_NAME,
      public: true,
      file_size_limit: 10485760, // 10MB
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp']
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create bucket: ${createRes.status} ${errText}`);
  }
  console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
}

function findImages(dir, baseDir = dir) {
  let images = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      images = images.concat(findImages(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (MIME_TYPES[ext]) {
        const stats = fs.statSync(fullPath);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        images.push({
          fullPath,
          relPath,
          size: stats.size,
          ext,
          mimeType: MIME_TYPES[ext]
        });
      }
    }
  }
  return images;
}

async function uploadImage(image) {
  const fileBuffer = fs.readFileSync(image.fullPath);
  // Storage object path: relative to products dir (e.g. Shirts/SHIRT-001/black.jpg)
  const storagePath = image.relPath;
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const url = `${cleanBaseUrl}/storage/v1/object/${BUCKET_NAME}/${encodedPath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': image.mimeType,
      'x-upsert': 'true'
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed for ${storagePath}: [${res.status}] ${errText}`);
  }

  const publicUrl = `${cleanBaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
  return { storagePath, publicUrl };
}

async function runImageUploadPipeline() {
  const startTime = Date.now();
  console.log('\n===============================================================');
  console.log('       SHOPI AI SUPABASE STORAGE IMAGE UPLOADER               ');
  console.log('===============================================================');
  console.log(`Supabase Host : ${cleanBaseUrl}`);
  console.log(`Target Bucket : ${BUCKET_NAME}`);
  console.log(`Source Folder : ${PRODUCTS_DIR}`);
  console.log('---------------------------------------------------------------');

  await ensureBucket();

  const allImages = findImages(PRODUCTS_DIR);
  console.log(`Discovered ${allImages.length} image files on disk.`);

  const report = {
    generated_at: new Date().toISOString(),
    bucket_name: BUCKET_NAME,
    total_found: allImages.length,
    uploaded: 0,
    skipped_empty: 0,
    failed: 0,
    errors: [],
    sample_urls: []
  };

  const BATCH_SIZE = 10;
  for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
    const batch = allImages.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (img) => {
      if (img.size === 0) {
        report.skipped_empty++;
        console.warn(`[SKIP] Empty 0-byte image: ${img.relPath}`);
        return;
      }

      try {
        const { storagePath, publicUrl } = await uploadImage(img);
        report.uploaded++;
        if (report.sample_urls.length < 5) {
          report.sample_urls.push({ storagePath, publicUrl });
        }
      } catch (err) {
        report.failed++;
        report.errors.push({ file: img.relPath, error: err.message });
        console.error(`[ERROR] ${err.message}`);
      }
    }));
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, allImages.length)} / ${allImages.length} processed...`);
  }

  console.log('\n');

  const reportPath = path.join(REPORTS_DIR, 'image-upload-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('===============================================================');
  console.log('                 IMAGE UPLOAD SUMMARY                         ');
  console.log('===============================================================');
  console.log(`Total Found   : ${report.total_found}`);
  console.log(`Uploaded      : ${report.uploaded}`);
  console.log(`Skipped Empty : ${report.skipped_empty}`);
  console.log(`Failed        : ${report.failed}`);
  console.log(`Execution Time: ${Date.now() - startTime}ms`);
  console.log(`Report Saved  : ${reportPath}`);
  console.log('Sample Public URLs:');
  report.sample_urls.forEach(s => console.log(`  - ${s.storagePath} -> ${s.publicUrl}`));
  console.log('===============================================================\n');

  if (report.failed > 0) {
    console.error(`Image upload had ${report.failed} failures!`);
    process.exit(1);
  }
}

if (require.main === module) {
  runImageUploadPipeline().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}

module.exports = { runImageUploadPipeline };
