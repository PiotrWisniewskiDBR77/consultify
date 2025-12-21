-- Migration: Phase G Referrals and Ecosystem Participation
-- Created: 2025-12-21

-- Referral codes table
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    use_count INTEGER DEFAULT 0,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Referral usage tracking
CREATE TABLE IF NOT EXISTS referral_uses (
    id TEXT PRIMARY KEY,
    referral_id TEXT NOT NULL,
    used_by_user_id TEXT NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resulted_in_org_id TEXT,
    FOREIGN KEY (referral_id) REFERENCES referrals(id),
    FOREIGN KEY (used_by_user_id) REFERENCES users(id),
    FOREIGN KEY (resulted_in_org_id) REFERENCES organizations(id)
);

-- Benchmark participation (opt-in)
CREATE TABLE IF NOT EXISTS benchmark_participation (
    organization_id TEXT PRIMARY KEY,
    opted_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    industry_category TEXT,
    opted_out_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON referrals(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referral ON referral_uses(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_user ON referral_uses(used_by_user_id);
