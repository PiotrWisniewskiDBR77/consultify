-- DEC-519 additive rollback: restore the former format-in-category values.
-- Keep the nullable `format` column so rollback never drops data/schema.

UPDATE interview_library_templates
SET category = CASE format
      WHEN 'pulse' THEN 'Pulse'
      WHEN 'standard' THEN 'Standard'
      WHEN 'deep_dive' THEN 'Deep Dive'
      ELSE category
    END,
    format = NULL
WHERE id LIKE 'v6_t%'
  AND organization_id IS NULL
  AND template_scope = 'system'
  AND created_by = 'system'
  AND format IN ('pulse', 'standard', 'deep_dive');
