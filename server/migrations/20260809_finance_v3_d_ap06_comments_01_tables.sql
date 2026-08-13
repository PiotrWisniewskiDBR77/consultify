-- Finance v3 — Gate D (AP-06): comments / review threads / assignments / review checklist.
--
-- Source: docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md section 3
-- point 6 ("Komentarze i review: komentarz do artefaktu/KPI/linii/komorki/okresu, mentions,
-- assign, resolve/reopen, blocking flag i review checklist") and section 3's "Krytyczna zmiana
-- priorytetow" (comments/review moved P2 -> P0/P1, must be designed together with mutations,
-- versions and audit rather than bolted on after the engines are done).
--
-- Foundation reused, not reinvented (CLAUDE.md hard rule): addressing uses AP-00's CellRef
-- (server/src/types/finance/CellRef.ts) JSON shape directly as the `anchor` payload rather than
-- inventing a parallel row/column addressing scheme; lifecycle/role model reuses WP-B02's
-- FinanceRole (preparer/reviewer/approver/finance_admin/viewer,
-- docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md section 7) —
-- this migration does not add its own role enum.
--
-- Additive only. Does not modify, rename or drop any existing table. Three new tables:
--
--   1. finance_comments            — one row per comment (mutable: resolve/reopen updates the
--                                     same row, unlike the append-only finance_exceptions ledger
--                                     WP-B05 uses for a different reason — exceptions need a full
--                                     event history for audit/dedup; a comment thread's lifecycle
--                                     is simpler: OPEN <-> RESOLVED, tracked by resolved_by/at).
--   2. finance_comment_assignments — one row per assign/reassign action (append semantics: a
--                                     reassignment INSERTs a new row rather than overwriting the
--                                     old one, so "who was this assigned to at time T" stays
--                                     answerable; "current assignee" = latest row by assigned_at).
--   3. finance_review_checklists   — one row per checklist item per business_version_id.
--
-- `anchor` (finance_comments.anchor, JSONB, nullable) — task brief: "komentarz do
-- artefaktu/KPI/linii/komorki/okresu". `NULL` = artifact-level comment. Non-null = a serialized
-- AP-00 CellRef (server/src/types/finance/CellRef.ts) addressing a specific cell, which — because
-- a CellRef's rowKey already carries canonicalLineId and its columnKey already carries periodId —
-- covers "line", "period" and "cell" anchors uniformly as one JSON shape (a comment anchored to
-- "a line" is a CellRef with that rowKey and the column the discussion is actually about; a
-- comment anchored to "a period" is symmetric). "KPI" anchors are deliberately NOT modeled here:
-- CellRef.ts's own header documents that its FinanceTableNameValues union has exactly one member
-- today (`finance_stmt_lines`) because no other Gate D domain table (e.g. WP-D03's
-- `finance_analysis_kpi_values`) has a CellRef branch yet — adding a KPI anchor kind here would
-- either invent a second, parallel addressing scheme (which the CellRef.ts header explicitly
-- warns against) or require a schema change to a file this work package does not own. When a
-- future work package adds a `finance_analysis_kpi_values` branch to CellRef's discriminated
-- union, `anchor` here needs no migration — it already stores whatever CellRef-shaped JSON is
-- current at insert time.

BEGIN;

-- 1. finance_comments — comment/review threads.
CREATE TABLE IF NOT EXISTS finance_comments (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL REFERENCES organizations(id),
  artifact_id           TEXT NOT NULL,
  business_version_id   TEXT NOT NULL,

  -- NULL = artifact-level comment; non-NULL = a serialized AP-00 CellRef (see file header).
  anchor                JSONB,

  author_id             TEXT NOT NULL,
  body                  TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  mentions              TEXT[] NOT NULL DEFAULT '{}',

  -- WP-B02 5.1's approval gate reads this flag directly (artifactVersionService.approveVersion()
  -- step (a3b)): an unresolved is_blocking=true row on the SAME business_version_id must reject
  -- approve with APPROVAL_BLOCKED, mirroring the existing SECURITY-exception check at (a3).
  is_blocking           BOOLEAN NOT NULL DEFAULT false,

  resolved_by           TEXT,
  resolved_at           TIMESTAMPTZ,

  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_comments_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_finance_comments_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- resolved_by and resolved_at are set/cleared together (resolve sets both, reopen clears both).
  CONSTRAINT chk_finance_comments_resolved_pair
    CHECK ((resolved_by IS NULL) = (resolved_at IS NULL))
);

-- The exact lookup approveVersion() step (a3b) runs: "does business_version_id X have an
-- unresolved blocking comment". Partial index keeps that check O(1)-ish even with a large
-- resolved-comment history.
CREATE INDEX IF NOT EXISTS idx_finance_comments_blocking_open
  ON finance_comments (organization_id, business_version_id)
  WHERE is_blocking AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_comments_artifact ON finance_comments(artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_comments_bv ON finance_comments(business_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_comments_mentions ON finance_comments USING GIN (mentions);

-- Anchor-scoped lookup ("show me every comment on this exact cell") — GIN on the whole JSONB
-- doc is sufficient for the `anchor @> '{"rowKey": {...}}'` containment queries commentService.ts
-- uses; a cell has few enough comments that a full expression index per CellRef field is not
-- warranted yet.
CREATE INDEX IF NOT EXISTS idx_finance_comments_anchor ON finance_comments USING GIN (anchor);

CREATE OR REPLACE FUNCTION finance_comments_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_comments_touch_updated_at ON finance_comments;
CREATE TRIGGER trg_finance_comments_touch_updated_at
  BEFORE UPDATE ON finance_comments
  FOR EACH ROW EXECUTE FUNCTION finance_comments_touch_updated_at();

-- 2. finance_comment_assignments — assign/reassign history (append semantics; see file header).
CREATE TABLE IF NOT EXISTS finance_comment_assignments (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  comment_id     TEXT NOT NULL REFERENCES finance_comments(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),

  assignee_id     TEXT NOT NULL,
  due_date         DATE,

  assigned_by       TEXT NOT NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_comment_assignments_comment
  ON finance_comment_assignments(comment_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_comment_assignments_assignee
  ON finance_comment_assignments(organization_id, assignee_id, assigned_at DESC);

-- 3. finance_review_checklists — per-business-version review checklist items.
CREATE TABLE IF NOT EXISTS finance_review_checklists (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id      TEXT NOT NULL REFERENCES organizations(id),
  business_version_id  TEXT NOT NULL,

  item                 TEXT NOT NULL CHECK (length(btrim(item)) > 0),
  required             BOOLEAN NOT NULL DEFAULT true,

  checked_by           TEXT,
  checked_at           TIMESTAMPTZ,

  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_review_checklists_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_review_checklists_checked_pair
    CHECK ((checked_by IS NULL) = (checked_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_finance_review_checklists_bv
  ON finance_review_checklists(business_version_id, created_at);

COMMIT;
