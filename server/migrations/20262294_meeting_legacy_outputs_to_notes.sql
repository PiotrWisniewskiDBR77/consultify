-- U-52 etap 3: legacy `meetings` przestaje być źródłem decyzji i działań.
-- Istniejące dane przenosimy do zatwierdzonej, governed `meeting_notes`, a
-- wskaźnik na spotkaniu pozwala warstwie kompatybilnej czytać jeden kanon.
-- [ODMROZENIE 08_MEETINGS DEC-650]

BEGIN;

CREATE OR REPLACE FUNCTION u52_legacy_safe_jsonb_array(raw text) RETURNS jsonb AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN '[]'::jsonb; END IF;
  IF jsonb_typeof(raw::jsonb) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  RETURN raw::jsonb;
EXCEPTION WHEN others THEN
  RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION u52_legacy_safe_timestamptz(raw text) RETURNS timestamptz AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  RETURN raw::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

WITH decision_payloads AS (
  SELECT
    m.id AS meeting_id,
    COALESCE(
      jsonb_agg(
        CASE
          WHEN jsonb_typeof(item.value) = 'string'
            THEN jsonb_build_object('decision', item.value #>> '{}')
          WHEN jsonb_typeof(item.value) = 'object' AND item.value ? 'decision'
            THEN item.value
          ELSE NULL
        END
        ORDER BY item.ordinality
      ) FILTER (
        WHERE (jsonb_typeof(item.value) = 'string' AND btrim(item.value #>> '{}') <> '')
           OR (jsonb_typeof(item.value) = 'object'
               AND item.value ? 'decision'
               AND btrim(COALESCE(item.value ->> 'decision', '')) <> '')
      ),
      '[]'::jsonb
    ) AS decisions
  FROM meetings m
  LEFT JOIN LATERAL jsonb_array_elements(u52_legacy_safe_jsonb_array(m.decisions_json))
    WITH ORDINALITY AS item(value, ordinality) ON TRUE
  GROUP BY m.id
), action_payloads AS (
  SELECT
    m.id AS meeting_id,
    COALESCE(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'task', f.title,
          'owner', NULLIF(btrim(f.owner), ''),
          'deadline', NULLIF(btrim(f.due_at), '')
        ))
        ORDER BY f.created_at, f.id
      ) FILTER (
        WHERE f.id IS NOT NULL
          AND btrim(f.title) <> ''
          AND COALESCE(f.source_kind, 'manual') <> 'note'
      ),
      '[]'::jsonb
    ) AS actions
  FROM meetings m
  LEFT JOIN meeting_follow_ups f ON f.meeting_id = m.id
  GROUP BY m.id
), candidates AS (
  SELECT m.*, d.decisions, a.actions
  FROM meetings m
  JOIN decision_payloads d ON d.meeting_id = m.id
  JOIN action_payloads a ON a.meeting_id = m.id
  WHERE m.approved_minutes_note_id IS NULL
    AND (jsonb_array_length(d.decisions) > 0 OR jsonb_array_length(a.actions) > 0)
)
INSERT INTO meeting_notes (
  id, organization_id, meeting_id, source, language, transcript_hash,
  summary, key_points_json, decisions_json, action_items_json, status,
  proposal_id, idempotency_key, created_by, created_at, updated_at
)
SELECT
  'legacy-meeting-note-' || md5(c.organization_id || ':' || c.id),
  c.organization_id,
  c.id,
  'heuristic',
  'en',
  md5('legacy-cutover:' || c.organization_id || ':' || c.id),
  '',
  '[]',
  c.decisions::text,
  c.actions::text,
  'approved',
  NULL,
  'legacy-cutover:' || c.id,
  c.created_by,
  COALESCE(u52_legacy_safe_timestamptz(c.created_at::text), NOW()),
  COALESCE(u52_legacy_safe_timestamptz(c.updated_at::text), NOW())
FROM candidates c
ON CONFLICT DO NOTHING;

UPDATE meetings m
SET approved_minutes_note_id = n.id,
    approved_minutes_at = COALESCE(m.approved_minutes_at, n.updated_at)
FROM meeting_notes n
WHERE n.organization_id = m.organization_id
  AND n.meeting_id = m.id
  AND n.idempotency_key = 'legacy-cutover:' || m.id
  AND n.status = 'approved'
  AND m.approved_minutes_note_id IS NULL;

DROP FUNCTION IF EXISTS u52_legacy_safe_jsonb_array(text);
DROP FUNCTION IF EXISTS u52_legacy_safe_timestamptz(text);

COMMIT;
