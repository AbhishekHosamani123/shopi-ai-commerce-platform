import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Banner generation service — OPTION C (pre-baked discount bases).
 *
 * The discount visual ("<N>% OFF") is NOT rendered at runtime. Each supported
 * discount value has a pre-generated base image (produced offline by a human,
 * perfect quality control) in `banner-bases/`. The runtime pipeline:
 *
 *   approved campaign.offer.discountValue
 *        ↓ selects the matching base image (banner-bases/banner_<N>.png)
 *   Python overlay adds ONLY "Hey <FirstName>" in the greeting area
 *        ↓
 *   CID-embedded into the email
 *
 * SINGLE SOURCE OF TRUTH: the approved campaign object. The base is selected
 * BY the approved value and its filename encodes it, so a 60% base can never
 * be attached to a 25% campaign. Missing base → banner omitted (logged), the
 * email still sends. Never a broken image, never a failed email.
 *
 * Caching: content-hash of (templateVersion + name + baseHash). Different
 * discounts use different bases → different cache entries; Aarav's banner is
 * never reused for Vihaan; no raw customer names in filenames.
 */

export const BANNER_TEMPLATE_VERSION = 'v4';

const MODULE_DIR = path.join(__dirname, '..', 'banner-generator');
const SCRIPT_PATH = path.join(MODULE_DIR, 'generate_banner.py');
const FONT_DIR = path.join(MODULE_DIR, 'fonts');
const BASES_DIR = path.join(MODULE_DIR, 'banner-bases');
const OUTPUT_DIR = process.env.BANNER_OUTPUT_DIR
  || path.join(__dirname, '..', 'generated_campaign_assets');

/** Resolved at spawn time so PYTHON_BIN changes (and Render env) apply cleanly. */
function pythonBin(): string {
  return process.env.PYTHON_BIN || 'python';
}

/** Discount values expected to have pre-baked base images. */
export const SUPPORTED_DISCOUNTS = [5, 10, 15, 25, 30, 50];

export interface GeneratedBanner {
  ok: boolean;
  cid?: string;
  filePath?: string;
  content?: Buffer;
  filename: string;
  sha256_16?: string;
  renderedName?: string;
  renderedGreeting?: string;
  /** Discount value of the selected pre-baked base (equals the approved value). */
  baseDiscountPercent?: number;
  templateVersion?: string;
  fromCache?: boolean;
  error?: string;
}

interface PythonResult {
  success: boolean;
  error?: string;
  outPath?: string;
  sha256_16?: string;
  baseSha256_16?: string;
  renderedName?: string;
  renderedGreeting?: string;
  templateVersion?: string;
}

function runPython(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(pythonBin(), [SCRIPT_PATH, ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => resolve({ stdout: '', stderr: String(err), code: -1 }));
    proc.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

/**
 * Expected banner discount text for the approved offer — same rendering the
 * email body uses (`25` → `25% OFF`).
 */
export function expectedBannerDiscountText(discountValue: number): string {
  return `${Math.round(discountValue)}% OFF`;
}

function baseImagePath(discountPercent: number): string {
  return path.join(BASES_DIR, `banner_${Math.round(discountPercent)}.png`);
}

/**
 * Generates (or reuses) the banner for one recipient of an approved campaign.
 *
 * @param customerName Campaign recipient name (missing → 'Valued Customer',
 *                     the same fallback the email body uses).
 * @param approvedDiscountPercent The approved campaign.offer.discountValue.
 * @param emailOfferText The offer display text the HTML body will show; kept
 *                     for interface compatibility and audit context.
 */
export async function generateCampaignBanner(
  customerName: string | null | undefined,
  approvedDiscountPercent: number,
  emailOfferText: string
): Promise<GeneratedBanner> {
  const name = customerName && String(customerName).trim() ? String(customerName) : 'Valued Customer';
  const discount = Math.round(Number(approvedDiscountPercent));
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    return { ok: false, filename: '', error: `Invalid approved discount for banner: ${approvedDiscountPercent}` };
  }

  // ---- Option C core: pick the pre-baked base for the APPROVED value ----
  const basePath = baseImagePath(discount);
  if (!fs.existsSync(basePath)) {
    return {
      ok: false,
      filename: '',
      error: `No pre-generated banner base for ${discount}% OFF (expected ${basePath}). ` +
        `Generate it once and store it as banner-bases/banner_${discount}.png. Banner omitted; email still sends.`
    };
  }

  const baseHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(basePath))
    .digest('hex')
    .slice(0, 16);

  // ---- Cache key: hash(templateVersion + name + baseHash) ----
  // baseHash encodes the discount (each value has its own base file), so a
  // wrong-discount reuse is impossible by construction.
  const cacheKey = crypto
    .createHash('sha256')
    .update(`${BANNER_TEMPLATE_VERSION}|${name}|${baseHash}`)
    .digest('hex')
    .slice(0, 24);
  const filename = `banner_${cacheKey}.png`;
  const outPath = path.join(OUTPUT_DIR, filename);

  // ---- Reuse an existing cached render (key already encodes name+base) ----
  try {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10_000) {
      const content = fs.readFileSync(outPath);
      return {
        ok: true,
        cid: `banner-${cacheKey.slice(0, 16)}`,
        filePath: outPath,
        content,
        filename,
        sha256_16: cacheKey.slice(0, 16),
        renderedName: name,
        renderedGreeting: `Hey ${name.split(' ')[0]}`,
        baseDiscountPercent: discount,
        templateVersion: BANNER_TEMPLATE_VERSION,
        fromCache: true
      };
    }
  } catch {
    // fall through to regenerate
  }

  // ---- Overlay the name onto the pre-baked base ----
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const { stdout, stderr, code } = await runPython([
      '--name', name,
      '--base', basePath,
      '--font-dir', FONT_DIR,
      '--out', outPath
    ]);

    if (code !== 0 || !stdout.trim()) {
      throw new Error(stderr || stdout || `python exited with code ${code}`);
    }

    let parsed: PythonResult;
    try {
      parsed = JSON.parse(stdout.trim().split('\n').pop() || '{}');
    } catch {
      throw new Error(`unparseable generator output: ${stdout.slice(0, 200)}`);
    }
    if (!parsed.success) {
      throw new Error(parsed.error || 'generator reported failure');
    }

    // ---- CONSISTENCY VALIDATION (single source of truth) ----
    // The overlay must have used the exact base chosen for the approved value,
    // and the greeting must contain the sanitized name. Any mismatch rejects
    // the banner for this send — never an email with inconsistent info.
    if (parsed.baseSha256_16 !== baseHash) {
      throw new Error(`Banner base changed during generation (hash mismatch). Banner rejected for this send.`);
    }
    if (!parsed.renderedGreeting || !parsed.renderedGreeting.includes(parsed.renderedName || '')) {
      throw new Error(`Banner greeting/name mismatch: "${parsed.renderedGreeting}" vs "${parsed.renderedName}"`);
    }

    const content = fs.readFileSync(outPath);
    return {
      ok: true,
      cid: `banner-${cacheKey.slice(0, 16)}`,
      filePath: outPath,
      content,
      filename,
      sha256_16: parsed.sha256_16 || cacheKey.slice(0, 16),
      renderedName: parsed.renderedName || name,
      renderedGreeting: parsed.renderedGreeting,
      baseDiscountPercent: discount,
      templateVersion: parsed.templateVersion || BANNER_TEMPLATE_VERSION,
      fromCache: false
    };
  } catch (err: any) {
    // Log clearly; the email must still go out (without the banner).
    console.error(`[banner-generator] generation failed for "${name}" @ ${discount}%: ${err.message}`);
    return { ok: false, filename, error: err.message };
  }
}

export const bannerGeneratorService = {
  generateCampaignBanner,
  expectedBannerDiscountText,
  BANNER_TEMPLATE_VERSION,
  SUPPORTED_DISCOUNTS
};
