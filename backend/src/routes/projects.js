const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/projects — create a project (client creates for self; admin can specify client_id)
router.post('/', authenticate, async (req, res) => {
  const { project_address, client_id } = req.body;

  if (!project_address) {
    return res.status(400).json({ error: 'project_address is required' });
  }

  // Clients can only create projects for themselves
  const ownerId = req.user.role === 'admin' && client_id ? client_id : req.user.id;

  const { rows } = await db.query(
    `INSERT INTO projects (client_id, project_address) VALUES ($1, $2)
     RETURNING *`,
    [ownerId, project_address]
  );
  res.status(201).json(rows[0]);
});

// GET /api/projects — list projects
// Clients see own; admins see all
router.get('/', authenticate, async (req, res) => {
  let query, params;

  if (req.user.role === 'admin') {
    query = `
      SELECT p.*, u.name AS client_name, u.email AS client_email,
             COUNT(e.id) AS estimate_count
      FROM projects p
      JOIN users u ON u.id = p.client_id
      LEFT JOIN estimates e ON e.project_id = p.id
      GROUP BY p.id, u.name, u.email
      ORDER BY p.created_at DESC
    `;
    params = [];
  } else {
    query = `
      SELECT p.*, COUNT(e.id) AS estimate_count
      FROM projects p
      LEFT JOIN estimates e ON e.project_id = p.id
      WHERE p.client_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    params = [req.user.id];
  }

  const { rows } = await db.query(query, params);
  res.json(rows);
});

// GET /api/projects/:id — get project + its estimates
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  const projectQ = await db.query(
    `SELECT p.*, u.name AS client_name, u.email AS client_email
     FROM projects p
     JOIN users u ON u.id = p.client_id
     WHERE p.id = $1`,
    [id]
  );

  const project = projectQ.rows[0];
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Clients can only view their own projects
  if (req.user.role === 'client' && project.client_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const estimatesQ = await db.query(
    `SELECT id, estimate_number, status, estimate_type, is_reroof, created_at, updated_at
     FROM estimates WHERE project_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  res.json({ ...project, estimates: estimatesQ.rows });
});

module.exports = router;
