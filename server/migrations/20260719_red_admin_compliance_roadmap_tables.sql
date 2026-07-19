-- RED-ADMIN 2026-07-19: schema-500 klasy „tabela brak → 42P01" w rewirze
-- superadmin (feature-roadmap + GDPR compliance). Kontrolery/serwisy odpytują tabele,
-- których migracje definiujące (015_enterprise_customers_module.sql — częściowo
-- niezaaplikowane; 055_security_module.sql.sql — poza autorun) nigdy nie założyły na
-- tym środowisku. CZYSTY Postgres, CREATE TABLE IF NOT EXISTS (idempotentne). Prefiks
-- daty → autorun. Na demo (jeśli istnieją) = no-op.

-- GET /api/superadmin/feature-roadmap → FeedbackService.getFeatureRoadmap:
--   SELECT * FROM feature_roadmap ORDER BY priority DESC, votes_count DESC, created_at DESC → 42P01.
-- Schemat z 015_enterprise_customers_module.sql (feature_title/priority TEXT), Postgres-safe.
CREATE TABLE IF NOT EXISTS feature_roadmap (
  id TEXT PRIMARY KEY,
  feature_title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  priority TEXT DEFAULT 'medium',
  target_release_date DATE,
  related_feedback_ids_json TEXT DEFAULT '[]',
  votes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feature_roadmap_status ON feature_roadmap(status);
CREATE INDEX IF NOT EXISTS idx_feature_roadmap_priority ON feature_roadmap(priority);

-- GET /api/superadmin/compliance/gdpr-requests → SuperAdminController.getGDPRRequests:
--   SELECT * FROM gdpr_data_subject_requests WHERE organization_id = ? ORDER BY requested_at DESC → 42P01.
-- (Migracja 055 zakłada gdpr_deletion_requests — inna nazwa; kontroler oczekuje
-- gdpr_data_subject_requests.) Kolumny z INSERT createGDPRRequest + GET ORDER BY.
CREATE TABLE IF NOT EXISTS gdpr_data_subject_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  request_type TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gdpr_dsr_org ON gdpr_data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_dsr_status ON gdpr_data_subject_requests(status);
