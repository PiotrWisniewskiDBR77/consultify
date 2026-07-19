-- Migration: 20260720_analytics_module_tables.sql
-- SuperAdmin Analytics Module Tables (Postgres-native re-creation of dead 238_analytics_module_tables.sql)
--
-- Context: 238_analytics_module_tables.sql was written in SQLite dialect (randomblob/hex ids,
-- 0/1 booleans, INSERT OR IGNORE) and its filename never matched the migration runner's
-- regex /^(7\d{2}|\d{8})_.*\.sql$/ (server/src/database/DatabaseInitializer.ts), so it NEVER
-- executed on Postgres. All 8 tables below are missing on live Postgres databases even though
-- server/src/routes/analytics-superadmin.routes.ts (mounted at /api/superadmin/analytics in
-- Gateway.ts) has full live CRUD against every one of them.
--
-- Column set is driven by the LIVE caller (analytics-superadmin.routes.ts), not the original
-- 238 draft — two columns were added vs. the original draft because the live route code needs
-- them and the original migration never shipped, so it never got a chance to drift into
-- alignment:
--   - predictive_model_runs.parameters_json      (route: POST /models/:id/train, GET .../predict)
--   - predictive_model_predictions.prediction_type / .prediction_result_json
--     (route: POST /models/:id/predict)
--
-- NOTE: server/src/controllers/SuperAdminController.ts ALSO references business_metrics /
-- predictive_models with a different, incompatible column set (metric_type, calculation_formula,
-- training_data_json, model_config_json, business_metric_history). Those controller functions
-- (getBusinessMetrics, createBusinessMetric, getPredictiveModels, createPredictiveModel, etc.)
-- are exported but never wired to any Express route (grep confirms zero route registrations) —
-- dead code, intentionally NOT accommodated here. Only the analytics-superadmin.routes.ts schema
-- is created.

-- ============================================================
-- ANALYTICS DASHBOARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_dashboards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,

    -- Layout configuration
    layout_json TEXT DEFAULT '{}', -- Grid layout
    widgets_json TEXT DEFAULT '[]', -- Widget configurations

    -- Sharing
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with TEXT DEFAULT '[]', -- JSON array of user IDs

    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_created_by ON analytics_dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_shared ON analytics_dashboards(is_shared);

-- ============================================================
-- ANALYTICS REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_status ON analytics_reports(status);

CREATE TABLE IF NOT EXISTS analytics_report_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    executed_at TIMESTAMPTZ DEFAULT NOW(),
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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_business_metrics_category ON business_metrics(category);
CREATE INDEX IF NOT EXISTS idx_business_metrics_active ON business_metrics(is_active);

CREATE TABLE IF NOT EXISTS business_metric_values (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_id TEXT NOT NULL,

    -- Value
    value REAL NOT NULL,

    -- Metadata
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (metric_id) REFERENCES business_metrics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_metric_values_metric ON business_metric_values(metric_id);
CREATE INDEX IF NOT EXISTS idx_business_metric_values_date ON business_metric_values(recorded_at);

-- ============================================================
-- PREDICTIVE MODELS
-- ============================================================

CREATE TABLE IF NOT EXISTS predictive_models (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,

    -- Model configuration
    model_type TEXT DEFAULT 'linear_regression', -- linear_regression, logistic, random_forest, xgboost, churn, revenue, growth
    target_metric TEXT,
    features_json TEXT DEFAULT '[]', -- Input features
    model_parameters_json TEXT DEFAULT '{}', -- Hyperparameters / trained parameters

    -- Status
    status TEXT DEFAULT 'draft', -- draft, training, trained, deployed, archived
    last_trained_at TEXT,

    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_predictive_models_type ON predictive_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_status ON predictive_models(status);

CREATE TABLE IF NOT EXISTS predictive_model_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    model_id TEXT NOT NULL,

    -- Training results
    accuracy_score REAL,
    precision_score REAL,
    recall_score REAL,
    f1_score REAL,
    training_samples INTEGER,
    validation_samples INTEGER,
    -- Live caller (POST /models/:id/train, /models/:id/predict) stores the computed
    -- trained-parameters payload here; not present in the original (never-ran) 238 draft.
    parameters_json TEXT,

    -- Performance
    training_time_seconds REAL,

    -- Status
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    error_message TEXT,

    -- Metadata
    run_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_model ON predictive_model_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_date ON predictive_model_runs(run_at);

CREATE TABLE IF NOT EXISTS predictive_model_predictions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    model_id TEXT NOT NULL,

    -- Prediction
    -- prediction_type / prediction_result_json: needed by the live caller
    -- (POST /models/:id/predict); not present in the original (never-ran) 238 draft.
    prediction_type TEXT,
    input_data_json TEXT,
    prediction_result_json TEXT,
    predicted_value REAL,
    confidence_score REAL,
    actual_value REAL, -- For tracking accuracy

    -- Metadata
    predicted_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_model ON predictive_model_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_date ON predictive_model_predictions(predicted_at);
