/**
 * Creates the initial admin user.
 * Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword node src/migrations/seed_admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Admin password must be at least 12 characters.');
    process.exit(1);
  }

  const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists.rows.length > 0) {
    console.log('Admin user already exists:', email);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'admin', $3) RETURNING id, email, name`,
    [email.toLowerCase(), hash, name]
  );

  console.log('Admin created:', result.rows[0]);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
