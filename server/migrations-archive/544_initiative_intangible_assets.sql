-- ==========================================
-- INITIATIVE INTANGIBLE ASSETS TABLE
-- ==========================================
-- Licenses, training, knowledge, certifications, IP, legal rights

CREATE TABLE IF NOT EXISTS initiative_intangible_assets (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    asset_type TEXT NOT NULL DEFAULT 'license',    -- 'license', 'training', 'certification', 'knowledge', 'ip', 'legal_right', 'other'
    name TEXT NOT NULL,
    provider TEXT,                                  -- training vendor, license issuer, etc.
    cost REAL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PLN',
    valid_from DATE,
    valid_until DATE,
    status TEXT DEFAULT 'planned',                  -- 'planned', 'active', 'expired', 'renewed'
    beneficiaries TEXT,                             -- who benefits (team/person names or "all")
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_intangible_assets_initiative ON initiative_intangible_assets(initiative_id);
