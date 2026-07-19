-- Phase 8.4: Profit Excellence & Cost Control
-- Add hard limits and freeze capabilities to AI budgets

ALTER TABLE ai_budgets ADD COLUMN hard_limit_usd REAL;
ALTER TABLE ai_budgets ADD COLUMN freeze_on_limit INTEGER DEFAULT 0; -- 1 = stop all AI when usage >= hard_limit_usd
ALTER TABLE ai_budgets ADD COLUMN alert_thresholds TEXT DEFAULT '[80, 90, 100]'; -- JSON array of percentages

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_budgets_usage ON ai_budgets(current_month_usage);
