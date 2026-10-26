const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const db = require('../config/database');

const DEFAULT_TRAVEL_PREFERENCES = {
  favoriteDestinations: [],
  preferredActivities: [],
  travelCompanionType: 'solo'
};

class UserDocument {
  constructor(row) {
    this._id = row.id;
    this.id = row.id;
    this.name = row.name;
    this.email = row.email;
    this.password = row.password;
    this.createdAt = row.created_at;
    this.travelPreferences = row.travel_preferences || DEFAULT_TRAVEL_PREFERENCES;
    this.profile = row.profile || {};
    this.isVerified = Boolean(row.is_verified);
    this.is_verified = Boolean(row.is_verified);
    this.verification_token_hash = row.verification_token_hash || null;
    this.verification_token_expires = row.verification_token_expires ? new Date(row.verification_token_expires) : null;
    this.verification_attempts = Number(row.verification_attempts || 0);
    this.reset_otp_hash = row.reset_otp_hash || null;
    this.reset_otp_expires = row.reset_otp_expires ? new Date(row.reset_otp_expires) : null;
    this.reset_otp_attempts = Number(row.reset_otp_attempts || 0);
    this.reset_token_hash = row.reset_token_hash || null;
    this.reset_token_expires = row.reset_token_expires ? new Date(row.reset_token_expires) : null;
  }

  async comparePassword(enteredPassword) {
    return bcryptjs.compare(enteredPassword, this.password);
  }

  toJSON() {
    const obj = { ...this };
    delete obj.password;
    delete obj.verification_token_hash;
    delete obj.reset_otp_hash;
    delete obj.reset_token_hash;
    return obj;
  }
}

const toDocument = (row) => row ? new UserDocument(row) : null;

const normalizePreferences = (preferences = {}) => ({
  ...DEFAULT_TRAVEL_PREFERENCES,
  ...preferences
});

const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

const setNested = (target, dottedKey, value) => {
  const keys = dottedKey.split('.');
  for (const k of keys) {
    if (FORBIDDEN_PROPERTIES.has(k)) {
      throw new Error(`Security violation: property path '${dottedKey}' is not permitted.`);
    }
  }

  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });

  cursor[keys[keys.length - 1]] = value;
};


// In-memory fallback store for offline / demo mode
const memoryUsers = new Map();
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    const demoHash = await bcryptjs.hash('password123', 10);
    memoryUsers.set('ravi@example.com', {
      id: 'demo-user-ravi',
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      password: demoHash,
      is_verified: true,
      created_at: new Date().toISOString(),
      travel_preferences: DEFAULT_TRAVEL_PREFERENCES,
      profile: {}
    });
  })();
}

const findOneExec = async (filter) => {
  if (filter.email) {
    const cleanEmail = filter.email.toLowerCase().trim();
    if (db.isConnected()) {
      try {
        if (typeof db.withSystemContext === 'function') {
          const doc = await db.withSystemContext(async (client) => {
            const result = await client.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
            return result.rows[0] ? toDocument(result.rows[0]) : null;
          });
          if (doc) return doc;
        } else {
          const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
          if (result.rows[0]) return toDocument(result.rows[0]);
        }
      } catch (err) {
        console.warn('DB query error in findOne, checking memory store:', err.message);
      }
    }
    const memUser = memoryUsers.get(cleanEmail);
    return memUser ? toDocument(memUser) : null;
  }

  return null;
};

class UserQuery {
  constructor(filter) {
    this.filter = filter;
  }

  select() {
    return this;
  }

  exec() {
    return findOneExec(this.filter);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

const User = {
  async create(data) {
    const id = crypto.randomUUID();
    const hashedPassword = await bcryptjs.hash(data.password, 12);
    const travelPreferences = normalizePreferences(data.travelPreferences);
    const profile = data.profile || {};
    const cleanEmail = data.email.toLowerCase().trim();
    const isVerified = Boolean(data.is_verified);
    const verificationTokenHash = data.verification_token_hash || null;
    const verificationTokenExpires = data.verification_token_expires || null;

    const memRecord = {
      id,
      name: data.name,
      email: cleanEmail,
      password: hashedPassword,
      travel_preferences: travelPreferences,
      profile,
      is_verified: isVerified,
      verification_token_hash: verificationTokenHash,
      verification_token_expires: verificationTokenExpires,
      verification_attempts: 0,
      created_at: new Date().toISOString()
    };
    memoryUsers.set(cleanEmail, memRecord);

    if (db.isConnected()) {
      try {
        const result = await db.query(
          `INSERT INTO users (id, name, email, password, travel_preferences, profile, is_verified, verification_token_hash, verification_token_expires)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            id,
            data.name,
            cleanEmail,
            hashedPassword,
            JSON.stringify(travelPreferences),
            JSON.stringify(profile),
            isVerified,
            verificationTokenHash,
            verificationTokenExpires
          ]
        );
        return toDocument(result.rows[0]);
      } catch (err) {
        console.warn('DB error during user insert, using memory store:', err.message);
      }
    }

    return toDocument(memRecord);
  },

  findOne(filter) {
    return new UserQuery(filter);
  },

  async findById(id) {
    if (db.isConnected()) {
      try {
        if (id && typeof db.withUserContext === 'function') {
          const doc = await db.withUserContext(id, async (client) => {
            const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
            return result.rows[0] ? toDocument(result.rows[0]) : null;
          });
          if (doc) return doc;
        } else {
          const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
          if (result.rows[0]) return toDocument(result.rows[0]);
        }
      } catch (err) {
        console.warn('DB error during findById, checking memory store:', err.message);
      }
    }
    for (const u of memoryUsers.values()) {
      if (u.id === id) return toDocument(u);
    }
    return null;
  },

  async findByIdAndUpdate(id, updates) {
    const user = await User.findById(id);
    if (!user) return null;

    const next = {
      name: user.name,
      travelPreferences: { ...user.travelPreferences },
      profile: { ...user.profile }
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'name') next.name = value;
      else if (key === 'profile') next.profile = value;
      else if (key.includes('.')) setNested(next, key, value);
      else next[key] = value;
    });

    if (db.isConnected()) {
      try {
        const updateSql = `UPDATE users
           SET name = $2, travel_preferences = $3, profile = $4
           WHERE id = $1
           RETURNING *`;
        const updateParams = [
          id,
          next.name,
          JSON.stringify(next.travelPreferences),
          JSON.stringify(next.profile)
        ];
        let result;
        if (id && typeof db.withUserContext === 'function') {
          result = await db.withUserContext(id, async (client) => {
            return client.query(updateSql, updateParams);
          });
        } else {
          result = await db.query(updateSql, updateParams);
        }
        if (result && result.rows[0]) {
          const doc = toDocument(result.rows[0]);
          for (const u of memoryUsers.values()) {
            if (u.id === id) {
              u.name = next.name;
              u.travel_preferences = next.travelPreferences;
              u.profile = next.profile;
            }
          }
          return doc;
        }
      } catch (err) {
        console.warn('DB error during findByIdAndUpdate, using memory store:', err.message);
      }
    }

    for (const u of memoryUsers.values()) {
      if (u.id === id) {
        u.name = next.name;
        u.travel_preferences = next.travelPreferences;
        u.profile = next.profile;
        return toDocument(u);
      }
    }

    return null;
  },

  async findByIdAndDelete(id) {
    let deletedUser = null;
    if (db.isConnected()) {
      try {
        let result;
        if (id && typeof db.withUserContext === 'function') {
          result = await db.withUserContext(id, async (client) => {
            return client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
          });
        } else {
          result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        }
        if (result && result.rows[0]) {
          deletedUser = toDocument(result.rows[0]);
        }
      } catch (err) {
        console.warn('DB error during findByIdAndDelete:', err.message);
      }
    }
    for (const [email, u] of memoryUsers.entries()) {
      if (u.id === id || (deletedUser && u.email === deletedUser.email)) {
        memoryUsers.delete(email);
        if (!deletedUser) deletedUser = toDocument(u);
      }
    }
    return deletedUser;
  },

  async setVerificationToken(email, tokenHash, expiresAt) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          await client.query(
            `UPDATE users SET verification_token_hash = $1, verification_token_expires = $2, verification_attempts = 0 WHERE email = $3`,
            [tokenHash, expiresAt, cleanEmail]
          );
        });
      } catch (err) {
        console.warn('DB error in setVerificationToken:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.verification_token_hash = tokenHash;
      mem.verification_token_expires = expiresAt;
      mem.verification_attempts = 0;
    }
  },

  async incrementVerificationAttempts(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    let attempts = 1;
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          const res = await client.query(
            `UPDATE users SET verification_attempts = COALESCE(verification_attempts, 0) + 1 WHERE email = $1 RETURNING verification_attempts`,
            [cleanEmail]
          );
          if (res.rows[0]) attempts = Number(res.rows[0].verification_attempts);
        });
      } catch (err) {
        console.warn('DB error in incrementVerificationAttempts:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.verification_attempts = (mem.verification_attempts || 0) + 1;
      attempts = mem.verification_attempts;
    }
    return attempts;
  },

  async verifyEmail(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    let updated = null;
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          const res = await client.query(
            `UPDATE users SET is_verified = TRUE, verification_token_hash = NULL, verification_token_expires = NULL, verification_attempts = 0 WHERE email = $1 RETURNING *`,
            [cleanEmail]
          );
          if (res.rows[0]) updated = toDocument(res.rows[0]);
        });
      } catch (err) {
        console.warn('DB error in verifyEmail:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.is_verified = true;
      mem.verification_token_hash = null;
      mem.verification_token_expires = null;
      mem.verification_attempts = 0;
      if (!updated) updated = toDocument(mem);
    }
    return updated;
  },

  async setResetOtp(email, otpHash, expiresAt) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          await client.query(
            `UPDATE users SET reset_otp_hash = $1, reset_otp_expires = $2, reset_otp_attempts = 0, reset_token_hash = NULL, reset_token_expires = NULL WHERE email = $3`,
            [otpHash, expiresAt, cleanEmail]
          );
        });
      } catch (err) {
        console.warn('DB error in setResetOtp:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.reset_otp_hash = otpHash;
      mem.reset_otp_expires = expiresAt;
      mem.reset_otp_attempts = 0;
      mem.reset_token_hash = null;
      mem.reset_token_expires = null;
    }
  },

  async incrementResetOtpAttempts(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    let attempts = 1;
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          const res = await client.query(
            `UPDATE users SET reset_otp_attempts = COALESCE(reset_otp_attempts, 0) + 1 WHERE email = $1 RETURNING reset_otp_attempts`,
            [cleanEmail]
          );
          if (res.rows[0]) attempts = Number(res.rows[0].reset_otp_attempts);
        });
      } catch (err) {
        console.warn('DB error in incrementResetOtpAttempts:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.reset_otp_attempts = (mem.reset_otp_attempts || 0) + 1;
      attempts = mem.reset_otp_attempts;
    }
    return attempts;
  },

  async setResetToken(email, tokenHash, expiresAt) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          await client.query(
            `UPDATE users SET reset_token_hash = $1, reset_token_expires = $2, reset_otp_hash = NULL, reset_otp_expires = NULL, reset_otp_attempts = 0 WHERE email = $3`,
            [tokenHash, expiresAt, cleanEmail]
          );
        });
      } catch (err) {
        console.warn('DB error in setResetToken:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.reset_token_hash = tokenHash;
      mem.reset_token_expires = expiresAt;
      mem.reset_otp_hash = null;
      mem.reset_otp_expires = null;
      mem.reset_otp_attempts = 0;
    }
  },

  async resetPassword(email, newHashedPassword) {
    const cleanEmail = (email || '').toLowerCase().trim();
    let updated = null;
    if (db.isConnected()) {
      try {
        await db.withSystemContext(async (client) => {
          const res = await client.query(
            `UPDATE users SET password = $1, reset_token_hash = NULL, reset_token_expires = NULL, reset_otp_hash = NULL, reset_otp_expires = NULL, reset_otp_attempts = 0 WHERE email = $2 RETURNING *`,
            [newHashedPassword, cleanEmail]
          );
          if (res.rows[0]) updated = toDocument(res.rows[0]);
        });
      } catch (err) {
        console.warn('DB error in resetPassword:', err.message);
      }
    }
    const mem = memoryUsers.get(cleanEmail);
    if (mem) {
      mem.password = newHashedPassword;
      mem.reset_token_hash = null;
      mem.reset_token_expires = null;
      mem.reset_otp_hash = null;
      mem.reset_otp_expires = null;
      mem.reset_otp_attempts = 0;
      if (!updated) updated = toDocument(mem);
    }
    return updated;
  }
};

module.exports = User;
