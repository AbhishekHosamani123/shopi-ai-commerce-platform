import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 100, // requests
  duration: 1, // per second
});

// Stricter limiter for authentication endpoints: 10 attempts per minute
const authRateLimiter = new RateLimiterMemory({
  points: 500,
  duration: 60,
});

const getIP = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown';

const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  rateLimiter.consume(getIP(req))
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too Many Requests' }));
};

const authRateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  authRateLimiter.consume(getIP(req))
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many attempts. Please try again later.' }));
};

export { rateLimiterMiddleware as default, authRateLimiterMiddleware };