const Anthropic = require('@anthropic-ai/sdk');
const { getSlopeFactor } = require('./calculationEngine');

// The spec asks for claude-sonnet-4-20250514; that model shipped as claude-sonnet-4-6 in the API.
const VISION_MODEL = process.env.VISION_MODEL || 'claude-sonnet-4-6';

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are an expert at reading architectural construction plans for roofing estimates. Analyze this plan carefully and return structured JSON.

STEP 1 — FIND THE SCALE KEY
Look for text like "1/4\" = 1'-0\"", "Scale: 1:48", "Scale 1/8 inch = 1 foot", or a graphical scale bar.
Extract exactly what the scale says as a string.

STEP 2 — DETERMINE PLAN TYPE
"roof_plan": Shows the actual roof geometry from above. You can see ridge lines, hip lines, valley lines, and roof slope indicators (like "6/12" arrow symbols or slope triangles). Dimensions label the roof surfaces directly.
"floor_plan": Shows the building floor layout from above. You see rooms, walls, doors, windows, and the building's overall perimeter/footprint dimensions. No actual roof geometry is shown.

STEP 3A — IF ROOF PLAN: Extract all geometry
For each distinct roof plane (sloped surface), record:
- A label (A, B, C, etc.)
- Horizontal (plan-view) dimensions in real-world FEET, converted using the scale
- Pitch if labeled on the plan (e.g. "6/12" → pitch_numerator = 6). If not labeled, omit.

Extract total linear footage in real-world FEET for each of these separately:
- Eaves: horizontal edges at the bottom of roof slopes (overhangs)
- Rakes: sloped edges at gable ends (where roof meets a vertical wall gable)
- Hips: diagonal lines where two adjacent sloped surfaces meet going upward-outward from a valley (no, going outward from ridge). A hip is where two slopes meet at an outside corner, going DOWN and OUT to a corner.
- Ridges: the horizontal peak lines at the very top
- Valleys: diagonal lines where two slopes meet at an INSIDE corner going DOWN and IN

STEP 3B — IF FLOOR PLAN: Extract footprint
Record the overall building footprint dimensions in real-world FEET using the scale.
If the building is irregular, describe the main rectangular portion.

RETURN ONLY valid JSON — no explanation, no markdown fences, just the raw JSON object.

For a roof plan return:
{
  "plan_type": "roof_plan",
  "scale_ratio": "exact scale text from the plan",
  "planes": [
    {
      "plane_label": "A",
      "horizontal_length": 40.0,
      "horizontal_width": 22.5,
      "pitch_numerator": 6,
      "plane_notes": "main field - south facing"
    }
  ],
  "linear_footage": {
    "eave_lf": 80.0,
    "rake_lf": 45.0,
    "hip_lf": 0.0,
    "ridge_lf": 40.0,
    "valley_lf": 0.0
  },
  "extraction_notes": "describe any uncertainty, missing dimensions, or assumptions made"
}

For a floor plan return:
{
  "plan_type": "floor_plan",
  "scale_ratio": "exact scale text from the plan",
  "footprint": {
    "length": 60.0,
    "width": 40.0,
    "shape": "rectangular",
    "shape_notes": "L-shaped; dimensions are for the main 60x40 rectangle"
  },
  "extraction_notes": "describe any uncertainty or assumptions"
}

Critical rules:
- ALL dimensions must be converted to real-world FEET using the scale before returning
- If you cannot locate a scale key, set scale_ratio to "unknown" and use best judgment based on typical residential construction (note this in extraction_notes)
- Do not return any text outside the JSON object`;

// ── API call ──────────────────────────────────────────────────────────────────

function buildContentBlock(fileBuffer, mimeType) {
  const base64 = fileBuffer.toString('base64');
  if (mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  // Supported image types: image/jpeg, image/png, image/gif, image/webp
  return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
}

function extractJSON(text) {
  // Strip any accidental markdown fences or leading prose
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude did not return a JSON object in its response');
  return JSON.parse(match[0]);
}

async function analyzePlan(fileBuffer, mimeType) {
  const client = getClient();

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        buildContentBlock(fileBuffer, mimeType),
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
  });

  const raw = response.content[0]?.text ?? '';
  const parsed = extractJSON(raw);

  // Normalise and validate
  if (!['roof_plan', 'floor_plan'].includes(parsed.plan_type)) {
    throw new Error(`Unexpected plan_type from Claude: ${parsed.plan_type}`);
  }

  if (parsed.plan_type === 'roof_plan') {
    return normaliseRoofPlan(parsed);
  }
  return normaliseFloorPlan(parsed);
}

function normaliseRoofPlan(raw) {
  const planes = (raw.planes || []).map((p, i) => ({
    plane_label:      p.plane_label || `Plane ${i + 1}`,
    horizontal_length: parseFloat(p.horizontal_length) || 0,
    horizontal_width:  parseFloat(p.horizontal_width)  || 0,
    horizontal_area:   p.horizontal_area != null
                         ? parseFloat(p.horizontal_area)
                         : (parseFloat(p.horizontal_length) || 0) * (parseFloat(p.horizontal_width) || 0),
    pitch_numerator:   p.pitch_numerator != null ? parseInt(p.pitch_numerator, 10) : 6,
    plane_notes:       p.plane_notes || '',
  }));

  const lf = raw.linear_footage || {};
  return {
    plan_type:         'roof_plan',
    scale_ratio:       raw.scale_ratio || 'unknown',
    planes,
    linear_footage: {
      eave_lf:   parseFloat(lf.eave_lf)   || 0,
      rake_lf:   parseFloat(lf.rake_lf)   || 0,
      hip_lf:    parseFloat(lf.hip_lf)    || 0,
      ridge_lf:  parseFloat(lf.ridge_lf)  || 0,
      valley_lf: parseFloat(lf.valley_lf) || 0,
    },
    extraction_notes: raw.extraction_notes || '',
  };
}

function normaliseFloorPlan(raw) {
  const fp = raw.footprint || {};
  return {
    plan_type:   'floor_plan',
    scale_ratio: raw.scale_ratio || 'unknown',
    footprint: {
      length:      parseFloat(fp.length) || 0,
      width:       parseFloat(fp.width)  || 0,
      shape:       fp.shape || 'rectangular',
      shape_notes: fp.shape_notes || '',
    },
    extraction_notes: raw.extraction_notes || '',
  };
}

// ── Roof plane derivation from floor plan ────────────────────────────────────

/**
 * Derive roof planes and linear footage from a rectangular footprint.
 * All results are in real-world feet.
 */
function deriveRoofFromFootprint(footprint, roofStyle, pitchNumerator) {
  const L = Math.max(footprint.length, footprint.width);  // long side
  const W = Math.min(footprint.length, footprint.width);  // short side
  const pitch = parseInt(pitchNumerator, 10) || 6;
  const sf = getSlopeFactor(pitch);

  switch (roofStyle) {
    case 'gable':       return deriveGable(L, W, pitch, sf);
    case 'hip':         return deriveHip(L, W, pitch, sf);
    case 'combination': return deriveGable(L, W, pitch, sf, true); // approximate
    default:            return deriveGable(L, W, pitch, sf);
  }
}

function deriveGable(L, W, pitch, sf, isCombo = false) {
  const half = W / 2;
  // Each rake edge: horizontal projection = half-span, actual length = half × sf
  const rakeLf = 4 * half * sf;   // 4 rake edges (2 per gable end)

  return {
    planes: [
      { plane_label: 'A – Front Slope', horizontal_length: L, horizontal_width: half, pitch_numerator: pitch },
      { plane_label: 'B – Back Slope',  horizontal_length: L, horizontal_width: half, pitch_numerator: pitch },
    ],
    linear_footage: {
      eave_lf:   round1(2 * L),
      rake_lf:   round1(rakeLf),
      hip_lf:    0,
      ridge_lf:  round1(L),
      valley_lf: 0,
    },
    notes: isCombo
      ? 'Combination roof approximated as gable — field verification required'
      : null,
  };
}

function deriveHip(L, W, pitch, sf) {
  // Two trapezoidal side planes + two triangular end planes
  // Side plane horizontal area: ((L-W) + L) / 2 × W/2 = (2L-W)×W/4
  // End plane (triangle) horizontal area: W × (W/2) / 2 = W²/4
  const sideArea = (2 * L - W) * W / 4;
  const endArea  = (W * W) / 4;

  // Hip rafter horizontal projection (plan diagonal from corner to ridge end):
  //   Δx = W/2, Δy = W/2  →  horizontal = (W/2) × sqrt(2)
  // Hip rafter actual length including rise:
  //   rise per unit horizontal = pitch/12, but the hip direction is at 45° to the slope direction
  //   actual hip = sqrt((W/2)^2 + (W/2)^2 + ((W/2)×pitch/12)^2)
  //              = (W/2) × sqrt(2 + (pitch/12)^2)
  const hipActual = (W / 2) * Math.sqrt(2 + Math.pow(pitch / 12, 2));

  return {
    planes: [
      { plane_label: 'A – Right Side',  horizontal_area: round2(sideArea), pitch_numerator: pitch },
      { plane_label: 'B – Left Side',   horizontal_area: round2(sideArea), pitch_numerator: pitch },
      { plane_label: 'C – Front End',   horizontal_area: round2(endArea),  pitch_numerator: pitch },
      { plane_label: 'D – Back End',    horizontal_area: round2(endArea),  pitch_numerator: pitch },
    ],
    linear_footage: {
      eave_lf:   round1(2 * L + 2 * W),        // full perimeter
      rake_lf:   0,                              // hip roofs have no rakes
      hip_lf:    round1(4 * hipActual),          // 4 hip rafters
      ridge_lf:  round1(Math.max(0, L - W)),     // center ridge
      valley_lf: 0,
    },
    notes: null,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { analyzePlan, deriveRoofFromFootprint };
