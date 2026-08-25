"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiterMiddleware = exports.default = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 100, // requests
    duration: 1, // per second
});
// Stricter limiter for authentication endpoints: 10 attempts per minute
const authRateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 500,
    duration: 60,
});
const getIP = (req) => req.ip || req.socket.remoteAddress || 'unknown';
const rateLimiterMiddleware = (req, res, next) => {
    rateLimiter.consume(getIP(req))
        .then(() => next())
        .catch(() => res.status(429).json({ error: 'Too Many Requests' }));
};
exports.default = rateLimiterMiddleware;
const authRateLimiterMiddleware = (req, res, next) => {
    authRateLimiter.consume(getIP(req))
        .then(() => next())
        .catch(() => res.status(429).json({ error: 'Too many attempts. Please try again later.' }));
};
exports.authRateLimiterMiddleware = authRateLimiterMiddleware;
