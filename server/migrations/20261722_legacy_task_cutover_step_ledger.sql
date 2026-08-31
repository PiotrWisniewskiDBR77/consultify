CREATE TABLE IF NOT EXISTS legacy_task_cutover_step_ledger (
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  command_status TEXT NOT NULL CHECK (command_status IN ('APPLIED', 'REPLAYED')),
  request_checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, initiative_id, step_key),
  UNIQUE (organization_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_task_cutover_step_ledger_initiative
  ON legacy_task_cutover_step_ledger (organization_id, initiative_id, updated_at);
