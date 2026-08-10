-- Platform-owned obligations table (decision #5 of
-- docs/product/results-vnext/KPI_E003_DESIGN.md §A: "build now, not as a
-- separate future micro-package" — OKR check-in-due and ROI PIR-due will
-- need the identical mechanism, building it once now avoids the exact
-- fragmentation this program exists to fix).
--
-- Design: docs/product/results-vnext/KPI_E003_DESIGN.md §A, full DDL copied
-- verbatim. References rvn_platform_events (server/migrations/
-- 20260809_rvn_platform_events_outbox.sql) via source_event_id.
--
-- DEVIATION FROM DESIGN (idempotency, not a schema change): the two trailing
-- `CREATE INDEX` statements in §A's literal text omit `IF NOT EXISTS`. This
-- migration adds it on both — required for this package's own "second run
-- on the same ephemeral Postgres must exit 0" verification step, and
-- consistent with every other index in this migration family
-- (20260810_rvn_kpi_core.sql, 20260811_rvn_kpi_deviation_loop.sql all use
-- `IF NOT EXISTS` throughout).
CREATE TABLE IF NOT EXISTS rvn_platform_obligations (
  obligation_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                TEXT NOT NULL,
  assignee_user_id                TEXT NOT NULL,
  reference_type                 TEXT NOT NULL,
  reference_id                   UUID NOT NULL,
  aggregate_version_at_creation    INT NOT NULL,
  obligation_type                TEXT NOT NULL,
  due_at                         TIMESTAMPTZ NULL,
  status                         TEXT NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','completed','cancelled','superseded')),
  policy_version_id               UUID NULL,
  -- Nullable: buildEvent() only gets a real event_id AFTER applyMutation
  -- returns (see atomicWrite.ts) — attach this in a second, separate query
  -- once executeAtomicCreate's outcome.eventId is known, not inline here.
  source_event_id                UUID NULL REFERENCES rvn_platform_events(event_id),
  cadence_occurrence_id           TEXT NULL,
  deduplication_key               TEXT NOT NULL,
  completed_at                    TIMESTAMPTZ NULL,
  completed_via_command           TEXT NULL,
  row_version                     INT NOT NULL DEFAULT 1,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, deduplication_key)
);
CREATE INDEX IF NOT EXISTS idx_rvn_platform_obligations_assignee
  ON rvn_platform_obligations(organization_id, assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_platform_obligations_reference
  ON rvn_platform_obligations(organization_id, reference_type, reference_id);
