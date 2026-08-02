-- INT-01 — immutable publication versions for Interview Library templates.

ALTER TABLE IF EXISTS public.interview_library_templates
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'org';

ALTER TABLE IF EXISTS public.interview_library_template_questions
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS evidence_prompt text,
    ADD COLUMN IF NOT EXISTS answer_type text DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS help_hint text,
    ADD COLUMN IF NOT EXISTS answer_options text DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS expected_answer_shape text,
    ADD COLUMN IF NOT EXISTS allow_voice integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS allow_file_upload integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS allow_url integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS allow_context_note integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS section_title text,
    ADD COLUMN IF NOT EXISTS guidance text,
    ADD COLUMN IF NOT EXISTS example_answer text;

ALTER TABLE IF EXISTS public.interview_questions
    ADD COLUMN IF NOT EXISTS evidence_prompt text;

CREATE TABLE IF NOT EXISTS public.interview_library_template_versions (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    template_id text NOT NULL,
    organization_id text NOT NULL,
    version integer NOT NULL,
    snapshot_json jsonb NOT NULL,
    published_by text NOT NULL,
    published_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_int001_template_version_unique
    ON public.interview_library_template_versions (template_id, version);

CREATE INDEX IF NOT EXISTS idx_int001_template_version_org
    ON public.interview_library_template_versions (organization_id, template_id, version DESC);
