require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const { testConnection } = require('./config/database');

const app = express();

const isProd      = process.env.NODE_ENV === 'production';
// Resolve client/dist relative to the repo root (two levels up from server/src)
const clientDist  = path.resolve(__dirname, '../../client/dist');

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  // Allow the SPA to load its own scripts/styles
  contentSecurityPolicy: false,
}));

// In production the server itself serves the client — no cross-origin needed.
// In development the Vite dev server runs on a different port, so we allow it.
const corsOptions = isProd
  ? { origin: false }   // same-origin, CORS not needed
  : {
      origin:         process.env.CLIENT_URL || 'http://localhost:5173',
      credentials:    true,
      methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

app.use(limiter);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',        loginLimiter, require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/schools',     require('./routes/schools'));
app.use('/api/teachers',    require('./routes/teachers'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/positions',   require('./routes/positions'));
app.use('/api/attendance',  require('./routes/attendance'));
app.use('/api/reports',     require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Serve React SPA in production ───────────────────────────────────────────
if (isProd && fs.existsSync(clientDist)) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(clientDist, { maxAge: '7d' }));

  // All non-API routes → return index.html so React Router handles them
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Development or missing dist — keep JSON 404 for API-only mode
  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
testConnection().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀  Server running on http://0.0.0.0:${PORT}`);
    console.log(`📱  Access from other devices: http://<your-ip>:${PORT}`);
  });
});
