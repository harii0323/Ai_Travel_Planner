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

const setNested = (target, dottedKey, value) => {
  const keys = dottedKey.split('.');
  let cursor = target;

  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });

  cursor[keys[keys.length - 1]] = value;
};

const findOneExec = async (filter) => {
  if (filter.email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [filter.email.toLowerCase()]);
    return toDocument(result.rows[0]);
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

    const result = await db.query(
      `INSERT INTO users (id, name, email, password, travel_preferences, profile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        data.name,
        data.email.toLowerCase(),
        hashedPassword,
        JSON.stringify(travelPreferences),
        JSON.stringify(profile)
      ]
    );

    return toDocument(result.rows[0]);
  },

  findOne(filter) {
    return new UserQuery(filter);
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return toDocument(result.rows[0]);
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

    const result = await db.query(
      `UPDATE users
       SET name = $2, travel_preferences = $3, profile = $4
       WHERE id = $1
       RETURNING *`,
      [
        id,
        next.name,
        JSON.stringify(next.travelPreferences),
        JSON.stringify(next.profile)
      ]
    );

    return toDocument(result.rows[0]);
  }
};

module.exports = User;
