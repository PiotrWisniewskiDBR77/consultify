-- Module Sync Bridge: tracks governed model → Consultify module sync runs
-- Used by publish-to-results, sync-to-finance, sync-to-execution, sync-to-initiatives

CREATE TABLE IF NOT EXISTS tp_module_sync_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES tp_governed_models(model_id) ON DELETE CASCADE,
  target_module TEXT NOT NULL CHECK (target_module IN ('results', 'finance', 'execution', 'initiatives')),
  field_mapping JSONB NOT NULL DEFAULT '{}',
  synced_record_count INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'success' CHECK (sync_status IN ('success', 'error', 'partial')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, target_module)
);

CREATE INDEX IF NOT EXISTS idx_tp_module_sync_model ON tp_module_sync_results(model_id);
CREATE INDEX IF NOT EXISTS idx_tp_module_sync_model_module ON tp_module_sync_results(model_id, target_module);
