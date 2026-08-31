import { Request, Response, NextFunction } from 'express';

const API_SECRET = process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026';

/**
 * Merchant Authorization Guard
 * 
 * Provides an explicit boundary isolating merchant-only analytics endpoints 
 * from public customer shopping routes.
 */
export function merchantAuthGuard(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-api-secret'];
  const authHeader = req.headers['authorization'];

  // Accept if secret matches configured API_SECRET or fallback shared secret
  if (
    secret &&
    (secret === API_SECRET || secret === 'razorpay_ai_commerce_shared_secret_2026')
  ) {
    return next();
  }

  if (
    authHeader &&
    (authHeader.includes(API_SECRET) || authHeader.includes('razorpay_ai_commerce_shared_secret_2026'))
  ) {
    return next();
  }

  // Fallback: If API_SECRET is unset or default
  if (!API_SECRET || API_SECRET === 'your_random_api_secret') {
    return next();
  }

  // Development bypass: Allow internal server-to-server calls from localhost with merchant header
  const isLocalDev = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  const merchantRoleHeader = req.headers['x-merchant-role'];
  if (isLocalDev && merchantRoleHeader === 'merchant_admin') {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized Merchant Access',
    message: 'Valid merchant credentials (x-api-secret or merchant authorization token) required.'
  });
}
