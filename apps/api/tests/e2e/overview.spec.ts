import { createServer, type Server } from 'node:http';

import { expect, test } from '@playwright/test';

type SetupHarness = typeof import('../utils/supabase-stub')['setupSupabaseTestClients'];

let server: Server | null = null;
let baseURL: string;
let restoreSupabase: (() => void) | null = null;
let setupSupabaseTestClients: SetupHarness;

const bootstrapServer = async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-key';
  process.env.SKIP_CAPTCHA_ENFORCEMENT = 'true';

  ({ setupSupabaseTestClients } = await import('../utils/supabase-stub'));
  const harness = setupSupabaseTestClients();
  restoreSupabase = harness.restore;

  const appModule = await import('../../src/index');
  const honoApp = appModule.default;

  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body:
        req.method && ['GET', 'HEAD'].includes(req.method.toUpperCase())
          ? undefined
          : req,
    });

    const response = await honoApp.fetch(request);
    const body = Buffer.from(await response.arrayBuffer());

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(body);
  });

  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const address = server!.address();
  if (address && typeof address === 'object') {
    baseURL = `http://127.0.0.1:${address.port}`;
  } else {
    throw new Error('Unable to determine server address for tests.');
  }
};

test.beforeAll(async () => {
  await bootstrapServer();
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  restoreSupabase?.();
});

test('returns overview metrics from the Supamode API', async ({ request }) => {
  const response = await request.get(`${baseURL}/data/overview`);
  expect(response.status()).toBe(200);

  const payload = await response.json();
  expect(payload.summary).toEqual({
    collections: 4,
    entries: 27,
    dashboards: 3,
  });
});
