import { NextRequest, NextResponse } from 'next/server';
import { getMerchantSession } from '@/lib/merchantSession';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3500';
const API_SECRET = process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026';

/**
 * Server-side authorization gate for every merchant API call.
 *
 * The customer-facing Next app must NEVER proxy unauthenticated traffic to the
 * merchant backend. Each request here verifies the httpOnly merchant_session
 * JWT (role merchant_admin/admin/merchant) BEFORE forwarding to the Express
 * service with the API_SECRET.
 *
 * Returns 401/403 JSON to the browser when the session is missing, expired or
 * not a merchant — the Merchant AI dashboard and its API are unreachable to
 * customers and anonymous visitors.
 */
async function authorize(request: NextRequest): Promise<{ session: Awaited<ReturnType<typeof getMerchantSession>> } | NextResponse> {
  const session = await getMerchantSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — merchant login required' },
      { status: 401 }
    );
  }
  return { session };
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
    const merchantId = 'default_merchant'; // demo dataset is seeded under default_merchant (auth still enforced above)

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
  const auth = await authorize(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { path } = await params;
    const subPath = path.join('/');
    const body = await request.json().catch(() => ({}));
    const targetUrl = `${BACKEND_URL}/api/merchant/${subPath}`;
    const merchantId = 'default_merchant'; // demo dataset is seeded under default_merchant (auth still enforced above)

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
    const merchantId = 'default_merchant'; // demo dataset is seeded under default_merchant (auth still enforced above)

    const backendRes = await fetch(targetUrl, {
      method: 'PUT',
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
    const merchantId = 'default_merchant'; // demo dataset is seeded under default_merchant (auth still enforced above)

    const backendRes = await fetch(targetUrl, {
      method: 'DELETE',
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
    console.error('Merchant DELETE proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Backend connection failed' },
      { status: 500 }
    );
  }
}
