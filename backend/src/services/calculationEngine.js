/**
 * Roofing calculation engine — pure functions, no database calls.
 * All monetary values returned as plain numbers; caller rounds for display.
 */

const SLOPE_FACTORS = {
  2: 1.014, 3: 1.031, 4: 1.054, 5: 1.083,  6: 1.118,
  7: 1.158, 8: 1.202, 9: 1.250, 10: 1.302, 11: 1.357, 12: 1.414,
};

function getSlopeFactor(pitchNumerator) {
  return SLOPE_FACTORS[pitchNumerator] ?? SLOPE_FACTORS[6];
}

/**
 * Annotate each plane with computed slope_factor, horizontal_area, and actual_surface_area.
 * Accepts planes as stored in DB (fields may come back as strings from pg).
 */
function annotatePlanes(planes) {
  return planes.map((p) => {
    const pitch = parseInt(p.pitch_numerator, 10) || 6;
    const slopeFactor = getSlopeFactor(pitch);
    const horizArea = parseFloat(p.horizontal_area)
      || (parseFloat(p.horizontal_length) * parseFloat(p.horizontal_width));
    const actualSqFt = horizArea * slopeFactor;
    return {
      ...p,
      pitch_numerator: pitch,
      slope_factor: slopeFactor,
      horizontal_area: horizArea,
      actual_surface_area: actualSqFt,
      actual_sq: actualSqFt / 100,
    };
  });
}

/** Field shingles: total actual SQ × 1.15 waste, rounded up. */
function calcFieldShingles(annotatedPlanes, material) {
  const totalSq = annotatedPlanes.reduce((s, p) => s + p.actual_sq, 0);
  const withWaste = totalSq * 1.15;
  const qty = Math.ceil(withWaste);
  const unitPrice = +material.unit_price;
  return {
    line_type: 'field_shingles',
    material_id: material.id,
    description: [material.manufacturer, material.name].filter(Boolean).join(' '),
    quantity: qty,
    unit: 'SQ',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 1,
    metadata: { total_sq: round4(totalSq), with_waste: round4(withWaste) },
  };
}

/**
 * Underlayment: planes with pitch < 3/12 get doubled coverage for that plane.
 * Rolls = ceil(total underlayment SQ / material.coverage_sq).
 */
function calcUnderlayment(annotatedPlanes, material) {
  let underlaymentSq = 0;
  for (const p of annotatedPlanes) {
    const planeSq = p.actual_sq;
    underlaymentSq += p.pitch_numerator < 3 ? planeSq * 2 : planeSq;
  }
  const coveragePerRoll = +material.coverage_sq || 10;
  const qty = Math.ceil(underlaymentSq / coveragePerRoll);
  const unitPrice = +material.unit_price;
  return {
    line_type: 'underlayment',
    material_id: material.id,
    description: [material.manufacturer, material.name].filter(Boolean).join(' '),
    quantity: qty,
    unit: 'RL',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 2,
    metadata: { underlayment_sq: round4(underlaymentSq) },
  };
}

/**
 * Ice & Water Shield: valleys only.
 * Effective coverage = lf_per_unit − 1 ft seam overlap.
 * Rolls = ceil(valley_lf / effective_lf).
 */
function calcIWS(valleyLf, material) {
  const valley = +valleyLf || 0;
  const effectiveLf = (+material.lf_per_unit || 66) - 1; // 65 for StormGuard
  const qty = valley > 0 ? Math.ceil(valley / effectiveLf) : 0;
  const unitPrice = +material.unit_price;
  return {
    line_type: 'ice_water_shield',
    material_id: material.id,
    description: [material.manufacturer, material.name].filter(Boolean).join(' '),
    quantity: qty,
    unit: 'RL',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 3,
    metadata: { valley_lf: valley, effective_lf_per_roll: effectiveLf },
  };
}

/**
 * Starter: (eave LF + rake LF) ÷ material.lf_per_unit, rounded up.
 */
function calcStarter(eave_lf, rake_lf, material) {
  const perimeter = (+eave_lf || 0) + (+rake_lf || 0);
  const lfPerBundle = +material.lf_per_unit || 120;
  const qty = Math.ceil(perimeter / lfPerBundle);
  const unitPrice = +material.unit_price;
  return {
    line_type: 'starter',
    material_id: material.id,
    description: [material.manufacturer, material.name].filter(Boolean).join(' '),
    quantity: qty,
    unit: 'BD',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 4,
    metadata: { perimeter_lf: perimeter },
  };
}

/**
 * Drip Edge: (eave LF + rake LF) ÷ 10, rounded up, + 3 extra sticks always.
 */
function calcDripEdge(eave_lf, rake_lf, material) {
  const perimeter = (+eave_lf || 0) + (+rake_lf || 0);
  const lfPerPiece = +material.lf_per_unit || 10;
  const qty = Math.ceil(perimeter / lfPerPiece) + 3;
  const unitPrice = +material.unit_price;
  return {
    line_type: 'drip_edge',
    material_id: material.id,
    description: material.name,
    quantity: qty,
    unit: 'PC',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 5,
    metadata: { perimeter_lf: perimeter, extra_sticks: 3 },
  };
}

/**
 * Hip & Ridge: (hip LF + ridge LF) ÷ material.lf_per_unit, rounded up.
 */
function calcHipRidge(hip_lf, ridge_lf, material) {
  const totalLf = (+hip_lf || 0) + (+ridge_lf || 0);
  const lfPerBundle = +material.lf_per_unit || 33;
  const qty = Math.ceil(totalLf / lfPerBundle);
  const unitPrice = +material.unit_price;
  return {
    line_type: 'hip_ridge',
    material_id: material.id,
    description: [material.manufacturer, material.name].filter(Boolean).join(' '),
    quantity: qty,
    unit: 'BD',
    unit_price: unitPrice,
    total_price: round2(qty * unitPrice),
    display_order: 6,
    metadata: { hip_lf: +hip_lf || 0, ridge_lf: +ridge_lf || 0, total_lf: totalLf },
  };
}

/**
 * Labor: calculated per pitch tier separately, then summed.
 * Base $50/SQ for ≤ 7/12; +$5/SQ for each full increment above 7/12.
 * Returns one line item with tier breakdown in metadata.
 */
function calcLabor(annotatedPlanes) {
  // Group actual SQ by pitch tier
  const tiers = {};
  for (const p of annotatedPlanes) {
    const pitch = p.pitch_numerator;
    tiers[pitch] = (tiers[pitch] || 0) + p.actual_sq;
  }

  let totalLaborCost = 0;
  let totalSq = 0;
  const breakdown = [];

  for (const [pitchStr, sq] of Object.entries(tiers)) {
    const pitch = parseInt(pitchStr, 10);
    const rate = pitch <= 7 ? 50 : 50 + (pitch - 7) * 5;
    const tierCost = sq * rate;
    totalLaborCost += tierCost;
    totalSq += sq;
    breakdown.push({ pitch, sq: round4(sq), rate, total: round2(tierCost) });
  }

  breakdown.sort((a, b) => a.pitch - b.pitch);

  // blended rate for display (actual math is in metadata)
  const blendedRate = totalSq > 0 ? totalLaborCost / totalSq : 0;

  return {
    line_type: 'labor',
    material_id: null,
    description: 'Installation Labor',
    quantity: round4(totalSq),
    unit: 'SQ',
    unit_price: round4(blendedRate),
    total_price: round2(totalLaborCost),
    display_order: 7,
    metadata: { pitch_tiers: breakdown },
  };
}

/**
 * Tear-off: single layer $75/SQ; each additional layer +$10/SQ.
 * Only included for re-roof jobs.
 */
function calcTearoff(totalSq, layers) {
  const l = Math.max(1, parseInt(layers, 10) || 1);
  const rate = 75 + (l - 1) * 10;
  return {
    line_type: 'tearoff',
    material_id: null,
    description: `Tear-Off (${l} layer${l !== 1 ? 's' : ''})`,
    quantity: round4(totalSq),
    unit: 'SQ',
    unit_price: rate,
    total_price: round2(totalSq * rate),
    display_order: 8,
    metadata: { layers: l, rate_per_sq: rate },
  };
}

/**
 * Financial summary.
 *   Direct Costs = materials + labor (+ tearoff)
 *   Sales Tax    = materials × tax_rate  (never on labor)
 *   Overhead     = direct_costs × overhead_pct
 *   Profit       = direct_costs × profit_pct
 *   Grand Total  = direct_costs × (1 + overhead_pct + profit_pct) + sales_tax
 */
function calcFinancials(lineItems, overheadPct, profitPct, taxRate = 8.25) {
  const MATERIAL_TYPES = new Set([
    'field_shingles', 'underlayment', 'ice_water_shield',
    'starter', 'drip_edge', 'hip_ridge',
  ]);

  const materialsSubtotal = lineItems
    .filter((li) => MATERIAL_TYPES.has(li.line_type))
    .reduce((s, li) => s + +li.total_price, 0);

  const laborTotal = lineItems
    .filter((li) => li.line_type === 'labor' || li.line_type === 'tearoff')
    .reduce((s, li) => s + +li.total_price, 0);

  const directCosts = materialsSubtotal + laborTotal;
  const salesTax    = materialsSubtotal * (taxRate / 100);
  const overhead    = directCosts * (overheadPct / 100);
  const profit      = directCosts * (profitPct  / 100);
  const grandTotal  = directCosts + salesTax + overhead + profit;

  return {
    materials_subtotal: round2(materialsSubtotal),
    labor_total:        round2(laborTotal),
    sales_tax:          round2(salesTax),
    direct_costs:       round2(directCosts),
    overhead:           round2(overhead),
    profit:             round2(profit),
    grand_total:        round2(grandTotal),
    overhead_pct:       overheadPct,
    profit_pct:         profitPct,
    tax_rate:           taxRate,
  };
}

/**
 * Master function: runs every line item for an estimate.
 *
 * @param {object} params
 * @param {Array}  params.planes            - roof plane rows (from DB or confirmed takeoff)
 * @param {object} params.linearFootage     - { eave_lf, rake_lf, hip_lf, ridge_lf, valley_lf }
 * @param {object} params.materials         - { field_shingles, underlayment, ice_water_shield,
 *                                              starter, drip_edge, hip_ridge }  (each a material row)
 * @param {object} params.estimateSettings  - { overhead_percent, profit_percent, is_reroof, tearoff_layers }
 * @returns {{ annotatedPlanes, lineItems, financials }}
 */
function runCalculation({ planes, linearFootage, materials, estimateSettings }) {
  const annotatedPlanes = annotatePlanes(planes);
  const { eave_lf, rake_lf, hip_lf, ridge_lf, valley_lf } = linearFootage;
  const { overhead_percent, profit_percent, is_reroof, tearoff_layers } = estimateSettings;

  const lineItems = [
    calcFieldShingles(annotatedPlanes, materials.field_shingles),
    calcUnderlayment(annotatedPlanes, materials.underlayment),
    calcIWS(valley_lf, materials.ice_water_shield),
    calcStarter(eave_lf, rake_lf, materials.starter),
    calcDripEdge(eave_lf, rake_lf, materials.drip_edge),
    calcHipRidge(hip_lf, ridge_lf, materials.hip_ridge),
    calcLabor(annotatedPlanes),
  ];

  if (is_reroof) {
    const totalSq = annotatedPlanes.reduce((s, p) => s + p.actual_sq, 0);
    lineItems.push(calcTearoff(totalSq, tearoff_layers));
  }

  const financials = calcFinancials(
    lineItems,
    parseFloat(overhead_percent) || 15,
    parseFloat(profit_percent)   || 35,
  );

  return { annotatedPlanes, lineItems, financials };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

module.exports = {
  SLOPE_FACTORS,
  getSlopeFactor,
  annotatePlanes,
  calcFieldShingles,
  calcUnderlayment,
  calcIWS,
  calcStarter,
  calcDripEdge,
  calcHipRidge,
  calcLabor,
  calcTearoff,
  calcFinancials,
  runCalculation,
};
