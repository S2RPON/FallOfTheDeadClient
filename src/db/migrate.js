import 'dotenv/config';
import pkg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log('Migration applied:', file);
  }
  console.log('All migrations applied');
  await pool.end();
}

migrate().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
