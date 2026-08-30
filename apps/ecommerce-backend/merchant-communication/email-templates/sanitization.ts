/**
 * Strict sanitization and security escaping utilities for HTML email generation.
 * Prevents HTML injection, XSS, and malicious URL schemes.
 */

/**
 * Escapes HTML characters in dynamic text values.
 */
export function escapeHtml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes URLs to ensure only safe http/https schemes are permitted.
 * Blocks dangerous protocols like javascript:, data:, vbscript:, file:.
 */
export function sanitizeUrl(url: any, fallback: string = 'https://shopi.store'): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  
  // Reject javascript, data, vbscript, file protocols or control characters
  if (/^[\s\u0000-\u001f]*(javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallback;
  }

  // Accept valid relative URLs or internal paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Accept valid http and https URLs
  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
    return trimmed;
  }

  // Fallback if URL is malformed or uses unapproved scheme
  return fallback;
}

/**
 * Validates and sanitizes image URLs and static image asset paths.
 * Returns null if the URL is invalid or uses an insecure/dangerous scheme.
 */
export function sanitizeImageUrl(url: any): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Reject dangerous protocols
  if (/^[\s\u0000-\u001f]*(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  // Accept cid: attachments
  if (/^cid:[a-zA-Z0-9_-]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Accept valid relative paths or local filenames (e.g. "banner_img.png", "/banner_img.png")
  if (/^(\/?[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.(jpg|jpeg|png|webp|gif|svg))$/i.test(trimmed)) {
    return trimmed;
  }

  // Accept https and http image URLs
  if (/^https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|webp|gif|svg)(\?[^\s<>"']*)?$/i.test(trimmed) ||
      /^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Safely formats currency in INR without throwing on NaN or undefined.
 */
export function formatCurrency(amount: any): string {
  if (amount === null || amount === undefined) return '';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (!Number.isFinite(num)) return '';
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
}
