const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { Pool } = require('pg');

const getConnectionString = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: DATABASE_URL must be set in production!');
    }
    return 'postgres://postgres:postgres@localhost:5432/ai_travel_planner';
  }
  return url;
};

const getSslConfig = () => {
  if (process.env.POSTGRES_SSL === 'true') {
    if (process.env.POSTGRES_CA_CERT) {
      return {
        rejectUnauthorized: true,
        ca: process.env.POSTGRES_CA_CERT
      };
    }
    return process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  }
  return undefined;
};

const pool = new Pool({
  connectionString: getConnectionString(),
  max: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_TIMEOUT || '30000', 10),
  ssl: getSslConfig()
});

let connected = false;

const query = (text, params) => pool.query(text, params);

const initializeSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      travel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS itineraries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      destination TEXT NOT NULL,
      start_location TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      total_days INTEGER NOT NULL,
      budget NUMERIC NOT NULL,
      estimated_cost NUMERIC NOT NULL,
      without_budget BOOLEAN NOT NULL DEFAULT FALSE,
      activities JSONB NOT NULL DEFAULT '[]'::jsonb,
      accommodation TEXT,
      transport TEXT,
      travel_companion_type TEXT NOT NULL DEFAULT 'solo',
      number_of_travelers INTEGER NOT NULL DEFAULT 1,
      estimated_costs JSONB NOT NULL DEFAULT '{}'::jsonb,
      day_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
      money_tips JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'saved',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      planned_travel_date TIMESTAMPTZ
    );

    ALTER TABLE itineraries
      ADD COLUMN IF NOT EXISTS rental_booking JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS rental_vehicle JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS tourist_places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      region TEXT NOT NULL,
      coordinates JSONB NOT NULL,
      categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      best_time_to_visit JSONB NOT NULL DEFAULT '{}'::jsonb,
      suitable_for JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommended_transport JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS place_distances (
      id TEXT PRIMARY KEY,
      from_place TEXT NOT NULL REFERENCES tourist_places(id) ON DELETE CASCADE,
      to_place TEXT NOT NULL REFERENCES tourist_places(id) ON DELETE CASCADE,
      from_name TEXT NOT NULL,
      to_name TEXT NOT NULL,
      straight_line_distance_km NUMERIC NOT NULL,
      estimated_road_distance_km NUMERIC NOT NULL,
      recommended_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
      distance_source TEXT NOT NULL DEFAULT 'coordinate_estimate',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (from_place, to_place)
    );

    CREATE INDEX IF NOT EXISTS idx_itineraries_user_created ON itineraries(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_itineraries_destination ON itineraries(destination);
    CREATE INDEX IF NOT EXISTS idx_tourist_places_location ON tourist_places(city, state);
    CREATE INDEX IF NOT EXISTS idx_tourist_places_region ON tourist_places(region);
    CREATE INDEX IF NOT EXISTS idx_place_distances_names ON place_distances(from_name, to_name);
    CREATE INDEX IF NOT EXISTS idx_place_distances_road_distance ON place_distances(estimated_road_distance_km);

    -- Persistent durable tables for token revocation and payment idempotency
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS payment_transactions (
      transaction_id VARCHAR(128) PRIMARY KEY,
      booking_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      amount NUMERIC NOT NULL,
      payment_method VARCHAR(32) NOT NULL,
      payment_plan VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'completed',
      idempotency_key VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking ON payment_transactions(booking_id);
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);

    -- Enable and Force Row Level Security (RLS) on user-owned tables
    ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE itineraries FORCE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users FORCE ROW LEVEL SECURITY;

    -- Strict fail-closed tenant isolation policies
    DO $$
    BEGIN
      DROP POLICY IF EXISTS itineraries_tenant_isolation ON itineraries;
      CREATE POLICY itineraries_tenant_isolation ON itineraries
        FOR ALL
        USING (
          user_id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        )
        WITH CHECK (
          user_id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        );

      DROP POLICY IF EXISTS users_insert_policy ON users;
      CREATE POLICY users_insert_policy ON users
        FOR INSERT
        WITH CHECK (true);

      DROP POLICY IF EXISTS users_tenant_isolation ON users;
      CREATE POLICY users_tenant_isolation ON users
        FOR SELECT
        USING (
          id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        );

      DROP POLICY IF EXISTS users_modify_isolation ON users;
      CREATE POLICY users_modify_isolation ON users
        FOR UPDATE
        USING (
          id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        )
        WITH CHECK (
          id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        );

      DROP POLICY IF EXISTS users_delete_isolation ON users;
      CREATE POLICY users_delete_isolation ON users
        FOR DELETE
        USING (
          id = NULLIF(current_setting('app.current_user_id', true), '')
          OR current_setting('app.is_admin', true) = 'true'
        );
    END
    $$;
  `);
};

const connectDB = async () => {
  try {
    await query('SELECT 1');
    await initializeSchema();
    connected = true;
    console.log('PostgreSQL connected successfully');
  } catch (err) {
    connected = false;
    console.error('PostgreSQL connection failed:', err.message);
    console.log('Running in demo mode without database');
  }
};

const isConnected = () => connected;

const closeDB = async () => {
  connected = false;
  await pool.end();
};

/**
 * Execute queries within a user-isolated PostgreSQL transaction with Row-Level Security
 * @param {string} userId
 * @param {Function} callback (client) => Promise<any>
 */
const withUserContext = async (userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Execute queries within a system/administrative PostgreSQL transaction
 * @param {Function} callback (client) => Promise<any>
 */
const withSystemContext = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_admin', 'true', true)");
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  connectDB,
  closeDB,
  isConnected,
  withUserContext,
  withSystemContext,
  pool
};
