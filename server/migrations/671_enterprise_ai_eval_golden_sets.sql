-- Enterprise AI Eval Golden Sets & Extended Metrics
-- Supports automated eval pipeline triggers, golden datasets per language,
-- and grounding/hallucination tracking.

CREATE TABLE IF NOT EXISTS ai_eval_golden_sets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    purpose TEXT DEFAULT 'chat',
    samples_json TEXT NOT NULL DEFAULT '[]',
    sample_count INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_golden_sets_org_lang
    ON ai_eval_golden_sets(organization_id, language, is_active);

CREATE TABLE IF NOT EXISTS ai_eval_auto_triggers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'prompt_update',
    target_dataset_id TEXT,
    eval_types_json TEXT NOT NULL DEFAULT '["response_quality","citation_coverage","groundedness","hallucination_rate"]',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eval_triggers_org
    ON ai_eval_auto_triggers(organization_id, trigger_type, is_active);

CREATE TABLE IF NOT EXISTS ai_grounding_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    conversation_id TEXT,
    message_id TEXT,
    user_id TEXT,
    grounding_score REAL,
    confidence_score REAL,
    total_claims INTEGER DEFAULT 0,
    grounded_claims INTEGER DEFAULT 0,
    ungrounded_claims INTEGER DEFAULT 0,
    citation_accuracy REAL,
    hallucination_flags TEXT DEFAULT '[]',
    context_sources_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grounding_logs_org
    ON ai_grounding_logs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_observability_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    snapshot_type TEXT NOT NULL DEFAULT 'hourly',
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_requests INTEGER DEFAULT 0,
    avg_quality_score REAL,
    avg_latency_ms REAL,
    p95_latency_ms REAL,
    total_cost_usd REAL DEFAULT 0,
    safety_refusal_count INTEGER DEFAULT 0,
    tool_call_success_rate REAL,
    feedback_satisfaction_rate REAL,
    rag_avg_groundedness REAL,
    error_count INTEGER DEFAULT 0,
    metrics_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observability_snapshots_org
    ON ai_observability_snapshots(organization_id, snapshot_type, period_start DESC);
