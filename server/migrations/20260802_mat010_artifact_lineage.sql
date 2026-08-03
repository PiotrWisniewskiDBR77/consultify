-- MAT-010 artifact lineage receipts (2026-08-02).
--
-- ONE canonical, tenant-scoped receipt per artifact lifecycle, spanning all
-- three artifact types (Documents / Workbooks / Presentations), plus an
-- append-only child event log. See
-- `Harvard/wdrozenie-100/_MAT_010_DISCOVERY_GATE_2026-08-02.md` for the full
-- Phase-1 discovery that motivated this shape.
--
-- ── WHY A NEW TABLE PAIR IS ACTUALLY NEEDED (not preemptive) ───────────────
-- Discovery confirmed there is NO existing home for artifact-level lineage:
--   * `audit_events` is admin-scoped and carries no artifact identity column.
--   * `presentation_export_records` exists but is presentation-only; Workbook
--     and Document exports are recorded NOWHERE today.
--   * `presentation_deck_versions` / `generated_workbook_versions` /
--     `wave5_artifact_versions` are three different shapes in three tables —
--     which is precisely the "three tables, three shapes" problem MAT-010
--     exists to unify.
-- What is deliberately NOT duplicated here: artifact IDENTITY. All three types
-- already converge on `v8_output_artifacts.artifact_id` through
-- `artifactRegistryService.registerArtifactOrigin()`. This migration adds a
-- lineage layer that LINKS to that identity, never a second registry.
--
-- ── FRESH-DB GUARD (migration-ordering trap) ───────────────────────────────
-- `migrate.postgres.ts` applies migrations in plain FILENAME STRING sort
-- order, not chronological order ('2' < '7', so every `2026*` file runs before
-- every 3-digit `7xx/8xx/9xx` file on a from-zero replay). Both MAT-006 and
-- MAT-007/009 were bitten by this. This file is IMMUNE by construction: it
-- creates only NEW tables and adds NO foreign keys to `v8_output_artifacts`,
-- `generated_workbooks`, `presentation_decks` or `wave5_artifacts`, so it
-- depends on nothing having run before it. (Omitting the FKs also matches the
-- existing repo idiom — `v8_artifact_origin_links` likewise carries no FK to
-- `v8_output_artifacts`.) Verified by an actual `migrate.postgres.ts --safe`
-- run against a DROP'd + re-CREATE'd empty database, not by assumption.
--
-- Every statement is IF NOT EXISTS / DROP-then-ADD, so re-running is a no-op.

-- ── Receipt: one row per artifact lifecycle ────────────────────────────────
CREATE TABLE IF NOT EXISTS artifact_lineage_receipts (
  receipt_id            TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  -- Natural key part 2/3: which artifact family this receipt belongs to.
  artifact_kind         TEXT NOT NULL,
  -- Natural key part 3/3: the OWNER-TABLE id, which always exists the moment
  -- the artifact does (generated_workbooks.id / presentation_decks.id /
  -- wave5_artifacts.id). Never null — this is why the receipt is creatable
  -- even when the artifact registry registration failed or was skipped.
  source_record_id      TEXT NOT NULL,
  -- The canonical `v8_output_artifacts.artifact_id`, resolved through
  -- `v8_artifact_origin_links`. NULLABLE ON PURPOSE: registry registration is
  -- best-effort at all three call sites (fire-and-forget in Document Studio,
  -- try/catch-and-warn in Workbook), so it can legitimately be absent at
  -- receipt-creation time. Lazily backfilled on any later event or read.
  canonical_artifact_id TEXT,
  -- The `v8_artifact_origin_links.origin_runtime` value used for the lookup
  -- ('native_artifact' | 'sheet' | 'presentation'), kept for traceability.
  origin_runtime        TEXT,
  title_snapshot        TEXT,
  -- Source/context captured at creation (the head of the lineage chain).
  source_context_json   TEXT,
  created_by            TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_event_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_count           INTEGER NOT NULL DEFAULT 0
);

-- THE idempotency + anti-race guarantee. `INSERT ... ON CONFLICT DO NOTHING`
-- against this index is what makes "two near-simultaneous creation attempts
-- for the same artifact produce exactly one receipt" true by construction,
-- rather than by a caught-exception convention. This matters here because
-- `DbPromise.run()` defaults to `fallback: true` and SILENTLY swallows
-- constraint violations (root cause of the 180 orphaned template artifacts
-- documented at artifactRegistryService.ts:1275) — so MAT-010 must never
-- depend on seeing a constraint error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_lineage_receipt_natural
  ON artifact_lineage_receipts(organization_id, artifact_kind, source_record_id);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_receipt_org
  ON artifact_lineage_receipts(organization_id, last_event_at);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_receipt_canonical
  ON artifact_lineage_receipts(organization_id, canonical_artifact_id)
  WHERE canonical_artifact_id IS NOT NULL;

ALTER TABLE artifact_lineage_receipts
  DROP CONSTRAINT IF EXISTS artifact_lineage_receipts_kind_check;
ALTER TABLE artifact_lineage_receipts
  ADD CONSTRAINT artifact_lineage_receipts_kind_check
  CHECK (artifact_kind IN ('document', 'workbook', 'presentation'));

-- ── Event: append-only children of one receipt ─────────────────────────────
CREATE TABLE IF NOT EXISTS artifact_lineage_events (
  event_id        TEXT PRIMARY KEY,
  receipt_id      TEXT NOT NULL,
  -- Denormalized tenant column so every lineage read can be org-scoped in a
  -- single predicate without a join (established repo idiom — see
  -- `v8_artifact_origin_links.organization_id`).
  organization_id TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  -- NULL for `public_open`: an unauthenticated public reader has no actor.
  actor_user_id   TEXT,
  sequence_no     INTEGER NOT NULL,
  detail_json     TEXT,
  -- Retry-safety: a caller may pass a stable key so a network-retried request
  -- appends the event once, not twice.
  idempotency_key TEXT,
  occurred_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_lineage_event_idem
  ON artifact_lineage_events(receipt_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_event_receipt
  ON artifact_lineage_events(receipt_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_artifact_lineage_event_org
  ON artifact_lineage_events(organization_id, occurred_at);

ALTER TABLE artifact_lineage_events
  DROP CONSTRAINT IF EXISTS artifact_lineage_events_type_check;
ALTER TABLE artifact_lineage_events
  ADD CONSTRAINT artifact_lineage_events_type_check
  CHECK (
    event_type IN (
      'created',
      'version',
      'checkpoint',
      'restore',
      'export',
      'share_minted',
      'share_revoked',
      'public_open'
    )
  );
