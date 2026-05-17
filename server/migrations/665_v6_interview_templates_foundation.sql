-- V6-INTERVIEW-FOUNDATION-001
-- Purpose:
--  - extend interview template library with V6 metadata
--  - add template scopes: system / organization / private
--  - add audience, duration and runtime defaults
--  - add question modality flags for voice / attachment / link / context

CREATE TABLE IF NOT EXISTS interview_library_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT DEFAULT 'approved',
  visibility TEXT DEFAULT 'org',
  is_default INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_library_template_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  template_id TEXT NOT NULL REFERENCES interview_library_templates(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  question_text TEXT NOT NULL,
  answer_type TEXT DEFAULT 'open',
  is_required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  helper_text TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_library_templates_org ON interview_library_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_library_templates_status ON interview_library_templates(status);
CREATE INDEX IF NOT EXISTS idx_interview_library_templates_category ON interview_library_templates(category);
CREATE INDEX IF NOT EXISTS idx_interview_library_questions_template ON interview_library_template_questions(template_id);

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS template_scope TEXT DEFAULT 'organization';

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS audience TEXT;

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER DEFAULT 10;

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS runtime_mode_default TEXT DEFAULT 'one_question_per_screen';

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS source_template_id TEXT;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS expected_answer_shape TEXT;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS allow_voice INTEGER DEFAULT 0;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS allow_file_upload INTEGER DEFAULT 0;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS allow_url INTEGER DEFAULT 0;

ALTER TABLE interview_library_template_questions
  ADD COLUMN IF NOT EXISTS allow_context_note INTEGER DEFAULT 1;

UPDATE interview_library_templates
SET template_scope = CASE
  WHEN organization_id IS NULL THEN 'system'
  ELSE 'organization'
END
WHERE template_scope IS NULL
   OR template_scope = '';

UPDATE interview_library_templates
SET audience = CASE category
  WHEN 'OPERATIONAL' THEN 'Operations leaders / process owners'
  WHEN 'DIGITAL' THEN 'IT / OT / operations / analytics'
  WHEN 'COST' THEN 'Finance + business owners'
  WHEN 'DATA' THEN 'BI / controlling / process owners'
  WHEN 'STANDARD' THEN 'Operations / quality / training'
  WHEN 'QUICK' THEN 'Sponsor / manager / owner'
  ELSE 'Managers / business stakeholders'
END
WHERE audience IS NULL;

UPDATE interview_library_templates
SET estimated_time_minutes = CASE category
  WHEN 'QUICK' THEN 6
  WHEN 'OPERATIONAL' THEN 15
  WHEN 'DIGITAL' THEN 14
  WHEN 'COST' THEN 12
  WHEN 'DATA' THEN 12
  WHEN 'STANDARD' THEN 12
  ELSE 10
END
WHERE estimated_time_minutes IS NULL
   OR estimated_time_minutes = 10;

UPDATE interview_library_templates
SET runtime_mode_default = 'one_question_per_screen'
WHERE runtime_mode_default IS NULL
   OR runtime_mode_default = '';

UPDATE interview_library_template_questions
SET expected_answer_shape = CASE answer_type
  WHEN 'number' THEN 'Provide a numeric answer or estimate'
  WHEN 'select' THEN 'Choose the best matching option'
  WHEN 'scale' THEN 'Rate on the available scale and explain if useful'
  WHEN 'boolean' THEN 'Answer yes/no and add context if needed'
  ELSE 'Provide a short factual answer in plain language'
END
WHERE expected_answer_shape IS NULL;

UPDATE interview_library_template_questions
SET allow_context_note = 1
WHERE allow_context_note IS NULL;
