-- Ensure subscription_plans includes billing metadata columns
ALTER TABLE subscription_plans ADD COLUMN description TEXT;
ALTER TABLE subscription_plans ADD COLUMN price_yearly INTEGER;
ALTER TABLE subscription_plans ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE subscription_plans ADD COLUMN features TEXT;
ALTER TABLE subscription_plans ADD COLUMN limits TEXT;
ALTER TABLE subscription_plans ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN is_public INTEGER DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN trial_days INTEGER DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id_monthly TEXT;
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id_yearly TEXT;
ALTER TABLE subscription_plans ADD COLUMN updated_at DATETIME;
