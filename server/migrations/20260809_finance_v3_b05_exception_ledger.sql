-- Finance v3 — Gate C (WP-C01): WP-B05 exception / reconciliation ledger.
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md, Zalacznik A.
--
-- Additive only. Includes one additive column on finance_business_versions (result_quality) —
-- explicitly called out by the B05 ADR itself as "do dopisania do listy kolumn w
-- GATE_B_INTEGRATION_RECONCILIATION.md sekcja 2" rather than a new table.

BEGIN;

CREATE TABLE IF NOT EXISTS finance_exceptions (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exception_group_id    TEXT NOT NULL, -- = id on the RAISED row; carried on every later event in the same chain

  organization_id       TEXT NOT NULL REFERENCES organizations(id),
  artifact_id           TEXT NOT NULL,
  business_version_id   TEXT,          -- nullable: detection can happen before promotion to a business version
  working_revision_id   TEXT REFERENCES finance_working_revisions(working_revision_id),

  event_type            TEXT NOT NULL CHECK (event_type IN (
                           'RAISED', 'ACCEPTED', 'WAIVED', 'RESOLVED',
                           'ESCALATED', 'REOPENED', 'EXPIRED'
                         )),

  severity               TEXT NOT NULL CHECK (severity IN (
                           'INFO', 'WARNING', 'MATERIAL', 'CRITICAL_DATA', 'SECURITY'
                         )),
  blocking_category       TEXT CHECK (blocking_category IN ('TENANT_BREACH', 'UNDEFINED_MATH')),

  source_ref               JSONB NOT NULL, -- statement_line_code/period_id/entity_id/cell_ref/compute_run_id/legacy_*

  expected                  NUMERIC,
  observed                   NUMERIC,
  delta                       NUMERIC,
  unit                          TEXT,

  reason_code                    TEXT, -- machine-classifiable: ROUNDING/MISSING_SOURCE/DUPLICATE_ROW/RECLASS/...
  reason                           TEXT,
  dedup_key                         TEXT, -- hash(artifact_id, reason_code, core source_ref fields), set at RAISED

  owner                               TEXT,
  raised_by                            TEXT,
  accepted_by                           TEXT,
  expiry                                 TIMESTAMPTZ,

  evidence                                JSONB,

  created_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                                TEXT,

  CONSTRAINT fk_finance_exceptions_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_finance_exceptions_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- Security must carry blocking_category; other severities must not.
  CONSTRAINT chk_finance_exceptions_blocking_category
    CHECK ((severity = 'SECURITY' AND blocking_category IS NOT NULL)
        OR (severity != 'SECURITY' AND blocking_category IS NULL)),

  -- reason required on everything except the initial auto-logged RAISED.
  CONSTRAINT chk_finance_exceptions_reason_required
    CHECK (event_type = 'RAISED' OR reason IS NOT NULL),

  -- accepted_by required on ACCEPTED/WAIVED/RESOLVED.
  CONSTRAINT chk_finance_exceptions_accepted_by_required
    CHECK (event_type NOT IN ('ACCEPTED', 'WAIVED', 'RESOLVED') OR accepted_by IS NOT NULL),

  -- expiry required on WAIVED for anything above INFO.
  CONSTRAINT chk_finance_exceptions_expiry_required
    CHECK (event_type != 'WAIVED' OR severity = 'INFO' OR expiry IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_exceptions_group ON finance_exceptions(exception_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_exceptions_org_severity ON finance_exceptions(organization_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_exceptions_artifact ON finance_exceptions(artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_exceptions_dedup ON finance_exceptions(dedup_key) WHERE dedup_key IS NOT NULL;

-- Append-only — surowsze niż finance_business_versions: zero mutacji, zero wyjatkow (WP-B05 1.1, Zalacznik A).
CREATE OR REPLACE FUNCTION finance_exceptions_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_exceptions is append-only; % not permitted (row %)', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_exceptions_deny_update ON finance_exceptions;
CREATE TRIGGER trg_finance_exceptions_deny_update
  BEFORE UPDATE ON finance_exceptions
  FOR EACH ROW EXECUTE FUNCTION finance_exceptions_deny_mutation();

DROP TRIGGER IF EXISTS trg_finance_exceptions_deny_delete ON finance_exceptions;
CREATE TRIGGER trg_finance_exceptions_deny_delete
  BEFORE DELETE ON finance_exceptions
  FOR EACH ROW EXECUTE FUNCTION finance_exceptions_deny_mutation();

-- finance_exceptions_current — current state of the logical exception (WP-B05 section 7.1)
CREATE OR REPLACE VIEW finance_exceptions_current AS
SELECT DISTINCT ON (exception_group_id)
  fe.*,
  CASE
    WHEN fe.event_type = 'WAIVED' AND (fe.expiry IS NULL OR fe.expiry > now()) THEN 'WAIVED'
    WHEN fe.event_type IN ('ACCEPTED', 'RESOLVED') THEN fe.event_type
    ELSE 'OPEN' -- RAISED, ESCALATED, REOPENED, EXPIRED, or WAIVED with expired expiry
  END AS state
FROM finance_exceptions fe
ORDER BY fe.exception_group_id, fe.created_at DESC;

-- finance_reconciliation_runs — append-only source -> canonical waterfall (WP-B05 section 5)
CREATE TABLE IF NOT EXISTS finance_reconciliation_runs (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL REFERENCES organizations(id),
  artifact_id                   TEXT NOT NULL,
  business_version_id            TEXT,

  source_system                   TEXT NOT NULL, -- 'import:xlsx' | 'legacy:financial_model_events' | 'shadow_parity:...'

  source_total                     NUMERIC NOT NULL,
  mapped_total                      NUMERIC NOT NULL,
  excluded_total                     NUMERIC NOT NULL DEFAULT 0,
  unmapped_total                      NUMERIC NOT NULL DEFAULT 0,
  duplicate_total                      NUMERIC NOT NULL DEFAULT 0,
  reclass_net_total                     NUMERIC NOT NULL DEFAULT 0,
  elimination_net_total                  NUMERIC NOT NULL DEFAULT 0,
  canonical_total                         NUMERIC NOT NULL,

  residual NUMERIC GENERATED ALWAYS AS
    (source_total - canonical_total - excluded_total - unmapped_total) STORED,
  residual_pct NUMERIC GENERATED ALWAYS AS
    (CASE WHEN source_total = 0 THEN NULL
          ELSE ABS(source_total - canonical_total - excluded_total - unmapped_total) / ABS(source_total) END) STORED,

  materiality_threshold_applied            NUMERIC NOT NULL, -- frozen copy of the placeholder threshold used for THIS run
  status                                     TEXT NOT NULL CHECK (status IN ('CLEAN', 'WITHIN_TOLERANCE', 'EXCEEDS_MATERIALITY')),
  linked_exception_id                         TEXT REFERENCES finance_exceptions(id),

  bucket_detail                                JSONB,

  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                                     TEXT,

  CONSTRAINT fk_finance_recon_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_finance_recon_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_recon_artifact ON finance_reconciliation_runs(artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_recon_org_status ON finance_reconciliation_runs(organization_id, status);

-- Amendment to finance_business_versions (WP-B05 section 4.2 / Zalacznik A step 0) — additive
-- column, frozen once at approve (step (c) of B02's atomic approval transaction), and protected
-- by the same immutability trigger as the rest of the row because it is NOT in that trigger's
-- allow-list of post-approval-mutable columns (see the B01 migration's trigger definition).
ALTER TABLE finance_business_versions
  ADD COLUMN IF NOT EXISTS result_quality TEXT CHECK (result_quality IN ('CLEAN', 'CONDITIONAL', 'PROVISIONAL'));

COMMIT;
