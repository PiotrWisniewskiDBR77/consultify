-- 20260602 — My Work — Notebook containers (Notatniki)
--
-- Adds the missing container level above notebook_pages, per
-- docs/product/NOTEBOOK_STRUCTURE_SSOT.md.
--
-- Hierarchy: Notatki (L1 list of notebooks) -> Notebook workspace (L2)
--            -> note card (L3, existing notebook_pages row).
--
-- Two independent axes on the container:
--   scope            : who can open/edit  ('personal' | 'team', team_id required when team)
--   context_sharing  : whether content feeds org AI context ('private' default | 'org_context')
--
-- A notebook is owned by a person (owner_user_id) and is cross-project:
-- it is intentionally NOT bound to a project_id. Project stays at most a
-- per-note tag on the L3 page.
--
-- Additive + idempotent. Schema-tolerant readers default notebook_id to the
-- owner's default notebook when the column is absent.

-- ============================================================
-- CONTAINER TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notebooks (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  title             TEXT NOT NULL,
  icon              TEXT,
  scope             TEXT NOT NULL DEFAULT 'personal',   -- personal | team
  team_id           TEXT,                               -- required when scope='team'
  context_sharing   TEXT NOT NULL DEFAULT 'private',    -- private | org_context
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notebooks_owner ON notebooks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_org ON notebooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_team ON notebooks(team_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON notebooks(updated_at);

-- ============================================================
-- LINK PAGES -> NOTEBOOK
-- ============================================================

ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS notebook_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notebook_pages_notebook ON notebook_pages(notebook_id);

-- ============================================================
-- BACKFILL — default personal notebook per (org, owner)
-- ============================================================
-- Deterministic id keyed by org+owner makes this re-runnable (idempotent):
-- a second run inserts nothing new and leaves already-assigned pages intact.

INSERT INTO notebooks (id, owner_user_id, organization_id, title, scope, context_sharing)
SELECT DISTINCT
  'nb_default_' || np.organization_id || '_' || np.owner_user_id AS id,
  np.owner_user_id,
  np.organization_id,
  'Moje notatki',
  'personal',
  'private'
FROM notebook_pages np
WHERE np.notebook_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE notebook_pages
SET notebook_id = 'nb_default_' || organization_id || '_' || owner_user_id
WHERE notebook_id IS NULL;
