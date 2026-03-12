require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const detectRoutes = require('./routes/detect');
const chatRoutes = require('./routes/chat');
const feedbackRoutes = require('./routes/feedback');
const historyRoutes = require('./routes/history');
const { initDB } = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Ensure upload & data dirs exist ──────────────────────────────────────────
['./uploads', './data'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/detect',   detectRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/history',  historyRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌱 Plant Disease API running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}).catch(err => {
  console.error('Failed to initialise DB:', err);
  process.exit(1);
});
