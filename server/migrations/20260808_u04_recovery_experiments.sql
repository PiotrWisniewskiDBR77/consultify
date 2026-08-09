-- U04 — owner-backed recovery experiments. Additive, tenant-scoped and replay-safe.
ALTER TABLE kpi_recovery_cards
  ADD COLUMN IF NOT EXISTS experiment_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS kpi_recovery_experiments (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id TEXT NOT NULL,
  recovery_card_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  intervention TEXT NOT NULL,
  comparison TEXT,
  baseline TEXT NOT NULL,
  measurement_window TEXT NOT NULL,
  success_criterion TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  remeasure_at TIMESTAMPTZ NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  verdict TEXT,
  verdict_evidence TEXT,
  decision TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  due_notified_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_recovery_experiments_card_fk FOREIGN KEY (recovery_card_id)
    REFERENCES kpi_recovery_cards(id) ON DELETE CASCADE,
  CONSTRAINT kpi_recovery_experiments_approval_check
    CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
  CONSTRAINT kpi_recovery_experiments_verdict_check
    CHECK (verdict IS NULL OR verdict IN ('SUPPORTED','NOT_SUPPORTED','INCONCLUSIVE')),
  CONSTRAINT kpi_recovery_experiments_decision_check
    CHECK (decision IS NULL OR decision IN ('CONTINUE','REVISE','ESCALATE','CLOSE')),
  CONSTRAINT kpi_recovery_experiments_version_key UNIQUE (recovery_card_id, version),
  CONSTRAINT kpi_recovery_experiments_idempotency_key UNIQUE
    (organization_id, recovery_card_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_recovery_experiments_due
  ON kpi_recovery_experiments(organization_id, remeasure_at)
  WHERE approval_status='APPROVED' AND verdict IS NULL;

-- Confirmed cause is never inferred from an experiment verdict. It requires a
-- separate, attributable human evidence decision.
CREATE TABLE IF NOT EXISTS kpi_recovery_cause_decisions (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id TEXT NOT NULL,
  recovery_card_id TEXT NOT NULL,
  cause TEXT NOT NULL,
  evidence TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_recovery_cause_decisions_card_fk FOREIGN KEY (recovery_card_id)
    REFERENCES kpi_recovery_cards(id) ON DELETE CASCADE,
  CONSTRAINT kpi_recovery_cause_decisions_idempotency_key UNIQUE
    (organization_id, recovery_card_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_recovery_cause_decisions_card
  ON kpi_recovery_cause_decisions(organization_id, recovery_card_id, decided_at DESC);
