-- V8 Trust, Audit and Observability — core tables
-- WP-W1-TRUST-01: Trust/Audit/Observability core primitives

-- ==========================================
-- 1. Provenance Ledger
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_provenance_ledger (
  entry_id                TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  output_id               TEXT NOT NULL,
  output_type             TEXT NOT NULL
                          CHECK (output_type IN (
                            'chat_response', 'execution_output', 'report_section',
                            'presentation_slide', 'background_job_result'
                          )),
  trust_class             TEXT NOT NULL
                          CHECK (trust_class IN (
                            'grounded_fact', 'synthesis', 'uncertain_inference', 'degraded'
                          )),
  citation_bindings       TEXT NOT NULL DEFAULT '[]',
  context_snapshot_id     TEXT NOT NULL,
  retrieval_trace_id      TEXT,
  execution_run_id        TEXT,
  routing_explanation_id  TEXT,
  trust_summary           TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  created_by              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_provenance_org
  ON v8_provenance_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_provenance_output
  ON v8_provenance_ledger(organization_id, output_id);
CREATE INDEX IF NOT EXISTS idx_v8_provenance_trust_class
  ON v8_provenance_ledger(organization_id, trust_class);
CREATE INDEX IF NOT EXISTS idx_v8_provenance_snapshot
  ON v8_provenance_ledger(context_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_v8_provenance_run
  ON v8_provenance_ledger(execution_run_id)
  WHERE execution_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_provenance_created
  ON v8_provenance_ledger(organization_id, created_at);

-- ==========================================
-- 2. Support Traces
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_support_traces (
  trace_id                TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  context_snapshot_id     TEXT NOT NULL,
  execution_run_id        TEXT,
  retrieval_request_id    TEXT,
  routing_explanation_id  TEXT,
  trust_class             TEXT NOT NULL
                          CHECK (trust_class IN (
                            'grounded_fact', 'synthesis', 'uncertain_inference', 'degraded'
                          )),
  routing_explanation     TEXT,
  degraded_conditions     TEXT NOT NULL DEFAULT '[]',
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_traces_org
  ON v8_support_traces(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_traces_run
  ON v8_support_traces(organization_id, execution_run_id)
  WHERE execution_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_traces_snapshot
  ON v8_support_traces(context_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_v8_traces_trust_class
  ON v8_support_traces(organization_id, trust_class);
CREATE INDEX IF NOT EXISTS idx_v8_traces_created
  ON v8_support_traces(organization_id, created_at);

-- ==========================================
-- 3. Degraded Conditions
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_degraded_conditions (
  condition_id      TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  condition_type    TEXT NOT NULL
                    CHECK (condition_type IN (
                      'provider_fallback', 'retrieval_failure', 'acl_timeout',
                      'partial_tool_failure', 'connector_disconnected',
                      'voice_transcript_partial'
                    )),
  severity          TEXT NOT NULL
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_message      TEXT NOT NULL,
  operator_detail   TEXT NOT NULL,
  support_trace_id  TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (support_trace_id) REFERENCES v8_support_traces(trace_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_degraded_org
  ON v8_degraded_conditions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_degraded_type
  ON v8_degraded_conditions(organization_id, condition_type);
CREATE INDEX IF NOT EXISTS idx_v8_degraded_trace
  ON v8_degraded_conditions(support_trace_id)
  WHERE support_trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_degraded_created
  ON v8_degraded_conditions(organization_id, created_at);

-- ==========================================
-- 4. Health Signals
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_health_signals (
  signal_id       TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  signal_type     TEXT NOT NULL
                  CHECK (signal_type IN (
                    'retrieval_success_rate', 'retrieval_latency_p95',
                    'model_availability', 'fallback_rate',
                    'trust_degradation_rate', 'connector_health',
                    'acl_staleness', 'proposal_approval_latency',
                    'apply_failure_rate', 'execution_run_failure_rate'
                  )),
  component_id    TEXT NOT NULL,
  status          TEXT NOT NULL
                  CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  value           REAL,
  threshold       REAL,
  metadata        TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_health_org
  ON v8_health_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_health_type
  ON v8_health_signals(organization_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_v8_health_status
  ON v8_health_signals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_health_component
  ON v8_health_signals(organization_id, component_id);
CREATE INDEX IF NOT EXISTS idx_v8_health_timestamp
  ON v8_health_signals(organization_id, timestamp);
