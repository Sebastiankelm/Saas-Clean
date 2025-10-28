import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

type AppInstance = typeof import('../../src/index').default;
type SetupHarness = typeof import('../utils/supabase-stub')['setupSupabaseTestClients'];

const setBaseEnv = () => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.SKIP_CAPTCHA_ENFORCEMENT = 'true';
};

describe('GET /data/overview', () => {
  let app: AppInstance;
  let setupSupabaseTestClients: SetupHarness;
  const restoreFns: Array<() => void> = [];

  beforeAll(async () => {
    setBaseEnv();
    ({ setupSupabaseTestClients } = await import('../utils/supabase-stub'));
    const harness = setupSupabaseTestClients();
    restoreFns.push(() => harness.restore());
    app = (await import('../../src/index')).default;
  });

  afterEach(() => {
    process.env.SKIP_CAPTCHA_ENFORCEMENT = 'true';
  });

  afterAll(() => {
    for (const restore of restoreFns) {
      restore();
    }
  });

  it('responds with aggregated CMS and dashboard statistics', async () => {
    const response = await app.request('/data/overview', {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.summary).toEqual({
      collections: 4,
      entries: 27,
      dashboards: 3,
    });
  });
});
