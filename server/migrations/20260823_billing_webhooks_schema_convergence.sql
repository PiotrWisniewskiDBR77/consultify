-- The canonical PostgreSQL baseline creates compact subscription_plans and
-- webhooks tables. Runtime bootstrap has richer CREATE TABLE definitions, but
-- CREATE TABLE IF NOT EXISTS cannot extend a table that the baseline created
-- first. Converge both creation orders on the columns used by live services.

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_yearly INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features TEXT DEFAULT '[]';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS limits TEXT DEFAULT '{}';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_public INTEGER DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE subscription_plans
SET is_active = COALESCE(is_active, 1),
    is_public = COALESCE(is_public, 1),
    sort_order = COALESCE(sort_order, 0);

ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS events TEXT NOT NULL DEFAULT '[]';
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret TEXT NOT NULL DEFAULT '';
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS retry_policy TEXT DEFAULT '{"max_attempts":3,"backoff":"exponential"}';
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS headers TEXT DEFAULT '{}';
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS payload_template TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_webhooks_creator ON webhooks(created_by);
