-- V8 Governed Retrieval — core primitives
-- WP-W1-AI-02: Governed Retrieval baseline (retrieval requests + pipeline traces)

CREATE TABLE IF NOT EXISTS v8_retrieval_requests (
  request_id                TEXT PRIMARY KEY,
  organization_id           TEXT NOT NULL,
  context_snapshot_id       TEXT,
  retrieval_scope_token     TEXT,
  consumer_class            TEXT NOT NULL CHECK (consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')),
  query                     TEXT NOT NULL,
  search_preset             TEXT NOT NULL CHECK (search_preset IN ('workspace_broad', 'project_focused', 'artifact_deep', 'cross_org_federated')),
  budget_hint               TEXT,
  working_memory_context_ref TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_ret_req_org        ON v8_retrieval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ret_req_snapshot    ON v8_retrieval_requests(context_snapshot_id) WHERE context_snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ret_req_consumer    ON v8_retrieval_requests(consumer_class);
CREATE INDEX IF NOT EXISTS idx_v8_ret_req_created     ON v8_retrieval_requests(created_at);

-- Support-visible pipeline traces (§6 of analysis packet)
CREATE TABLE IF NOT EXISTS v8_retrieval_traces (
  trace_id                    TEXT PRIMARY KEY,
  request_id                  TEXT NOT NULL,
  organization_id             TEXT NOT NULL,
  snapshot_id                 TEXT,
  conversation_id             TEXT,
  consumer_class              TEXT NOT NULL CHECK (consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')),
  preset_used                 TEXT NOT NULL CHECK (preset_used IN ('workspace_broad', 'project_focused', 'artifact_deep', 'cross_org_federated')),
  scope_resolution_summary    TEXT NOT NULL DEFAULT '{}',
  pipeline_stages             TEXT NOT NULL DEFAULT '[]',
  candidates_considered       INTEGER NOT NULL DEFAULT 0,
  results_returned            INTEGER NOT NULL DEFAULT 0,
  results                     TEXT NOT NULL DEFAULT '[]',
  denied_entries              TEXT NOT NULL DEFAULT '[]',
  freshness_warnings          TEXT NOT NULL DEFAULT '[]',
  total_latency_ms            INTEGER NOT NULL DEFAULT 0,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (request_id) REFERENCES v8_retrieval_requests(request_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_ret_trace_org       ON v8_retrieval_traces(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ret_trace_req       ON v8_retrieval_traces(request_id);
CREATE INDEX IF NOT EXISTS idx_v8_ret_trace_conv      ON v8_retrieval_traces(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ret_trace_snapshot   ON v8_retrieval_traces(snapshot_id) WHERE snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ret_trace_created    ON v8_retrieval_traces(created_at);
