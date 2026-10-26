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
const bcryptjs = require('bcryptjs');
const { authenticate, revokeToken, getJwtSecret } = require('../middleware/authenticate');
const emailService = require('../services/emailService');
const { emailActionRateLimiter } = require('../middleware/security');

const sha256 = (val) => {
  return crypto.createHash('sha256').update(String(val)).digest('hex');
};

const timingSafeMatch = (a, b) => {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

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

// POST /api/auth/register - Register a new user with Brevo email verification
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
      if (existingUser.is_verified) {
        return res.status(400).json({ error: 'Email already registered. Please log in instead.' });
      }
      // Unverified account exists: issue new verification challenge
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256(verificationCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await User.setVerificationToken(cleanEmail, tokenHash, expiresAt);
      emailService.sendVerificationEmail(cleanEmail, existingUser.name, verificationCode, verificationToken, existingUser._id || existingUser.id).catch(err => console.warn('[Auth Register Resend Error]', err.message));

      const token = generateToken(existingUser._id || existingUser.id, existingUser.email);
      return res.status(200).json({
        success: true,
        message: 'Account already created but pending email verification. A fresh verification code has been sent.',
        requireVerification: true,
        email: cleanEmail,
        token,
        user: {
          id: existingUser._id || existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          isVerified: false,
          travelCompanionType: existingUser.travelPreferences?.travelCompanionType || 'solo'
        }
      });
    }
    
    // Generate secure single-use verification code (6 digits) and link token (32 bytes hex)
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(verificationCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create new unverified user
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      is_verified: false,
      verification_token_hash: tokenHash,
      verification_token_expires: expiresAt,
      travelPreferences: {
        travelCompanionType: travelCompanionType || 'solo'
      }
    });
    
    // Dispatch Brevo verification email (asynchronous to ensure rapid response)
    emailService.sendVerificationEmail(cleanEmail, cleanName, verificationCode, verificationToken, user._id)
      .catch(err => console.warn('[Auth Register Email Error]', err.message));

    // Generate token for immediate session setup while tagging verification requirement
    const token = generateToken(user._id, user.email);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. A verification code has been sent to your email.',
      requireVerification: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: false,
        travelCompanionType: user.travelPreferences?.travelCompanionType || 'solo'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please verify your inputs.' });
  }
});

// POST /api/auth/verify-email - Verify email address with 6-digit code or link token
router.post('/verify-email', emailActionRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();

    const { email, code, token } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    if (!code && !token) {
      return res.status(400).json({ error: 'Verification code or token is required' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification request' });
    }

    if (user.is_verified) {
      const authToken = generateToken(user._id || user.id, user.email);
      return res.status(200).json({
        success: true,
        message: 'Email address is already verified. You can log in.',
        alreadyVerified: true,
        token: authToken,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          isVerified: true,
          travelCompanionType: user.travelPreferences?.travelCompanionType || 'solo'
        }
      });
    }

    // Check failed attempt rate limit
    if (user.verification_attempts >= 5) {
      return res.status(429).json({
        error: 'Too many failed verification attempts. Please request a new verification code.'
      });
    }

    // Check expiration (15 minutes)
    if (!user.verification_token_hash || (user.verification_token_expires && new Date() > new Date(user.verification_token_expires))) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // Verify submission against stored hash using constant-time comparison
    const submittedHash = code ? sha256(String(code).trim()) : (token ? sha256(String(token).trim()) : '');
    const isMatch = timingSafeMatch(submittedHash, user.verification_token_hash);

    if (!isMatch) {
      await User.incrementVerificationAttempts(cleanEmail);
      return res.status(400).json({
        error: 'Invalid verification code. Please check your email and try again.'
      });
    }

    // Mark user verified and clear verification secrets
    const updatedUser = await User.verifyEmail(cleanEmail);
    const authToken = generateToken(updatedUser?._id || user._id || user.id, user.email);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. Welcome to VISTA!',
      token: authToken,
      user: {
        id: updatedUser?._id || user._id || user.id,
        name: updatedUser?.name || user.name,
        email: user.email,
        isVerified: true,
        travelCompanionType: updatedUser?.travelPreferences?.travelCompanionType || 'solo'
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-verification - Resend verification code with rate limiting
router.post('/resend-verification', emailActionRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();

    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Please provide an email address' });
    }

    const user = await User.findOne({ email: cleanEmail });

    // Anti-enumeration: Return generic success if account does not exist or is already verified
    if (!user || user.is_verified) {
      return res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email, a verification code has been sent.'
      });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(verificationCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.setVerificationToken(cleanEmail, tokenHash, expiresAt);
    await emailService.sendVerificationEmail(cleanEmail, user.name, verificationCode, verificationToken, user._id || user.id);

    res.status(200).json({
      success: true,
      message: 'A fresh verification code has been sent to your email.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code. Please try again later.' });
  }
});

// POST /api/auth/forgot-password - Request password reset OTP
router.post('/forgot-password', emailActionRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();

    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email: cleanEmail });

    // Anti-enumeration defense: Always return identical response whether user exists or not
    if (user) {
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = sha256(otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await User.setResetOtp(cleanEmail, otpHash, expiresAt);
      emailService.sendPasswordResetOtp(cleanEmail, user.name, otpCode, user._id || user.id)
        .catch(err => console.warn('[Auth Forgot-Password Email Error]', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a 6-digit verification code has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset request. Please try again.' });
  }
});

// POST /api/auth/verify-reset-otp - Verify password reset OTP and receive single-use reset token
router.post('/verify-reset-otp', emailActionRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();

    const { email, otp } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Limit attempts to prevent brute force
    if (user.reset_otp_attempts >= 5) {
      return res.status(429).json({
        error: 'Too many incorrect attempts. Please request a new password reset code.'
      });
    }

    // Check expiration
    if (!user.reset_otp_hash || (user.reset_otp_expires && new Date() > new Date(user.reset_otp_expires))) {
      return res.status(400).json({
        error: 'The verification code has expired. Please request a new code.'
      });
    }

    const isMatch = timingSafeMatch(sha256(cleanOtp), user.reset_otp_hash);
    if (!isMatch) {
      await User.incrementResetOtpAttempts(cleanEmail);
      return res.status(400).json({
        error: 'Invalid verification code. Please check your email and try again.'
      });
    }

    // Issue single-use 15-minute reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = sha256(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.setResetToken(cleanEmail, resetTokenHash, expiresAt);

    res.status(200).json({
      success: true,
      message: 'Verification code confirmed. You may now set your new password.',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ error: 'Failed to verify reset code. Please try again.' });
  }
});

// POST /api/auth/reset-password - Set new password using single-use reset token
router.post('/reset-password', emailActionRateLimiter, async (req, res) => {
  try {
    await ensureDatabase();

    const { email, resetToken, newPassword, confirmPassword, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanResetToken = (resetToken || '').trim();
    const targetPassword = newPassword || password || '';
    const targetConfirm = confirmPassword || newPassword || password || '';

    if (!cleanEmail || !cleanResetToken || !targetPassword) {
      return res.status(400).json({ error: 'Email, reset token, and new password are required' });
    }

    if (targetPassword !== targetConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (typeof targetPassword !== 'string' || targetPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (targetPassword.length > 128) {
      return res.status(400).json({ error: 'Password cannot exceed 128 characters' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset session' });
    }

    // Verify token expiry and match
    if (!user.reset_token_hash || (user.reset_token_expires && new Date() > new Date(user.reset_token_expires))) {
      return res.status(400).json({ error: 'Password reset session has expired. Please request a new code.' });
    }

    const isMatch = timingSafeMatch(sha256(cleanResetToken), user.reset_token_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password reset token. Please request a new code.' });
    }

    // Hash new password using bcrypt 12 work factor
    const hashedPassword = await bcryptjs.hash(targetPassword, 12);
    await User.resetPassword(cleanEmail, hashedPassword);

    // Invalidate any active sessions/tokens
    if (typeof revokeToken === 'function') {
      await revokeToken(null, cleanEmail, user._id || user.id);
    }

    // Send security confirmation email via Brevo
    emailService.sendPasswordChangedNotification(cleanEmail, user.name, user._id || user.id)
      .catch(err => console.warn('[Auth Password Changed Email Notice]', err.message));

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// POST /api/auth/login - User login with verification policy check
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

    // Email verification policy check
    if (process.env.ENFORCE_EMAIL_VERIFICATION === 'true' && user.is_verified === false) {
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const tokenHash = sha256(verificationCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await User.setVerificationToken(cleanEmail, tokenHash, expiresAt);
      emailService.sendVerificationEmail(cleanEmail, user.name, verificationCode, '', user._id || user.id)
        .catch(err => console.warn('[Auth Login Verify Email Error]', err.message));

      return res.status(403).json({
        error: 'Email verification required',
        requireVerification: true,
        email: user.email,
        message: 'Please verify your email before logging in. A new verification code has been sent.'
      });
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
        isVerified: Boolean(user.is_verified),
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
