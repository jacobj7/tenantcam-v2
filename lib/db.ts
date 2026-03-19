import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

export const db = {
  query,
  pool,

  async one<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const result = await query<T>(text, params);
    return result.rows[0] ?? null;
  },

  async many<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await query<T>(text, params);
    return result.rows;
  },

  async none(text: string, params?: unknown[]): Promise<void> {
    await query(text, params);
  },

  async transaction<T>(
    callback: (client: import("pg").PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default db;
