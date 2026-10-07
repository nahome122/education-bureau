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
app.use('/api/transfers',   require('./routes/transfers'));
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

// Error handler — translates MySQL errors to meaningful JSON responses
app.use((err, req, res, next) => {
  // If it came from a route that already used dbError(), just forward
  if (err.isDbError) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }

  // MySQL / DB errors
  const mysqlCodes = {
    'ER_DUP_ENTRY':           { status: 409, message: 'Duplicate entry — record already exists.' },
    'ER_ROW_IS_REFERENCED_2': { status: 409, message: 'Cannot delete — this record is referenced by other data.' },
    'ER_NO_REFERENCED_ROW_2': { status: 400, message: 'Foreign key error — referenced record does not exist.' },
    'ER_BAD_FIELD_ERROR':     { status: 500, message: `Unknown column: ${err.sqlMessage || ''}` },
    'ER_NO_SUCH_TABLE':       { status: 500, message: 'Table does not exist — run migrations.' },
    'ER_ACCESS_DENIED_ERROR': { status: 500, message: 'MySQL access denied — check DB credentials.' },
    'ER_BAD_DB_ERROR':        { status: 500, message: 'Database not found — run setupDb.js.' },
    'ER_PARSE_ERROR':         { status: 500, message: 'SQL syntax error.' },
    'ER_LOCK_WAIT_TIMEOUT':   { status: 503, message: 'Database lock timeout — try again.' },
    'ECONNREFUSED':           { status: 503, message: 'Cannot connect to MySQL — make sure XAMPP is running.' },
    'ETIMEDOUT':              { status: 503, message: 'Database connection timed out.' },
    'PROTOCOL_CONNECTION_LOST': { status: 503, message: 'Database connection lost.' },
  };

  const code = err.code || '';
  if (mysqlCodes[code]) {
    console.error(`[DB ERROR] ${code}:`, err.sqlMessage || err.message);
    const { status, message } = mysqlCodes[code];
    return res.status(status).json({ success: false, message, code });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token.' });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token expired.' });

  // Validation errors (express-validator)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }

  // Generic fallback
  console.error('[SERVER ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
testConnection().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀  Server running on http://0.0.0.0:${PORT}`);
    console.log(`📱  Access from other devices: http://<your-ip>:${PORT}`);
  });
});
