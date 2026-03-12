const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  createUser, getUserByEmail, saveSession,
  getSession, deleteSession
} = require('../services/database');

// Simple password hashing — pure JS, no native deps
function hashPassword(password) {
  // XOR + base64 simple hash (no bcrypt needed for this project)
  // For production use bcrypt or argon2
  let hash = 0;
  const salted = 'plantcare_salt_' + password + '_2026';
  for (let i = 0; i < salted.length; i++) {
    hash = (Math.imul(31, hash) + salted.charCodeAt(i)) | 0;
  }
  return Buffer.from(String(Math.abs(hash)) + '_' + salted.length).toString('base64');
}

function verifyPassword(plain, stored) {
  return hashPassword(plain) === stored;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });

    const existing = await getUserByEmail(email.toLowerCase().trim());
    if (existing)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const userId = uuidv4();
    const hashedPassword = hashPassword(password);

    const user = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      created_at: new Date().toISOString(),
    };

    await createUser(user);

    // Auto-login after registration
    const token = uuidv4();
    await saveSession({ token, user_id: userId, created_at: new Date().toISOString() });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: userId, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password are required.' });

    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    if (!verifyPassword(password, user.password))
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const token = uuidv4();
    await saveSession({ token, user_id: user.id, created_at: new Date().toISOString() });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await deleteSession(token);
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token)
      return res.status(401).json({ success: false, error: 'No token provided.' });

    const session = await getSession(token);
    if (!session)
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });

    // Re-fetch user to get latest info
    const { getUserById } = require('../services/database');
    const user = await getUserById(session.user_id);
    if (!user)
      return res.status(401).json({ success: false, error: 'User not found.' });

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not verify session.' });
  }
});

module.exports = router;
