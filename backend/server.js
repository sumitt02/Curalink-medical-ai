require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { chat, research, getSessionHistory, listSessions } = require('./controllers/chatController');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// DATABASE CONNECTION
// ============================================
connectDB();

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// RATE LIMITING
// ============================================

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again after 15 minutes',
    retryAfter: '15 minutes',
  },
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Stricter limiter for AI/research endpoints (they're expensive)
const researchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 research requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Research requests are limited. Please wait before making another request.',
    retryAfter: '5 minutes',
  },
  skip: (req) => process.env.NODE_ENV === 'development',
});

app.use('/api/', generalLimiter);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CuraLink Medical Research API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus =
    mongoose.connection.readyState === 1
      ? 'connected'
      : mongoose.connection.readyState === 2
      ? 'connecting'
      : 'disconnected';

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CuraLink Medical Research API',
    version: '1.0.0',
    database: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'configured' : 'not configured',
    pubmed: process.env.PUBMED_API_KEY ? 'configured' : 'using public access',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================
// API ROUTES
// ============================================

/**
 * POST /api/chat
 * Main chat endpoint for medical research queries
 * Body: { sessionId?, message, disease?, patientName?, location?, patientContext? }
 */
app.post('/api/chat', researchLimiter, chat);

/**
 * POST /api/research
 * Research endpoint (alias for /api/chat)
 * Body: { sessionId?, message, disease, patientName?, location?, patientContext? }
 */
app.post('/api/research', researchLimiter, research);

/**
 * GET /api/sessions/:sessionId/history
 * Returns conversation history for a session
 */
app.get('/api/sessions/:sessionId/history', getSessionHistory);

/**
 * GET /api/sessions
 * Returns list of all sessions
 */
app.get('/api/sessions', listSessions);

/**
 * DELETE /api/sessions/:sessionId
 * Clears a conversation session
 */
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const Conversation = require('./models/Conversation');

    const result = await Conversation.findOneAndDelete({ sessionId });

    if (!result) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No session found with ID: ${sessionId}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Session ${sessionId} deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/test
 * Test endpoint to verify query expansion without hitting external APIs
 */
app.post('/api/test/query-expansion', (req, res) => {
  const { expandQuery } = require('./services/queryExpansion');
  const { disease, query, location } = req.body;

  try {
    const expanded = expandQuery({ disease, query, location });
    return res.status(200).json({
      success: true,
      input: { disease, query, location },
      expanded,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Query Expansion Error',
      message: error.message,
    });
  }
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'POST /api/chat',
      'POST /api/research',
      'GET  /api/sessions/:sessionId/history',
      'GET  /api/sessions',
      'DELETE /api/sessions/:sessionId',
      'GET  /api/health',
      'GET  /health',
    ],
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.stack || err.message);

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Duplicate entry',
    });
  }

  // Generic server error
  return res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'Unknown error',
  });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('   CuraLink Medical Research Backend');
  console.log('========================================');
  console.log(`  Server:      http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/api/health`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  MongoDB:     ${process.env.MONGODB_URI ? process.env.MONGODB_URI.split('@').pop() || 'Atlas' : 'localhost (no DB configured)'}`);
  console.log(`  Groq (Llama3): ${process.env.GROQ_API_KEY ? '✅ Configured' : '❌ NOT configured - add GROQ_API_KEY to .env'}`);
  console.log(`  PubMed Key:  ${process.env.PUBMED_API_KEY ? '✅ Configured' : 'Using public access (3 req/s limit)'}`);
  console.log('========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});

module.exports = app;