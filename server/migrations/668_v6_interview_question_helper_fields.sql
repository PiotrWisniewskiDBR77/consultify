-- V6-INTERVIEW-RUNTIME-002
-- Purpose: add helper text and evidence prompt fields to interview questions
-- These support the V6 runtime: description shows below question text,
-- evidence_prompt encourages respondent to attach supporting materials.

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS evidence_prompt TEXT;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answer_options TEXT;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS evidence_prompt TEXT;
