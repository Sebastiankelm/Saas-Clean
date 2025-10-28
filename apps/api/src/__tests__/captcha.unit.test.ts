import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof globalThis.fetch;
}

const setBaseEnv = () => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
};

describe('verifyCaptchaToken', () => {
beforeEach(() => {
  vi.resetModules();
  setBaseEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

  it('returns true when captcha enforcement is skipped', async () => {
    vi.stubEnv('SKIP_CAPTCHA_ENFORCEMENT', 'true');

    const { verifyCaptchaToken } = await import('../services/captcha');
    const result = await verifyCaptchaToken('token');

    expect(result).toBe(true);
  });

  it('calls Turnstile verify endpoint when enforcement is enabled', async () => {
    vi.stubEnv('SKIP_CAPTCHA_ENFORCEMENT', 'false');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { verifyCaptchaToken } = await import('../services/captcha');
    const result = await verifyCaptchaToken('token', '127.0.0.1');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
