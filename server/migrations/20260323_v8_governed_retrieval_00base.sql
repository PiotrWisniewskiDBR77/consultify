-- Ordering guard: freshness extension sorts before the historical base file.

CREATE TABLE IF NOT EXISTS v8_retrieval_requests (
  request_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  context_snapshot_id TEXT,
  retrieval_scope_token TEXT,
  consumer_class TEXT NOT NULL CHECK (
    consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')
  ),
  query TEXT NOT NULL,
  search_preset TEXT NOT NULL CHECK (
    search_preset IN (
      'workspace_broad', 'project_focused', 'artifact_deep', 'cross_org_federated'
    )
  ),
  budget_hint TEXT,
  working_memory_context_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
