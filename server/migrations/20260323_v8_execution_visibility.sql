-- V8 Execution Visibility and Handoff — core tables
-- WP-W3-LIFECYCLE-03: Execution signals, aggregations, results handoff, rebaseline proposals

-- ==========================================
-- 1. Execution Signals (13 canonical types)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_execution_signals (
  signal_id          TEXT PRIMARY KEY,
  signal_type        TEXT NOT NULL
                     CHECK (signal_type IN (
                       'overdue_tasks_count', 'blocked_tasks_count',
                       'blocked_initiatives_count', 'pending_blocking_decisions_count',
                       'critical_risks_count', 'owners_over_capacity_count',
                       'milestones_at_risk_count', 'stale_items_count',
                       'missing_baseline_count', 'missing_estimate_count',
                       'critical_path_slip_count', 'forecast_low_confidence_count',
                       'rollover_pressure_count'
                     )),
  source_object_type TEXT NOT NULL
                     CHECK (source_object_type IN (
                       'task', 'decision', 'initiative', 'project', 'program'
                     )),
  source_object_id   TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  severity           TEXT NOT NULL
                     CHECK (severity IN ('info', 'warning', 'critical', 'blocker')),
  payload            TEXT NOT NULL DEFAULT '{}',
  timestamp          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_org
  ON v8_execution_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_source
  ON v8_execution_signals(source_object_type, source_object_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_type
  ON v8_execution_signals(organization_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_severity
  ON v8_execution_signals(organization_id, severity);
CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_time
  ON v8_execution_signals(timestamp);

-- ==========================================
-- 2. Signal Aggregations (Decision W3-8)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_signal_aggregations (
  aggregation_id      TEXT PRIMARY KEY,
  level               TEXT NOT NULL
                      CHECK (level IN ('task', 'initiative', 'project', 'pmo')),
  source_object_id    TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  source_signals      TEXT NOT NULL DEFAULT '[]',
  aggregated_severity TEXT NOT NULL
                      CHECK (aggregated_severity IN ('info', 'warning', 'critical', 'blocker')),
  preserves_lineage   INTEGER NOT NULL DEFAULT 1,
  timestamp           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_sig_agg_org
  ON v8_signal_aggregations(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_sig_agg_level
  ON v8_signal_aggregations(organization_id, level);
CREATE INDEX IF NOT EXISTS idx_v8_sig_agg_source
  ON v8_signal_aggregations(level, source_object_id, organization_id);

-- ==========================================
-- 3. Results Handoff Events (Decision W3-9)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_results_handoff_events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN (
                    'initiative_baseline_confirmed', 'execution_progress_updated',
                    'milestone_completed', 'delivery_risk_changed',
                    'rebaseline_approved', 'handover_completed',
                    'realization_tracking_started'
                  )),
  initiative_id   TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  payload         TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_handoff_org
  ON v8_results_handoff_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_handoff_initiative
  ON v8_results_handoff_events(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_handoff_type
  ON v8_results_handoff_events(organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_v8_handoff_time
  ON v8_results_handoff_events(timestamp);

-- ==========================================
-- 4. Rebaseline Proposals (Decision W3-10)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_rebaseline_proposals (
  proposal_id      TEXT PRIMARY KEY,
  initiative_id    TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  execution_run_id TEXT NOT NULL,
  reason           TEXT NOT NULL,
  baseline_before  TEXT NOT NULL DEFAULT '{}',
  baseline_after   TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN (
                     'draft', 'pending_review', 'approved', 'rejected',
                     'expired', 'policy_allowed'
                   )),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  FOREIGN KEY (execution_run_id) REFERENCES v8_execution_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_rebaseline_org
  ON v8_rebaseline_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rebaseline_initiative
  ON v8_rebaseline_proposals(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rebaseline_run
  ON v8_rebaseline_proposals(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_v8_rebaseline_status
  ON v8_rebaseline_proposals(organization_id, status);
