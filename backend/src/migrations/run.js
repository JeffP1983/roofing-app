require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function runMigrations() {
  const files = ['001_schema.sql', '002_seed_pricing.sql'];

  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`Running ${file}...`);
    await db.query(sql);
    console.log(`  ${file} complete.`);
  }

  console.log('All migrations complete.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
