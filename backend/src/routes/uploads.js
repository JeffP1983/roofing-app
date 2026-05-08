const express = require('express');
const multer  = require('multer');
const { authenticate } = require('../middleware/auth');
const { analyzePlan, deriveRoofFromFootprint } = require('../services/visionService');

const router = express.Router();

// Store files in memory — we only need them long enough to send to Claude
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP, GIF, and PDF files are accepted'));
  },
});

/**
 * POST /api/uploads/analyze
 * Multipart field: "plan" (file)
 *
 * Sends the uploaded plan to Claude for analysis.
 * Returns extracted plan data — nothing is saved to the database here.
 * The client reviews the data, then POSTs to /api/projects/:id/estimates.
 */
router.post('/analyze', authenticate, upload.single('plan'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a file in the "plan" field.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI vision is not configured. Set ANTHROPIC_API_KEY in the server environment.' });
  }

  try {
    const result = await analyzePlan(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error('Vision analysis error:', err);
    if (err.message?.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: err.message });
    }
    if (err.status === 400 || err.message?.includes('JSON')) {
      return res.status(422).json({ error: 'Could not extract plan data from the uploaded file. Try a clearer image.', detail: err.message });
    }
    res.status(500).json({ error: 'Vision analysis failed', detail: err.message });
  }
});

/**
 * POST /api/uploads/derive-planes
 * JSON body: { footprint: { length, width }, roof_style: "gable"|"hip"|"combination", pitch_numerator: 6 }
 *
 * Pure geometry — derives roof planes from a floor plan footprint.
 * No AI call; no database write.
 */
router.post('/derive-planes', authenticate, (req, res) => {
  const { footprint, roof_style, pitch_numerator } = req.body;

  if (!footprint?.length || !footprint?.width) {
    return res.status(400).json({ error: 'footprint.length and footprint.width are required' });
  }
  if (!['gable', 'hip', 'combination'].includes(roof_style)) {
    return res.status(400).json({ error: 'roof_style must be gable, hip, or combination' });
  }
  if (!pitch_numerator) {
    return res.status(400).json({ error: 'pitch_numerator is required (e.g. 6 for 6/12)' });
  }

  const result = deriveRoofFromFootprint(footprint, roof_style, pitch_numerator);
  res.json(result);
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
