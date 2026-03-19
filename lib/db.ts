import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Export db as an alias for pool for compatibility
export const db = pool;

export default pool;
