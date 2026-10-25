// Authentication routes - Register and Login

const express = require('express');
const jwt = require('jsonwebtoken');
const { isConnected } = require('../config/database');
const User = require('../models/User');

const router = express.Router();

const ensureDatabase = async () => {
  if (isConnected()) {
    return true;
  }

  try {
    const { connectDB } = require('../config/database');
    await connectDB();
  } catch (err) {
    console.warn('Database auto-reconnect notice:', err.message);
  }
  return true;
};

const crypto = require('crypto');
const { authenticate, revokeToken, getJwtSecret } = require('../middleware/authenticate');

// Generate JWT token with explicit HS256 algorithm and cryptographic jti
const generateToken = (userId, email) => {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: String(userId),
      email: email || undefined,
      jti: crypto.randomUUID()
    },
    secret,
    { 
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRE || '7d' 
    }
  );
};

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    await ensureDatabase();

    const { name, email, password, passwordConfirm, confirmPassword, travelCompanionType } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    
    // Validation
    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Please provide all required fields (name, email, password)' });
    }
    
    const confirm = passwordConfirm || confirmPassword;
    if (confirm && password !== confirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (password.length > 128) {
      return res.status(400).json({ error: 'Password cannot exceed 128 characters' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please log in instead.' });
    }
    
    // Create new user
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      travelPreferences: {
        travelCompanionType: travelCompanionType || 'solo'
      }
    });
    
    // Generate token
    const token = generateToken(user._id, user.email);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        travelCompanionType: user.travelPreferences?.travelCompanionType || 'solo'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please verify your inputs.' });
  }
});

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    await ensureDatabase();

    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    
    // Validation
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Find user (include password for comparison)
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Compare passwords
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = generateToken(user._id || user.id, user.email);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        travelCompanionType: user.travelPreferences?.travelCompanionType || 'solo'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// GET /api/auth/profile - Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    await ensureDatabase();

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        travelPreferences: user.travelPreferences,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    await ensureDatabase();

    // Prototype pollution detection
    const hasPollutionProbe = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      for (const key of Object.keys(obj)) {
        if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
          return true;
        }
        if (typeof obj[key] === 'object' && hasPollutionProbe(obj[key])) {
          return true;
        }
      }
      return false;
    };

    if (hasPollutionProbe(req.body)) {
      return res.status(400).json({ error: 'Security violation: Prototype pollution payload detected.' });
    }

    const { name, travelCompanionType, favoriteDestinations, preferredActivities, profile } = req.body || {};

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)) {
      return res.status(400).json({ error: 'Name must be a valid string of 1 to 100 characters' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: name ? name.trim() : undefined,
        'travelPreferences.travelCompanionType': travelCompanionType || undefined,
        'travelPreferences.favoriteDestinations': Array.isArray(favoriteDestinations) ? favoriteDestinations.slice(0, 50) : undefined,
        'travelPreferences.preferredActivities': Array.isArray(preferredActivities) ? preferredActivities.slice(0, 50) : undefined,
        profile: (profile && typeof profile === 'object' && !Array.isArray(profile)) ? profile : undefined
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        travelPreferences: user.travelPreferences,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message && error.message.includes('Security violation') ? error.message : 'Failed to update profile' });
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, async (req, res) => {
  if (req.token) {
    await revokeToken(req.token, null, req.user?.id);
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// DELETE /api/auth/account - Delete user account and all personal itineraries
router.delete('/account', authenticate, async (req, res) => {
  try {
    await ensureDatabase();

    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.token) {
      await revokeToken(req.token, null, userId);
    }

    // Delete all user itineraries first if cascading is not enabled in memory mode
    const { query, isConnected } = require('../config/database');
    if (isConnected()) {
      await query('DELETE FROM itineraries WHERE user_id = $1', [userId]);
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User account not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Account and associated travel itineraries have been permanently deleted.'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Account deletion failed. Please contact support.' });
  }
});

// GET /api/auth/privacy - Transparent data retention and privacy summary
router.get('/privacy', (req, res) => {
  res.status(200).json({
    success: true,
    policy: {
      dataCollected: ['Account name', 'Account email', 'Hashed password (bcrypt 12-rounds)', 'User-created trip itineraries', 'Saved travel style preferences'],
      retentionPeriod: 'Retained as long as your account is active. Permanently purged upon account deletion.',
      thirdPartySharing: 'We do not sell, rent, or trade your personal information. Route and map computations use anonymized origin and destination coordinates.',
      guarantees: 'Estimated fuel tariffs and NHAI FASTag tolls are benchmarks and can fluctuate with market rates. We do not guarantee third-party commercial pricing.',
      cancellationAndRefunds: 'Vehicle rentals through partner fleets (A6 Cars) adhere to partner cancellation schedules as detailed during booking.',
      contactEmail: 'privacy@vistatravel.app'
    },
    dataRetention: 'Retained as long as your account is active. Permanently purged upon account deletion.',
    accountDeletion: {
      available: true,
      endpoint: 'DELETE /api/auth/account',
      method: 'Permanent cascading purge'
    }
  });
});

module.exports = router;
