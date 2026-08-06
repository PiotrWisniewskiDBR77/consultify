-- Strict dated-order producer for sponsor-report extensions introduced next.
CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    executive_summary TEXT,
    detailed_analysis TEXT,
    recommendations TEXT,
    benchmark_data TEXT,
    generated_by TEXT DEFAULT 'ai',
    generation_params TEXT,
    public_link_id TEXT,
    public_link_expires_at TIMESTAMP,
    public_link_password TEXT,
    last_export_format TEXT,
    last_export_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
