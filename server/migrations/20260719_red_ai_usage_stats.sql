-- RED partia 2: brakująca tabela ai_usage_stats (42P01)
-- Reader: server/src/routes/admin-data.routes.ts (mounted /api/admin-data)
--   GET  /user-tiers/:orgId        -> LEFT JOIN ai_usage_stats (tier, requests_count, cost_usd, period_start)
--   GET  /cost-attribution/:orgId  -> SUM(requests_count, tokens_used, cost_usd), project_id
--   PUT  /user-tiers/:orgId/:userId-> INSERT ... ON CONFLICT(user_id, period_start) DO UPDATE
-- Schemat wywiedziony z czytelnika + seed server/migrations/229_admin_overview_seed.sql (dialekt SQLite -> Postgres).
-- Idempotentne: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS ai_usage_stats (
    id             TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id        TEXT,
    project_id     TEXT,
    period_start   TIMESTAMPTZ NOT NULL,
    period_end     TIMESTAMPTZ NOT NULL,
    requests_count INTEGER DEFAULT 0,
    tokens_used    INTEGER DEFAULT 0,
    cost_usd       DOUBLE PRECISION DEFAULT 0,
    tier           TEXT DEFAULT 'STANDARD',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Cel ON CONFLICT(user_id, period_start) writera PUT /user-tiers -> wymagany UNIQUE dokładnie na (user_id, period_start).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_stats_user_period ON ai_usage_stats(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_org ON ai_usage_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_user ON ai_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_period ON ai_usage_stats(period_start);
