-- U-52 etap 3 rollback: usuwa wyłącznie notatki utworzone przez cutover legacy.
-- Historyczne kolumny i wiersze follow-up pozostają nietknięte.

BEGIN;

UPDATE meetings m
SET approved_minutes_note_id = NULL,
    approved_minutes_at = CASE
      WHEN m.approved_minutes_at = n.updated_at THEN NULL
      ELSE m.approved_minutes_at
    END
FROM meeting_notes n
WHERE m.approved_minutes_note_id = n.id
  AND n.id = 'legacy-meeting-note-' || md5(n.organization_id || ':' || n.meeting_id)
  AND n.idempotency_key = 'legacy-cutover:' || n.meeting_id
  AND n.proposal_id IS NULL;

DELETE FROM meeting_notes n
WHERE n.id = 'legacy-meeting-note-' || md5(n.organization_id || ':' || n.meeting_id)
  AND n.idempotency_key = 'legacy-cutover:' || n.meeting_id
  AND n.proposal_id IS NULL;

COMMIT;
