-- ==============================================================
-- AI Travel Planner - Enterprise Row-Level Security (RLS) & State Migration
-- Target: PostgreSQL 13+
-- Description: Enforces strict fail-closed tenant isolation at the database layer.
-- ==============================================================

-- 1. Create tables for durable security mechanisms (JWT revocation & Payment idempotency)
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

-- 2. Enable and FORCE Row Level Security on user-owned tables
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- 3. Create least-privilege application runtime role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'travel_app_runtime') THEN
    CREATE ROLE travel_app_runtime WITH LOGIN PASSWORD 'CHANGE_IN_PRODUCTION_SECRET';
  ELSE
    ALTER ROLE travel_app_runtime NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- Grant minimal necessary table privileges to application runtime role
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO travel_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON itineraries TO travel_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON revoked_tokens TO travel_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_transactions TO travel_app_runtime;
GRANT SELECT ON tourist_places TO travel_app_runtime;
GRANT SELECT ON place_distances TO travel_app_runtime;

-- Ensure runtime role cannot bypass RLS
ALTER ROLE travel_app_runtime NOBYPASSRLS;

-- 4. Row-Level Security Policy for 'itineraries' (STRICT FAIL-CLOSED)
-- Unauthenticated queries or missing context return 0 rows.
DROP POLICY IF EXISTS itineraries_tenant_isolation ON itineraries;

CREATE POLICY itineraries_tenant_isolation ON itineraries
  FOR ALL
  TO travel_app_runtime, public
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  );

-- 5. Row-Level Security Policy for 'users'
-- Users can only read and modify their own account profile.
-- System authentication (login lookup) executes under app.is_admin = 'true'.
DROP POLICY IF EXISTS users_tenant_isolation ON users;
DROP POLICY IF EXISTS users_insert_policy ON users;

CREATE POLICY users_insert_policy ON users
  FOR INSERT
  TO travel_app_runtime, public
  WITH CHECK (true);

CREATE POLICY users_tenant_isolation ON users
  FOR SELECT
  TO travel_app_runtime, public
  USING (
    id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  );

CREATE POLICY users_modify_isolation ON users
  FOR UPDATE
  TO travel_app_runtime, public
  USING (
    id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  );

CREATE POLICY users_delete_isolation ON users
  FOR DELETE
  TO travel_app_runtime, public
  USING (
    id = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.is_admin', true) = 'true'
  );
