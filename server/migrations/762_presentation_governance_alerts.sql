-- Sprint 8: presentation governance alert dispatcher (subscriptions + dispatch audit)
--
-- Two tables:
--   * presentation_governance_alert_subscriptions  - org-level webhook/email/slack targets
--   * presentation_governance_alert_dispatches     - per-attempt audit row (sent/failed/suppressed/dry_run)
--
-- Both are idempotent so the migration can be re-applied safely.

CREATE TABLE IF NOT EXISTS presentation_governance_alert_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('webhook', 'email', 'slack')),
  target TEXT NOT NULL,                -- URL for webhook/slack, email address otherwise
  min_severity TEXT NOT NULL DEFAULT 'BLOCKED_P1' CHECK (min_severity IN ('BLOCKED_P0','BLOCKED_P1')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pres_gov_alert_subs_org
  ON presentation_governance_alert_subscriptions(organization_id, active);

CREATE TABLE IF NOT EXISTS presentation_governance_alert_dispatches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subscription_id TEXT,
  organization_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  from_verdict TEXT,                   -- nullable when deck is brand-new
  to_verdict TEXT NOT NULL CHECK (to_verdict IN ('BLOCKED_P0','BLOCKED_P1')),
  channel TEXT NOT NULL,
  target_redacted TEXT,                -- token-masked target for audit
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','suppressed','dry_run')),
  http_status INTEGER,
  error_category TEXT,
  payload_json TEXT,                   -- stored payload for replay/debug
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pres_gov_alert_dispatch_org
  ON presentation_governance_alert_dispatches(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pres_gov_alert_dispatch_deck
  ON presentation_governance_alert_dispatches(deck_id);
