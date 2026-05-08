-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('client', 'admin')),
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_address TEXT,
  phone           VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- APP SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- MATERIALS & PRICING
-- ============================================================

CREATE TABLE IF NOT EXISTS material_categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id        INTEGER NOT NULL REFERENCES material_categories(id),
  manufacturer       VARCHAR(100),
  name               VARCHAR(255) NOT NULL,
  unit               VARCHAR(20) NOT NULL,          -- SQ, RL, BD, PC, EA, BX
  unit_price         NUMERIC(10,4) NOT NULL,
  coverage_sq        NUMERIC(10,4),                  -- square coverage per unit (for underlayment/IWS)
  lf_per_unit        NUMERIC(10,2),                  -- linear feet per unit (for starter, H&R, drip edge)
  is_default         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_address TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ESTIMATES
-- ============================================================

CREATE TABLE IF NOT EXISTS estimates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_number  VARCHAR(50) NOT NULL UNIQUE,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted')),
  estimate_type    VARCHAR(20) NOT NULL DEFAULT 'calculated' CHECK (estimate_type IN ('calculated', 'assisted')),
  is_reroof        BOOLEAN NOT NULL DEFAULT FALSE,
  tearoff_layers   INTEGER DEFAULT 1,
  overhead_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  profit_percent   NUMERIC(5,2) NOT NULL DEFAULT 35.00,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS estimate_number_seq START 1000;

-- ============================================================
-- TAKEOFF DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS takeoffs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id   UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  plan_type     VARCHAR(20) CHECK (plan_type IN ('roof_plan', 'floor_plan')),
  roof_style    VARCHAR(20) CHECK (roof_style IN ('gable', 'hip', 'combination')),
  scale_ratio   VARCHAR(100),
  plan_file_url TEXT,
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(estimate_id)
);

CREATE TABLE IF NOT EXISTS roof_planes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id          UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  plane_label         VARCHAR(50),
  horizontal_length   NUMERIC(10,2),
  horizontal_width    NUMERIC(10,2),
  horizontal_area     NUMERIC(10,2),
  pitch_numerator     INTEGER NOT NULL DEFAULT 6,   -- e.g. 6 for 6/12
  slope_factor        NUMERIC(6,4),
  actual_surface_area NUMERIC(10,2),
  display_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS takeoff_linear_footage (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  takeoff_id  UUID NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  eave_lf     NUMERIC(10,2) NOT NULL DEFAULT 0,
  rake_lf     NUMERIC(10,2) NOT NULL DEFAULT 0,
  hip_lf      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ridge_lf    NUMERIC(10,2) NOT NULL DEFAULT 0,
  valley_lf   NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(takeoff_id)
);

-- ============================================================
-- ESTIMATE LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id         UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  line_type           VARCHAR(50) NOT NULL CHECK (line_type IN (
                        'field_shingles', 'underlayment', 'ice_water_shield',
                        'starter', 'drip_edge', 'hip_ridge',
                        'labor', 'tearoff'
                      )),
  material_id         UUID REFERENCES materials(id) ON DELETE RESTRICT,
  description         TEXT NOT NULL,
  quantity            NUMERIC(10,4) NOT NULL,
  unit                VARCHAR(20) NOT NULL,
  unit_price          NUMERIC(10,4) NOT NULL,
  total_price         NUMERIC(12,2) NOT NULL,
  is_manual_override  BOOLEAN NOT NULL DEFAULT FALSE,
  display_order       INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB,                        -- pitch tier breakdown, etc.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_client_id   ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status     ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_line_items_estimate  ON estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_materials_category   ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_roof_planes_takeoff  ON roof_planes(takeoff_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'client_profiles', 'materials', 'projects',
    'estimates', 'takeoffs', 'estimate_line_items'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
