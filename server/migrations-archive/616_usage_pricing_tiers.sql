-- Usage Pricing Tiers
-- Stores configurable per-unit rates for usage-based billing (tokens, storage, users, API calls, etc.)

CREATE TABLE IF NOT EXISTS usage_pricing_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  tier_type TEXT DEFAULT 'standard',
  min_quantity INTEGER DEFAULT 0,
  max_quantity INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default tiers matching the original hardcoded values
INSERT OR IGNORE INTO usage_pricing_tiers (id, name, unit, price_per_unit, currency, tier_type, min_quantity, max_quantity, is_active)
VALUES
  ('upt-token-overage', 'Token Overage Rate', 'per 1,000 tokens', 0.002, 'USD', 'overage', 0, NULL, 1),
  ('upt-storage-overage', 'Storage Overage Rate', 'per GB', 0.10, 'USD', 'overage', 0, NULL, 1),
  ('upt-user-overage', 'User Overage Rate', 'per user', 5.00, 'USD', 'overage', 0, NULL, 1);
