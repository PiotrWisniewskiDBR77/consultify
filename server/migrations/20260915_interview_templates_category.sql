-- DEC-519: separate interview template subject category from interview length/format.
-- Additive and idempotent. The V6 mapping is intentionally constrained to the
-- 18 global system templates; organization/private templates are untouched.

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS format TEXT;

DO $$
DECLARE
  target_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO target_count
  FROM interview_library_templates
  WHERE id LIKE 'v6_t%'
    AND organization_id IS NULL
    AND template_scope = 'system'
    AND created_by = 'system';

  -- The strict schema runner intentionally excludes every file containing
  -- `seed`; a completely empty installation therefore reaches this migration
  -- before product seed data exists. Zero is an honest schema-only no-op.
  IF target_count NOT IN (0, 18) THEN
    RAISE EXCEPTION 'DEC-519 expected 0 or 18 global V6 interview templates, found %', target_count;
  END IF;
END $$;

UPDATE interview_library_templates
SET format = CASE LOWER(TRIM(category))
  WHEN 'pulse' THEN 'pulse'
  WHEN 'standard' THEN 'standard'
  WHEN 'deep dive' THEN 'deep_dive'
  WHEN 'deep_dive' THEN 'deep_dive'
END
WHERE id LIKE 'v6_t%'
  AND organization_id IS NULL
  AND template_scope = 'system'
  AND created_by = 'system'
  AND NULLIF(TRIM(format), '') IS NULL;

DO $$
DECLARE
  unmapped_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO unmapped_count
  FROM interview_library_templates
  WHERE id LIKE 'v6_t%'
    AND organization_id IS NULL
    AND template_scope = 'system'
    AND created_by = 'system'
    AND format NOT IN ('pulse', 'standard', 'deep_dive');

  IF unmapped_count <> 0 THEN
    RAISE EXCEPTION 'DEC-519 could not preserve format for % V6 templates', unmapped_count;
  END IF;
END $$;

WITH classified(id, category) AS (
  VALUES
    ('v6_t01_quick_company_snapshot', 'strategy'),
    ('v6_t02_leadership_alignment_pulse', 'strategy'),
    ('v6_t03_strategic_direction_discovery', 'strategy'),
    ('v6_t04_operating_model_fit', 'strategy'),
    ('v6_t05_operational_excellence_discovery', 'operations'),
    ('v6_t06_process_pain_mapping', 'operations'),
    ('v6_t07_manufacturing_walkthrough', 'operations'),
    ('v6_t08_digital_landscape_discovery', 'digital'),
    ('v6_t09_automation_readiness', 'digital'),
    ('v6_t10_data_reporting_maturity', 'data'),
    ('v6_t11_finance_baseline', 'finance'),
    ('v6_t12_cost_efficiency_review', 'cost'),
    ('v6_t13_working_capital_cash', 'finance'),
    ('v6_t14_customer_experience_discovery', 'commercial'),
    ('v6_t15_commercial_pipeline_forecast', 'commercial'),
    ('v6_t16_organization_roles_clarity', 'people'),
    ('v6_t17_change_readiness', 'people'),
    ('v6_t18_quality_compliance_risk', 'operations')
)
UPDATE interview_library_templates AS template
SET category = classified.category
FROM classified
WHERE template.id = classified.id
  AND template.organization_id IS NULL
  AND template.template_scope = 'system'
  AND template.created_by = 'system'
  AND template.category IS DISTINCT FROM classified.category;

DO $$
DECLARE
  distribution jsonb;
BEGIN
  SELECT jsonb_object_agg(category, amount) INTO distribution
  FROM (
    SELECT category, COUNT(*)::integer AS amount
    FROM interview_library_templates
    WHERE id LIKE 'v6_t%'
      AND organization_id IS NULL
      AND template_scope = 'system'
      AND created_by = 'system'
    GROUP BY category
  ) measured;

  IF distribution IS NOT NULL
     AND distribution <> '{"commercial":2,"cost":1,"data":1,"digital":2,"finance":2,"operations":4,"people":2,"strategy":4}'::jsonb THEN
    RAISE EXCEPTION 'DEC-519 unexpected category distribution: %', distribution;
  END IF;
END $$;
