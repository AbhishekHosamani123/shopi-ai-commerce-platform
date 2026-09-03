import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies campaign banner images from the backend to the storefront origin.
 *
 * The banner generator produces a personalized PNG per recipient and serves
 * it from the BACKEND at /campaign-banners/<sha>.png (index.ts). The WhatsApp
 * channel needs a PUBLIC https URL to attach the image (Evolution API cannot
 * fetch local paths or CID attachments), and the URL used must resolve for
 * the deployed storefront domain — this route makes
 * https://<storefront>/campaign-banners/<file> work by forwarding to the
 * backend that actually holds the file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    // Only banner_<24 hex>.png filenames — mirrors the backend's own
    // strict validation (no path traversal).
    if (!/^banner_[a-f0-9]{24}\.png$/.test(filename)) {
      return new NextResponse('Not found', { status: 404 });
    }
    const backend = process.env.BACKEND_URL || 'http://localhost:3500';
    const res = await fetch(`${backend}/campaign-banners/${filename}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      return new NextResponse('Not found', { status: 404 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
