-- Day 10 Meetings: additive structured decisions and follow-up provenance.
-- No foreign keys: meetings and meeting_follow_ups may be bootstrapped lazily.

CREATE TABLE IF NOT EXISTS meeting_decisions (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL,
    meeting_id         TEXT NOT NULL,
    statement          TEXT NOT NULL,
    rationale          TEXT DEFAULT '',
    decided_by         TEXT,
    decided_at         TEXT,
    status             TEXT DEFAULT 'recorded',
    source_kind        TEXT DEFAULT 'manual',
    source_note_id     TEXT,
    source_index       INTEGER,
    created_by         TEXT NOT NULL,
    created_at         TEXT DEFAULT (now()::text),
    updated_at         TEXT DEFAULT (now()::text)
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_org_meeting_created
    ON meeting_decisions(organization_id, meeting_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_decisions_source_dedup
    ON meeting_decisions(
        organization_id,
        meeting_id,
        source_kind,
        COALESCE(source_note_id, ''),
        source_index
    )
    WHERE source_index IS NOT NULL;

ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS due_at TEXT;
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS source_kind TEXT DEFAULT 'manual';
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS source_note_id TEXT;
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS source_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_follow_ups_source_dedup
    ON meeting_follow_ups(
        meeting_id,
        source_kind,
        COALESCE(source_note_id, ''),
        source_index
    )
    WHERE source_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_org_status
    ON meeting_follow_ups(organization_id, status);

INSERT INTO meeting_decisions (
    id,
    organization_id,
    meeting_id,
    statement,
    status,
    source_kind,
    source_index,
    created_by,
    created_at,
    updated_at
)
SELECT
    'legacy-' || md5(m.id || ':' || legacy.ordinality::text),
    m.organization_id,
    m.id,
    legacy.statement,
    'recorded',
    'legacy',
    legacy.ordinality - 1,
    m.created_by,
    COALESCE(m.created_at, now()::text),
    COALESCE(m.updated_at, m.created_at, now()::text)
FROM meetings AS m
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN m.decisions_json IS NULL OR btrim(m.decisions_json) = '' THEN '[]'::jsonb
        ELSE m.decisions_json::jsonb
    END
) WITH ORDINALITY AS legacy(statement, ordinality)
WHERE btrim(legacy.statement) <> ''
ON CONFLICT DO NOTHING;
