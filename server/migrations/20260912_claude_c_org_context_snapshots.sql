-- Lane C (closure) — ORG-BVP-001 / ORG-OPS-001: governed organization-context
-- snapshot spine — proposal (claim) -> human approval -> IMMUTABLE, versioned,
-- hash-bound snapshot, with exact source refs.
--
-- ── WHY THIS EXISTS (reproduced gaps, not preemptive design) ───────────────
-- Read-only inventory of `OrganizationContextService.ts` (this branch) found:
--   1. `organization_context_snapshots` PK = organization_id (ONE row per
--      org) and `rebuildSnapshot()` does an in-place UPDATE — structurally
--      cannot hold history, and is not immutable. `snapshot_json` is also
--      write-only: no consumer ever SELECTs it (every consumer recomputes
--      `buildResolvedContext()` live).
--   2. `recordContextSource()` hard-codes `organization_context_claims.status
--      = 'active'`, and (until this same lane's service change) defaulted
--      `review_status` to `'accepted'` at INSERT time — a claim was
--      auto-accepted the moment it was created; no endpoint ever transitioned
--      a claim's review state.
--   3. Claims carry no exact ref: `evidence.documentExtraction` claims store
--      `docId`/`filename`/`mimeType`/`snippet` but never
--      `knowledge_docs.file_hash` or `.version`, so a claim cites "this
--      document", never "this exact version of these exact bytes".
--   4. `organization_context_items.visibility_scope` is written but never
--      used as a read filter.
--
-- What this migration is NOT: it does not touch `organization_context_items`,
-- `organization_context_claims`, or `organization_context_snapshots` at all
-- (no ALTER, no FK to any of them) — the existing mutable/live path
-- (`rebuildSnapshot` / `buildResolvedContext`) keeps working unchanged, per
-- the closure task's explicit "never destructively alter the existing
-- mutable snapshot table" constraint. This adds a parallel, ADDITIVE
-- governance spine: an explicit claim-review ledger, plus an append-only,
-- hash-bound, versioned snapshot table that only ever receives claims which
-- passed that review.
--
-- ── FRESH-DB GUARD (migration-ordering trap) ────────────────────────────────
-- `migrate.postgres.ts` applies migrations in plain FILENAME STRING sort
-- order, not chronological order ('2' < '7'/'8'/'9', so every `2026*` file
-- runs BEFORE every 3-digit `7xx/8xx/9xx` file on a from-zero replay) — see
-- `server/migrations/20260802_mat010_artifact_lineage.sql:22-33` for the
-- fully worked example of this trap and its fix. This file is IMMUNE by
-- construction: it creates only NEW tables (IF NOT EXISTS) and adds NO
-- foreign key to `organizations`, `knowledge_docs`,
-- `organization_context_claims`, `organization_context_items`, or anything
-- else created elsewhere — exactly the same no-FK idiom already used by
-- `v8_artifact_origin_links` (no FK to `v8_output_artifacts`) and by this
-- lane's own `20260912_claude_c_handoff_spine.sql`. Application code joins
-- to `organization_context_claims.id` / `knowledge_docs.id` by plain TEXT
-- equality, never a DB-level FK.
--
-- Every statement is IF NOT EXISTS / CREATE-OR-REPLACE, so re-running is a
-- no-op (verified by fresh + repeat + --dry-run runs, see closure report).

-- ── Claim review ledger (mutable — this is the governance decision log,
--    NOT the immutable snapshot) ───────────────────────────────────────────
-- One row per claim that has ever received an explicit human decision.
-- Absence of a row means "no explicit decision yet" — the application layer
-- (`OrganizationContextService.resolveClaimApproval`) resolves that case
-- against the claim's own legacy `review_status` column for backward
-- compatibility (pre-governance rows keep their auto-accepted history
-- un-rewritten; see the service file's header comment for the exact rule).
CREATE TABLE IF NOT EXISTS organization_context_claim_reviews (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  claim_id         TEXT NOT NULL,
  review_state     TEXT NOT NULL DEFAULT 'pending'
                     CONSTRAINT ck_occr_review_state
                     CHECK (review_state IN ('pending', 'approved', 'rejected')),
  decided_by       TEXT,
  decided_at       TIMESTAMP,
  decision_note    TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Exactly one review row per claim — this is also the concurrency arbiter:
-- `INSERT ... ON CONFLICT (claim_id) DO UPDATE ... WHERE review_state =
-- 'pending'` lets Postgres serialize two simultaneous approve/reject calls
-- for the same claim so only the first to observe 'pending' (or the absence
-- of a row) can transition it; the loser's guarded UPDATE affects 0 rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_occr_claim_id
  ON organization_context_claim_reviews(claim_id);

CREATE INDEX IF NOT EXISTS idx_occr_org_state
  ON organization_context_claim_reviews(organization_id, review_state);

-- ── Immutable, versioned, hash-bound snapshot ───────────────────────────────
-- One row per PUBLISHED version. Never UPDATEd by application code (the
-- service only INSERTs); a BEFORE UPDATE trigger below additionally makes
-- that a DB-level guarantee, not just an app-code convention. DELETE remains
-- possible (used only by test fixture teardown / deliberate admin purge) —
-- deletion removes a row wholesale, it cannot silently corrupt its content,
-- which is the specific hazard this table exists to prevent.
CREATE TABLE IF NOT EXISTS organization_context_snapshot_versions (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  version           INTEGER NOT NULL,
  schema_version    INTEGER NOT NULL DEFAULT 1,
  -- sha256 hex digest of the canonicalized (recursively key-sorted) JSON of
  -- {organizationId, schemaVersion, claims[]} — see
  -- `OrganizationContextService.computeContentHash`. Length-64 check catches
  -- an accidental non-hash value at INSERT time.
  content_hash      TEXT NOT NULL
                      CONSTRAINT ck_ocsv_content_hash_present
                      CHECK (content_hash IS NOT NULL AND length(content_hash) = 64),
  claim_count       INTEGER NOT NULL DEFAULT 0,
  -- The exact payload `content_hash` was computed over (approved claims,
  -- canonical order) — re-hashing this column must always reproduce
  -- `content_hash`; the realDB test suite asserts that.
  snapshot_json     TEXT NOT NULL,
  -- Exact source refs per contributing claim: claim id, item id, source
  -- type, and — for document-extraction claims — the source document id
  -- plus `knowledge_docs.file_hash`/`.version` AS THEY WERE AT PUBLISH TIME
  -- (frozen copies, so a later edit or hard-delete of the source document
  -- cannot change what this row says it was built from — see the read path
  -- for how a stale/dangling ref is DETECTED, not silently ignored).
  source_refs_json  TEXT NOT NULL DEFAULT '[]',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT NOT NULL
);

-- DB-level guarantee #1: no two published versions of the same organization
-- can share a version number (the "pinned version N" contract depends on
-- this being unique, not just conventionally incrementing).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocsv_org_version
  ON organization_context_snapshot_versions(organization_id, version);

CREATE INDEX IF NOT EXISTS idx_ocsv_org_created
  ON organization_context_snapshot_versions(organization_id, created_at DESC);

-- DB-level guarantee #2: a published version cannot be mutated in place.
-- This IS enforceable in Postgres (a BEFORE UPDATE trigger that always
-- raises) and is stronger than the app-code discipline of "the service only
-- ever INSERTs" — even a future bug, a raw `psql` UPDATE, or a different
-- service reusing this table cannot silently rewrite a published row.
-- What is NOT enforced at the DB level (documented, not silently assumed):
--   * DELETE is still possible (see table comment above) — this trigger
--     guards against MUTATION (content changing while the row keeps
--     existing under the same identity), not against removal of the row.
--   * Nothing stops a second, different snapshot mechanism outside this
--     table from being introduced later; this trigger only protects rows
--     that live in `organization_context_snapshot_versions` itself.
CREATE OR REPLACE FUNCTION claude_c_org_context_snapshot_versions_block_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'organization_context_snapshot_versions is append-only: UPDATE on org % version % is not permitted — publish a new version instead.',
    OLD.organization_id, OLD.version
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocsv_block_update ON organization_context_snapshot_versions;
CREATE TRIGGER trg_ocsv_block_update
  BEFORE UPDATE ON organization_context_snapshot_versions
  FOR EACH ROW EXECUTE FUNCTION claude_c_org_context_snapshot_versions_block_update();
