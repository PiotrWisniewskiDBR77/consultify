-- D-124 / DEC-650: keep denormalized interview session counters aligned with
-- the canonical interview_questions rows. Existing drift is repaired once by
-- the recount call at the end; the function remains available for an explicit,
-- idempotent operational recount after deployment.

CREATE OR REPLACE FUNCTION recount_interview_session_question_counters(
  p_session_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_sessions INTEGER := 0;
BEGIN
  WITH actual AS (
    SELECT
      s.id AS session_id,
      COUNT(q.id)::INTEGER AS total_questions,
      COUNT(q.id) FILTER (
        WHERE LOWER(REPLACE(TRIM(COALESCE(q.status, '')), '-', '_')) = 'answered'
      )::INTEGER AS answered_questions
    FROM interview_sessions s
    LEFT JOIN interview_questions q ON q.session_id = s.id
    WHERE p_session_id IS NULL OR s.id = p_session_id
    GROUP BY s.id
  )
  UPDATE interview_sessions s
     SET total_questions = actual.total_questions,
         answered_questions = actual.answered_questions
    FROM actual
   WHERE s.id = actual.session_id
     AND (
       COALESCE(s.total_questions, 0) IS DISTINCT FROM actual.total_questions
       OR COALESCE(s.answered_questions, 0) IS DISTINCT FROM actual.answered_questions
     );

  GET DIAGNOSTICS updated_sessions = ROW_COUNT;
  RETURN updated_sessions;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_interview_session_counters_after_question_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE interview_sessions
     SET total_questions = GREATEST(COALESCE(total_questions, 0) - 1, 0),
         answered_questions = GREATEST(
           COALESCE(answered_questions, 0) -
             CASE
               WHEN LOWER(REPLACE(TRIM(COALESCE(OLD.status, '')), '-', '_')) = 'answered'
                 THEN 1
               ELSE 0
             END,
           0
         )
   WHERE id = OLD.session_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_interview_question_delete_counters ON interview_questions;
CREATE TRIGGER trg_interview_question_delete_counters
AFTER DELETE ON interview_questions
FOR EACH ROW
EXECUTE FUNCTION decrement_interview_session_counters_after_question_delete();

SELECT recount_interview_session_question_counters(NULL);
