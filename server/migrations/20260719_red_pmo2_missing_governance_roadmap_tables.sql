-- RED-PMO2 (2026-07-19) — additive, idempotent recreation of three PMO tables
-- that exist only in the migrations-v2 baseline dump but were never created on
-- demo/parity by the live migration runner.
--
-- The live runner (server/src/database/DatabaseInitializer.ts) only picks up
-- files matching /^(7\d{2}|\d{8})_.*\.sql$/, so the canonical DDL in
-- server/migrations-v2/001_baseline_20260413.sql never runs there. As a result
-- these GET endpoints throw 42P01 "relation ... does not exist" (schema-500):
--
--   GET /api/governance/change-requests   -> change_requests        (42P01)
--   GET /api/governance/policies          -> governance_policies    (42P01)
--   GET /api/roadmap/:projectId/waves     -> roadmap_waves          (42P01)
--   GET /api/roadmap/:projectId/summary   -> roadmap_waves          (42P01)
--
-- Column shapes below are copied verbatim from the baseline dump
-- (server/migrations-v2/001_baseline_20260413.sql) so this migration is a
-- faithful, additive recreation — no drift, no destructive change. Every
-- statement is IF NOT EXISTS / catalog-guarded and safe to re-run.

-- change_requests (baseline line 8038) --------------------------------------
CREATE TABLE IF NOT EXISTS change_requests (
    id text NOT NULL,
    organization_id text NOT NULL,
    project_id text,
    requester_id text NOT NULL,
    title text NOT NULL,
    description text,
    reason text,
    impact text,
    status text DEFAULT 'PENDING',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_requests_pkey') THEN
    ALTER TABLE change_requests ADD CONSTRAINT change_requests_pkey PRIMARY KEY (id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_change_requests_org ON change_requests (organization_id);

-- governance_policies (baseline line 14253) ---------------------------------
CREATE TABLE IF NOT EXISTS governance_policies (
    id text NOT NULL,
    organization_id text,
    name text NOT NULL,
    description text,
    rules text,
    is_active bigint DEFAULT 1,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_policies_pkey') THEN
    ALTER TABLE governance_policies ADD CONSTRAINT governance_policies_pkey PRIMARY KEY (id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_governance_policies_org ON governance_policies (organization_id);

-- roadmap_waves (baseline line 25929) ---------------------------------------
CREATE TABLE IF NOT EXISTS roadmap_waves (
    id text NOT NULL,
    organization_id text NOT NULL,
    project_id text NOT NULL,
    name text NOT NULL,
    description text,
    start_date text,
    end_date text,
    sequence_order bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roadmap_waves_pkey') THEN
    ALTER TABLE roadmap_waves ADD CONSTRAINT roadmap_waves_pkey PRIMARY KEY (id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_roadmap_waves_project ON roadmap_waves (project_id, organization_id);
