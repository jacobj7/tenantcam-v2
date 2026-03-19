import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Export db as an alias for pool for compatibility
export const db = pool;

export default pool;
export async function query<T extends import('pg').QueryResultRow = import('pg').QueryResultRow>(
  sql: string,
  params: unknown[] = [],
) {
  return pool.query<T>(sql, params);
}
