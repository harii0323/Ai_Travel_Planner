const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/ai_travel_planner';

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_TIMEOUT || '30000', 10),
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined
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

module.exports = {
  query,
  connectDB,
  closeDB,
  isConnected
};
