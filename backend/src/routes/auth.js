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

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
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
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
    const token = generateToken(user._id);
    
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
    res.status(500).json({ error: error.message || 'Registration failed' });
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
    const token = generateToken(user._id || user.id);
    
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
const authenticate = require('../middleware/authenticate');

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
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    await ensureDatabase();

    const { name, travelCompanionType, favoriteDestinations, preferredActivities, profile } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: name || undefined,
        'travelPreferences.travelCompanionType': travelCompanionType || undefined,
        'travelPreferences.favoriteDestinations': favoriteDestinations || undefined,
        'travelPreferences.preferredActivities': preferredActivities || undefined,
        profile: profile || undefined
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
