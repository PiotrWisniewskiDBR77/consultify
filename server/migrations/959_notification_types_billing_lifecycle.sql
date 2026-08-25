-- Migration 959: Register Stripe subscription/invoice lifecycle notification
-- types (N2 / DEC-2026-08-25-21).
--
-- These four types were emitted via a direct `INSERT INTO notifications`
-- (server/src/routes/webhooks/stripe.routes.ts, createNotification() helper)
-- that bypasses the notification_types registry entirely — the row was
-- never looked up in `notificationService.ts`'s `getNotificationTypeConfig`,
-- so channel/critical metadata for these types has never existed.
--
-- Registering them with `default_channels = '["in_app"]'` and
-- `is_critical = FALSE` matches the createNotification() helper's ACTUAL
-- prior behavior exactly (it only ever did a plain in-app `INSERT`, never
-- sent email) — this migration changes zero observable behavior on its own.
-- The follow-up code change (N2) routes these four call sites through
-- notificationService.send() instead of createNotification(), which is what
-- makes the registry row (and, from then on, the user's preferences) start
-- being respected.
INSERT INTO notification_types (id, name, category, display_name, default_channels, icon, is_critical)
VALUES
  ('nt-subscription-created', 'subscription_created', 'billing', 'Subscription Activated', '["in_app"]', '💳', FALSE),
  ('nt-subscription-canceled', 'subscription_canceled', 'billing', 'Subscription Canceled', '["in_app"]', '💳', FALSE),
  ('nt-invoice-paid', 'invoice_paid', 'billing', 'Payment Successful', '["in_app"]', '🧾', FALSE),
  ('nt-invoice-finalized', 'invoice_finalized', 'billing', 'Invoice Ready', '["in_app"]', '🧾', FALSE)
ON CONFLICT (id) DO NOTHING;
