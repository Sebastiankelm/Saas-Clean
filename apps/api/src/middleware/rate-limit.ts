import { Context, Next } from 'hono';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for development (use Redis in production)
const requestStore = new Map<string, RequestRecord>();

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const clientId = c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Clean up expired entries
    for (const [key, record] of requestStore.entries()) {
      if (record.resetTime < now) {
        requestStore.delete(key);
      }
    }
    
    // Get or create record for this client
    let record = requestStore.get(clientId);
    
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      requestStore.set(clientId, record);
    }
    
    record.count++;
    
    if (record.count > config.maxRequests) {
      return c.json(
        { 
          error: config.message || 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        },
        429
      );
    }
    
    // Add rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
    
    await next();
  };
}

// Predefined rate limiters
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'Global rate limit exceeded',
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Authentication rate limit exceeded',
});

export const sensitiveRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Sensitive endpoint rate limit exceeded',
});
