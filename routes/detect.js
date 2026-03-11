const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const { detectDisease } = require('../services/huggingface');
const { getTreatmentAdvice } = require('../services/claude');
const { saveScan, getScanById } = require('../services/database');

const router = express.Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
  },
});

// ── POST /api/detect ──────────────────────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded.' });
  }

  const imagePath = req.file.path;

  try {
    // 1️⃣ HuggingFace disease detection (send image directly, no resize)
    const diagnosis = await detectDisease(imagePath);

    // 2️⃣ Claude treatment recommendations
    const treatmentAdvice = await getTreatmentAdvice(diagnosis);

    // 3️⃣ Save to DB
    const scanId = uuidv4();
    const scan = {
      id: scanId,
      image_path: req.file.filename,
      ...diagnosis,
      treatment_advice: treatmentAdvice,
    };
    await saveScan(scan);

    return res.json({
      success: true,
      scan_id: scanId,
      diagnosis: {
        crop_type: diagnosis.crop_type,
        disease_name: diagnosis.disease_name,
        confidence: diagnosis.confidence,
        severity_level: diagnosis.severity_level,
        affected_area_percent: diagnosis.affected_area_percent,
        low_confidence: diagnosis.low_confidence,
        top_predictions: diagnosis.raw_predictions,
      },
      treatment_advice: treatmentAdvice,
      image_url: `/uploads/${req.file.filename}`,
    });

  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlink(imagePath, () => {});
    console.error('Detection error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/detect/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const scan = await getScanById(req.params.id);
    if (!scan) return res.status(404).json({ success: false, error: 'Scan not found.' });
    return res.json({
      success: true,
      scan: {
        ...scan,
        raw_predictions: JSON.parse(scan.raw_predictions || '[]'),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
