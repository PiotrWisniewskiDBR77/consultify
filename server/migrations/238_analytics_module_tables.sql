-- Migration: 238_analytics_module_tables.sql
-- SuperAdmin Analytics Module Tables
-- Date: 2026-01-10
--
-- Tables:
-- - analytics_dashboards: Custom dashboard definitions
-- - analytics_reports: Saved report configurations
-- - analytics_report_executions: Report execution history
-- - business_metrics: Custom business KPI definitions
-- - business_metric_values: Historical metric values
-- - predictive_models: ML model configurations
-- - predictive_model_runs: Model training history
-- - predictive_model_predictions: Model predictions

-- ============================================================
-- ANALYTICS DASHBOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_dashboards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Layout configuration
    layout_json TEXT DEFAULT '{}', -- Grid layout
    widgets_json TEXT DEFAULT '[]', -- Widget configurations
    
    -- Sharing
    is_shared INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]', -- JSON array of user IDs
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_created_by ON analytics_dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_shared ON analytics_dashboards(is_shared);

-- ============================================================
-- ANALYTICS REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Report configuration
    report_type TEXT DEFAULT 'custom', -- custom, revenue, usage, security
    query_sql TEXT,
    parameters_json TEXT DEFAULT '[]', -- Input parameters
    visualization_type TEXT DEFAULT 'table', -- table, chart, pivot
    
    -- Scheduling
    schedule_json TEXT, -- Cron schedule
    recipients_json TEXT DEFAULT '[]', -- Email recipients
    last_executed_at TEXT,
    next_execution_at TEXT,
    
    -- Status
    status TEXT DEFAULT 'active',
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_status ON analytics_reports(status);

CREATE TABLE IF NOT EXISTS analytics_report_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    report_id TEXT NOT NULL,
    
    -- Execution details
    parameters_json TEXT DEFAULT '{}',
    row_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'pending', -- pending, running, success, failed
    error_message TEXT,
    
    -- Results (optional, for caching)
    results_json TEXT,
    
    -- Metadata
    executed_at TEXT DEFAULT (datetime('now')),
    executed_by TEXT,
    
    FOREIGN KEY (report_id) REFERENCES analytics_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_report_executions_report ON analytics_report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_analytics_report_executions_date ON analytics_report_executions(executed_at);

-- ============================================================
-- BUSINESS METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS business_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Metric definition
    category TEXT DEFAULT 'custom', -- revenue, growth, engagement, operational
    formula TEXT, -- Calculation formula or SQL
    unit TEXT DEFAULT 'number', -- number, currency, percentage, time
    
    -- Thresholds
    target_value REAL,
    threshold_warning REAL,
    threshold_critical REAL,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_metrics_category ON business_metrics(category);
CREATE INDEX IF NOT EXISTS idx_business_metrics_active ON business_metrics(is_active);

CREATE TABLE IF NOT EXISTS business_metric_values (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric_id TEXT NOT NULL,
    
    -- Value
    value REAL NOT NULL,
    
    -- Metadata
    recorded_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (metric_id) REFERENCES business_metrics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_metric_values_metric ON business_metric_values(metric_id);
CREATE INDEX IF NOT EXISTS idx_business_metric_values_date ON business_metric_values(recorded_at);

-- ============================================================
-- PREDICTIVE MODELS
-- ============================================================

CREATE TABLE IF NOT EXISTS predictive_models (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Model configuration
    model_type TEXT DEFAULT 'linear_regression', -- linear_regression, logistic, random_forest, xgboost
    target_metric TEXT,
    features_json TEXT DEFAULT '[]', -- Input features
    model_parameters_json TEXT DEFAULT '{}', -- Hyperparameters
    
    -- Status
    status TEXT DEFAULT 'draft', -- draft, training, trained, deployed, archived
    last_trained_at TEXT,
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_predictive_models_type ON predictive_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_status ON predictive_models(status);

CREATE TABLE IF NOT EXISTS predictive_model_runs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    model_id TEXT NOT NULL,
    
    -- Training results
    accuracy_score REAL,
    precision_score REAL,
    recall_score REAL,
    f1_score REAL,
    training_samples INTEGER,
    validation_samples INTEGER,
    
    -- Performance
    training_time_seconds REAL,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    error_message TEXT,
    
    -- Metadata
    run_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_model ON predictive_model_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_date ON predictive_model_runs(run_at);

CREATE TABLE IF NOT EXISTS predictive_model_predictions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    model_id TEXT NOT NULL,
    
    -- Prediction
    input_data_json TEXT,
    predicted_value REAL,
    confidence_score REAL,
    actual_value REAL, -- For tracking accuracy
    
    -- Metadata
    predicted_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_model ON predictive_model_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_date ON predictive_model_predictions(predicted_at);

-- ============================================================
-- SEED DEMO DATA
-- ============================================================

-- Demo dashboards
INSERT OR IGNORE INTO analytics_dashboards (id, name, description, layout_json, widgets_json, is_shared, created_at)
VALUES 
    ('dash-exec-001', 'Executive Overview', 'High-level KPIs for leadership', 
     '{"columns": 3, "rows": 2}',
     '[{"id": "w1", "type": "kpi", "metric": "mrr", "title": "MRR"}, {"id": "w2", "type": "kpi", "metric": "users", "title": "Active Users"}, {"id": "w3", "type": "chart", "chartType": "line", "metric": "revenue_trend"}]',
     1, datetime('now')),
    ('dash-ops-001', 'Operations Dashboard', 'System health and usage metrics',
     '{"columns": 4, "rows": 3}',
     '[{"id": "w1", "type": "kpi", "metric": "api_requests", "title": "API Requests"}, {"id": "w2", "type": "kpi", "metric": "error_rate", "title": "Error Rate"}, {"id": "w3", "type": "chart", "chartType": "bar", "metric": "usage_by_org"}]',
     1, datetime('now')),
    ('dash-rev-001', 'Revenue Analytics', 'Detailed revenue breakdown',
     '{"columns": 2, "rows": 2}',
     '[{"id": "w1", "type": "chart", "chartType": "pie", "metric": "revenue_by_plan"}, {"id": "w2", "type": "chart", "chartType": "line", "metric": "mrr_trend"}]',
     1, datetime('now'));

-- Demo reports
INSERT OR IGNORE INTO analytics_reports (id, name, description, report_type, query_sql, visualization_type, status, created_at)
VALUES 
    ('rep-mrr-001', 'Monthly MRR Report', 'Monthly recurring revenue breakdown by plan', 'revenue',
     'SELECT sp.name as plan, COUNT(s.id) as subscribers, SUM(sp.price_monthly) as mrr FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.status = ''active'' GROUP BY sp.id',
     'table', 'active', datetime('now')),
    ('rep-usage-001', 'API Usage Report', 'API usage by organization', 'usage',
     'SELECT o.name as organization, COUNT(r.id) as requests FROM ai_request_logs r JOIN organizations o ON r.organization_id = o.id GROUP BY r.organization_id ORDER BY requests DESC LIMIT 20',
     'table', 'active', datetime('now')),
    ('rep-churn-001', 'Churn Analysis', 'Customer churn analysis', 'revenue',
     'SELECT strftime(''%Y-%m'', canceled_at) as month, COUNT(*) as churned FROM subscriptions WHERE status = ''canceled'' GROUP BY month ORDER BY month DESC',
     'chart', 'active', datetime('now'));

-- Demo business metrics
INSERT OR IGNORE INTO business_metrics (id, name, description, category, formula, unit, target_value, threshold_warning, threshold_critical, is_active, created_at)
VALUES 
    ('metric-mrr-001', 'Monthly Recurring Revenue', 'Total MRR from active subscriptions', 'revenue', 'SUM(price_monthly) FROM active_subscriptions', 'currency', 50000, 40000, 30000, 1, datetime('now')),
    ('metric-arr-001', 'Annual Recurring Revenue', 'Projected annual revenue', 'revenue', 'MRR * 12', 'currency', 600000, 480000, 360000, 1, datetime('now')),
    ('metric-users-001', 'Active Users', 'Total active users across all organizations', 'engagement', 'COUNT(*) FROM users WHERE is_active = 1', 'number', 1000, 800, 500, 1, datetime('now')),
    ('metric-churn-001', 'Monthly Churn Rate', 'Percentage of customers churned', 'revenue', 'churned_customers / total_customers * 100', 'percentage', 3, 5, 10, 1, datetime('now')),
    ('metric-nps-001', 'Net Promoter Score', 'Customer satisfaction score', 'engagement', 'AVG(nps_score)', 'number', 50, 30, 10, 1, datetime('now'));

-- Demo metric values
INSERT OR IGNORE INTO business_metric_values (id, metric_id, value, recorded_at)
SELECT 
    'val-' || m.id || '-' || d.day_offset,
    m.id,
    CASE m.id
        WHEN 'metric-mrr-001' THEN 35000 + (30 - d.day_offset) * 500 + ABS(RANDOM() % 2000)
        WHEN 'metric-arr-001' THEN (35000 + (30 - d.day_offset) * 500) * 12
        WHEN 'metric-users-001' THEN 750 + (30 - d.day_offset) * 5 + ABS(RANDOM() % 20)
        WHEN 'metric-churn-001' THEN 2.5 + (ABS(RANDOM() % 30) / 10.0)
        WHEN 'metric-nps-001' THEN 40 + ABS(RANDOM() % 20)
    END,
    datetime('now', '-' || d.day_offset || ' days')
FROM business_metrics m
CROSS JOIN (SELECT 0 day_offset UNION SELECT 7 UNION SELECT 14 UNION SELECT 21 UNION SELECT 28) d
WHERE m.id IN ('metric-mrr-001', 'metric-arr-001', 'metric-users-001', 'metric-churn-001', 'metric-nps-001');

-- Demo predictive models
INSERT OR IGNORE INTO predictive_models (id, name, description, model_type, target_metric, features_json, status, created_at)
VALUES 
    ('model-churn-001', 'Churn Prediction', 'Predict customer churn likelihood', 'logistic', 'churn_probability',
     '["last_login_days", "usage_decline", "support_tickets", "billing_issues"]', 'trained', datetime('now')),
    ('model-rev-001', 'Revenue Forecast', 'Forecast MRR growth', 'linear_regression', 'mrr_forecast',
     '["current_mrr", "new_customers", "churn_rate", "expansion_rate"]', 'trained', datetime('now')),
    ('model-growth-001', 'Growth Prediction', 'Predict user growth', 'random_forest', 'user_growth',
     '["marketing_spend", "feature_releases", "market_trends", "competitor_activity"]', 'draft', datetime('now'));

-- Demo model runs
INSERT OR IGNORE INTO predictive_model_runs (id, model_id, accuracy_score, precision_score, recall_score, f1_score, training_samples, status, run_at)
VALUES 
    ('run-001', 'model-churn-001', 0.87, 0.85, 0.82, 0.83, 5000, 'completed', datetime('now', '-7 days')),
    ('run-002', 'model-churn-001', 0.89, 0.87, 0.84, 0.85, 6500, 'completed', datetime('now', '-1 day')),
    ('run-003', 'model-rev-001', 0.92, 0.90, 0.88, 0.89, 3000, 'completed', datetime('now', '-3 days'));
