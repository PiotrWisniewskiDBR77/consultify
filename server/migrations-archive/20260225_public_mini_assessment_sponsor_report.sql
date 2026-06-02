-- =====================================================
-- Bundle 03B: T015 Public Mini Assessment + T017 Sponsor Report
-- =====================================================

-- T015: Public mini-assessment results
CREATE TABLE IF NOT EXISTS public_mini_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  token TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'en',
  template_id TEXT NOT NULL DEFAULT 'default_v1',
  answers_json JSONB DEFAULT '[]'::JSONB,
  ai_result_json JSONB,
  respondent_email TEXT,
  respondent_name TEXT,
  source_campaign TEXT,
  partner_code TEXT,
  utm_params JSONB DEFAULT '{}'::JSONB,
  organization_id TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_public_mini_assessments_token ON public_mini_assessments(token);
CREATE INDEX IF NOT EXISTS idx_public_mini_assessments_org ON public_mini_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_public_mini_assessments_status ON public_mini_assessments(status);
CREATE INDEX IF NOT EXISTS idx_public_mini_assessments_partner ON public_mini_assessments(partner_code);

-- T017: Sponsor report workflow columns on existing assessment_reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='sponsor_mode') THEN
    ALTER TABLE assessment_reports ADD COLUMN sponsor_mode BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='insight_source_ids') THEN
    ALTER TABLE assessment_reports ADD COLUMN insight_source_ids JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='assumptions_json') THEN
    ALTER TABLE assessment_reports ADD COLUMN assumptions_json JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='unknowns_json') THEN
    ALTER TABLE assessment_reports ADD COLUMN unknowns_json JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='counterpoints_json') THEN
    ALTER TABLE assessment_reports ADD COLUMN counterpoints_json JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='utilization_notes') THEN
    ALTER TABLE assessment_reports ADD COLUMN utilization_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='utilized_at') THEN
    ALTER TABLE assessment_reports ADD COLUMN utilized_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='approved_by') THEN
    ALTER TABLE assessment_reports ADD COLUMN approved_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_reports' AND column_name='rejected_reason') THEN
    ALTER TABLE assessment_reports ADD COLUMN rejected_reason TEXT;
  END IF;
END $$;
