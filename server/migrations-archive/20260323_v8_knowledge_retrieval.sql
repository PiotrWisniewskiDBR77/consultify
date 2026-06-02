-- V8 Knowledge + Retrieval Integration — core tables
-- WP-W2-AI-02: Working memory entries + governed memory promotion requests

-- ==========================================
-- 1. Working Memory Entries
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_working_memory_entries (
  entry_id          TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  memory_type       TEXT NOT NULL
                    CHECK (memory_type IN (
                      'ephemeral', 'session', 'user_private_durable', 'organization_durable'
                    )),
  content           TEXT NOT NULL,
  source_ref        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_wm_entries_org
  ON v8_working_memory_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_wm_entries_conv
  ON v8_working_memory_entries(conversation_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_wm_entries_type
  ON v8_working_memory_entries(organization_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_v8_wm_entries_expires
  ON v8_working_memory_entries(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_wm_entries_created
  ON v8_working_memory_entries(organization_id, created_at);

-- ==========================================
-- 2. Memory Promotion Requests (Decision W2-6)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_memory_promotion_requests (
  request_id          TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  source_entry_id     TEXT NOT NULL,
  target_memory_type  TEXT NOT NULL
                      CHECK (target_memory_type IN (
                        'ephemeral', 'session', 'user_private_durable', 'organization_durable'
                      )),
  promotion_status    TEXT NOT NULL DEFAULT 'pending'
                      CHECK (promotion_status IN ('pending', 'approved', 'rejected')),
  provenance_ref      TEXT NOT NULL,
  requested_by        TEXT NOT NULL,
  resolved_by         TEXT,
  resolved_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (source_entry_id) REFERENCES v8_working_memory_entries(entry_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_mem_promo_org
  ON v8_memory_promotion_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_mem_promo_source
  ON v8_memory_promotion_requests(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_v8_mem_promo_status
  ON v8_memory_promotion_requests(organization_id, promotion_status);
CREATE INDEX IF NOT EXISTS idx_v8_mem_promo_created
  ON v8_memory_promotion_requests(organization_id, created_at);
