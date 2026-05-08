const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/materials — all active materials grouped by category
// Public within authenticated session (clients need it for dropdowns)
router.get('/', authenticate, async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      m.id, m.category_id, mc.name AS category_name, mc.label AS category_label,
      m.manufacturer, m.name, m.unit, m.unit_price,
      m.coverage_sq, m.lf_per_unit, m.is_default, m.notes
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    WHERE m.is_active = TRUE
    ORDER BY mc.id, m.manufacturer NULLS LAST, m.unit_price
  `);

  // Group by category
  const grouped = {};
  for (const row of rows) {
    const key = row.category_name;
    if (!grouped[key]) {
      grouped[key] = { name: key, label: row.category_label, items: [] };
    }
    grouped[key].items.push({
      id: row.id,
      manufacturer: row.manufacturer,
      name: row.name,
      unit: row.unit,
      unit_price: parseFloat(row.unit_price),
      coverage_sq: row.coverage_sq ? parseFloat(row.coverage_sq) : null,
      lf_per_unit: row.lf_per_unit ? parseFloat(row.lf_per_unit) : null,
      is_default: row.is_default,
      notes: row.notes,
    });
  }

  res.json(Object.values(grouped));
});

// GET /api/materials/defaults — just the default material for each category
router.get('/defaults', authenticate, async (req, res) => {
  const { rows } = await db.query(`
    SELECT m.*, mc.name AS category_name
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    WHERE m.is_default = TRUE AND m.is_active = TRUE
  `);

  const defaults = {};
  for (const row of rows) {
    defaults[row.category_name] = row;
  }
  res.json(defaults);
});

// GET /api/materials/settings — overhead, profit, tax
// NOTE: must be defined before PUT /:id to avoid "settings" being captured as an id param
router.get('/settings', authenticate, async (req, res) => {
  const { rows } = await db.query(`SELECT key, value FROM app_settings`);
  const settings = {};
  for (const row of rows) settings[row.key] = parseFloat(row.value);
  res.json(settings);
});

// PUT /api/materials/settings — update O&P settings (admin only)
// NOTE: must be defined before PUT /:id
router.put('/settings', authenticate, requireAdmin, async (req, res) => {
  const { overhead_percent, profit_percent, sales_tax_percent } = req.body;
  const pairs = [
    ['overhead_percent', overhead_percent],
    ['profit_percent', profit_percent],
    ['sales_tax_percent', sales_tax_percent],
  ].filter(([, v]) => v !== undefined);

  if (pairs.length === 0) return res.status(400).json({ error: 'No settings provided' });

  for (const [key, value] of pairs) {
    await db.query(
      `UPDATE app_settings SET value = $1, updated_at = NOW(), updated_by = $2 WHERE key = $3`,
      [value, req.user.id, key]
    );
  }

  const { rows } = await db.query(`SELECT key, value FROM app_settings`);
  const settings = {};
  for (const row of rows) settings[row.key] = parseFloat(row.value);
  res.json(settings);
});

// PUT /api/materials/:id — update price or details (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { unit_price, name, notes, is_active } = req.body;
  const { id } = req.params;

  const updates = [];
  const values = [];
  let idx = 1;

  if (unit_price !== undefined) { updates.push(`unit_price = $${idx++}`); values.push(unit_price); }
  if (name !== undefined)       { updates.push(`name = $${idx++}`);       values.push(name); }
  if (notes !== undefined)      { updates.push(`notes = $${idx++}`);      values.push(notes); }
  if (is_active !== undefined)  { updates.push(`is_active = $${idx++}`);  values.push(is_active); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  values.push(id);
  const { rows } = await db.query(
    `UPDATE materials SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (!rows[0]) return res.status(404).json({ error: 'Material not found' });
  res.json(rows[0]);
});

module.exports = router;
