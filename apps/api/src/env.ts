const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseAnonKey: getEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET ?? null,
};

export const optionalEnv = {
  auditLogDisabled: process.env.AUDIT_LOG_DISABLED === 'true',
  skipCaptcha: process.env.SKIP_CAPTCHA_ENFORCEMENT === 'true',
};
