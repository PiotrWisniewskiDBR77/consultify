-- D-124 rollback: remove the ongoing delete guard and recount helper.
-- Repaired counter values are truthful projections and are intentionally kept.

DROP TRIGGER IF EXISTS trg_interview_question_delete_counters ON interview_questions;
DROP FUNCTION IF EXISTS decrement_interview_session_counters_after_question_delete();
DROP FUNCTION IF EXISTS recount_interview_session_question_counters(TEXT);
