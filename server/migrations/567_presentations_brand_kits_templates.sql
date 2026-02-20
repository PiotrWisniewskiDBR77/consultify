-- Migration 567: Presentations generator + brand kits + templates
-- Bundle 17: T058 (Presentation Generator) + T059 (Business Presentation Templates)

-- ============================================
-- T059: BRAND KITS (per organization)
-- ============================================

CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'Default',
  logo_url TEXT,
  primary_color TEXT DEFAULT '003A70',
  secondary_color TEXT DEFAULT '2C5F8A',
  accent_color TEXT DEFAULT '00AA55',
  font_title TEXT DEFAULT 'Calibri Light',
  font_body TEXT DEFAULT 'Calibri',
  footer_text TEXT,
  header_text TEXT,
  show_page_numbers BOOLEAN DEFAULT TRUE,
  show_confidentiality BOOLEAN DEFAULT TRUE,
  confidentiality_default TEXT DEFAULT 'internal' CHECK (confidentiality_default IN ('confidential', 'internal', 'public')),
  disclaimer_text TEXT,
  watermark_text TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_org ON brand_kits(organization_id);

-- ============================================
-- T059: PRESENTATION TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS presentation_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  deck_type TEXT NOT NULL,
  audience TEXT DEFAULT 'executive',
  goal TEXT DEFAULT 'inform',
  language_default TEXT DEFAULT 'en',
  confidentiality_default TEXT DEFAULT 'internal',
  theme TEXT DEFAULT 'corporate' CHECK (theme IN ('corporate', 'minimal', 'modern')),
  outline_json TEXT NOT NULL,
  max_slides INTEGER DEFAULT 25,
  min_slides INTEGER DEFAULT 5,
  must_have_intents TEXT,
  recommended_visuals TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  cloned_from TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_org ON presentation_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_pt_type ON presentation_templates(deck_type);
CREATE INDEX IF NOT EXISTS idx_pt_system ON presentation_templates(is_system);

-- Seed 5 system templates
INSERT INTO presentation_templates (id, name, description, deck_type, audience, goal, outline_json, must_have_intents, recommended_visuals, max_slides, min_slides) VALUES
  ('pt-steering',
   'Steering Committee Update',
   'Executive update on program status, portfolio health, risks, and next steps. BCG-grade steering deck.',
   'steering_committee',
   'sponsor',
   'inform',
   '[{"intent":"cover","title":"Steering Committee Update"},{"intent":"executive_summary","title":"Executive Summary"},{"intent":"key_messages","title":"Key Messages"},{"intent":"performance_overview","title":"Portfolio Health"},{"intent":"initiative_portfolio","title":"Initiative Portfolio"},{"intent":"roadmap","title":"Execution Roadmap"},{"intent":"risk_management","title":"Risks & Mitigations"},{"intent":"next_steps","title":"Next Steps & Decisions"}]',
   '["cover","executive_summary","key_messages","next_steps"]',
   '["kpi_strip","roadmap_band","risk_table","initiative_cards"]',
   20, 8),

  ('pt-program',
   'Program / Execution Update',
   'Operational update on execution progress, delays, budget status, and team delivery.',
   'program_update',
   'executive',
   'inform',
   '[{"intent":"cover","title":"Program Update"},{"intent":"executive_summary","title":"Summary"},{"intent":"performance_overview","title":"Delivery Metrics"},{"intent":"initiative_portfolio","title":"Workstream Status"},{"intent":"single_insight","title":"Budget Overview"},{"intent":"risk_management","title":"Blockers & Risks"},{"intent":"roadmap","title":"Timeline"},{"intent":"next_steps","title":"Actions & Owners"}]',
   '["cover","executive_summary","next_steps"]',
   '["kpi_strip","roadmap_band","heatmap"]',
   18, 6),

  ('pt-valuation',
   'Valuation Pack',
   'Financial valuation presentation with sensitivity analysis, key assumptions, and disclaimers.',
   'valuation_pack',
   'investor',
   'sell',
   '[{"intent":"cover","title":"Valuation Summary"},{"intent":"executive_summary","title":"Investment Thesis"},{"intent":"key_messages","title":"Key Financials"},{"intent":"performance_overview","title":"Financial Overview"},{"intent":"single_insight","title":"Valuation Model"},{"intent":"comparison","title":"Sensitivity Analysis"},{"intent":"risk_management","title":"Key Risks"},{"intent":"next_steps","title":"Next Steps"},{"intent":"appendix","title":"Disclaimers & Methodology"}]',
   '["cover","executive_summary","next_steps","appendix"]',
   '["kpi_strip","comparison_chart","sensitivity_table"]',
   25, 8),

  ('pt-tool-workshop',
   'Tool Workshop Summary',
   'Summary of consulting tool session results, insights, and recommended actions.',
   'tool_workshop',
   'internal',
   'align',
   '[{"intent":"cover","title":"Workshop Summary"},{"intent":"executive_summary","title":"Key Outcomes"},{"intent":"key_messages","title":"Insights"},{"intent":"assessment","title":"Assessment Results"},{"intent":"recommendation_portfolio","title":"Recommendations"},{"intent":"next_steps","title":"Action Plan"}]',
   '["cover","executive_summary","next_steps"]',
   '["heatmap","recommendation_cards"]',
   15, 5),

  ('pt-assessment',
   'Assessment Summary',
   'Digital maturity assessment results with gap analysis, strengths, and transformation roadmap.',
   'assessment_summary',
   'sponsor',
   'decide',
   '[{"intent":"cover","title":"Assessment Results"},{"intent":"executive_summary","title":"Executive Summary"},{"intent":"key_messages","title":"Key Findings"},{"intent":"assessment","title":"Maturity Overview"},{"intent":"performance_overview","title":"Score Breakdown"},{"intent":"comparison","title":"Gap Analysis"},{"intent":"recommendation_portfolio","title":"Recommendations"},{"intent":"roadmap","title":"Transformation Roadmap"},{"intent":"next_steps","title":"Next Steps"}]',
   '["cover","executive_summary","assessment","next_steps"]',
   '["heatmap","kpi_strip","roadmap_band","dot_scale"]',
   20, 7)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- T058: PRESENTATION DECKS (generated artifacts)
-- ============================================

CREATE TABLE IF NOT EXISTS presentation_decks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  template_id TEXT,
  deck_type TEXT,
  audience TEXT,
  goal TEXT,
  language TEXT DEFAULT 'en',
  confidentiality TEXT DEFAULT 'internal',
  theme TEXT DEFAULT 'corporate',
  brand_kit_id TEXT,
  source_artifacts TEXT,
  outline_json TEXT,
  unified_json TEXT,
  slide_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed')),
  export_path TEXT,
  export_format TEXT,
  exported_at TIMESTAMP,
  share_token TEXT,
  share_expires_at TIMESTAMP,
  validation_warnings TEXT,
  generated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pd_org ON presentation_decks(organization_id);
CREATE INDEX IF NOT EXISTS idx_pd_project ON presentation_decks(project_id);
CREATE INDEX IF NOT EXISTS idx_pd_template ON presentation_decks(template_id);
CREATE INDEX IF NOT EXISTS idx_pd_status ON presentation_decks(status);
CREATE INDEX IF NOT EXISTS idx_pd_share ON presentation_decks(share_token);
