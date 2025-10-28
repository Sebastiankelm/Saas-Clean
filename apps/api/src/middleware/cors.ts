// @ts-nocheck
import { Context, Next } from 'hono';

interface CorsConfig {
  origin: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(config: CorsConfig) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin');
    
    // Check if origin is allowed
    const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];
    const isAllowed = !origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*');
    
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    c.header('Access-Control-Allow-Methods', (config.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']).join(', '));
    c.header('Access-Control-Allow-Headers', (config.allowedHeaders || ['Content-Type', 'Authorization']).join(', '));
    
    if (config.credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }
    
    if (config.maxAge) {
      c.header('Access-Control-Max-Age', config.maxAge.toString());
    }
    
    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return c.newResponse(null, { status: 204 });
    }
    
    await next();
  };
}

// Default CORS configuration
export const defaultCors = cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
});
