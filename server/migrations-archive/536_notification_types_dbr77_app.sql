-- Migration 536: Add product/app communication notification types (DBR77 + billing/limits)
-- These types are used as App→Human and DBR77→Human communication channel.

-- Ensure base table exists (older DBs may not have 257_notification_system applied)
CREATE TABLE IF NOT EXISTS notification_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  default_channels TEXT NOT NULL,
  is_user_configurable BOOLEAN DEFAULT TRUE,
  is_critical BOOLEAN DEFAULT FALSE,
  template_subject TEXT,
  template_body TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO notification_types (id, name, category, display_name, default_channels, icon, is_critical)
VALUES
  -- App / Billing / Limits comms
  ('nt-billing-limit-warning', 'billing_limit_warning', 'billing', 'Billing Limit Warning', '["in_app","email"]', '📈', TRUE),
  ('nt-billing-limit-reached', 'billing_limit_reached', 'billing', 'Billing Limit Reached', '["in_app","email"]', '⛔', TRUE),
  ('nt-billing-invoice-ready', 'invoice_ready', 'billing', 'Invoice Ready', '["in_app","email"]', '🧾', FALSE),

  -- DBR77 / Product comms
  ('nt-dbr77-update', 'dbr77_update', 'dbr77', 'DBR77 Update', '["in_app"]', '🆕', FALSE),
  ('nt-dbr77-release-notes', 'dbr77_release_notes', 'dbr77', 'DBR77 Release Notes', '["in_app"]', '📣', FALSE),
  ('nt-dbr77-kb-new', 'dbr77_kb_new', 'dbr77', 'New Knowledge Base', '["in_app"]', '📚', FALSE),
  ('nt-dbr77-instruction', 'dbr77_instruction', 'dbr77', 'New Instruction', '["in_app"]', '🧭', FALSE);

