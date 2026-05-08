const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/admin/auth/login — admin login (separate portal)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const result = await db.query(
    `SELECT id, email, password_hash, role, name FROM users WHERE email = $1 AND role = 'admin'`,
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// GET /api/admin/auth/me — verify admin token
router.get('/me', authenticate, requireAdmin, async (req, res) => {
  const result = await db.query(
    `SELECT id, email, role, name, created_at FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(result.rows[0]);
});

// POST /api/admin/auth/create-admin — create initial admin (protected, only callable by existing admin)
// On first run, use the seed script instead.
router.post('/create-admin', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: 'Admin passwords must be at least 12 characters' });
  }

  const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'admin', $3)
     RETURNING id, email, role, name`,
    [email.toLowerCase(), hash, name]
  );

  res.status(201).json(result.rows[0]);
});

module.exports = router;
