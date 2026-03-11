const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { chat } = require('../services/claude');
const { getScanById, saveChatSession, getChatSession } = require('../services/database');

const router = express.Router();

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { message, session_id?, scan_id? }
router.post('/', async (req, res) => {
  const { message, session_id, scan_id } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message is required.' });
  }

  try {
    // Load or create session
    let session = session_id ? await getChatSession(session_id) : null;
    if (!session) {
      session = {
        id: uuidv4(),
        scan_id: scan_id || null,
        messages: [],
      };
    }

    // Load scan context if available
    let scanContext = null;
    if (session.scan_id) {
      const scan = await getScanById(session.scan_id);
      if (scan) {
        scanContext = {
          crop_type: scan.crop_type,
          disease_name: scan.disease_name,
          severity_level: scan.severity_level,
          confidence: scan.confidence,
          affected_area_percent: scan.affected_area_percent,
        };
      }
    }

    // Append user message
    session.messages.push({ role: 'user', content: message.trim() });

    // Get Claude response
    const assistantReply = await chat(session.messages, scanContext);

    // Append assistant message
    session.messages.push({ role: 'assistant', content: assistantReply });

    // Keep last 20 messages to control context size
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    // Persist session
    await saveChatSession(session);

    return res.json({
      success: true,
      session_id: session.id,
      reply: assistantReply,
      message_count: session.messages.length,
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/chat/:session_id ─────────────────────────────────────────────────
router.get('/:session_id', async (req, res) => {
  try {
    const session = await getChatSession(req.params.session_id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found.' });
    return res.json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
