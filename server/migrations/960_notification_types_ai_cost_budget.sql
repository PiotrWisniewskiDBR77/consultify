-- Migration 960: Register the AI cost budget alert notification type
-- (N2 / DEC-2026-08-25-21).
--
-- `ai_cost_budget_alert` was emitted via a direct EmailService.send() call
-- (server/src/services/ai/aiCostAlertsService.ts, sendEmailToOrgAdmins()) —
-- bypassing preferences entirely (notyfikacje-audyt.md §1C).
--
-- Registering it with `default_channels = '["email"]'` matches that
-- function's ACTUAL prior behavior exactly (admin email only, no in-app
-- row was ever created) — this migration changes zero observable behavior
-- on its own. The follow-up code change (N2) routes the call site through
-- notificationService.send() instead of EmailService.send() directly,
-- which is what makes the registry row (and, from then on, the user's
-- preferences) start being respected.
INSERT INTO notification_types (id, name, category, display_name, default_channels, icon, is_critical)
VALUES
  ('nt-ai-cost-budget-alert', 'ai_cost_budget_alert', 'ai', 'AI Cost Budget Alert', '["email"]', '💸', FALSE)
ON CONFLICT (id) DO NOTHING;
