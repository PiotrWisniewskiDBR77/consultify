-- =====================================================
-- T067: CV-Based Role and Task Matching Engine
-- =====================================================

-- Candidate profiles (internal employees or external candidates)
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  candidate_type TEXT NOT NULL DEFAULT 'internal' CHECK (candidate_type IN ('internal','external','vendor')),
  user_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_org ON candidate_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user ON candidate_profiles(user_id);

-- CV documents (uploaded files metadata)
CREATE TABLE IF NOT EXISTS candidate_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf','docx','txt')),
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','extracting','extracted','mapping','mapped','ready','error')),
  extracted_text TEXT,
  extracted_sections JSONB DEFAULT '{}'::JSONB,
  error_message TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate ON candidate_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_org ON candidate_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_status ON candidate_documents(status);

-- Competency signals extracted from CV
CREATE TABLE IF NOT EXISTS candidate_competency_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES candidate_documents(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  inferred_level INTEGER NOT NULL CHECK (inferred_level BETWEEN 1 AND 5),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence BETWEEN 0.00 AND 1.00),
  evidence_snippets JSONB DEFAULT '[]'::JSONB,
  approved BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  manual_override_level INTEGER CHECK (manual_override_level IS NULL OR manual_override_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signals_candidate ON candidate_competency_signals(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_signals_capability ON candidate_competency_signals(capability_id);
CREATE INDEX IF NOT EXISTS idx_candidate_signals_org ON candidate_competency_signals(organization_id);

-- Match results cache (ranking candidates against requirements)
CREATE TABLE IF NOT EXISTS candidate_match_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  task_id TEXT,
  match_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  explanation JSONB DEFAULT '{}'::JSONB,
  missing_evidence JSONB DEFAULT '[]'::JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_match_candidate ON candidate_match_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_match_initiative ON candidate_match_results(initiative_id);
CREATE INDEX IF NOT EXISTS idx_candidate_match_org ON candidate_match_results(organization_id);

-- Audit log for CV access
CREATE TABLE IF NOT EXISTS cv_access_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  document_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  accessed_by TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view','download','delete','export','map','match')),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_access_log_doc ON cv_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_cv_access_log_org ON cv_access_log(organization_id);
