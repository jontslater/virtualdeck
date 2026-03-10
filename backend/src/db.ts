import { Pool } from 'pg';

// Default uses port 5433 to avoid conflict with local Postgres on 5432; set DATABASE_URL to override
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/virtualdeck';

// Log connection target (password redacted) for debugging
const safeUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
console.log('[db] connecting to', safeUrl);

export const pool = new Pool({
  connectionString
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

