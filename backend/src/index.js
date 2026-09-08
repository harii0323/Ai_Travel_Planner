const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { connectDB, isConnected } = require('./config/database');

const app = express();

const getAllowedOrigins = () => {
  const configuredOrigins = process.env.FRONTEND_URL || 'http://localhost:3000';
  return configuredOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
};

// CORS configuration
const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.REQUEST_BODY_LIMIT || '10mb'
}));

// Connect to PostgreSQL
connectDB();

// Routes
const authRouter = require('./routes/auth');
const itineraryRouter = require('./routes/itinerary');
const historyRouter = require('./routes/history');
const placesRouter = require('./routes/places');
const rentalsRouter = require('./routes/rentals');
const { validateGoogleMapsApiKey } = require('./utils/googleMapsAPI');

app.use('/api/auth', authRouter);
app.use('/api/itinerary', itineraryRouter);
app.use('/api/history', historyRouter);
app.use('/api/places', placesRouter);
app.use('/api/rentals', rentalsRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const googleMapsHealth = await validateGoogleMapsApiKey();

  res.json({
    status: 'Server is running',
    database: isConnected() ? 'connected' : 'disconnected',
    googleMaps: {
      ok: googleMapsHealth.ok,
      status: googleMapsHealth.status,
      error: googleMapsHealth.error,
      sampleDistanceKm: googleMapsHealth.distance,
      sampleDuration: googleMapsHealth.duration
    },
    timestamp: new Date()
  });
});

// Log Google Maps API key state at startup
const { hasGoogleMapsAPI } = require('./utils/googleMapsAPI');
hasGoogleMapsAPI();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request payload is too large',
      message: 'The itinerary is larger than the server request limit. Increase REQUEST_BODY_LIMIT or save a smaller plan.'
    });
  }
  
  // Validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: Object.values(err.errors).map(e => e.message) 
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
