import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

let pool: Pool | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    if (!database) {
      database = drizzle(getPool(), { schema });
    }
    return (database as unknown as Record<string | symbol, unknown>)[prop];
  },
});
