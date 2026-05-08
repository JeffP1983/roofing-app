/**
 * Calculation engine unit tests — no database required.
 * Run with: node src/tests/calculationEngine.test.js
 */

const {
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
} = require('../services/calculationEngine');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

// ── Slope factors ─────────────────────────────────────────────────────────────
console.log('\nSlope factors');
assert('6/12 = 1.118', SLOPE_FACTORS[6] === 1.118);
assert('12/12 = 1.414', SLOPE_FACTORS[12] === 1.414);
assert('unknown pitch defaults to 6/12', getSlopeFactor(99) === 1.118);

// ── annotatePlanes ────────────────────────────────────────────────────────────
console.log('\nannotatePlanes');
const planes = [
  { id: '1', horizontal_length: '40', horizontal_width: '20', pitch_numerator: '6' },
  { id: '2', horizontal_area: '600', pitch_numerator: '8' },
];
const ann = annotatePlanes(planes);

assert('plane 1 horizontal_area = 800', ann[0].horizontal_area === 800);
assert('plane 1 slope_factor = 1.118', ann[0].slope_factor === 1.118);
assert('plane 1 actual_surface_area ≈ 894.4', approxEqual(ann[0].actual_surface_area, 894.4));
assert('plane 2 uses stored horizontal_area = 600', ann[1].horizontal_area === 600);
assert('plane 2 slope_factor = 1.202', ann[1].slope_factor === 1.202);
assert('plane 2 actual_surface_area ≈ 721.2', approxEqual(ann[1].actual_surface_area, 721.2));

// ── Field shingles ────────────────────────────────────────────────────────────
console.log('\ncalcFieldShingles');
{
  // total actual SQ = (894.4 + 721.2) / 100 = 16.156 SQ
  // with 15% waste = 18.579 → ceil = 19
  const mat = { id: 'g1', manufacturer: 'GAF', name: 'Timberline HDZ', unit: 'SQ', unit_price: '124.02' };
  const li = calcFieldShingles(ann, mat);
  assert('quantity = 19 SQ', li.quantity === 19, `got ${li.quantity}`);
  assert('unit = SQ', li.unit === 'SQ');
  assert('total_price = 19 × 124.02 = 2356.38', approxEqual(li.total_price, 2356.38), `got ${li.total_price}`);
}

// ── Underlayment ──────────────────────────────────────────────────────────────
console.log('\ncalcUnderlayment');
{
  // Both planes pitch >= 3, so no doubling
  // total actual SQ = 16.156 SQ
  // rolls = ceil(16.156 / 10) = 2
  const mat = { id: 'u1', manufacturer: 'ABC', name: 'Pro Guard 10SQ', unit: 'RL', unit_price: '99.90', coverage_sq: '10' };
  const li = calcUnderlayment(ann, mat);
  assert('rolls = 2', li.quantity === 2, `got ${li.quantity}`);
  assert('total_price = 199.80', approxEqual(li.total_price, 199.80), `got ${li.total_price}`);

  // Test pitch < 3 doubling
  const lowPlanes = annotatePlanes([
    { id: 'x', horizontal_area: '400', pitch_numerator: '2' }, // 2/12 → double
    { id: 'y', horizontal_area: '600', pitch_numerator: '6' }, // 6/12 → normal
  ]);
  // lowPlanes[0] actual SQ = (400 * 1.014)/100 = 4.056 SQ × 2 = 8.112
  // lowPlanes[1] actual SQ = (600 * 1.118)/100 = 6.708 SQ
  // total = 14.82 → ceil(14.82/10) = 2
  const li2 = calcUnderlayment(lowPlanes, mat);
  assert('low-pitch plane doubles underlayment: rolls = 2', li2.quantity === 2, `got ${li2.quantity}`);
  assert('low-pitch metadata.underlayment_sq ≈ 14.82', approxEqual(li2.metadata.underlayment_sq, 14.82, 0.05), `got ${li2.metadata.underlayment_sq}`);
}

// ── IWS ───────────────────────────────────────────────────────────────────────
console.log('\ncalcIWS');
{
  const mat = { id: 'iws1', manufacturer: 'GAF', name: 'StormGuard', unit: 'RL', unit_price: '136.50', lf_per_unit: '66' };
  // valley 130 LF → ceil(130/65) = 2
  const li = calcIWS(130, mat);
  assert('valley 130 LF → 2 rolls', li.quantity === 2, `got ${li.quantity}`);
  assert('effective LF = 65', li.metadata.effective_lf_per_roll === 65);
  assert('total_price = 273.00', approxEqual(li.total_price, 273.00), `got ${li.total_price}`);

  // valley = 0 → 0 rolls
  const li2 = calcIWS(0, mat);
  assert('valley 0 LF → 0 rolls', li2.quantity === 0);
  assert('total_price = 0 when no valleys', li2.total_price === 0);

  // valley 65 LF → exactly 1 roll
  assert('valley 65 LF → 1 roll', calcIWS(65, mat).quantity === 1);
  // valley 66 LF → 2 rolls (65 effective, so 66/65 rounds up to 2)
  assert('valley 66 LF → 2 rolls', calcIWS(66, mat).quantity === 2);
}

// ── Starter ───────────────────────────────────────────────────────────────────
console.log('\ncalcStarter');
{
  const mat = { id: 's1', manufacturer: 'GAF', name: 'Pro-Start 120LF', unit: 'BD', unit_price: '64.50', lf_per_unit: '120' };
  // eave 120 + rake 80 = 200 LF → ceil(200/120) = 2 bundles
  const li = calcStarter(120, 80, mat);
  assert('200 LF / 120 → 2 bundles', li.quantity === 2, `got ${li.quantity}`);
  assert('total_price = 129.00', approxEqual(li.total_price, 129.00), `got ${li.total_price}`);

  // exact 120 LF → 1 bundle
  assert('120 LF / 120 → 1 bundle', calcStarter(120, 0, mat).quantity === 1);
  // 121 LF → 2 bundles
  assert('121 LF / 120 → 2 bundles', calcStarter(121, 0, mat).quantity === 2);
}

// ── Drip Edge ─────────────────────────────────────────────────────────────────
console.log('\ncalcDripEdge');
{
  const mat = { id: 'd1', name: 'Drip Edge 1.5x1.5 Painted', unit: 'PC', unit_price: '7.675', lf_per_unit: '10' };
  // eave 120 + rake 80 = 200 LF → ceil(200/10) = 20 + 3 = 23 sticks
  const li = calcDripEdge(120, 80, mat);
  assert('200 LF → 23 pieces (20 + 3 extra)', li.quantity === 23, `got ${li.quantity}`);
  assert('always adds 3 extra', li.metadata.extra_sticks === 3);
  assert('total_price = 23 × 7.675 = 176.525', approxEqual(li.total_price, 176.53, 0.01), `got ${li.total_price}`);
}

// ── Hip & Ridge ───────────────────────────────────────────────────────────────
console.log('\ncalcHipRidge');
{
  const mat = { id: 'hr1', manufacturer: 'GAF', name: 'Z-Ridge 33LF', unit: 'BD', unit_price: '87.75', lf_per_unit: '33' };
  // hip 60 + ridge 40 = 100 LF → ceil(100/33) = 4 bundles
  const li = calcHipRidge(60, 40, mat);
  assert('100 LF / 33 → 4 bundles', li.quantity === 4, `got ${li.quantity}`);
  assert('total_price = 4 × 87.75 = 351.00', approxEqual(li.total_price, 351.00), `got ${li.total_price}`);

  // 99 LF → 3 bundles
  assert('99 LF / 33 → 3 bundles', calcHipRidge(50, 49, mat).quantity === 3);
}

// ── Labor ─────────────────────────────────────────────────────────────────────
console.log('\ncalcLabor');
{
  // plane A: 6/12, 10 SQ actual → $50/SQ = $500
  // plane B: 10/12, 5 SQ actual → $50 + (10-7)*5 = $65/SQ = $325
  const testPlanes = annotatePlanes([
    { id: 'a', horizontal_area: '1000', pitch_numerator: '6' }, // 1000 × 1.118 = 1118 sq ft = 11.18 SQ
    { id: 'b', horizontal_area: '500',  pitch_numerator: '10' }, // 500 × 1.302 = 651 sq ft = 6.51 SQ
  ]);
  const li = calcLabor(testPlanes);
  // 6/12: 11.18 SQ × $50 = $559
  // 10/12: 6.51 SQ × $65 = $423.15
  // total ≈ $982.15
  assert('labor total ≈ $982.15', approxEqual(li.total_price, 982.15, 0.10), `got ${li.total_price}`);
  assert('two pitch tiers in breakdown', li.metadata.pitch_tiers.length === 2);
  assert('6/12 rate = $50', li.metadata.pitch_tiers.find(t => t.pitch === 6)?.rate === 50);
  assert('10/12 rate = $65', li.metadata.pitch_tiers.find(t => t.pitch === 10)?.rate === 65);

  // Edge: 12/12 should be $75/SQ
  const steep = annotatePlanes([{ id: 'c', horizontal_area: '100', pitch_numerator: '12' }]);
  assert('12/12 rate = $75', calcLabor(steep).metadata.pitch_tiers[0].rate === 75);

  // Edge: 8/12 = $55/SQ
  const eight = annotatePlanes([{ id: 'd', horizontal_area: '100', pitch_numerator: '8' }]);
  assert('8/12 rate = $55', calcLabor(eight).metadata.pitch_tiers[0].rate === 55);
}

// ── Tear-off ──────────────────────────────────────────────────────────────────
console.log('\ncalcTearoff');
{
  assert('1 layer: $75/SQ × 20 SQ = $1500', calcTearoff(20, 1).total_price === 1500);
  assert('2 layers: $85/SQ × 20 SQ = $1700', calcTearoff(20, 2).total_price === 1700);
  assert('3 layers: $95/SQ × 20 SQ = $1900', calcTearoff(20, 3).total_price === 1900);
}

// ── calcFinancials ────────────────────────────────────────────────────────────
console.log('\ncalcFinancials');
{
  const items = [
    { line_type: 'field_shingles',   total_price: 2000 },
    { line_type: 'underlayment',     total_price: 200 },
    { line_type: 'ice_water_shield', total_price: 273 },
    { line_type: 'starter',         total_price: 129 },
    { line_type: 'drip_edge',       total_price: 177 },
    { line_type: 'hip_ridge',       total_price: 351 },
    { line_type: 'labor',           total_price: 1000 },
  ];

  const f = calcFinancials(items, 15, 35, 8.25);
  // materials = 2000+200+273+129+177+351 = 3130
  // labor = 1000
  // direct = 4130
  // tax = 3130 * 0.0825 = 258.225
  // overhead = 4130 * 0.15 = 619.5
  // profit = 4130 * 0.35 = 1445.5
  // grand = 4130 + 258.225 + 619.5 + 1445.5 = 6453.225

  assert('materials_subtotal = 3130',  f.materials_subtotal === 3130);
  assert('labor_total = 1000',         f.labor_total === 1000);
  assert('direct_costs = 4130',        f.direct_costs === 4130);
  assert('sales_tax ≈ 258.23',         approxEqual(f.sales_tax, 258.23), `got ${f.sales_tax}`);
  assert('overhead = 619.50',          approxEqual(f.overhead, 619.50),  `got ${f.overhead}`);
  assert('profit = 1445.50',           approxEqual(f.profit, 1445.50),   `got ${f.profit}`);
  assert('grand_total ≈ 6453.23',      approxEqual(f.grand_total, 6453.23, 0.02), `got ${f.grand_total}`);
}

// ── runCalculation (integration) ──────────────────────────────────────────────
console.log('\nrunCalculation (integration)');
{
  const testPlanes = [
    { id: 'p1', horizontal_length: '40', horizontal_width: '20', pitch_numerator: '6' }, // 800 SqFt horiz
    { id: 'p2', horizontal_length: '40', horizontal_width: '10', pitch_numerator: '8' }, // 400 SqFt horiz
  ];
  const linearFootage = { eave_lf: 120, rake_lf: 80, hip_lf: 40, ridge_lf: 40, valley_lf: 65 };

  const materials = {
    field_shingles:  { id: 'g1', manufacturer: 'GAF', name: 'Timberline HDZ',    unit: 'SQ', unit_price: '124.02' },
    underlayment:    { id: 'u1', manufacturer: 'ABC', name: 'Pro Guard 10SQ',     unit: 'RL', unit_price: '99.90',  coverage_sq: '10' },
    ice_water_shield:{ id: 'i1', manufacturer: 'GAF', name: 'StormGuard',         unit: 'RL', unit_price: '136.50', lf_per_unit: '66' },
    starter:         { id: 's1', manufacturer: 'GAF', name: 'Pro-Start 120LF',    unit: 'BD', unit_price: '64.50',  lf_per_unit: '120' },
    drip_edge:       { id: 'd1', manufacturer: null,  name: 'DE 1.5x1.5 Painted', unit: 'PC', unit_price: '7.675',  lf_per_unit: '10' },
    hip_ridge:       { id: 'h1', manufacturer: 'GAF', name: 'Z-Ridge 33LF',       unit: 'BD', unit_price: '87.75',  lf_per_unit: '33' },
  };

  const { lineItems, financials } = runCalculation({
    planes: testPlanes,
    linearFootage,
    materials,
    estimateSettings: { overhead_percent: 15, profit_percent: 35, is_reroof: false, tearoff_layers: 1 },
  });

  assert('produces 7 line items (no tearoff)', lineItems.length === 7, `got ${lineItems.length}`);
  assert('has field_shingles line',   lineItems.some(li => li.line_type === 'field_shingles'));
  assert('has labor line',            lineItems.some(li => li.line_type === 'labor'));
  assert('no tearoff (new construction)', !lineItems.some(li => li.line_type === 'tearoff'));

  // With re-roof
  const { lineItems: reRoofItems } = runCalculation({
    planes: testPlanes,
    linearFootage,
    materials,
    estimateSettings: { overhead_percent: 15, profit_percent: 35, is_reroof: true, tearoff_layers: 2 },
  });
  assert('re-roof has 8 line items (with tearoff)', reRoofItems.length === 8, `got ${reRoofItems.length}`);
  assert('tearoff shows 2 layers', reRoofItems.find(li => li.line_type === 'tearoff')?.description.includes('2 layer'));

  assert('grand_total > 0', financials.grand_total > 0);
  assert('grand_total > direct_costs', financials.grand_total > financials.direct_costs);
  assert('tax only on materials', approxEqual(financials.sales_tax, financials.materials_subtotal * 0.0825, 0.02));
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
