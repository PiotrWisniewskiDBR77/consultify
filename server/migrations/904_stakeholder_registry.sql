-- Migration 904: Stakeholder Registry (Zwornik Delta A)
--
-- Zwornik Z95/#78 — SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §3.
--
-- PMBOK three-layer stakeholder model: identification (who/contact) is shared
-- per organization; assessment (influence/interest/expectations) is always
-- CONTEXTUAL to a specific engagement. This migration adds exactly that split
-- WITHOUT touching the existing `initiative_stakeholders` table (335), which
-- keeps its live CRUD + RACI + notifications (InitiativeController.ts:5000-5200,
-- pmo/initiatives.routes.ts:2743-2745) untouched.
--
-- 1. `stakeholder_registry`  — identity, once per org (PMBOK identification).
-- 2. `stakeholder_engagements` — RACI/influence/interest per context
--    (project_id NULL = org-level baseline, project_id SET = project-level),
--    modeled after the `decisions` FK-ladder pattern (000_initdb_core_tables.sql).
-- 3. `initiative_stakeholders.registry_id` — links the existing initiative-level
--    rows to the registry, plus a backfill of distinct stakeholders already
--    recorded on initiatives.
--
-- Idempotent: every statement uses IF NOT EXISTS / guarded backfill so this is
-- safe to re-run. Written for review — NOT executed by this task; run via
-- skill `consultify-promocja-demo` after Piotr's review.

-- ============================================================================
-- 1. stakeholder_registry — identity (§3.2 table 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stakeholder_registry (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    external_name TEXT,
    external_email TEXT,
    org_unit TEXT,
    category TEXT DEFAULT 'INTERNAL' CHECK (
      category IN ('INTERNAL', 'EXTERNAL', 'CLIENT', 'REGULATOR', 'PARTNER', 'OTHER')
    ),
    default_influence INTEGER CHECK (default_influence IS NULL OR (default_influence BETWEEN 1 AND 5)),
    default_interest INTEGER CHECK (default_interest IS NULL OR (default_interest BETWEEN 1 AND 5)),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    -- identity must be resolvable: a system user OR an external name.
    CONSTRAINT stakeholder_registry_identity_chk CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_registry_org ON stakeholder_registry(organization_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_registry_user ON stakeholder_registry(user_id);

-- Anti-duplicate: at most one registry row per (org, user) and per (org, external_email).
-- Partial indexes because NULL columns don't collide under a plain UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stakeholder_registry_org_user
  ON stakeholder_registry(organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stakeholder_registry_org_email
  ON stakeholder_registry(organization_id, external_email)
  WHERE user_id IS NULL AND external_email IS NOT NULL;

-- ============================================================================
-- 2. stakeholder_engagements — assessment per context (§3.2 table 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stakeholder_engagements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stakeholder_id TEXT NOT NULL,
    project_id TEXT,
    role TEXT,
    raci_type TEXT CHECK (raci_type IS NULL OR raci_type IN ('R', 'A', 'C', 'I')),
    influence_level INTEGER NOT NULL DEFAULT 3 CHECK (influence_level BETWEEN 1 AND 5),
    interest_level INTEGER NOT NULL DEFAULT 3 CHECK (interest_level BETWEEN 1 AND 5),
    engagement_status TEXT CHECK (
      engagement_status IS NULL OR
      engagement_status IN ('UNAWARE', 'RESISTANT', 'NEUTRAL', 'SUPPORTIVE', 'LEADING')
    ),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholder_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_engagements_org ON stakeholder_engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_engagements_stakeholder ON stakeholder_engagements(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_engagements_project ON stakeholder_engagements(project_id);

-- One engagement per (stakeholder, project) at project level, and one
-- org-level baseline engagement (project_id NULL) per stakeholder.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stakeholder_engagements_project
  ON stakeholder_engagements(stakeholder_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stakeholder_engagements_org_level
  ON stakeholder_engagements(stakeholder_id) WHERE project_id IS NULL;

-- ============================================================================
-- 3. initiative_stakeholders.registry_id — link existing rows to the registry
-- ============================================================================
ALTER TABLE initiative_stakeholders ADD COLUMN IF NOT EXISTS registry_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_initiative_stakeholders_registry'
      AND table_name = 'initiative_stakeholders'
  ) THEN
    ALTER TABLE initiative_stakeholders
      ADD CONSTRAINT fk_initiative_stakeholders_registry
      FOREIGN KEY (registry_id) REFERENCES stakeholder_registry(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft: never let an FK add block the run (e.g. legacy orphan data).
  RAISE NOTICE 'migration 904: FK fk_initiative_stakeholders_registry skipped/failed (ignored): %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_registry ON initiative_stakeholders(registry_id);

-- ----------------------------------------------------------------------------
-- Backfill: distinct stakeholders already recorded on initiatives become
-- registry rows (identification layer), then initiative_stakeholders rows are
-- linked back via registry_id. Org is resolved via the parent initiative.
-- Guarded by the partial unique indexes above (ON CONFLICT DO NOTHING), so
-- this is safe to re-run.
-- ----------------------------------------------------------------------------

-- 3a. Backfill registry rows for user-identified stakeholders.
INSERT INTO stakeholder_registry (id, organization_id, user_id, category, created_by, created_at)
SELECT DISTINCT ON (i.organization_id, s.user_id)
  gen_random_uuid()::text,
  i.organization_id,
  s.user_id,
  'INTERNAL',
  s.created_by,
  CURRENT_TIMESTAMP
FROM initiative_stakeholders s
JOIN initiatives i ON i.id = s.initiative_id
WHERE s.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- 3b. Backfill registry rows for external-identified stakeholders (no user_id).
INSERT INTO stakeholder_registry (id, organization_id, external_name, external_email, category, created_by, created_at)
SELECT DISTINCT ON (i.organization_id, s.external_email)
  gen_random_uuid()::text,
  i.organization_id,
  s.external_name,
  s.external_email,
  'EXTERNAL',
  s.created_by,
  CURRENT_TIMESTAMP
FROM initiative_stakeholders s
JOIN initiatives i ON i.id = s.initiative_id
WHERE s.user_id IS NULL AND s.external_email IS NOT NULL
ON CONFLICT (organization_id, external_email) WHERE user_id IS NULL AND external_email IS NOT NULL DO NOTHING;

-- 3c. Link initiative_stakeholders rows back to the registry (user_id match).
UPDATE initiative_stakeholders s
SET registry_id = r.id
FROM initiatives i, stakeholder_registry r
WHERE i.id = s.initiative_id
  AND s.registry_id IS NULL
  AND s.user_id IS NOT NULL
  AND r.organization_id = i.organization_id
  AND r.user_id = s.user_id;

-- 3d. Link initiative_stakeholders rows back to the registry (external_email match).
UPDATE initiative_stakeholders s
SET registry_id = r.id
FROM initiatives i, stakeholder_registry r
WHERE i.id = s.initiative_id
  AND s.registry_id IS NULL
  AND s.user_id IS NULL
  AND s.external_email IS NOT NULL
  AND r.organization_id = i.organization_id
  AND r.user_id IS NULL
  AND r.external_email = s.external_email;
