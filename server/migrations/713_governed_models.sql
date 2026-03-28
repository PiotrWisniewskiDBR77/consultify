-- Governed Models: KPI definitions, dimensions, trust flags
-- Equivalent of Power BI semantic models

CREATE TABLE IF NOT EXISTS tp_governed_models (
  model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tp_kpi_definitions (
  kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES tp_governed_models(model_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_pl TEXT,
  formula_type TEXT NOT NULL CHECK (formula_type IN ('field_sum', 'field_avg', 'field_count', 'expression', 'canonical_line')),
  formula_config JSONB NOT NULL DEFAULT '{}',
  source_table_id UUID REFERENCES tp_tables(id),
  source_field_id UUID REFERENCES tp_fields(id),
  unit TEXT,
  format TEXT DEFAULT 'number',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, code)
);

CREATE TABLE IF NOT EXISTS tp_dimensions (
  dimension_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES tp_governed_models(model_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_table_id UUID REFERENCES tp_tables(id),
  source_field_id UUID REFERENCES tp_fields(id),
  dimension_type TEXT NOT NULL DEFAULT 'categorical' CHECK (dimension_type IN ('categorical', 'temporal', 'hierarchical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tp_model_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES tp_governed_models(model_id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tp_tables(id),
  trusted BOOLEAN NOT NULL DEFAULT false,
  required_provenance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, table_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_kpi_model ON tp_kpi_definitions(model_id);
CREATE INDEX IF NOT EXISTS idx_tp_dim_model ON tp_dimensions(model_id);
CREATE INDEX IF NOT EXISTS idx_tp_model_sources_model ON tp_model_sources(model_id);
CREATE INDEX IF NOT EXISTS idx_tp_governed_models_base ON tp_governed_models(base_id);

-- Add trust_flag to existing provenance table
ALTER TABLE tp_record_provenance ADD COLUMN IF NOT EXISTS trusted BOOLEAN DEFAULT false;
