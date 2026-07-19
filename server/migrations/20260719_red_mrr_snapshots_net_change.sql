-- RED partia 2: brakująca kolumna mrr_snapshots.net_mrr_change (42703)
-- Reader: server/src/services/analytics/MrrAnalyticsService.ts getMRRTrend() -> SELECT net_mrr_change
-- Writer: server/src/services/analytics/SnapshotService.ts -> INSERT ... net_mrr_change (movement.netMRRChange)
-- Tabela mrr_snapshots ISTNIEJE na parity, brak tylko tej kolumny. Pozostałe *_mrr kolumny to typ real.
-- Idempotentne: ADD COLUMN IF NOT EXISTS.

ALTER TABLE mrr_snapshots ADD COLUMN IF NOT EXISTS net_mrr_change REAL DEFAULT 0;
