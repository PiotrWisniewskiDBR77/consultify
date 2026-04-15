ALTER TABLE interview_library_templates
ADD COLUMN IF NOT EXISTS area_tags TEXT DEFAULT '[]';
