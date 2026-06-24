-- M14/F6 (6.2): Real distribution worker support.
-- report_distributions only tracked intent (created_at / sent_at) but had no
-- delivery-state columns the email-worker can claim/settle on.
-- delivered_at IS NULL = "not yet delivered" → the worker's work queue.

ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivered_at TEXT;
ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivery_status TEXT;
