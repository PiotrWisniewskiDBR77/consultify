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

-- FIX-M-4b (D.4/D.5 owner review, 2026-08-25): `meetings.decisions_json` is a
-- free-text TEXT column with no format enforcement at the write side (see
-- meeting.routes.ts createMeeting — accepts whatever the client sends before
-- the direct-write path was retired). A bare `m.decisions_json::jsonb` cast
-- below would abort this ENTIRE migration/replay on the first row of demo
-- data holding malformed legacy JSON (or plain non-JSON text). Mirrors the
-- established fail-soft helper pattern (`mw_safe_jsonb`,
-- 20260805_m02p03_inbox_projection_lifecycle.sql:75-84) but returns an EMPTY
-- ARRAY, not an empty object, because the caller feeds it straight into
-- `jsonb_array_elements_text` — an object there would raise its own cast
-- error. Also guards the "valid JSON but not an array" case (e.g. a bare
-- string or object slipped into decisions_json) the same way.
CREATE OR REPLACE FUNCTION meeting_decisions_day10_safe_jsonb_array(raw text) RETURNS jsonb AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '[]'::jsonb;
  END IF;
  BEGIN
    parsed := raw::jsonb;
  EXCEPTION WHEN others THEN
    RETURN '[]'::jsonb;
  END;
  IF jsonb_typeof(parsed) IS DISTINCT FROM 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN parsed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
    meeting_decisions_day10_safe_jsonb_array(m.decisions_json)
) WITH ORDINALITY AS legacy(statement, ordinality)
WHERE btrim(legacy.statement) <> ''
ON CONFLICT DO NOTHING;

-- Migration-local helper, not needed after the backfill above runs.
DROP FUNCTION IF EXISTS meeting_decisions_day10_safe_jsonb_array(text);
