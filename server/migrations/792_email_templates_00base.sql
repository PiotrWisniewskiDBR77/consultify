-- Strict runtime-order producer for the email template registry consumed by 793.
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    template_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    available_variables TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, template_key)
);
