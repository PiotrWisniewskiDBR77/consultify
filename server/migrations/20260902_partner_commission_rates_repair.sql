-- PRT-BVP-001 / PRT-MVP-LEGACY-CUTOVER-001
--
-- Migration 217 declared this Partner-owned lookup, but it is absent from a
-- current fresh canonical replay. Recreate only that missing contract. Existing
-- operator-configured tier rows win on replay; the repair never resets rates.

CREATE TABLE IF NOT EXISTS partner_commission_rates (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tier TEXT NOT NULL UNIQUE,
    tier_name TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 10.00,
    min_revenue REAL DEFAULT 0,
    color TEXT DEFAULT 'bg-slate-500',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO partner_commission_rates (id, tier, tier_name, rate, min_revenue, color) VALUES
    (gen_random_uuid()::text, 'REGISTERED', 'Registered', 10.00, 0, 'bg-slate-500'),
    (gen_random_uuid()::text, 'BRONZE', 'Bronze', 12.00, 5000, 'bg-amber-600'),
    (gen_random_uuid()::text, 'SILVER', 'Silver', 15.00, 15000, 'bg-slate-400'),
    (gen_random_uuid()::text, 'GOLD', 'Gold', 18.00, 50000, 'bg-yellow-500'),
    (gen_random_uuid()::text, 'PLATINUM', 'Platinum', 20.00, 100000, 'bg-violet-500')
ON CONFLICT (tier) DO NOTHING;
