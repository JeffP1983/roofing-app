const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register — client self-registration
router.post('/register', async (req, res) => {
  const { name, email, password, project_address, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, name)
       VALUES ($1, $2, 'client', $3) RETURNING id, email, role, name, created_at`,
      [email.toLowerCase(), hash, name]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO client_profiles (user_id, project_address, phone) VALUES ($1, $2, $3)`,
      [user.id, project_address || null, phone || null]
    );

    await client.query('COMMIT');

    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login — client login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const result = await db.query(
    `SELECT id, email, password_hash, role, name FROM users WHERE email = $1 AND role = 'client'`,
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// GET /api/auth/me — return current user from token
router.get('/me', authenticate, async (req, res) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.role, u.name, u.created_at,
            cp.project_address, cp.phone
     FROM users u
     LEFT JOIN client_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }

  const u = result.rows[0];
  res.json({ id: u.id, email: u.email, role: u.role, name: u.name, created_at: u.created_at, project_address: u.project_address, phone: u.phone });
});

module.exports = router;
