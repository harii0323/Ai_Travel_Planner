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
  }

  async comparePassword(enteredPassword) {
    return bcryptjs.compare(enteredPassword, this.password);
  }

  toJSON() {
    const obj = { ...this };
    delete obj.password;
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

    const memRecord = {
      id,
      name: data.name,
      email: cleanEmail,
      password: hashedPassword,
      travel_preferences: travelPreferences,
      profile,
      created_at: new Date().toISOString()
    };
    memoryUsers.set(cleanEmail, memRecord);

    if (db.isConnected()) {
      try {
        const result = await db.query(
          `INSERT INTO users (id, name, email, password, travel_preferences, profile)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            id,
            data.name,
            cleanEmail,
            hashedPassword,
            JSON.stringify(travelPreferences),
            JSON.stringify(profile)
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
  }
};

module.exports = User;
