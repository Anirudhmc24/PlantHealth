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

// ── Shared processing logic ───────────────────────────────────────────────────
async function processImage(imagePath, filename) {
  const diagnosis = await detectDisease(imagePath);
  const treatmentAdvice = await getTreatmentAdvice(diagnosis);
  const scanId = uuidv4();
  const scan = {
    id: scanId,
    image_path: filename,
    ...diagnosis,
    treatment_advice: treatmentAdvice,
  };
  await saveScan(scan);
  return { scanId, diagnosis, treatmentAdvice, filename };
}

// ── POST /api/detect — multipart (mobile) ─────────────────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded.' });
  }
  const imagePath = req.file.path;
  try {
    const { scanId, diagnosis, treatmentAdvice, filename } = await processImage(imagePath, req.file.filename);
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
      image_url: `/uploads/${filename}`,
    });
  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlink(imagePath, () => {});
    console.error('Detection error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/detect-base64 — base64 (web) ───────────────────────────────────
router.post('/base64', async (req, res) => {
  const { image, filename } = req.body;
  if (!image) {
    return res.status(400).json({ success: false, error: 'No image data provided.' });
  }

  const ext = path.extname(filename || 'leaf.jpg').toLowerCase() || '.jpg';
  const savedFilename = `${uuidv4()}${ext}`;
  const imagePath = `./uploads/${savedFilename}`;

  try {
    // Decode base64 and save to disk
    const buffer = Buffer.from(image, 'base64');
    fs.writeFileSync(imagePath, buffer);

    const { scanId, diagnosis, treatmentAdvice } = await processImage(imagePath, savedFilename);

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
      image_url: `/uploads/${savedFilename}`,
    });
  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlink(imagePath, () => {});
    console.error('Base64 detection error:', err.message);
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
