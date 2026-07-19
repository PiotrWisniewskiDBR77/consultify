-- RED partia 2: brakująca tabela metrics_events (42P01)
-- Readers:
--   server/src/services/metricsCollector.ts (JEDYNY writer + getEvents/getEventTimeSeries/
--     getUniqueOrgCount/getEventsBySource) -> id, event_type, user_id, organization_id, source, context, created_at
--   server/src/ai/aiContextBuilder.ts -> SELECT event_type, created_at WHERE organization_id
--   server/src/ai/aiCoach.ts -> odczyt metrics_events
-- Schemat wywiedziony z INSERT metricsCollector.ts (linia 167). Dialekt Postgres.
-- Idempotentne: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS metrics_events (
    id              TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    user_id         TEXT,
    organization_id TEXT,
    source          TEXT,
    context         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_events_type ON metrics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_metrics_events_org ON metrics_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_metrics_events_created ON metrics_events(created_at);
