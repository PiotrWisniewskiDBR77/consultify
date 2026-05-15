-- Ensure subscription_plans has token_limit column
ALTER TABLE subscription_plans ADD COLUMN token_limit INTEGER DEFAULT 100000;
