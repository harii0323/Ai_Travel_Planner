// Authentication middleware with strict token validation, algorithm enforcement, and durable token revocation
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory sliding cache of revoked token hashes for sub-millisecond hot lookups
const revokedTokens = new Map();

const hashToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Periodic cleanup of expired revoked tokens every 5 minutes in memory and database
const cleanupRevokedInterval = setInterval(async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const [hash, expiresAt] of revokedTokens.entries()) {
    if (expiresAt && expiresAt < now) {
      revokedTokens.delete(hash);
    }
  }

  try {
    const db = require('../config/database');
    if (db.isConnected()) {
      await db.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
    }
  } catch (err) {
    // Non-fatal background cleanup log
  }
}, 5 * 60 * 1000);

if (cleanupRevokedInterval.unref) {
  cleanupRevokedInterval.unref();
}

/**
 * Revoke a JWT token so it cannot be reused (durable in database + fast in memory)
 * @param {string} token
 * @param {number} [expiresAt] Unix timestamp seconds
 * @param {string} [userId]
 */
async function revokeToken(token, expiresAt, userId = null) {
  if (!token || typeof token !== 'string') return;
  const tokenHash = hashToken(token);
  // Default to 7 days from now if not supplied
  const expiry = expiresAt || Math.floor(Date.now() / 1000) + (7 * 24 * 3600);
  
  // 1. In-memory hot cache
  revokedTokens.set(tokenHash, expiry);

  // 2. Persistent database table (survives restarts & scales across instances)
  try {
    const db = require('../config/database');
    if (db.isConnected()) {
      await db.query(
        `INSERT INTO revoked_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, to_timestamp($3))
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId, expiry]
      );
    }
  } catch (err) {
    console.warn('Warning: Failed to persist revoked token to database:', err.message);
  }
}

/**
 * Check if a token has been revoked (checks memory cache first, then database)
 * @param {string} token
 * @returns {Promise<boolean>}
 */
async function isTokenRevoked(token) {
  if (!token || typeof token !== 'string') return false;
  const tokenHash = hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  // 1. Check in-memory hot cache
  const cachedExpiresAt = revokedTokens.get(tokenHash);
  if (cachedExpiresAt) {
    if (cachedExpiresAt < now) {
      revokedTokens.delete(tokenHash);
      return false;
    }
    return true;
  }

  // 2. Check persistent database (handles server restarts and multiple instances)
  try {
    const db = require('../config/database');
    if (db.isConnected()) {
      const result = await db.query(
        'SELECT token_hash FROM revoked_tokens WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (result.rows && result.rows.length > 0) {
        // Cache locally for subsequent requests
        revokedTokens.set(tokenHash, now + 3600);
        return true;
      }
    }
  } catch (err) {
    console.warn('Warning: Failed to check revoked token database:', err.message);
  }

  return false;
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
    }
    return 'your_secret_key';
  }
  if (secret.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production!');
  }
  return secret;
};

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const t = authHeader.substring(7).trim();
    if (t) return t;
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided. Please log in.' });
    }
    
    // Check revocation store (durable check)
    if (await isTokenRevoked(token)) {
      return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
    }
    
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    });
    
    if (!decoded || !decoded.id || typeof decoded.id !== 'string') {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email
    };
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication credentials.' });
  }
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.revokeToken = revokeToken;
module.exports.isTokenRevoked = isTokenRevoked;
module.exports.getJwtSecret = getJwtSecret;
module.exports.extractToken = extractToken;
