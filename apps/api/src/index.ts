import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authentication } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { securityHeaders } from './middleware/security-headers';
import { globalRateLimit, authRateLimit } from './middleware/rate-limit';
import { defaultCors } from './middleware/cors';
import dataRouter from './routes/data';
import cmsRouter from './routes/cms';
import dashboardsRouter from './routes/dashboards';
import authAdminRouter from './routes/auth-admin';
import storageRouter from './routes/storage';
import auditRouter from './routes/audit';

const app = new Hono<AppEnv>();

// Apply security middleware first
app.use('*', securityHeaders());
app.use('*', defaultCors);
app.use('*', globalRateLimit);

// Apply authentication and audit middleware
app.use('*', authentication());
app.use('*', auditMiddleware());

// Apply stricter rate limiting to auth routes
app.use('/auth-admin/*', authRateLimit);

app.route('/data', dataRouter);
app.route('/cms', cmsRouter);
app.route('/dashboards', dashboardsRouter);
app.route('/auth-admin', authAdminRouter);
app.route('/storage', storageRouter);
app.route('/audit', auditRouter);

export default app;
