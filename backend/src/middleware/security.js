/**
 * Enterprise Application Security, Rate Limiting & Performance Middleware
 * 
 * Implements:
 * 1. Standard security response headers (HSTS, CSP, Clickjacking, MIME-sniffing, COOP, CORP)
 * 2. High-performance sliding-window rate limiters keyed by authenticated user or verified IP
 * 3. Elimination of untrusted client rate-limit bypass backdoors
 * 4. Request timeout safeguards to prevent socket exhaustion
 * 5. Micro-caching layer for reusable public metadata (places, distances)
 */

// Memory store for sliding window rate limiter
class SlidingWindowRateLimiter {
  constructor({ windowMs, maxRequests, message }) {
    this.windowMs = windowMs || 15 * 60 * 1000;
    this.maxRequests = maxRequests || 100;
    this.message = message || 'Too many requests, please try again later.';
    this.hits = new Map();

    // Auto cleanup expired windows every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, records] of this.hits.entries()) {
        const valid = records.filter(timestamp => now - timestamp < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, valid);
        }
      }
    }, 60000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  middleware() {
    return (req, res, next) => {
      // Health check endpoint and CORS preflights are exempt from throttling
      if (req.path === '/api/health' || req.method === 'OPTIONS') {
        return next();
      }

      // Secure client identification: bind to authenticated user ID when present, else verified IP
      const clientIdentifier = (req.user && req.user.id)
        ? `user:${req.user.id}`
        : (req.ip || req.socket.remoteAddress || '127.0.0.1');

      const now = Date.now();
      const clientHits = this.hits.get(clientIdentifier) || [];
      const windowStart = now - this.windowMs;
      const recentHits = clientHits.filter(t => t > windowStart);

      if (recentHits.length >= this.maxRequests) {
        const oldestHit = recentHits[0];
        const retryAfterSeconds = Math.ceil((oldestHit + this.windowMs - now) / 1000);
        
        res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));
        res.setHeader('X-RateLimit-Limit', this.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: this.message,
          retryAfterSeconds: Math.max(1, retryAfterSeconds)
        });
      }

      recentHits.push(now);
      this.hits.set(clientIdentifier, recentHits);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - recentHits.length));

      next();
    };
  }
}

// 1. Enterprise Security Headers Middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  const clientOrigin = req.headers.origin;
  const isAllowedOrigin = Boolean(clientOrigin && (
    clientOrigin.includes('localhost') ||
    clientOrigin.includes('127.0.0.1') ||
    (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes(clientOrigin))
  ));
  res.setHeader('Cross-Origin-Resource-Policy', isAllowedOrigin ? 'cross-origin' : 'same-origin');

  // Defense-in-depth Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://maps.googleapis.com https://routes.googleapis.com https://api.open-meteo.com",
    "frame-src 'self' https://www.google.com https://maps.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// 2. Request Timeout Middleware
const requestTimeout = (timeoutMs = 60000) => {
  return (req, res, next) => {
    // Extended processing window for deep spatiotemporal Pareto and corridor calculations
    const effectiveTimeout = (req.path.includes('/itinerary') || req.path.includes('/generate'))
      ? 120000
      : timeoutMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'The requested calculation took longer than the acceptable threshold. Please refine your inputs and try again.'
        });
      }
    }, effectiveTimeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

// 3. Simple in-memory response cache for idempotent public endpoints (places, distances)
class ResponseCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();

    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000).unref();
  }

  middleware(ttlMs) {
    const ttl = ttlMs || this.defaultTtlMs;
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') return next();

      const key = `${req.originalUrl || req.url}`;
      const cached = this.cache.get(key);

      if (cached && cached.expiresAt > Date.now()) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(cached.status).json(cached.body);
      }

      res.setHeader('X-Cache', 'MISS');

      // Intercept json
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.cache.set(key, {
            status: res.statusCode,
            body,
            expiresAt: Date.now() + ttl
          });
        }
        return originalJson(body);
      };

      next();
    };
  }
}

const memoryResponseCache = new ResponseCache(10 * 60 * 1000); // 10 minutes

// Preconfigured Production-Ready Limiters
const authRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
}).middleware();

const itineraryRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 80,
  message: 'Itinerary generation limit reached for your connection. Please wait a few minutes before generating more routes.'
}).middleware();

const generalRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 1200,
  message: 'High request rate detected. Throttling active to preserve server stability.'
}).middleware();

const emailActionRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Email request rate limit reached. Please wait a few minutes before requesting more emails.'
}).middleware();

module.exports = {
  securityHeaders,
  requestTimeout,
  authRateLimiter,
  itineraryRateLimiter,
  generalRateLimiter,
  emailActionRateLimiter,
  cacheMiddleware: (ttl) => memoryResponseCache.middleware(ttl)
};
