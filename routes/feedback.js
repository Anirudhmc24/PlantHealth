const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { saveFeedback, getFeedbackStats, getScanById } = require('../services/database');
const { getImprovedAdvice } = require('../services/claude');

const router = express.Router();

// ── POST /api/feedback ────────────────────────────────────────────────────────
// Body: { scan_id, was_correct, correct_disease?, treatment_helpful, comments? }
router.post('/', async (req, res) => {
  const { scan_id, was_correct, correct_disease, treatment_helpful, comments } = req.body;

  if (!scan_id) {
    return res.status(400).json({ success: false, error: 'scan_id is required.' });
  }
  if (was_correct === undefined) {
    return res.status(400).json({ success: false, error: 'was_correct (boolean) is required.' });
  }

  try {
    const scan = await getScanById(scan_id);
    if (!scan) return res.status(404).json({ success: false, error: 'Scan not found.' });

    const feedback = {
      id: uuidv4(),
      scan_id,
      was_correct: !!was_correct,
      correct_disease: correct_disease || null,
      treatment_helpful: treatment_helpful !== undefined ? !!treatment_helpful : null,
      comments: comments || null,
    };

    await saveFeedback(feedback);

    // If diagnosis was wrong, get improved advice from Claude
    let improvedAdvice = null;
    if (!was_correct && (correct_disease || comments)) {
      improvedAdvice = await getImprovedAdvice(scan, { correct_disease, comments });
    }

    return res.json({
      success: true,
      feedback_id: feedback.id,
      message: 'Thank you for your feedback! It helps improve our system.',
      improved_advice: improvedAdvice,
    });

  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/feedback/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getFeedbackStats();
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
