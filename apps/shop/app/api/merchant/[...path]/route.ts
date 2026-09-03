import { NextRequest, NextResponse } from 'next/server';
import { getMerchantSession } from '@/lib/merchantSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://shopi-backend-ono3.onrender.com' : 'http://localhost:3500')
).replace(/\/+$/, '');

const API_SECRET = process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026';

/**
 * Server-side authorization gate for every merchant API call.
 * Authenticates active session or falls back to demo merchant admin session.
 */
async function authorize(request: NextRequest): Promise<{ session: any }> {
  try {
    const session = await getMerchantSession();
    if (session) return { session };
  } catch {
    // ignore
  }

  return {
    session: {
      userID: 1,
      role: 'merchant_admin',
      userName: 'merchant_admin',
      email: 'abhishekhosamani522@gmail.com'
    }
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const auth = await authorize(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { path } = await params;
    const subPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}${searchParams ? `?${searchParams}` : ''}`;
    const merchantId = 'default_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000)
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
  const auth = await authorize(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { path } = await params;
    const subPath = path.join('/');
    const body = await request.json().catch(() => ({}));
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}`;
    const merchantId = 'default_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000)
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const auth = await authorize(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { path } = await params;
    const subPath = path.join('/');
    const body = await request.json().catch(() => ({}));
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}`;
    const merchantId = 'default_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000)
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    console.error('Merchant PUT proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backend connection failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const auth = await authorize(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { path } = await params;
    const subPath = path.join('/');
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}`;
    const merchantId = 'default_merchant';

    const backendRes = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'x-api-secret': API_SECRET,
        'x-merchant-id': merchantId,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000)
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    console.error('Merchant DELETE proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backend connection failed' },
      { status: 500 }
    );
  }
}
