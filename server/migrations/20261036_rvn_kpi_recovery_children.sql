-- Canonical Results recovery child resources (RESULTS-W27..W31).
--
-- The Recovery Card remains the legacy owner aggregate during this bounded
-- cut-over. Actions and checkpoints move to one canonical writer each. A
-- one-way id-preserving backfill is installed; no trigger or dual write is.

CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_recovery_cards_id_org
  ON kpi_recovery_cards(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_id_org
  ON tasks(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_time_series_id_org
  ON kpi_time_series(id, organization_id);

CREATE TABLE IF NOT EXISTS rvn_kpi_recovery_actions (
  action_id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id      TEXT NOT NULL,
  recovery_card_id     TEXT NOT NULL,
  action_type          TEXT NOT NULL CHECK (action_type IN ('IMMEDIATE', 'DURABLE')),
  title                TEXT NOT NULL,
  description          TEXT,
  owner_user_id        TEXT,
  due_date             DATE,
  status               TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  linked_task_id       TEXT,
  task_link_status     TEXT NOT NULL DEFAULT 'NONE'
                       CHECK (task_link_status IN ('NONE', 'PENDING', 'LINKED', 'LINK_FAILED')),
  task_link_error      TEXT,
  task_link_attempted_at TIMESTAMPTZ,
  row_version          INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, recovery_card_id, action_id),
  UNIQUE (linked_task_id),
  CONSTRAINT fk_rvn_recovery_action_card_tenant
    FOREIGN KEY (recovery_card_id, organization_id)
    REFERENCES kpi_recovery_cards(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_rvn_recovery_action_task_tenant
    FOREIGN KEY (linked_task_id, organization_id)
    REFERENCES tasks(id, organization_id) ON DELETE SET NULL (linked_task_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_recovery_actions_card
  ON rvn_kpi_recovery_actions(organization_id, recovery_card_id, created_at);

CREATE TABLE IF NOT EXISTS rvn_kpi_recovery_checkpoints (
  checkpoint_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id      TEXT NOT NULL,
  recovery_card_id     TEXT NOT NULL,
  checkpoint_date      DATE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'MET', 'MISSED', 'CANCELLED')),
  kpi_time_series_id   TEXT,
  notes                TEXT,
  row_version          INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ,
  UNIQUE (organization_id, recovery_card_id, checkpoint_id),
  CONSTRAINT fk_rvn_recovery_checkpoint_card_tenant
    FOREIGN KEY (recovery_card_id, organization_id)
    REFERENCES kpi_recovery_cards(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_rvn_recovery_checkpoint_measurement_tenant
    FOREIGN KEY (kpi_time_series_id, organization_id)
    REFERENCES kpi_time_series(id, organization_id) ON DELETE SET NULL (kpi_time_series_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_recovery_checkpoints_card
  ON rvn_kpi_recovery_checkpoints(organization_id, recovery_card_id, checkpoint_date, created_at);

-- Records the exact legacy bytes accepted during the one-way adoption. This
-- separates a genuine first-adoption collision from later canonical changes:
-- migration replay validates the frozen source snapshot but never overwrites
-- a resource that canonical commands have advanced.
CREATE TABLE IF NOT EXISTS rvn_kpi_recovery_backfill_receipts (
  resource_type       TEXT NOT NULL CHECK (resource_type IN ('ACTION', 'CHECKPOINT')),
  legacy_id           TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  source_payload      JSONB NOT NULL,
  adopted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, legacy_id)
);

-- One-way ownership transfer.  Stable ids preserve mounted deep state and
-- task links.  Replaying the migration is a no-op; no trigger writes back to
-- the legacy tables after this point.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM kpi_recovery_actions legacy
    INNER JOIN rvn_kpi_recovery_backfill_receipts receipt
      ON receipt.resource_type='ACTION' AND receipt.legacy_id=legacy.id
    WHERE receipt.organization_id IS DISTINCT FROM legacy.organization_id
       OR receipt.source_payload IS DISTINCT FROM to_jsonb(legacy)
  ) THEN
    RAISE EXCEPTION 'rvn recovery action backfill source changed after adoption';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kpi_recovery_actions legacy
    INNER JOIN rvn_kpi_recovery_actions canonical ON canonical.action_id=legacy.id
    LEFT JOIN rvn_kpi_recovery_backfill_receipts receipt
      ON receipt.resource_type='ACTION' AND receipt.legacy_id=legacy.id
    WHERE receipt.legacy_id IS NULL AND (
          canonical.organization_id IS DISTINCT FROM legacy.organization_id
       OR canonical.recovery_card_id IS DISTINCT FROM legacy.recovery_card_id
       OR canonical.action_type IS DISTINCT FROM legacy.action_type
       OR canonical.title IS DISTINCT FROM legacy.title
       OR canonical.description IS DISTINCT FROM legacy.description
       OR canonical.owner_user_id IS DISTINCT FROM legacy.owner_user_id
       OR canonical.due_date IS DISTINCT FROM legacy.due_date
       OR canonical.status IS DISTINCT FROM legacy.status
       OR canonical.linked_task_id IS DISTINCT FROM legacy.linked_task_id
       OR canonical.task_link_status IS DISTINCT FROM legacy.task_link_status
       OR canonical.task_link_error IS DISTINCT FROM legacy.task_link_error
       OR canonical.task_link_attempted_at IS DISTINCT FROM legacy.task_link_attempted_at
       OR canonical.created_by IS DISTINCT FROM COALESCE(legacy.created_by, 'legacy-migration')
       OR canonical.created_at IS DISTINCT FROM legacy.created_at
       OR canonical.updated_at IS DISTINCT FROM legacy.updated_at)
  ) THEN
    RAISE EXCEPTION 'rvn recovery action backfill identity/payload conflict';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kpi_recovery_checkpoints legacy
    INNER JOIN rvn_kpi_recovery_backfill_receipts receipt
      ON receipt.resource_type='CHECKPOINT' AND receipt.legacy_id=legacy.id
    WHERE receipt.organization_id IS DISTINCT FROM legacy.organization_id
       OR receipt.source_payload IS DISTINCT FROM to_jsonb(legacy)
  ) THEN
    RAISE EXCEPTION 'rvn recovery checkpoint backfill source changed after adoption';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kpi_recovery_checkpoints legacy
    INNER JOIN rvn_kpi_recovery_checkpoints canonical ON canonical.checkpoint_id=legacy.id
    LEFT JOIN rvn_kpi_recovery_backfill_receipts receipt
      ON receipt.resource_type='CHECKPOINT' AND receipt.legacy_id=legacy.id
    WHERE receipt.legacy_id IS NULL AND (
          canonical.organization_id IS DISTINCT FROM legacy.organization_id
       OR canonical.recovery_card_id IS DISTINCT FROM legacy.recovery_card_id
       OR canonical.checkpoint_date IS DISTINCT FROM legacy.checkpoint_date
       OR canonical.status IS DISTINCT FROM legacy.status
       OR canonical.kpi_time_series_id IS DISTINCT FROM legacy.kpi_time_series_id
       OR canonical.notes IS DISTINCT FROM legacy.notes
       OR canonical.created_by IS DISTINCT FROM COALESCE(legacy.created_by, 'legacy-migration')
       OR canonical.created_at IS DISTINCT FROM legacy.created_at
       OR canonical.resolved_at IS DISTINCT FROM legacy.resolved_at)
  ) THEN
    RAISE EXCEPTION 'rvn recovery checkpoint backfill identity/payload conflict';
  END IF;
END $$;

INSERT INTO rvn_kpi_recovery_actions (
  action_id, organization_id, recovery_card_id, action_type, title, description,
  owner_user_id, due_date, status, linked_task_id, task_link_status,
  task_link_error, task_link_attempted_at, created_by, created_at, updated_at
)
SELECT id, organization_id, recovery_card_id, action_type, title, description,
       owner_user_id, due_date, status, linked_task_id, task_link_status,
       task_link_error, task_link_attempted_at, COALESCE(created_by, 'legacy-migration'),
       created_at, updated_at
  FROM kpi_recovery_actions
ON CONFLICT (action_id) DO NOTHING;

INSERT INTO rvn_kpi_recovery_checkpoints (
  checkpoint_id, organization_id, recovery_card_id, checkpoint_date, status,
  kpi_time_series_id, notes, created_by, created_at, resolved_at
)
SELECT id, organization_id, recovery_card_id, checkpoint_date, status,
       kpi_time_series_id, notes, COALESCE(created_by, 'legacy-migration'),
       created_at, resolved_at
  FROM kpi_recovery_checkpoints
ON CONFLICT (checkpoint_id) DO NOTHING;

INSERT INTO rvn_kpi_recovery_backfill_receipts (
  resource_type, legacy_id, organization_id, source_payload
)
SELECT 'ACTION', id, organization_id, to_jsonb(legacy)
  FROM kpi_recovery_actions legacy
ON CONFLICT (resource_type, legacy_id) DO NOTHING;

INSERT INTO rvn_kpi_recovery_backfill_receipts (
  resource_type, legacy_id, organization_id, source_payload
)
SELECT 'CHECKPOINT', id, organization_id, to_jsonb(legacy)
  FROM kpi_recovery_checkpoints legacy
ON CONFLICT (resource_type, legacy_id) DO NOTHING;
