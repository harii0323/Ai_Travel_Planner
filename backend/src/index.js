const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { connectDB, isConnected } = require('./config/database');

const app = express();

app.disable('x-powered-by');

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const getAllowedOrigins = () => {
  const configuredOrigins = process.env.FRONTEND_URL || '';
  const list = configuredOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    ...list
  ];
};

// CORS configuration supporting localhost, 127.0.0.1, and configured origins
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowed = getAllowedOrigins();
    if (
      allowed.includes(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production' && !process.env.ENFORCE_CORS) {
      return callback(null, true);
    }

    const corsErr = new Error(`Origin ${origin} is not allowed by CORS policy.`);
    corsErr.status = 403;
    return callback(corsErr);
  },
  credentials: true,
  optionsSuccessStatus: 200
};

const {
  securityHeaders,
  requestTimeout,
  authRateLimiter,
  itineraryRateLimiter,
  generalRateLimiter,
  cacheMiddleware
} = require('./middleware/security');

app.use(securityHeaders);
app.use(requestTimeout(30000));

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.REQUEST_BODY_LIMIT || '2mb'
}));

// Apply general API rate limiter
app.use('/api', generalRateLimiter);

// Connect to PostgreSQL
connectDB();

// Routes with targeted rate limiters & caching
const authRouter = require('./routes/auth');
const itineraryRouter = require('./routes/itinerary');
const historyRouter = require('./routes/history');
const placesRouter = require('./routes/places');
const rentalsRouter = require('./routes/rentals');
const { validateGoogleMapsApiKey, hasGoogleMapsAPI } = require('./utils/googleMapsAPI');

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth', authRouter);

app.use('/api/itinerary/generate', itineraryRateLimiter);
app.use('/api/itinerary', itineraryRouter);

app.use('/api/history', historyRouter);
app.use('/api/places', cacheMiddleware(10 * 60 * 1000), placesRouter);
app.use('/api/rentals', rentalsRouter);

// Cached Google Maps health status to prevent quota exhaustion from monitoring / health probes
let cachedGoogleMapsCheck = null;
let lastMapsCheckTime = 0;

// Health check endpoint (exempt from rate limits, fast and safe)
app.get('/api/health', async (req, res) => {
  const hasMapsKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  const shouldDeepCheck = req.query.deep === 'true' && (Date.now() - lastMapsCheckTime > 60000);

  if (shouldDeepCheck && hasMapsKey) {
    try {
      cachedGoogleMapsCheck = await validateGoogleMapsApiKey();
      lastMapsCheckTime = Date.now();
    } catch (e) {
      cachedGoogleMapsCheck = { ok: false, error: e.message };
    }
  }

  res.json({
    status: 'Server is running',
    database: isConnected() ? 'connected' : 'disconnected',
    googleMaps: {
      configured: hasMapsKey,
      ...(cachedGoogleMapsCheck || { ok: hasMapsKey, status: hasMapsKey ? 'configured' : 'missing_key' })
    },
    timestamp: new Date().toISOString()
  });
});

// Log Google Maps API key state at startup
hasGoogleMapsAPI();

// Error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || (err.statusCode || 500);
  const isProd = process.env.NODE_ENV === 'production';

  // Secure operational logging: sanitize message without printing user inputs or secrets
  console.error(`[Security Log] ${req.method} ${req.path} - ${statusCode} - ${err.message}`);

  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({
      error: 'Forbidden by CORS policy',
      message: 'The request origin is not authorized to access this API.'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request payload is too large',
      message: 'The request body exceeds the permissible server limit.'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: Object.values(err.errors || {}).map(e => e.message) 
    });
  }
  
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired authentication credentials.' });
  }

  const safeMessage = (statusCode === 500 && isProd)
    ? 'An unexpected error occurred while processing your request. Please try again later.'
    : (statusCode === 500 ? 'Internal server error' : (err.message || 'Operation failed'));

  res.status(statusCode).json({ 
    error: safeMessage 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;
let server = null;
if (require.main === module || process.env.AUTO_START_SERVER === 'true') {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
module.exports.server = server;
