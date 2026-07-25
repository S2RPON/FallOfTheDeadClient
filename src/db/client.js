import { Pool } from 'pg';
import { config } from '../config.js';

const isRender = (config.databaseUrl || '').includes('.render.com');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isRender ? { rejectUnauthorized: false } : false
});
export function getPool() {
  return pool;
}
export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
