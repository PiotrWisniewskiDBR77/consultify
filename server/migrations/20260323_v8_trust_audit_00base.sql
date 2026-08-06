-- Ordering guard: provenance extension sorts before the historical trust/audit
-- base file.

CREATE TABLE IF NOT EXISTS v8_support_traces (
  trace_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  execution_run_id TEXT,
  retrieval_request_id TEXT,
  routing_explanation_id TEXT,
  trust_class TEXT NOT NULL CHECK (
    trust_class IN ('grounded_fact', 'synthesis', 'uncertain_inference', 'degraded')
  ),
  routing_explanation TEXT,
  degraded_conditions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS v8_degraded_conditions (
  condition_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'provider_fallback', 'retrieval_failure', 'acl_timeout',
    'partial_tool_failure', 'connector_disconnected', 'voice_transcript_partial'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_message TEXT NOT NULL,
  operator_detail TEXT NOT NULL,
  support_trace_id TEXT REFERENCES v8_support_traces(trace_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS v8_health_signals (
  signal_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'retrieval_success_rate', 'retrieval_latency_p95', 'model_availability',
    'fallback_rate', 'trust_degradation_rate', 'connector_health',
    'acl_staleness', 'proposal_approval_latency', 'apply_failure_rate',
    'execution_run_failure_rate'
  )),
  component_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  value REAL,
  threshold REAL,
  metadata TEXT NOT NULL DEFAULT '{}',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
