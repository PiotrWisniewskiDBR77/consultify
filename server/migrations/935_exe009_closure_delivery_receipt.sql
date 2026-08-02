-- EXE-09 — durable Execution-closure → Results/Finance delivery receipt.
--
-- Replaces the fire-and-forget-only closure handoff
-- (server/src/services/executionResultsBridge.ts `fireClosureHandoff`,
-- called from initiativeTransitionService.ts on every DONE transition) with a
-- durable row written INSIDE the same transaction as the status change, plus
-- a worker/reconciliation sweep that retries delivery until it lands.
--
-- One row per real closure event (one initiative DONE transition), keyed by
-- the SAME `correlationId` the canonical transition engine already generates
-- for `initiative_status_history`/`initiative_history` (see
-- initiativeTransitionService.ts ~L1413, "ONE correlationId shared by both
-- rows") — this row's PRIMARY KEY IS that correlationId, so Execution,
-- Results and Finance share one literal identifier end-to-end without
-- inventing a second causation concept. That correlationId is a fresh UUID
-- generated exactly once per transition (never client-supplied), so the PK
-- itself is the idempotency guard: a caller cannot make this table accept a
-- second row for the same transition even if the surrounding code were
-- accidentally invoked twice.
--
-- results_status / finance_status are tracked INDEPENDENTLY (contract point
-- 3 of the EXE-09 brief: "Results delivery i Finance delivery mają osobny
-- stan") — a Finance failure must never block or hide a successful Results
-- delivery and vice versa.
--
-- Additive/idempotent throughout (IF NOT EXISTS), same convention as
-- 934_initiative_closure_evidence_gate.sql. Plain-numbered (935, after 934)
-- so it runs in the safe plain-numbered block, not before tables it
-- references (initiatives, organizations) reliably exist on a fresh bootstrap
-- — see 934's file header for why dated-prefix filenames are unsafe here.

CREATE TABLE IF NOT EXISTS closure_delivery_receipts (
  -- = the correlationId minted by initiativeTransitionService's
  -- executeInitiativeTransition for this same DONE transition (also the PK of
  -- initiative_status_history and embedded in initiative_history.notes).
  id TEXT PRIMARY KEY,

  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,

  -- Points at the initiative_history row the transition wrote (same value as
  -- `id` today since both use the shared correlationId — kept as its own
  -- column, not just an alias of `id`, so a future re-keying of one side does
  -- not silently break the other's audit linkage).
  transition_audit_ref TEXT NOT NULL,

  -- No FK to users(id): NOT NULL audit-identity column, same convention as
  -- initiative_closure_requests.requested_by (a NOT NULL column can never
  -- carry ON DELETE SET NULL). 'system:exe-009-closure-receipt' when the
  -- transition itself was actor-less (e.g. an automated/system transition).
  actor_id TEXT,
  actor_label TEXT NOT NULL DEFAULT 'system:exe-009-closure-receipt',

  results_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (results_status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED')),
  results_attempts INTEGER NOT NULL DEFAULT 0,
  results_last_error TEXT,
  results_delivered_at TIMESTAMPTZ,
  -- Read-back payload: e.g. { "benefitIds": [...], "createdCount": n, "skippedCount": n }.
  -- Always re-populated from a fresh query on every attempt (not just on the
  -- attempt that first created the rows), so a retried delivery reports the
  -- SAME downstream ids rather than only the first attempt's ids.
  results_payload JSONB,

  finance_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (finance_status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'NEEDS_DECISION')),
  finance_attempts INTEGER NOT NULL DEFAULT 0,
  finance_last_error TEXT,
  finance_delivered_at TIMESTAMPTZ,
  finance_payload JSONB,

  -- Worker scheduling: NULL/past = eligible for immediate pickup by the
  -- reconciliation sweep. Set to a future time after a failed attempt
  -- (exponential backoff) so a persistently-broken downstream cannot spin the
  -- worker in a tight loop.
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_closure_delivery_receipts_org
  ON closure_delivery_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_closure_delivery_receipts_initiative
  ON closure_delivery_receipts(initiative_id);

-- Worker pickup query shape: any receipt with either leg not yet terminal
-- (DELIVERED is terminal-success; NEEDS_DECISION is terminal for finance
-- until a human acts; FAILED is retried until max attempts, see service),
-- ready to run now.
CREATE INDEX IF NOT EXISTS idx_closure_delivery_receipts_pending_sweep
  ON closure_delivery_receipts(next_retry_at)
  WHERE results_status IN ('PENDING', 'FAILED') OR finance_status IN ('PENDING', 'FAILED');

-- Finance delivery payload — a NEW, additive table, deliberately NOT reusing
-- any existing Finance table (`initiative_benefits.currency` defaults to an
-- unset 'USD', `financeEnterpriseService`/Atelier tables carry their own
-- unrelated coherence work this packet does not touch). One row per receipt
-- whose Finance leg actually resolved a value (i.e. did NOT end in
-- NEEDS_DECISION) — this table's very existence for a given receipt IS the
-- "delivered" signal for Finance, alongside the parent row's finance_status.
CREATE TABLE IF NOT EXISTS closure_finance_actuals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  closure_receipt_id TEXT NOT NULL REFERENCES closure_delivery_receipts(id) ON DELETE CASCADE,

  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL,
  -- Where the amount/currency came from — always spelled out, never silently
  -- assumed, so a reviewer can see exactly what was reused vs. decided here.
  -- e.g. "results_benefit_target_value+initiatives.budget_currency".
  value_source TEXT NOT NULL,

  source_tag TEXT NOT NULL DEFAULT 'EXE_009_CLOSURE_RECEIPT',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_closure_finance_actuals_org
  ON closure_finance_actuals(organization_id);
CREATE INDEX IF NOT EXISTS idx_closure_finance_actuals_initiative
  ON closure_finance_actuals(initiative_id);

-- One Finance actual per receipt — the idempotency backstop for the Finance
-- adapter (app-level pre-check via SELECT is the fast path; this is the DB
-- guarantee, same "pre-check + unique-index backstop" shape already used by
-- migration 783's initiative_benefits dedup).
CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_finance_actuals_receipt
  ON closure_finance_actuals(closure_receipt_id);
