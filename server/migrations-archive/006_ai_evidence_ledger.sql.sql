-- Step 15: Explainability Ledger & Evidence Pack
-- Migration: 006_ai_evidence_ledger.sql
-- 
-- Creates tables for storing AI evidence objects, explainability links,
-- and reasoning ledger entries (immutable, server-generated only).

-- ==========================================
-- ai_evidence_objects: Raw evidence storage
-- ==========================================
-- Stores snapshots of data used as evidence for AI decisions:
-- - METRIC_SNAPSHOT: Point-in-time metric values
-- - SIGNAL: Detected AI signals (USER_AT_RISK, BLOCKED_INITIATIVE, etc.)
-- - DOC_REF: References to documents/knowledge used
-- - USER_EVENT: User actions that triggered AI response
-- - SYSTEM_EVENT: System events (job completions, threshold breaches)

CREATE TABLE IF NOT EXISTS ai_evidence_objects (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('METRIC_SNAPSHOT', 'SIGNAL', 'DOC_REF', 'USER_EVENT', 'SYSTEM_EVENT')),
    source TEXT NOT NULL,
    payload_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_org ON ai_evidence_objects(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_type ON ai_evidence_objects(type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_source ON ai_evidence_objects(source);

-- ==========================================
-- ai_explainability_links: Evidence → Entity links
-- ==========================================
-- Links evidence objects to AI entities (proposals, decisions, executions, run_steps).
-- Many-to-many relationship with weight for importance scoring.

CREATE TABLE IF NOT EXISTS ai_explainability_links (
    id TEXT PRIMARY KEY,
    from_type TEXT NOT NULL CHECK(from_type IN ('proposal', 'decision', 'execution', 'run_step', 'playbook_run')),
    from_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 1),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(evidence_id) REFERENCES ai_evidence_objects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_explainability_links_from ON ai_explainability_links(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_ai_explainability_links_evidence ON ai_explainability_links(evidence_id);

-- ==========================================
-- ai_reasoning_ledger: Immutable reasoning records
-- ==========================================
-- Server-generated reasoning summaries. CRITICAL: No client input allowed.
-- Each entry is immutable - corrections require new entries.

CREATE TABLE IF NOT EXISTS ai_reasoning_ledger (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    reasoning_summary TEXT NOT NULL,
    assumptions_json TEXT DEFAULT '[]',
    confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_entity ON ai_reasoning_ledger(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_confidence ON ai_reasoning_ledger(confidence);
CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_created ON ai_reasoning_ledger(created_at);
