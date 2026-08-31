import { Request, Response, NextFunction } from 'express';

const API_SECRET = process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026';

function authenticateToken(req: Request, res: Response, next: NextFunction) {
    // Exempt public webhook endpoints which authenticate via their own cryptographic signature (e.g. Razorpay webhook signature)
    if (req.path === '/razorpay/webhook' || req.originalUrl?.includes('/razorpay/webhook')) {
        return next();
    }

    const secret = req.headers['x-api-secret'];

    // Accept if secret matches configured API_SECRET or fallback shared secret
    if (secret && (secret === API_SECRET || secret === 'razorpay_ai_commerce_shared_secret_2026')) {
        return next();
    }

    // Also accept if API_SECRET is not configured or matches
    if (!API_SECRET || API_SECRET === 'your_random_api_secret') {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
}

export default authenticateToken;
