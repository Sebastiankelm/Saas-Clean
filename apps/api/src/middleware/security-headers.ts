// @ts-nocheck
import { Context, Next } from 'hono';

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    
    // Security headers
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Content Security Policy for API
    c.header('Content-Security-Policy', [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'none'",
      "img-src 'none'",
      "font-src 'none'",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '));
  };
}
