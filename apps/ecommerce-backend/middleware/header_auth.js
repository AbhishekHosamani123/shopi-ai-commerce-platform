"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const API_SECRET = process.env.API_SECRET;
function authenticateToken(req, res, next) {
    var _a;
    // Exempt public webhook endpoints which authenticate via their own cryptographic signature (e.g. Razorpay webhook signature)
    if (req.path === '/razorpay/webhook' || ((_a = req.originalUrl) === null || _a === void 0 ? void 0 : _a.includes('/razorpay/webhook'))) {
        return next();
    }
    const secret = req.headers['x-api-secret'];
    if (!secret || secret !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}
exports.default = authenticateToken;
