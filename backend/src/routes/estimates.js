const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { runCalculation } = require('../services/calculationEngine');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDefaultMaterials(client) {
  const { rows } = await client.query(`
    SELECT m.*, mc.name AS category_name
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    WHERE m.is_default = TRUE AND m.is_active = TRUE
  `);
  const defaults = {};
  for (const row of rows) defaults[row.category_name] = row;
  return defaults;
}

async function getMaterialById(client, id) {
  const { rows } = await client.query(
    `SELECT m.*, mc.name AS category_name FROM materials m
     JOIN material_categories mc ON mc.id = m.category_id
     WHERE m.id = $1 AND m.is_active = TRUE`,
    [id]
  );
  return rows[0] || null;
}

/** Resolve the material to use for each category, falling back to defaults. */
async function resolveMaterials(client, selections = {}) {
  const defaults = await getDefaultMaterials(client);
  const categories = ['field_shingles', 'underlayment', 'ice_water_shield', 'starter', 'drip_edge', 'hip_ridge'];
  const resolved = {};

  for (const cat of categories) {
    if (selections[cat]) {
      const m = await getMaterialById(client, selections[cat]);
      resolved[cat] = m || defaults[cat];
    } else {
      resolved[cat] = defaults[cat];
    }
    if (!resolved[cat]) {
      throw new Error(`No material found for category: ${cat}`);
    }
  }
  return resolved;
}

async function getAppSettings(client) {
  const { rows } = await client.query(`SELECT key, value FROM app_settings`);
  const s = {};
  for (const r of rows) s[r.key] = parseFloat(r.value);
  return s;
}

function nextEstimateNumber(seq) {
  const year = new Date().getFullYear();
  return `EST-${year}-${String(seq).padStart(5, '0')}`;
}

async function assertEstimateAccess(client, estimateId, user) {
  const { rows } = await client.query(
    `SELECT e.*, p.client_id FROM estimates e
     JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [estimateId]
  );
  const est = rows[0];
  if (!est) return null;
  if (user.role === 'client' && est.client_id !== user.id) return null;
  return est;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/projects/:projectId/estimates
 * Create a new estimate with takeoff data. Does NOT run calculation yet.
 *
 * Body: {
 *   is_reroof?, tearoff_layers?,
 *   plan_type, roof_style?,
 *   scale_ratio?,
 *   planes: [{ plane_label?, horizontal_length, horizontal_width, horizontal_area?, pitch_numerator }],
 *   linear_footage: { eave_lf, rake_lf, hip_lf, ridge_lf, valley_lf }
 * }
 */
router.post('/projects/:projectId/estimates', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const {
    is_reroof = false,
    tearoff_layers = 1,
    plan_type,
    roof_style,
    scale_ratio,
    planes = [],
    linear_footage = {},
    notes,
    facet_count,
    structure_complexity,
  } = req.body;

  if (!planes.length) {
    return res.status(400).json({ error: 'At least one roof plane is required' });
  }
  if (!plan_type) {
    return res.status(400).json({ error: 'plan_type is required (roof_plan or floor_plan)' });
  }

  const dbClient = await db.pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Verify project exists and user has access
    const projResult = await dbClient.query(
      `SELECT id, client_id FROM projects WHERE id = $1`,
      [projectId]
    );
    const project = projResult.rows[0];
    if (!project) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    if (req.user.role === 'client' && project.client_id !== req.user.id) {
      await dbClient.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate estimate number
    const seqResult = await dbClient.query(`SELECT nextval('estimate_number_seq') AS seq`);
    const estimateNumber = nextEstimateNumber(seqResult.rows[0].seq);

    const estimateType = plan_type === 'floor_plan' ? 'assisted' : 'calculated';

    // Get default overhead/profit from settings
    const settings = await getAppSettings(dbClient);

    const estResult = await dbClient.query(
      `INSERT INTO estimates
         (project_id, estimate_number, estimate_type, is_reroof, tearoff_layers,
          overhead_percent, profit_percent, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        projectId, estimateNumber, estimateType, is_reroof, tearoff_layers,
        settings.overhead_percent ?? 15, settings.profit_percent ?? 35, notes || null,
      ]
    );
    const estimate = estResult.rows[0];

    // Create takeoff
    const takeoffResult = await dbClient.query(
      `INSERT INTO takeoffs (estimate_id, plan_type, roof_style, scale_ratio, facet_count, structure_complexity, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [estimate.id, plan_type, roof_style || null, scale_ratio || null, facet_count || null, structure_complexity || null]
    );
    const takeoffId = takeoffResult.rows[0].id;

    // Insert roof planes
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i];
      const horizArea = p.horizontal_area != null
        ? p.horizontal_area
        : (parseFloat(p.horizontal_length) * parseFloat(p.horizontal_width));
      await dbClient.query(
        `INSERT INTO roof_planes
           (takeoff_id, plane_label, horizontal_length, horizontal_width,
            horizontal_area, pitch_numerator, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          takeoffId,
          p.plane_label || `Plane ${i + 1}`,
          p.horizontal_length || null,
          p.horizontal_width  || null,
          horizArea,
          p.pitch_numerator   || 6,
          i,
        ]
      );
    }

    // Insert linear footage
    const lf = linear_footage;
    await dbClient.query(
      `INSERT INTO takeoff_linear_footage
         (takeoff_id, eave_lf, rake_lf, hip_lf, ridge_lf, valley_lf)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        takeoffId,
        lf.eave_lf   || 0,
        lf.rake_lf   || 0,
        lf.hip_lf    || 0,
        lf.ridge_lf  || 0,
        lf.valley_lf || 0,
      ]
    );

    await dbClient.query('COMMIT');
    res.status(201).json({ estimate, takeoff_id: takeoffId, message: 'Estimate created. POST /api/estimates/:id/calculate to generate pricing.' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Create estimate error:', err);
    res.status(500).json({ error: err.message || 'Failed to create estimate' });
  } finally {
    dbClient.release();
  }
});

/**
 * POST /api/estimates/:id/calculate
 * Run (or re-run) the calculation engine with optional material selections.
 * Replaces all non-manually-overridden line items.
 *
 * Body: {
 *   material_selections?: {
 *     field_shingles?: uuid,
 *     underlayment?: uuid,
 *     ice_water_shield?: uuid,
 *     starter?: uuid,
 *     drip_edge?: uuid,
 *     hip_ridge?: uuid
 *   }
 * }
 */
router.post('/:id/calculate', authenticate, async (req, res) => {
  const { id } = req.params;
  const { material_selections = {} } = req.body;

  const dbClient = await db.pool.connect();
  try {
    await dbClient.query('BEGIN');

    const estimate = await assertEstimateAccess(dbClient, id, req.user);
    if (!estimate) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Load takeoff
    const takeoffResult = await dbClient.query(
      `SELECT t.*, tlf.eave_lf, tlf.rake_lf, tlf.hip_lf, tlf.ridge_lf, tlf.valley_lf
       FROM takeoffs t
       LEFT JOIN takeoff_linear_footage tlf ON tlf.takeoff_id = t.id
       WHERE t.estimate_id = $1`,
      [id]
    );
    const takeoff = takeoffResult.rows[0];
    if (!takeoff) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'No takeoff data found for this estimate. Create the estimate with planes first.' });
    }

    const planesResult = await dbClient.query(
      `SELECT * FROM roof_planes WHERE takeoff_id = $1 ORDER BY display_order`,
      [takeoff.id]
    );
    const planes = planesResult.rows;
    if (!planes.length) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'No roof planes found in takeoff data' });
    }

    // Resolve materials
    const materials = await resolveMaterials(dbClient, material_selections);

    const linearFootage = {
      eave_lf:   takeoff.eave_lf   || 0,
      rake_lf:   takeoff.rake_lf   || 0,
      hip_lf:    takeoff.hip_lf    || 0,
      ridge_lf:  takeoff.ridge_lf  || 0,
      valley_lf: takeoff.valley_lf || 0,
    };

    // Run calculation engine
    const { annotatedPlanes, lineItems, financials } = runCalculation({
      planes,
      linearFootage,
      materials,
      estimateSettings: {
        overhead_percent: estimate.overhead_percent,
        profit_percent:   estimate.profit_percent,
        is_reroof:        estimate.is_reroof,
        tearoff_layers:   estimate.tearoff_layers,
      },
    });

    // Delete old non-overridden line items
    await dbClient.query(
      `DELETE FROM estimate_line_items WHERE estimate_id = $1 AND is_manual_override = FALSE`,
      [id]
    );

    // Insert new line items
    const insertedItems = [];
    for (const li of lineItems) {
      const { rows } = await dbClient.query(
        `INSERT INTO estimate_line_items
           (estimate_id, line_type, material_id, description, quantity, unit,
            unit_price, total_price, display_order, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id, li.line_type, li.material_id || null, li.description,
          li.quantity, li.unit, li.unit_price, li.total_price,
          li.display_order, li.metadata ? JSON.stringify(li.metadata) : null,
        ]
      );
      insertedItems.push(rows[0]);
    }

    // Store annotated plane data back (slope_factor + actual_surface_area)
    for (const p of annotatedPlanes) {
      await dbClient.query(
        `UPDATE roof_planes
         SET slope_factor = $1, actual_surface_area = $2
         WHERE id = $3`,
        [p.slope_factor, p.actual_surface_area, p.id]
      );
    }

    await dbClient.query('COMMIT');

    // Merge any manual overrides into financials response
    const allItemsResult = await db.query(
      `SELECT eli.*, m.manufacturer, m.name AS material_name
       FROM estimate_line_items eli
       LEFT JOIN materials m ON m.id = eli.material_id
       WHERE eli.estimate_id = $1
       ORDER BY eli.display_order`,
      [id]
    );

    res.json({
      estimate: {
        id: estimate.id,
        estimate_number: estimate.estimate_number,
        estimate_type: estimate.estimate_type,
        status: estimate.status,
        is_reroof: estimate.is_reroof,
        overhead_percent: estimate.overhead_percent,
        profit_percent: estimate.profit_percent,
      },
      line_items: allItemsResult.rows,
      financials,
      materials_used: Object.fromEntries(
        Object.entries(materials).map(([cat, m]) => [cat, { id: m.id, name: m.name, manufacturer: m.manufacturer, unit_price: +m.unit_price }])
      ),
    });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Calculate error:', err);
    res.status(500).json({ error: err.message || 'Calculation failed' });
  } finally {
    dbClient.release();
  }
});

/**
 * GET /api/estimates/:id
 * Full estimate: metadata, takeoff summary, line items, financials.
 */
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const dbClient = await db.pool.connect();
  try {
    const estimate = await assertEstimateAccess(dbClient, id, req.user);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });

    const [takeoffR, planesR, lineItemsR, projectR] = await Promise.all([
      dbClient.query(
        `SELECT t.*, tlf.eave_lf, tlf.rake_lf, tlf.hip_lf, tlf.ridge_lf, tlf.valley_lf
         FROM takeoffs t
         LEFT JOIN takeoff_linear_footage tlf ON tlf.takeoff_id = t.id
         WHERE t.estimate_id = $1`,
        [id]
      ),
      dbClient.query(
        `SELECT * FROM roof_planes rp
         JOIN takeoffs t ON t.id = rp.takeoff_id
         WHERE t.estimate_id = $1 ORDER BY rp.display_order`,
        [id]
      ),
      dbClient.query(
        `SELECT eli.*,
                m.manufacturer, m.name AS material_name,
                mc.name AS category_name, mc.label AS category_label
         FROM estimate_line_items eli
         LEFT JOIN materials m ON m.id = eli.material_id
         LEFT JOIN material_categories mc ON mc.id = m.category_id
         WHERE eli.estimate_id = $1
         ORDER BY eli.display_order`,
        [id]
      ),
      dbClient.query(
        `SELECT p.project_address, u.name AS client_name, u.email AS client_email
         FROM projects p JOIN users u ON u.id = p.client_id
         WHERE p.id = $1`,
        [estimate.project_id]
      ),
    ]);

    const lineItems = lineItemsR.rows;
    const { overhead_percent, profit_percent } = estimate;

    // Recompute financials from stored line items
    const { calcFinancials } = require('../services/calculationEngine');
    const settingsR = await dbClient.query(`SELECT key, value FROM app_settings WHERE key = 'sales_tax_percent'`);
    const taxRate = settingsR.rows[0] ? parseFloat(settingsR.rows[0].value) : 8.25;
    const financials = calcFinancials(lineItems, parseFloat(overhead_percent), parseFloat(profit_percent), taxRate);

    res.json({
      estimate: {
        id: estimate.id,
        estimate_number: estimate.estimate_number,
        estimate_type: estimate.estimate_type,
        status: estimate.status,
        is_reroof: estimate.is_reroof,
        tearoff_layers: estimate.tearoff_layers,
        overhead_percent: parseFloat(estimate.overhead_percent),
        profit_percent: parseFloat(estimate.profit_percent),
        notes: estimate.notes,
        created_at: estimate.created_at,
        updated_at: estimate.updated_at,
      },
      project: projectR.rows[0],
      takeoff: takeoffR.rows[0],
      planes: planesR.rows,
      line_items: lineItems,
      financials,
    });
  } finally {
    dbClient.release();
  }
});

/**
 * GET /api/estimates — list estimates
 * Clients see their own; admins see all (with optional status filter).
 */
router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  let query, params;

  if (req.user.role === 'admin') {
    query = `
      SELECT e.*, p.project_address, u.name AS client_name
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      JOIN users u ON u.id = p.client_id
      ${status ? 'WHERE e.status = $1' : ''}
      ORDER BY e.created_at DESC
    `;
    params = status ? [status] : [];
  } else {
    query = `
      SELECT e.*, p.project_address
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE p.client_id = $1 ${status ? 'AND e.status = $2' : ''}
      ORDER BY e.created_at DESC
    `;
    params = status ? [req.user.id, status] : [req.user.id];
  }

  const { rows } = await db.query(query, params);
  res.json(rows);
});

/**
 * PATCH /api/estimates/:id — update status, notes, O&P (admin only for O&P)
 */
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status, notes, overhead_percent, profit_percent, is_reroof, tearoff_layers } = req.body;

  const dbClient = await db.pool.connect();
  try {
    const estimate = await assertEstimateAccess(dbClient, id, req.user);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });

    const updates = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      if (!['draft', 'sent', 'accepted'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push(`status = $${idx++}`); values.push(status);
    }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }

    // O&P changes: admin only
    if (overhead_percent !== undefined || profit_percent !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change overhead/profit' });
      }
      if (overhead_percent !== undefined) { updates.push(`overhead_percent = $${idx++}`); values.push(overhead_percent); }
      if (profit_percent   !== undefined) { updates.push(`profit_percent = $${idx++}`);   values.push(profit_percent); }
    }

    if (is_reroof !== undefined && req.user.role === 'admin') {
      updates.push(`is_reroof = $${idx++}`); values.push(is_reroof);
    }
    if (tearoff_layers !== undefined && req.user.role === 'admin') {
      updates.push(`tearoff_layers = $${idx++}`); values.push(tearoff_layers);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id);
    const { rows } = await dbClient.query(
      `UPDATE estimates SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } finally {
    dbClient.release();
  }
});

/**
 * PATCH /api/estimates/:id/line-items/:lineId — manual override (admin only)
 */
router.patch('/:id/line-items/:lineId', authenticate, requireAdmin, async (req, res) => {
  const { id, lineId } = req.params;
  const { quantity, unit_price, description } = req.body;

  const updates = ['is_manual_override = TRUE'];
  const values = [];
  let idx = 1;

  if (quantity    !== undefined) { updates.push(`quantity = $${idx++}`);    values.push(quantity); }
  if (unit_price  !== undefined) { updates.push(`unit_price = $${idx++}`);  values.push(unit_price); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }

  // Recompute total_price if qty or unit_price changed
  if (quantity !== undefined || unit_price !== undefined) {
    // We need both values — fetch current if one is missing
    const current = await db.query(
      `SELECT quantity, unit_price FROM estimate_line_items WHERE id = $1 AND estimate_id = $2`,
      [lineId, id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Line item not found' });

    const finalQty   = quantity   ?? current.rows[0].quantity;
    const finalPrice = unit_price ?? current.rows[0].unit_price;
    updates.push(`total_price = $${idx++}`);
    values.push(Math.round(parseFloat(finalQty) * parseFloat(finalPrice) * 100) / 100);
  }

  values.push(lineId, id);
  const { rows } = await db.query(
    `UPDATE estimate_line_items SET ${updates.join(', ')}
     WHERE id = $${idx++} AND estimate_id = $${idx} RETURNING *`,
    values
  );

  if (!rows[0]) return res.status(404).json({ error: 'Line item not found' });
  res.json(rows[0]);
});

module.exports = router;
