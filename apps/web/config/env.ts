import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const supportedLocales = z
  .string()
  .min(1, 'At least one locale is required')
  .transform((value) =>
    value
      .split(',')
      .map((locale) => locale.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().min(2)).min(1));

export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    FRONTEND_URL: z.string().url(),
    BASE_URL: z.string().url().optional(),
    CONTACT_EMAIL: z.string().email(),
    I18N_DEFAULT_LOCALE: z.string().min(2),
    I18N_SUPPORTED_LOCALES: supportedLocales,
    POSTGRES_URL: z.string().url().optional(),
    POSTGRES_SSL: z.enum(['true', 'false']).optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    BASE_URL: process.env.BASE_URL,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL,
    I18N_DEFAULT_LOCALE: process.env.I18N_DEFAULT_LOCALE,
    I18N_SUPPORTED_LOCALES: process.env.I18N_SUPPORTED_LOCALES,
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_SSL: process.env.POSTGRES_SSL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

export const baseUrl = env.BASE_URL ?? env.FRONTEND_URL;
export const supportedLocaleList = env.I18N_SUPPORTED_LOCALES;
