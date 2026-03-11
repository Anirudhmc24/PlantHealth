const express = require('express');
const { getAllScans, getScanById } = require('../services/database');

const router = express.Router();

// ── GET /api/history ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const scans = await getAllScans(limit);
    return res.json({
      success: true,
      count: scans.length,
      scans: scans.map(s => ({
        ...s,
        raw_predictions: JSON.parse(s.raw_predictions || '[]'),
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/history/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const scan = await getScanById(req.params.id);
    if (!scan) return res.status(404).json({ success: false, error: 'Scan not found.' });
    return res.json({
      success: true,
      scan: { ...scan, raw_predictions: JSON.parse(scan.raw_predictions || '[]') },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
