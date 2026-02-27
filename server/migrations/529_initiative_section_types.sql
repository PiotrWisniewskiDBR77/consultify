-- Migration: 529_initiative_section_types.sql
-- Initiative Section Library - Dynamic section types for initiative cards
-- Date: 2026-02-08
--
-- Analogous to report_builder_block_types, this table defines the available
-- section types that can be used in initiative document views.
-- Templates reference section keys via visible_sections JSON.

-- ==========================================
-- INITIATIVE SECTION TYPES (Library)
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_section_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT,          -- NULL for system section types

  -- Identity
  key TEXT NOT NULL,             -- Unique key used in visible_sections (e.g. 'problemDefinition')
  name TEXT NOT NULL,
  name_pl TEXT,
  description TEXT,
  description_pl TEXT,

  -- Layout
  category TEXT NOT NULL DEFAULT 'content',  -- content | control | meta
  column_position TEXT NOT NULL DEFAULT 'left', -- left | right
  default_order INTEGER NOT NULL DEFAULT 100,

  -- Visual
  icon TEXT,                     -- lucide icon name (e.g. 'FileText')
  icon_color TEXT,               -- tailwind color class (e.g. 'text-blue-500')
  icon_bg TEXT,                  -- tailwind bg class (e.g. 'from-blue-500/10 to-cyan-500/10')

  -- Component
  component_key TEXT NOT NULL,   -- maps to React component in registry

  -- AI
  ai_prompt_template TEXT,       -- AI generation prompt template for this section

  -- Config
  render_config TEXT,            -- JSON: additional rendering configuration
  default_config TEXT,           -- JSON: default section-specific config

  -- Status
  is_system INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- If a partial/legacy run created boolean flags, normalize to INTEGER flags (0/1).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'initiative_section_types'
      AND column_name = 'is_system'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_system DROP DEFAULT;
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_system TYPE INTEGER
      USING (CASE WHEN is_system THEN 1 ELSE 0 END);
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_system SET DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'initiative_section_types'
      AND column_name = 'is_active'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_active DROP DEFAULT;
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_active TYPE INTEGER
      USING (CASE WHEN is_active THEN 1 ELSE 0 END);
    ALTER TABLE initiative_section_types
      ALTER COLUMN is_active SET DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ist_org ON initiative_section_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_ist_key ON initiative_section_types(key);
CREATE INDEX IF NOT EXISTS idx_ist_active ON initiative_section_types(is_active);
CREATE INDEX IF NOT EXISTS idx_ist_column ON initiative_section_types(column_position);

-- ==========================================
-- SEED: System Section Types (~24 types)
-- ==========================================

-- ========== LEFT COLUMN (content) ==========

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-overview', 'overview', 'Initiative Description', 'Opis inicjatywy', 'Core description and summary of the initiative', 'Podstawowy opis i podsumowanie inicjatywy', 'content', 'left', 10, 'FileText', 'text-blue-500', 'from-blue-500/10 to-cyan-500/10', 'overview', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-problem-definition', 'problemDefinition', 'Problem Definition', 'Definicja problemu', 'Structured problem analysis: symptom, root cause, cost of inaction', 'Strukturalna analiza problemu: symptom, przyczyna źródłowa, koszt bezczynności', 'content', 'left', 20, 'AlertTriangle', 'text-rose-500', 'from-rose-500/10 to-red-500/10', 'problemDefinition', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-target-state', 'targetState', 'Target State & Success Criteria', 'Stan docelowy i kryteria sukcesu', 'Desired outcome, deliverables, and measurable success criteria', 'Pożądany wynik, produkty i mierzalne kryteria sukcesu', 'content', 'left', 30, 'Target', 'text-emerald-500', 'from-emerald-500/10 to-green-500/10', 'targetState', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-scope', 'scope', 'Scope & Kill Criteria', 'Zakres i kryteria rezygnacji', 'In-scope, out-of-scope boundaries and conditions for stopping', 'Granice zakresu i warunki zatrzymania inicjatywy', 'content', 'left', 40, 'Scale', 'text-violet-500', 'from-violet-500/10 to-purple-500/10', 'scope', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-tasks', 'tasks', 'Tasks & Milestones', 'Zadania i kamienie milowe', 'Action items with milestone tracking and progress', 'Zadania do wykonania z kamieniami milowymi i postępem', 'content', 'left', 50, 'CheckSquare', 'text-emerald-500', 'from-emerald-500/10 to-teal-500/10', 'tasks', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-decisions', 'decisions', 'Decisions', 'Decyzje', 'Key decisions linked to the initiative with approval tracking', 'Kluczowe decyzje powiązane z inicjatywą ze śledzeniem zatwierdzeń', 'content', 'left', 60, 'Scale', 'text-amber-500', 'from-amber-500/10 to-yellow-500/10', 'decisions', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-raid', 'raid', 'RAID Log', 'Rejestr RAID', 'Risks, Assumptions, Issues, Dependencies tracking', 'Śledzenie Ryzyk, Założeń, Problemów, Zależności', 'content', 'left', 70, 'AlertTriangle', 'text-orange-500', 'from-orange-500/10 to-amber-500/10', 'raid', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-gates', 'gates', 'Gate Readiness', 'Bramki decyzyjne', 'Gate approval workflow with readiness checks', 'Proces zatwierdzania bramek z kontrolą gotowości', 'content', 'left', 80, 'Milestone', 'text-purple-500', 'from-purple-500/10 to-indigo-500/10', 'gates', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-financial-analysis', 'financialAnalysis', 'Financial Analysis', 'Analiza finansowa', 'Cost-benefit analysis and ROI calculations', 'Analiza kosztów i korzyści oraz obliczenia ROI', 'content', 'left', 90, 'BarChart3', 'text-teal-500', 'from-teal-500/10 to-emerald-500/10', 'financialAnalysis', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-financial-impact', 'financialImpact', 'Financial Impact', 'Wpływ finansowy', 'Expected financial outcomes and business impact', 'Oczekiwane wyniki finansowe i wpływ biznesowy', 'content', 'left', 100, 'DollarSign', 'text-green-500', 'from-green-500/10 to-emerald-500/10', 'financialImpact', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-kpis', 'kpis', 'KPIs & Benefits', 'KPI i korzyści', 'Key performance indicators with baseline and target values', 'Kluczowe wskaźniki efektywności z wartościami bazowymi i docelowymi', 'content', 'left', 110, 'TrendingUp', 'text-cyan-500', 'from-cyan-500/10 to-blue-500/10', 'kpis', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-pilot', 'pilot', 'Pilot', 'Pilot', 'Pilot phase: hypotheses, success/failure criteria, results', 'Faza pilotażowa: hipotezy, kryteria sukcesu/porażki, wyniki', 'content', 'left', 120, 'Sparkles', 'text-indigo-500', 'from-indigo-500/10 to-violet-500/10', 'pilot', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-comments', 'comments', 'Comments', 'Komentarze', 'Discussion thread for the initiative', 'Wątek dyskusji dotyczący inicjatywy', 'content', 'left', 130, 'MessageSquare', 'text-slate-500', 'from-slate-500/10 to-gray-500/10', 'comments', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-history', 'history', 'Activity Log', 'Historia zmian', 'Chronological log of all changes and events', 'Chronologiczny rejestr zmian i zdarzeń', 'content', 'left', 140, 'History', 'text-slate-400', 'from-slate-400/10 to-gray-400/10', 'history', 1, 1);

-- ========== RIGHT COLUMN (control/meta) ==========

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-control', 'control', 'Control Panel', 'Panel sterowania', 'Module, status, priority and workflow actions', 'Moduł, status, priorytet i akcje workflow', 'control', 'right', 10, 'Layers', 'text-purple-500', 'from-purple-500/10 to-pink-500/10', 'control', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-team', 'team', 'Team', 'Zespół', 'Initiative owner, sponsor and team assignments', 'Właściciel inicjatywy, sponsor i przypisania zespołu', 'control', 'right', 20, 'Users', 'text-indigo-500', 'from-indigo-500/10 to-violet-500/10', 'team', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-timeline', 'timeline', 'Timeline', 'Harmonogram', 'Start/end dates, target quarter, duration', 'Daty startu/końca, kwartał docelowy, czas trwania', 'control', 'right', 30, 'Calendar', 'text-cyan-500', 'from-cyan-500/10 to-blue-500/10', 'timeline', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-resources', 'resources', 'Resources', 'Zasoby', 'FTE allocation, budget, tools and infrastructure', 'Alokacja FTE, budżet, narzędzia i infrastruktura', 'control', 'right', 40, 'Users', 'text-teal-500', 'from-teal-500/10 to-green-500/10', 'resources', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-stakeholders', 'stakeholders', 'Stakeholders (RACI)', 'Interesariusze (RACI)', 'Stakeholder mapping with RACI roles and notifications', 'Mapowanie interesariuszy z rolami RACI i notyfikacjami', 'meta', 'right', 50, 'Users', 'text-blue-500', 'from-blue-500/10 to-indigo-500/10', 'stakeholders', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-dependencies', 'dependencies', 'Dependencies', 'Zależności', 'Task and initiative dependencies', 'Zależności zadań i inicjatyw', 'meta', 'right', 60, 'Link2', 'text-orange-500', 'from-orange-500/10 to-amber-500/10', 'dependencies', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-attachments', 'attachments', 'Attachments & Linked Items', 'Załączniki i powiązane elementy', 'File attachments and linked tasks/decisions', 'Załączniki plików i powiązane zadania/decyzje', 'meta', 'right', 70, 'Link2', 'text-slate-500', 'from-slate-500/10 to-gray-500/10', 'attachments', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-tags', 'tags', 'Tags', 'Tagi', 'Initiative categorization tags', 'Tagi kategoryzacji inicjatywy', 'meta', 'right', 80, 'Tag', 'text-pink-500', 'from-pink-500/10 to-rose-500/10', 'tags', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-reminders', 'reminders', 'Reminders & Escalation', 'Przypomnienia i eskalacja', 'Automated reminders and escalation rules', 'Automatyczne przypomnienia i reguły eskalacji', 'meta', 'right', 90, 'Bell', 'text-amber-500', 'from-amber-500/10 to-yellow-500/10', 'reminders', 1, 1);

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-watchers', 'watchers', 'Watchers', 'Obserwatorzy', 'People watching this initiative for notifications', 'Osoby obserwujące inicjatywę w celu otrzymywania notyfikacji', 'meta', 'right', 100, 'BellOff', 'text-slate-400', 'from-slate-400/10 to-gray-400/10', 'watchers', 1, 1);

-- ==========================================
-- EXTEND initiative_templates with section_order and section_config
-- ==========================================

ALTER TABLE initiative_templates ADD COLUMN section_order TEXT DEFAULT '{}';
  -- JSON: { "overview": 10, "problemDefinition": 20, ... } - per-template ordering
ALTER TABLE initiative_templates ADD COLUMN section_config TEXT DEFAULT '{}';
  -- JSON: { "problemDefinition": { "showRootCause": true }, ... } - per-section config
