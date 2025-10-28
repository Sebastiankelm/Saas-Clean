import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authentication } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import dataRouter from './routes/data';
import cmsRouter from './routes/cms';
import dashboardsRouter from './routes/dashboards';
import authAdminRouter from './routes/auth-admin';
import storageRouter from './routes/storage';
import auditRouter from './routes/audit';

const app = new Hono<AppEnv>();

app.use('*', authentication());
app.use('*', auditMiddleware());

app.route('/data', dataRouter);
app.route('/cms', cmsRouter);
app.route('/dashboards', dashboardsRouter);
app.route('/auth-admin', authAdminRouter);
app.route('/storage', storageRouter);
app.route('/audit', auditRouter);

export default app;
