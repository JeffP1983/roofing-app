require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const MIGRATION_FILES = ['001_schema.sql', '002_seed_pricing.sql'];

async function runMigrations() {
  // Ensure tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of MIGRATION_FILES) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`[migrate] Applying ${file}...`);
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`[migrate] ${file} applied.`);
  }
}

// Allow running directly: node src/migrations/run.js
if (require.main === module) {
  runMigrations()
    .then(() => { console.log('Migrations complete.'); process.exit(0); })
    .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
}

module.exports = { runMigrations };
