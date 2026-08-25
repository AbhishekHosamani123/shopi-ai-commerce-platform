import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3500';
const API_SECRET = process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}${searchParams ? `?${searchParams}` : ''}`;
    const merchantId = request.headers.get('x-merchant-id') || 'default_pilot_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    console.error('Merchant GET proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backend connection failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subPath = path.join('/');
    const body = await request.json().catch(() => ({}));
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}`;
    const merchantId = request.headers.get('x-merchant-id') || 'default_pilot_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    console.error('Merchant POST proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backend connection failed' },
      { status: 500 }
    );
  }
}
