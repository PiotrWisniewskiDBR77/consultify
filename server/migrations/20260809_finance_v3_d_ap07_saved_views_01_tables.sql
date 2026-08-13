-- Finance v3 — Gate D (AP-07): saved views (personal/team) + shareable URL.
--
-- Source: docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md section 3
-- point 7 ("Filtry i saved views: category, quality, missing, changed, materiality, source, owner,
-- downstream use, entity, period; personal/team views i shareable URL").
--
-- Foundation reused, not reinvented (CLAUDE.md hard rule): this table persists exactly the two
-- shapes AP-01/AP-00 already designed and deliberately left unpersisted —
--   1. `GridViewState`'s `GridViewStateSnapshot` (server/src/services/finance/grid/GridViewState.ts,
--      `toJSON()`/`fromJSON()` — that file's header says in-memory-only "AP-07 could serialize into
--      a saved view row" is exactly this table).
--   2. `FinanceGridFilterState`'s `raw: Record<string, unknown>` opaque bag
--      (server/src/types/finance/WorkspaceState.ts — "AP-07 (Filters/saved views ... not yet
--      designed) owns that shape"). `savedViewService.ts` is where that shape gets designed: a
--      typed, discriminated-union filter set (see that file), not another opaque bag — the task
--      brief is explicit ("Filtry jako ustrukturyzowany JSON (nie wolna forma)").
-- Neither shape gets its own migration; both are serialized together into ONE `view_state` JSONB
-- column here, mirroring how `finance_comments.anchor` stores a whole AP-00 CellRef verbatim
-- (20260809_finance_v3_d_ap06_comments_01_tables.sql) rather than exploding it into columns.
--
-- `artifact_id` is NOT in the task brief's literal column list, but is added here deliberately:
-- the task's own acceptance scenario ("zapisz personal view ... dla GoldCo Analysis") saves a view
-- FOR one concrete artifact, not for every HISTORICAL_ANALYSIS artifact an organization will ever
-- have — and the shareable-URL requirement ("token widoku nie omija authorization na dane") needs a
-- concrete artifact to check authorization against when the token is resolved. `artifact_type` is
-- kept too (as the task brief lists it) — it is a denormalized copy of
-- `finance_artifacts.artifact_type` for the same artifact_id, cheap to keep in sync at write time
-- (savedViewService.ts derives it FROM the artifact row, never trusts a caller-supplied value) and
-- lets a listing query filter/label views without a join.
--
-- Additive only. Does not modify, rename or drop any existing table. One new table:
--   finance_saved_views — one row per saved view. Mutable (name/view_state edited in place by the
--   owner — see savedViewService.ts's "only the owner may write, scope only gates read visibility"
--   decision), unlike finance_comment_assignments' append-only history, because a saved view has no
--   audit/compliance requirement to reconstruct "what did this view look like at time T" the way a
--   comment (re)assignment does.

BEGIN;

CREATE TABLE IF NOT EXISTS finance_saved_views (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id    TEXT NOT NULL REFERENCES organizations(id),

  artifact_id        TEXT NOT NULL,
  artifact_type      TEXT NOT NULL CHECK (artifact_type IN (
                        'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                        'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                      )),

  -- PERSONAL: visible/editable only to owner_user_id. TEAM: visible to every member of
  -- organization_id (the service layer trusts organization_id is already the authenticated
  -- caller's own org — same convention as finance_comments/finance_exceptions — and does not
  -- re-verify org membership itself); editable only to owner_user_id regardless of scope (see
  -- savedViewService.ts header).
  scope              TEXT NOT NULL CHECK (scope IN ('PERSONAL', 'TEAM')),
  owner_user_id      TEXT NOT NULL,

  name               TEXT NOT NULL CHECK (length(btrim(name)) > 0),

  -- { schemaVersion: 1, gridViewState: GridViewStateSnapshot, filters: SavedViewFilter[] } —
  -- see savedViewService.ts's FinanceSavedViewStateSchema for the validated shape written here.
  view_state         JSONB NOT NULL,

  -- Opaque, unguessable, URL-safe (server/src/services/finance/canonical/savedViewService.ts
  -- generates via crypto.randomBytes(24).toString('base64url')). Globally unique across every
  -- organization/scope so a bare token is enough to look the row up; savedViewService.ts's
  -- resolveSharedView() is the ONLY place that is allowed to query by share_token alone — every
  -- other reader/writer here goes through organization_id (+ owner_user_id for PERSONAL) first.
  share_token        TEXT NOT NULL,

  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_saved_views_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_saved_views_share_token UNIQUE (share_token)
);

-- Personal-views listing: "my views on this artifact".
CREATE INDEX IF NOT EXISTS idx_finance_saved_views_personal
  ON finance_saved_views (organization_id, artifact_id, owner_user_id)
  WHERE scope = 'PERSONAL';

-- Team-views listing: "every team view on this artifact" (any org member may read all of these).
CREATE INDEX IF NOT EXISTS idx_finance_saved_views_team
  ON finance_saved_views (organization_id, artifact_id)
  WHERE scope = 'TEAM';

-- "All views I own, across artifacts" (management/cleanup UI).
CREATE INDEX IF NOT EXISTS idx_finance_saved_views_owner
  ON finance_saved_views (organization_id, owner_user_id);

CREATE OR REPLACE FUNCTION finance_saved_views_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_saved_views_touch_updated_at ON finance_saved_views;
CREATE TRIGGER trg_finance_saved_views_touch_updated_at
  BEFORE UPDATE ON finance_saved_views
  FOR EACH ROW EXECUTE FUNCTION finance_saved_views_touch_updated_at();

COMMIT;
