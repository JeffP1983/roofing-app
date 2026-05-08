/**
 * Tests for roof geometry derivation (no API calls needed).
 * Run with: node src/tests/visionService.test.js
 */

const { deriveRoofFromFootprint } = require('../services/visionService');

let passed = 0, failed = 0;

function assert(label, cond, detail = '') {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}
function near(a, b, tol = 0.5) { return Math.abs(a - b) <= tol; }

// ── Gable roof (6/12 pitch) on 60 × 40 ft ────────────────────────────────────
console.log('\nGable 60×40, pitch 6/12');
{
  const r = deriveRoofFromFootprint({ length: 60, width: 40 }, 'gable', 6);

  assert('2 planes', r.planes.length === 2, `got ${r.planes.length}`);

  // Both planes: horizontal_length = 60, horizontal_width = 20
  assert('plane A length = 60', parseFloat(r.planes[0].horizontal_length) === 60);
  assert('plane A width = 20',  parseFloat(r.planes[0].horizontal_width)  === 20);
  assert('plane B same dims',
    parseFloat(r.planes[1].horizontal_length) === 60 &&
    parseFloat(r.planes[1].horizontal_width)  === 20
  );

  // Linear footage
  // eave = 2×60 = 120
  assert('eave_lf = 120', r.linear_footage.eave_lf === 120, `got ${r.linear_footage.eave_lf}`);
  // ridge = 60
  assert('ridge_lf = 60', r.linear_footage.ridge_lf === 60, `got ${r.linear_footage.ridge_lf}`);
  // hip = 0
  assert('hip_lf = 0', r.linear_footage.hip_lf === 0);
  // rake = 4 × (W/2) × sf = 4 × 20 × 1.118 = 89.44
  assert('rake_lf ≈ 89.4', near(r.linear_footage.rake_lf, 89.4, 0.5), `got ${r.linear_footage.rake_lf}`);

  // Total horizontal area should equal footprint = 2400
  const totalHoriz = r.planes.reduce((s, p) => s + parseFloat(p.horizontal_length) * parseFloat(p.horizontal_width), 0);
  assert('total horizontal area = 2400', near(totalHoriz, 2400, 1), `got ${totalHoriz}`);
}

// ── Gable roof (4/12 pitch) on 40 × 30 ft ────────────────────────────────────
console.log('\nGable 40×30, pitch 4/12');
{
  const r = deriveRoofFromFootprint({ length: 40, width: 30 }, 'gable', 4);
  // slope factor 4/12 = 1.054
  // rake = 4 × 15 × 1.054 = 63.24
  assert('rake_lf ≈ 63.2', near(r.linear_footage.rake_lf, 63.2, 0.5), `got ${r.linear_footage.rake_lf}`);
  assert('eave_lf = 80', r.linear_footage.eave_lf === 80);
  assert('ridge_lf = 40', r.linear_footage.ridge_lf === 40);
}

// ── Hip roof (6/12) on 60 × 40 ft ────────────────────────────────────────────
console.log('\nHip 60×40, pitch 6/12');
{
  const r = deriveRoofFromFootprint({ length: 60, width: 40 }, 'hip', 6);

  assert('4 planes', r.planes.length === 4, `got ${r.planes.length}`);

  // Two side planes each: (2×60−40)×40/4 = 80×40/4 = 800 sq ft horizontal area
  const sideArea = (2 * 60 - 40) * 40 / 4;
  assert('side plane area = 800', near(parseFloat(r.planes[0].horizontal_area), sideArea, 1), `got ${r.planes[0].horizontal_area}`);

  // Two end (triangle) planes each: 40² / 4 = 400 sq ft
  const endArea = 40 * 40 / 4;
  assert('end plane area = 400', near(parseFloat(r.planes[2].horizontal_area), endArea, 1), `got ${r.planes[2].horizontal_area}`);

  // Total horizontal area should equal footprint = 2400
  const totalHoriz = r.planes.reduce((s, p) => s + parseFloat(p.horizontal_area), 0);
  assert('total horizontal area = 2400', near(totalHoriz, 2400, 2), `got ${totalHoriz}`);

  // Linear footage
  assert('eave_lf = 200 (perimeter)', r.linear_footage.eave_lf === 200, `got ${r.linear_footage.eave_lf}`);
  assert('ridge_lf = 20 (L−W)', r.linear_footage.ridge_lf === 20, `got ${r.linear_footage.ridge_lf}`);
  assert('rake_lf = 0', r.linear_footage.rake_lf === 0);

  // hip_lf = 4 × (W/2) × sqrt(2 + (pitch/12)^2)
  // = 4 × 20 × sqrt(2 + 0.25) = 80 × sqrt(2.25) = 80 × 1.5 = 120
  const expectedHip = 4 * (40 / 2) * Math.sqrt(2 + Math.pow(6 / 12, 2));
  assert('hip_lf ≈ 120', near(r.linear_footage.hip_lf, expectedHip, 0.5), `got ${r.linear_footage.hip_lf}`);
}

// ── Hip where L === W (square footprint) ─────────────────────────────────────
console.log('\nHip 40×40 (square), pitch 6/12');
{
  const r = deriveRoofFromFootprint({ length: 40, width: 40 }, 'hip', 6);
  assert('4 planes', r.planes.length === 4);
  // ridge = L - W = 0
  assert('ridge_lf = 0 for square', r.linear_footage.ridge_lf === 0, `got ${r.linear_footage.ridge_lf}`);
  // Total area = 40×40 = 1600
  const total = r.planes.reduce((s, p) => s + parseFloat(p.horizontal_area), 0);
  assert('total area = 1600', near(total, 1600, 2), `got ${total}`);
}

// ── Combination falls back to gable ──────────────────────────────────────────
console.log('\nCombination (gable approximation)');
{
  const r = deriveRoofFromFootprint({ length: 50, width: 30 }, 'combination', 6);
  assert('2 planes (gable approx)', r.planes.length === 2);
  assert('includes combination note', typeof r.notes === 'string' && r.notes.length > 0, `notes: ${r.notes}`);
}

// ── Width/length are auto-sorted so short side is always W ───────────────────
console.log('\nOrientation normalisation');
{
  const r1 = deriveRoofFromFootprint({ length: 60, width: 40 }, 'gable', 6);
  const r2 = deriveRoofFromFootprint({ length: 40, width: 60 }, 'gable', 6); // swapped
  assert('swapped dims give same ridge_lf', r1.linear_footage.ridge_lf === r2.linear_footage.ridge_lf);
  assert('swapped dims give same eave_lf',  r1.linear_footage.eave_lf  === r2.linear_footage.eave_lf);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
