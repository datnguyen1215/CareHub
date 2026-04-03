/** Rate limiting middleware for API endpoints. */
import rateLimit from 'express-rate-limit'

const TOO_MANY_REQUESTS = { error: 'Too many requests, please try again later' }

/** Global rate limiter for all /api/* routes (100 req / 15 min per IP). */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.url === '/health',
  handler: (_req, res) => {
    res.status(429).json(TOO_MANY_REQUESTS)
  },
})

/** Strict limiter for OTP auth endpoints (5 req / min per IP). */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(TOO_MANY_REQUESTS)
  },
})

/** Limiter for device registration (3 req / hour per IP). */
export const deviceRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(TOO_MANY_REQUESTS)
  },
})
