-- Customer Contracts Tables
-- Migration: 202_customer_contracts.sql

-- Contracts
CREATE TABLE IF NOT EXISTS customer_contracts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contract_type TEXT DEFAULT 'subscription',
    start_date DATE NOT NULL,
    end_date DATE,
    renewal_date DATE,
    value DECIMAL(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active',
    terms_json TEXT DEFAULT '{}',
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_org ON customer_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON customer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON customer_contracts(renewal_date);

-- Sample contracts
INSERT OR IGNORE INTO customer_contracts (id, organization_id, contract_type, start_date, end_date, renewal_date, value, currency, status) 
SELECT 
    'contract-' || substr(o.id, 1, 8),
    o.id,
    CASE 
        WHEN o.plan = 'ENTERPRISE' THEN 'enterprise'
        WHEN o.plan = 'PRO' THEN 'subscription'
        ELSE 'subscription'
    END,
    date('now', '-6 months'),
    date('now', '+6 months'),
    date('now', '+5 months'),
    CASE 
        WHEN o.plan = 'ENTERPRISE' THEN 12000.00
        WHEN o.plan = 'PRO' THEN 2400.00
        ELSE 600.00
    END,
    'USD',
    'active'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM customer_contracts WHERE organization_id = o.id);
