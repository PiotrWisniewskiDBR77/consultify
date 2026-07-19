-- V6-INTERVIEW-RUNTIME-001
-- Purpose:
--  - extend interview runtime answers for one-question-per-screen V6
--  - support voice transcript approval, context notes and raw answer payloads
--  - prepare evidence rows for knowledge ingestion tracking

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT 'open';

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS is_required INTEGER DEFAULT 0;

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS runtime_mode_default TEXT DEFAULT 'single_question';

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS expected_answer_shape TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS allow_voice INTEGER DEFAULT 0;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS allow_file_upload INTEGER DEFAULT 0;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS allow_url INTEGER DEFAULT 0;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS allow_context_note INTEGER DEFAULT 1;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_mode TEXT DEFAULT 'text';

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_payload TEXT DEFAULT '{}';

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS context_note TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS voice_transcript TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS voice_transcript_status TEXT DEFAULT 'none';

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS voice_audio_evidence_id TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS source_template_question_id TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_knowledge_doc_id TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS context_note_knowledge_doc_id TEXT;

ALTER TABLE interview_evidence
  ADD COLUMN IF NOT EXISTS evidence_role TEXT DEFAULT 'supporting';

ALTER TABLE interview_evidence
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;

ALTER TABLE interview_evidence
  ADD COLUMN IF NOT EXISTS ingest_to_knowledge INTEGER DEFAULT 1;

-- Normalize to the canonical INTEGER type on drifted DBs where the column is
-- BOOLEAN (the ADD COLUMN above is then a no-op and the `= 1` UPDATE below
-- fails). Convert true→1 / false→0.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_evidence' AND column_name = 'ingest_to_knowledge'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE interview_evidence ALTER COLUMN ingest_to_knowledge DROP DEFAULT;
    ALTER TABLE interview_evidence ALTER COLUMN ingest_to_knowledge TYPE INTEGER
      USING (CASE WHEN ingest_to_knowledge THEN 1 ELSE 0 END);
    ALTER TABLE interview_evidence ALTER COLUMN ingest_to_knowledge SET DEFAULT 1;
  END IF;
END $$;

ALTER TABLE interview_evidence
  ADD COLUMN IF NOT EXISTS knowledge_document_id TEXT;

UPDATE interview_questions
SET answer_mode = CASE
  WHEN COALESCE(TRIM(answer_text), '') = '' THEN 'empty'
  ELSE 'text'
END
WHERE answer_mode IS NULL
   OR answer_mode = '';

UPDATE interview_questions
SET voice_transcript_status = 'none'
WHERE voice_transcript_status IS NULL
   OR voice_transcript_status = '';

UPDATE interview_questions
SET answer_payload = '{}'
WHERE answer_payload IS NULL
   OR answer_payload = '';

UPDATE interview_evidence
SET evidence_role = 'supporting'
WHERE evidence_role IS NULL
   OR evidence_role = '';

UPDATE interview_evidence
SET ingest_to_knowledge = 1
WHERE ingest_to_knowledge IS NULL;

UPDATE interview_sessions
SET runtime_mode_default = 'single_question'
WHERE runtime_mode_default IS NULL
   OR runtime_mode_default = '';
