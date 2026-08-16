-- Lane C (closure) — governed handoff spine: proposal -> human approval ->
-- EXACTLY-ONE artifact receipt, plus a hash-bound export receipt.
--
-- ── WHY THIS EXISTS (reproduced gaps, not preemptive design) ───────────────
-- Inventory of the four Lane C domains at product SHA 64f507859c found the
-- SAME missing spine in all of them, each rediscovered independently:
--
--   * Idea -> Document  (`my-work.routes.ts` `/my-ideas/:id/convert`):
--       no idempotency key, no content hash, no approval step, no receipt.
--       Calling it twice creates two `reports` rows and two
--       `my_idea_conversions` rows.
--   * Chat (Teresa):    `TeresaCommitRequest.idempotencyKey` is DECLARED in
--       `contracts/teresa.ts` but never read by `TeresaProposalService.commit`
--       — a dead field. Chat tools create downstream objects with no gate.
--   * Meeting:          no proposal/approval/idempotency concept exists at
--       all; `addMeetingDecision` appends to a JSON array and
--       `addMeetingFollowUp` INSERTs a fresh UUID on every retry.
--   * Materials export: `presentation_export_records` has no hash and no
--       idempotency key; Workbook and Document exports are recorded NOWHERE
--       (a gap `20260802_mat010_artifact_lineage.sql:12-13` already names).
--
-- The repo ALREADY contains the correct idiom, in exactly one place:
-- `944_canvas_idea_materialization_receipts.sql` — a partial unique index on
-- `(organization_id, idempotency_key)` used as both dedup ledger and
-- concurrent-winner arbiter. This migration generalizes that proven shape to
-- the producers above instead of inventing a fifth mechanism.
--
-- ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
-- NOT a second artifact registry, and NOT a replacement for any existing
-- per-type version/share/export mechanism. Artifact IDENTITY stays where it
-- is (`v8_output_artifacts` + `artifact_lineage_receipts`, MAT-010). This
-- adds only the governance edge those tables do not model: "who proposed
-- what, from which exact source bytes, who approved it, and what single
-- object did that produce".
--
-- ── FRESH-DB GUARD (migration-ordering trap) ──────────────────────────────
-- `migrate.postgres.ts` applies migrations in plain FILENAME STRING sort
-- order, not chronological order ('2' < '7', so every `2026*` file runs
-- BEFORE every 3-digit `7xx/8xx/9xx` file on a from-zero replay). MAT-006 and
-- MAT-007/009 were both bitten by this; `20260802_mat010_artifact_lineage.sql`
-- documents it. This file is IMMUNE by construction: it creates only NEW
-- tables and adds NO foreign key to `my_ideas`, `meetings`, `conversations`,
-- `generated_workbooks`, `presentation_decks`, `wave5_artifacts` or
-- `v8_output_artifacts`. The only FK is receipts -> proposals, both created
-- below in this same file, in order.
--
-- Every statement is IF NOT EXISTS / DROP-then-ADD, so re-running is a no-op
-- (verified by fresh + repeat + --dry-run strict runs).

-- ── Proposal: a producer asks for an object to be created ─────────────────
CREATE TABLE IF NOT EXISTS artifact_handoff_proposals (
  proposal_id         TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  -- Which lane-C surface proposed this. Chat/Meeting/Idea/Organization all
  -- PROPOSE; none of them may write a foreign owner table directly.
  producer_kind       TEXT NOT NULL,
  -- Stable source ID in the producer's own owner table (my_ideas.id,
  -- meetings.id, conversations.id, organization_context_versions.id).
  producer_record_id  TEXT NOT NULL,
  -- sha256 of the CANONICALIZED source payload at proposal time. This is the
  -- "stable source ID + hash" the closure contract requires: it pins WHICH
  -- bytes were approved, so a later edit to the source cannot silently change
  -- what a human signed off on.
  source_content_hash TEXT NOT NULL,
  -- Monotonic per (organization_id, producer_kind, producer_record_id).
  source_version      INTEGER NOT NULL DEFAULT 1,
  -- Payload schema version, so a consumer can refuse an unknown shape rather
  -- than mis-parse it.
  contract_version    TEXT NOT NULL DEFAULT 'v1',
  target_kind         TEXT NOT NULL,
  payload_json        TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'pending',
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The HUMAN who approved/rejected. Enforced NOT NULL for any decided state
  -- by the check constraint below — this is what makes "human approval"
  -- a database invariant rather than an application convention.
  decided_by          TEXT,
  decided_at          TIMESTAMPTZ,
  decision_reason     TEXT,
  -- Recorded, not forbidden: four-eyes is required for Materials approval
  -- (`document_approvals`, which already enforces it) but the frozen MVP
  -- decision for Chat/Meeting/Idea says only "a human approves creation".
  -- Storing this makes self-approval auditable instead of invisible.
  self_approved       BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key     TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same proven shape as idx_canvas_idea_receipts_org_idem: only rows WITH a
-- caller-supplied key participate in dedup, so callers that legitimately omit
-- it never collide. Two concurrent retries of the same key resolve to exactly
-- one winner here; the loser reads the winner's row and replays it.
-- The service checks for THIS index BY NAME to distinguish "a concurrent
-- winner claimed this key" from any other constraint violation — the name
-- below MUST stay in sync with `handoffSpineService.ts`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoff_proposal_org_idem
  ON artifact_handoff_proposals (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handoff_proposal_producer
  ON artifact_handoff_proposals (organization_id, producer_kind, producer_record_id);

CREATE INDEX IF NOT EXISTS idx_handoff_proposal_state
  ON artifact_handoff_proposals (organization_id, state, created_at DESC);

ALTER TABLE artifact_handoff_proposals
  DROP CONSTRAINT IF EXISTS artifact_handoff_proposals_producer_check;
ALTER TABLE artifact_handoff_proposals
  ADD CONSTRAINT artifact_handoff_proposals_producer_check
  CHECK (producer_kind IN ('idea', 'chat', 'meeting', 'organization'));

ALTER TABLE artifact_handoff_proposals
  DROP CONSTRAINT IF EXISTS artifact_handoff_proposals_target_check;
ALTER TABLE artifact_handoff_proposals
  ADD CONSTRAINT artifact_handoff_proposals_target_check
  CHECK (target_kind IN ('document', 'presentation', 'workbook', 'material'));

ALTER TABLE artifact_handoff_proposals
  DROP CONSTRAINT IF EXISTS artifact_handoff_proposals_state_check;
ALTER TABLE artifact_handoff_proposals
  ADD CONSTRAINT artifact_handoff_proposals_state_check
  CHECK (state IN ('pending', 'approved', 'rejected', 'materialized', 'failed'));

-- The human-approval invariant: no proposal may leave 'pending' without a
-- recorded deciding actor. A service bug cannot produce an approved-but-
-- unattributed proposal; the INSERT/UPDATE simply fails.
ALTER TABLE artifact_handoff_proposals
  DROP CONSTRAINT IF EXISTS artifact_handoff_proposals_decider_check;
ALTER TABLE artifact_handoff_proposals
  ADD CONSTRAINT artifact_handoff_proposals_decider_check
  CHECK (state = 'pending' OR state = 'failed' OR decided_by IS NOT NULL);

-- ── Receipt: proof that an approved proposal produced EXACTLY ONE object ──
CREATE TABLE IF NOT EXISTS artifact_handoff_receipts (
  receipt_id          TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  proposal_id         TEXT NOT NULL
    REFERENCES artifact_handoff_proposals (proposal_id) ON DELETE RESTRICT,
  target_kind         TEXT NOT NULL,
  -- The id in the target owner table that this proposal produced.
  target_record_id    TEXT NOT NULL,
  -- sha256 of the materialized object at creation time.
  output_content_hash TEXT,
  materialized_by     TEXT NOT NULL,
  materialized_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXACTLY-ONE, enforced by the database rather than by application care:
-- one approved proposal can never yield a second object, no matter how many
-- times approval/materialization is retried or raced.
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoff_receipt_proposal_unique
  ON artifact_handoff_receipts (proposal_id);

CREATE INDEX IF NOT EXISTS idx_handoff_receipt_target
  ON artifact_handoff_receipts (organization_id, target_kind, target_record_id);

-- ── Export receipt: immutable source -> provider job -> hashed output ─────
CREATE TABLE IF NOT EXISTS artifact_export_receipts (
  export_receipt_id   TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  artifact_kind       TEXT NOT NULL,
  -- Owner-table id (wave5_artifacts.id / presentation_decks.id /
  -- generated_workbooks.id). No FK, per the fresh-DB guard above.
  source_record_id    TEXT NOT NULL,
  -- The exact version + bytes that were exported. Together these make an
  -- export re-derivable and let a reader prove an output corresponds to a
  -- specific source revision rather than "whatever was current".
  source_version      INTEGER NOT NULL,
  source_content_hash TEXT NOT NULL,
  output_format       TEXT NOT NULL,
  -- Which engine produced the bytes ('native:docx', 'native:pptxgenjs',
  -- 'native:exceljs', 'native:pdfkit'), or the literal 'unavailable' when no
  -- approved provider exists. MAT-POL-001 keeps external providers OFF until
  -- an owner decision, so 'unavailable' must be representable and explicit.
  provider_key        TEXT NOT NULL,
  provider_job_id     TEXT,
  status              TEXT NOT NULL,
  failure_code        TEXT,
  output_byte_size    INTEGER,
  output_content_hash TEXT,
  idempotency_key     TEXT,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_export_receipt_org_idem
  ON artifact_export_receipts (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_export_receipt_source
  ON artifact_export_receipts (organization_id, artifact_kind, source_record_id, created_at DESC);

ALTER TABLE artifact_export_receipts
  DROP CONSTRAINT IF EXISTS artifact_export_receipts_kind_check;
ALTER TABLE artifact_export_receipts
  ADD CONSTRAINT artifact_export_receipts_kind_check
  CHECK (artifact_kind IN ('document', 'workbook', 'presentation'));

ALTER TABLE artifact_export_receipts
  DROP CONSTRAINT IF EXISTS artifact_export_receipts_status_check;
ALTER TABLE artifact_export_receipts
  ADD CONSTRAINT artifact_export_receipts_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'unavailable'));

-- The no-false-success invariant. A row may only claim 'succeeded' if it
-- actually carries the produced bytes' hash and size. This makes the frozen
-- MVP decision "an unavailable provider returns explicit UNAVAILABLE, never a
-- mock or silent downgrade" unfalsifiable at the storage layer: a degraded
-- export physically cannot be recorded as a success.
ALTER TABLE artifact_export_receipts
  DROP CONSTRAINT IF EXISTS artifact_export_receipts_success_check;
ALTER TABLE artifact_export_receipts
  ADD CONSTRAINT artifact_export_receipts_success_check
  CHECK (
    status <> 'succeeded'
    OR (output_content_hash IS NOT NULL AND output_byte_size IS NOT NULL)
  );
