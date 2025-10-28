import { Pool, type PoolClient, type QueryResult } from 'pg';
import { env } from '@/config/env';

let pool: Pool | null = null;

function createPool() {
  if (!env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not configured');
  }

  return new Pool({
    connectionString: env.POSTGRES_URL,
    ssl:
      env.POSTGRES_SSL === 'true'
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  });
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getPool();
  const client = await db.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const db = getPool();
  return db.query<T>(sql, params);
}
