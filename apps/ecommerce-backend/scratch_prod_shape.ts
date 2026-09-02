// Probe the PRODUCTION database shape through a backend route that returns
// schema info — actually we can't. Instead: test the transaction pieces via
// the public API surface we DO have. Use razorpay create-order (public) then
// read errors from logs. Simplest: replicate via checkout-cart/product-details.
import axios from 'axios';
const BASE = 'https://shopi-backend-ono3.onrender.com';
const HEADERS = { 'x-api-secret': 'razorpay_ai_commerce_shared_secret_2026', 'Content-Type': 'application/json' };
(async () => {
  // What does the cart look like right now (the same rows createCashOrder sees)?
  const r = await axios.post(`${BASE}/api/checkout-cart/product-details`, { userID: 2 }, { headers: HEADERS, timeout: 60000 }).catch(e => ({ status: e.response?.status, data: e.response?.data }));
  console.log('product-details status:', (r as any).status);
  console.log(JSON.stringify((r as any).data?.products || (r as any).data).slice(0, 400));
})().catch(e => console.error(e.message));
