-- V6-INTERVIEW-RUNTIME-001
-- Purpose:
--  - extend interview runtime answers for one-question-per-screen V6
--  - support voice transcript approval, context notes and raw answer payloads
--  - prepare evidence rows for knowledge ingestion tracking

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT 'open';

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
