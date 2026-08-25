CREATE TABLE IF NOT EXISTS calendar_events (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    owner_id             TEXT NOT NULL,

    title                TEXT NOT NULL,
    description          TEXT DEFAULT '',
    location             TEXT DEFAULT '',

    start_at             TEXT NOT NULL,
    end_at               TEXT NOT NULL,
    all_day              INTEGER DEFAULT 0,

    attendees_json       TEXT DEFAULT '[]',
    visibility           TEXT DEFAULT 'private',
    status               TEXT DEFAULT 'confirmed',

    related_type         TEXT,
    related_id           TEXT,

    recurrence_rule      TEXT,
    recurrence_parent_id TEXT,

    created_by           TEXT NOT NULL,
    created_at           TEXT DEFAULT (now()::text),
    updated_at           TEXT DEFAULT (now()::text)
);

-- Main "my week" read path (the dominant owner-scoped calendar query).
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_range
    ON calendar_events(organization_id, owner_id, start_at);

-- Organization/team availability and overlapping-range queries.
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_range
    ON calendar_events(organization_id, start_at, end_at);

-- Finds time blocks reserved for one polymorphic task/initiative/meeting.
CREATE INDEX IF NOT EXISTS idx_calendar_events_related
    ON calendar_events(organization_id, related_type, related_id);
