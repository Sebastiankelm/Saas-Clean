declare module 'better-auth/integrations/next-js' {
  export function nextCookies(...args: unknown[]): unknown;
}

declare module 'kysely' {
  export class PostgresDialect {
    constructor(...args: unknown[]);
  }
}

declare module 'pg' {
  export class Pool {
    constructor(config?: unknown);
  }
}

declare module '@/lib/auth/better' {
  export const auth: any;
}
