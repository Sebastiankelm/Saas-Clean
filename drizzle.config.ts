import type { Config } from 'drizzle-kit';

export default {
  schema: './apps/web/lib/db/schema.ts',
  out: './apps/web/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
} satisfies Config;
