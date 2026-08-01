-- RES-003A — KPI Deviation → Recovery Card canonical loop (Results, Linia B).
-- (Branch is historically named feat/res-002-canonical-kpi-recovery-loop; RES-002
-- is reserved for a different package — "OKR definition quality gate", see
-- MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md. All new artifacts for this piece
-- of work use the RES-003A identifier per Codex/Piotr decision 2026-08-01.)
--
-- CONTEXT: `kpi_deviation_cases` / `kpi_deviation_actions` (both in
-- server/migrations-v2/001_baseline_20260413.sql) detect and track a KPI
-- deviation, but there is no owner object for the recovery plan itself — no
-- hypothesis/confirmed-cause split, no immediate-vs-durable actions, no
-- dependencies/risks, no checkpoints, no effectiveness assessment, no
-- close/continue/escalate decision. Contract: docs/program/WEEKEND_COMPLETION_
-- 2026-08-01/AGREEMENTS/07_RESULTS_REVIEW.md §7.1 ("KPI Recovery Card zawiera...").
--
-- BUG THIS SCHEMA FIXES THE ROOT CAUSE OF: server/src/routes/v8/results.routes.ts
-- (POST /workflow/kpi/:id/next-action) writes
--   UPDATE kpi_deviation_actions SET execution_follow_up_ref = ? WHERE id = ?
-- — `execution_follow_up_ref` does not exist on `kpi_deviation_actions` (it only
-- exists on the unrelated `v8_kpi_next_actions`); the error is silently caught.
-- The task is created in `tasks` but the back-reference is lost every time.
-- Fix direction (not applied by this migration): the linked-task reference now
-- has a real home on `kpi_recovery_actions.linked_task_id` /
-- `kpi_recovery_actions.task_link_status`, with an idempotent write path (see
-- the adapter contract in the accompanying packet). This migration only adds
-- the schema; no route code is touched here.
--
-- Fully additive + idempotent (CREATE TABLE/INDEX IF NOT EXISTS only); no
-- destructive statement, no backfill, no data migration. Auto-applied by
-- DatabaseInitializer (pattern ^\d{8}_.*\.sql$, server/src/database/
-- DatabaseInitializer.ts:3198) which wraps this whole file in its own
-- BEGIN/COMMIT (line 3234-3240) — this file must NOT open its own transaction.

-- ============================================================================
-- kpi_recovery_cards — the Recovery Card owner object, 1:1 with a deviation
-- case. `deviation_case_id` UNIQUE is the concurrency guard: two parallel
-- POSTs racing to create a card for the same case both hit the same
-- `INSERT ... ON CONFLICT (deviation_case_id) DO NOTHING`, so only one row is
-- ever created (adapter contract re-selects on conflict — see packet).
-- ============================================================================

CREATE TABLE IF NOT EXISTS kpi_recovery_cards (
  id                       TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id          TEXT NOT NULL,

  -- 1:1 with the deviation case that spawned this card.
  deviation_case_id        TEXT NOT NULL,
  -- Denormalized from kpi_deviation_cases.kpi_id at creation time so the
  -- close-gate's freshness check (kpi_time_series lookup) needs no join back
  -- through the case row. Immutable after insert (a card never re-points to
  -- a different KPI — a new deviation on a different KPI gets its own case
  -- and its own card).
  kpi_id                   TEXT NOT NULL,

  -- RCA: hypothesis is filled early (often at card creation from the
  -- deviation's auto-generated summary); confirmed_cause stays NULL until RCA
  -- is actually done. Contract §7.1: "RCA z rozróżnieniem hipotezy i
  -- przyczyny potwierdzonej".
  hypothesis                TEXT,
  confirmed_cause           TEXT,

  -- "opis odchylenia i jego wpływu" — description of the deviation's ACTUAL
  -- impact (distinct from expected_impact below, which is the anticipated
  -- effect of the recovery plan once executed).
  impact_description         TEXT,

  priority                   TEXT NOT NULL DEFAULT 'MEDIUM',
  -- Anticipated effect of the recovery plan (e.g. "closes 60% of the target
  -- gap within one quarter") — distinct from impact_description above.
  expected_impact            TEXT,

  -- Simple reference lists without a distinct per-item lifecycle: stored as
  -- JSON, matching the existing repo convention for this shape (see
  -- raid_items.linked_items, server/migrations/20260623_raid_assumption_issue.sql
  -- comment, and kpi_deviation_cases.context_json-style columns elsewhere).
  -- Each element: {"description": text, "relatedId"?: text, "note"?: text}.
  dependencies                JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks                       JSONB NOT NULL DEFAULT '[]'::jsonb,

  expected_recovery_date      DATE,
  effectiveness_criteria      TEXT,
  -- Workflow state of the assessment itself (has it even come due yet).
  effectiveness_status        TEXT NOT NULL DEFAULT 'NOT_YET_DUE',
  -- The actual grade, set only once effectiveness_status = 'ASSESSED'.
  effectiveness_rating        TEXT,

  lifecycle_status            TEXT NOT NULL DEFAULT 'DRAFT',
  decision                    TEXT,

  -- Anchor for the close-gate freshness check: the moment this card most
  -- recently entered ACTIVE (initial creation, or a reopen after a
  -- regression). "Measurement newer than card open" is evaluated as
  -- kpi_time_series.created_at > active_since, NOT against the underlying
  -- case's original detected_at — because kpi_deviation_cases does not
  -- currently update detected_at on reopen
  -- (server/src/services/results/kpiDeviationService.ts:192-202), which would
  -- silently let a stale pre-reopen measurement satisfy the close-gate.
  active_since                TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optimistic concurrency. Every mutating write does
  -- `WHERE id = ? AND version = ?` and increments version in the SET clause;
  -- 0 rows affected = conflict, caller refetches and retries. See adapter
  -- contract for why this project's Postgres connection-pool-per-call
  -- layout (server/src/database/PostgresDatabase.ts, pool.query() per call)
  -- makes single-statement optimistic concurrency the safe choice here,
  -- rather than a multi-statement BEGIN/SELECT FOR UPDATE/COMMIT sequence.
  version                     INTEGER NOT NULL DEFAULT 1,

  -- Evidence required before a CLOSE decision (mirrors the evidence fields
  -- already on kpi_deviation_cases: evidence_text / evidence_ref).
  evidence_text                TEXT,
  evidence_ref                  TEXT,

  created_by                    TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                    TEXT,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by                     TEXT,
  closed_at                     TIMESTAMPTZ,

  CONSTRAINT kpi_recovery_cards_deviation_case_id_key
    UNIQUE (deviation_case_id),

  CONSTRAINT kpi_recovery_cards_deviation_case_id_fkey
    FOREIGN KEY (deviation_case_id) REFERENCES kpi_deviation_cases(id) ON DELETE CASCADE,
  CONSTRAINT kpi_recovery_cards_kpi_id_fkey
    FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE,

  CONSTRAINT kpi_recovery_cards_priority_check
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT kpi_recovery_cards_effectiveness_status_check
    CHECK (effectiveness_status IN ('NOT_YET_DUE', 'PENDING_ASSESSMENT', 'ASSESSED')),
  CONSTRAINT kpi_recovery_cards_effectiveness_rating_check
    CHECK (effectiveness_rating IS NULL
           OR effectiveness_rating IN ('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE')),
  CONSTRAINT kpi_recovery_cards_lifecycle_status_check
    CHECK (lifecycle_status IN ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'CLOSED')),
  CONSTRAINT kpi_recovery_cards_decision_check
    CHECK (decision IS NULL OR decision IN ('CONTINUE', 'ESCALATE', 'CLOSE')),
  -- A CLOSE decision without at least one evidence field is exactly the gap
  -- flagged against the existing PUT /deviation-cases/:caseId/close endpoint
  -- (that endpoint accepts either evidenceText or evidenceRef, never both
  -- required, never re-measurement-checked). This CHECK enforces the
  -- evidence half of the guard at the schema level so it can never be
  -- bypassed by a future caller, even one that skips the service layer.
  CONSTRAINT kpi_recovery_cards_close_requires_evidence_check
    CHECK (decision IS DISTINCT FROM 'CLOSE'
           OR evidence_text IS NOT NULL OR evidence_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_kpi_recovery_cards_org
  ON kpi_recovery_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_cards_kpi
  ON kpi_recovery_cards(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_cards_lifecycle_status
  ON kpi_recovery_cards(organization_id, lifecycle_status);

-- ============================================================================
-- kpi_recovery_actions — immediate/durable action lines, one row per action so
-- each can carry its own owner/due date/status and (critically) its own
-- linked Execution/My Work task with idempotent, retry-safe linking. A JSONB
-- list was rejected here specifically because task-linking needs per-item
-- identity, per-item status transitions, and a unique constraint against
-- `tasks.id` — none of which a JSON array can express or enforce.
-- ============================================================================

CREATE TABLE IF NOT EXISTS kpi_recovery_actions (
  id                        TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id           TEXT NOT NULL,
  recovery_card_id          TEXT NOT NULL,

  action_type               TEXT NOT NULL,
  title                     TEXT NOT NULL,
  description               TEXT,
  owner_user_id             TEXT,
  due_date                  DATE,
  status                    TEXT NOT NULL DEFAULT 'OPEN',

  -- Execution/My Work task back-reference. This is the column the confirmed
  -- bug's UPDATE should have targeted. NULL until a task is actually created.
  linked_task_id            TEXT,
  -- Explicit recovery state so a task-created-but-ref-write-failed situation
  -- (the exact class of the current bug) is visible and retry-friendly
  -- instead of silently swallowed by a try/catch.
  task_link_status          TEXT NOT NULL DEFAULT 'NONE',
  task_link_error           TEXT,
  task_link_attempted_at    TIMESTAMPTZ,

  -- Caller-supplied idempotency key for "create this action (and its task)"
  -- retries. NULL is allowed (unkeyed inserts always create a new row, same
  -- as kpi_deviation_actions today); when present it is unique per card, so
  -- a retried POST with the same key collapses to the existing row instead
  -- of creating a duplicate action (and therefore a duplicate task).
  idempotency_key           TEXT,

  created_by                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kpi_recovery_actions_recovery_card_id_fkey
    FOREIGN KEY (recovery_card_id) REFERENCES kpi_recovery_cards(id) ON DELETE CASCADE,
  -- ON DELETE SET NULL (not CASCADE): if a task is ever hard-deleted, the
  -- action must not disappear with it — task_link_status stays 'LINKED' with
  -- linked_task_id now NULL, which is a visible anomaly the service layer
  -- can detect and repair, rather than silently losing the recovery action.
  CONSTRAINT kpi_recovery_actions_linked_task_id_fkey
    FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL,

  CONSTRAINT kpi_recovery_actions_action_type_check
    CHECK (action_type IN ('IMMEDIATE', 'DURABLE')),
  CONSTRAINT kpi_recovery_actions_status_check
    CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  CONSTRAINT kpi_recovery_actions_task_link_status_check
    CHECK (task_link_status IN ('NONE', 'PENDING', 'LINKED', 'LINK_FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_kpi_recovery_actions_org
  ON kpi_recovery_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_actions_card
  ON kpi_recovery_actions(recovery_card_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_actions_owner
  ON kpi_recovery_actions(owner_user_id)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_actions_due_date
  ON kpi_recovery_actions(due_date)
  WHERE due_date IS NOT NULL AND status = 'OPEN';

-- Idempotent action creation: at most one row per (card, idempotency_key).
-- Partial index (many NULLs allowed) mirrors the existing
-- uq_conversation_messages_client_msg pattern in
-- server/migrations/20260602_chat_message_idempotency_ordering.sql.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_recovery_actions_card_idem_key
  ON kpi_recovery_actions(recovery_card_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Idempotent task linking at the DB level: no task can ever end up linked
-- from two different recovery actions, regardless of application-layer bugs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_recovery_actions_linked_task
  ON kpi_recovery_actions(linked_task_id)
  WHERE linked_task_id IS NOT NULL;

-- ============================================================================
-- kpi_recovery_checkpoints — planned/actual check-in points ("kolejne
-- checkpointy i pomiary"). A dedicated table (not JSONB) because a checkpoint
-- has its own lifecycle (PENDING -> MET/MISSED) and, once met, links to the
-- exact kpi_time_series row that satisfied it — needed for audit and for a
-- future cron reminder job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS kpi_recovery_checkpoints (
  id                     TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id        TEXT NOT NULL,
  recovery_card_id       TEXT NOT NULL,

  checkpoint_date        DATE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'PENDING',
  -- The kpi_time_series row that resolved this checkpoint, once one exists.
  kpi_time_series_id     TEXT,
  notes                  TEXT,

  created_by              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at              TIMESTAMPTZ,

  CONSTRAINT kpi_recovery_checkpoints_recovery_card_id_fkey
    FOREIGN KEY (recovery_card_id) REFERENCES kpi_recovery_cards(id) ON DELETE CASCADE,
  CONSTRAINT kpi_recovery_checkpoints_kpi_time_series_id_fkey
    FOREIGN KEY (kpi_time_series_id) REFERENCES kpi_time_series(id) ON DELETE SET NULL,

  CONSTRAINT kpi_recovery_checkpoints_status_check
    CHECK (status IN ('PENDING', 'MET', 'MISSED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_kpi_recovery_checkpoints_org
  ON kpi_recovery_checkpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_checkpoints_card
  ON kpi_recovery_checkpoints(recovery_card_id);
CREATE INDEX IF NOT EXISTS idx_kpi_recovery_checkpoints_upcoming
  ON kpi_recovery_checkpoints(organization_id, checkpoint_date)
  WHERE status = 'PENDING';
