// Authentication routes - Register and Login

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

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
    const { name, email, password, passwordConfirm, travelCompanionType } = req.body;
    
    // Validation
    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create new user
    const user = await User.create({
      name,
      email,
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
        travelCompanionType: user.travelPreferences.travelCompanionType
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
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Find user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Compare passwords
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        travelCompanionType: user.travelPreferences.travelCompanionType
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
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
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

// POST /api/auth/logout - Logout (client-side mainly, but can be used for token invalidation)
router.post('/logout', authenticate, (req, res) => {
  // In a production app, you might want to maintain a blacklist of tokens
  // For now, just send a success response
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
