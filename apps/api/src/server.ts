import { serve } from '@hono/node-server';
import app from './index';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Admin API listening on http://localhost:${port}`);
