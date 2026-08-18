-- AMD-PRT-ECONOMICS-002 (owner decision 2A)
-- Durable, immutable, tenant-bound telemetry for Partner economic-policy denials.
--
-- WHY A SEPARATE TABLE AND NOT partner_legacy_usage_events.
-- That table's CHECK admits only legacy_read / legacy_uncovered_writer /
-- legacy_writer_blocked / rollback_writer. Recording a policy denial as
-- 'legacy_writer_blocked' would conflate "this writer moved to V8" with
-- "this operation is excluded by owner policy", and would silently corrupt the
-- cutover parity telemetry PRT-MVP-LEGACY-CUTOVER-001 depends on. A dedicated
-- reason gets a dedicated table.
--
-- LATE-SAFE / ADDITIVE. Every statement is IF NOT EXISTS or CREATE OR REPLACE.
-- Nothing is dropped, nothing is backfilled, no existing column changes type,
-- and no existing row is touched. Re-running applies zero changes.
--
-- NO FOREIGN KEYS BY DELIBERATE CHOICE. An append-only trigger plus an
-- ON DELETE CASCADE foreign key makes the PARENT row undeletable: the cascade
-- issues a DELETE against this table, the trigger refuses it, and the parent
-- delete fails. organization_id / partner_org_id are therefore plain
-- tenant-binding columns, exactly as in partner_legacy_usage_events.

CREATE TABLE IF NOT EXISTS partner_economics_policy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT,
    user_id TEXT,
    -- Tenant binding. Nullable because a denial must be recorded even when the
    -- caller never resolved a tenant (unauthenticated or foreign probe): losing
    -- the receipt would be worse than storing it without an organization.
    organization_id TEXT,
    partner_org_id TEXT,
    method TEXT NOT NULL,
    route_path TEXT NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN (
      'v8_partner',
      'legacy_partner',
      'superadmin_partner_settlements',
      'superadmin_partner_config',
      'service'
    )),
    operation TEXT NOT NULL CHECK (operation IN (
      'commission',
      'discount',
      'accrual',
      'payout',
      'payout_settings',
      'lifecycle_payout'
    )),
    -- Pinned literals: a row that does not name this exact decision and denial
    -- code is malformed and is refused by the CHECK BEFORE any row is stored.
    decision TEXT NOT NULL CHECK (decision = 'AMD-PRT-ECONOMICS-002'),
    denial_code TEXT NOT NULL CHECK (denial_code = 'PARTNER_ECONOMICS_POLICY_DISABLED'),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_observed
  ON partner_economics_policy_events(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_operation
  ON partner_economics_policy_events(operation, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_org
  ON partner_economics_policy_events(organization_id, observed_at DESC);

-- ---------------------------------------------------------------------------
-- Immutability. Append-only at the DATABASE level, not by service discipline.
--
-- There is deliberately NO GUC / SET LOCAL escape hatch. A session variable a
-- caller can set is not an authorization boundary — anything able to run the
-- UPDATE can also run the SET LOCAL, so such a guard protects nothing.
-- Corrections are new rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_economics_policy_events_deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'partner_economics_policy_events is append-only under AMD-PRT-ECONOMICS-002; % not permitted (row %) -- a policy-denial receipt is evidence, corrections must be new rows',
    TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_economics_policy_events_no_update
  ON partner_economics_policy_events;
CREATE TRIGGER trg_partner_economics_policy_events_no_update
  BEFORE UPDATE ON partner_economics_policy_events
  FOR EACH ROW EXECUTE FUNCTION public.partner_economics_policy_events_deny_mutation();

DROP TRIGGER IF EXISTS trg_partner_economics_policy_events_no_delete
  ON partner_economics_policy_events;
CREATE TRIGGER trg_partner_economics_policy_events_no_delete
  BEFORE DELETE ON partner_economics_policy_events
  FOR EACH ROW EXECUTE FUNCTION public.partner_economics_policy_events_deny_mutation();

-- ---------------------------------------------------------------------------
-- Preflight. Refuse to report success on a database where the protection
-- provably protects nothing. Mirrors the ROI-E007 CO-4 convention.
-- ---------------------------------------------------------------------------
DO $mig$
DECLARE
  table_present   integer;
  checks_present  integer;
  triggers_present integer;
BEGIN
  SELECT count(*) INTO table_present
    FROM information_schema.tables
   WHERE table_name = 'partner_economics_policy_events';

  IF table_present = 0 THEN
    RAISE EXCEPTION 'AMD-PRT-ECONOMICS-002: partner_economics_policy_events was not created';
  END IF;

  SELECT count(*) INTO checks_present
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.check_constraints cc
      ON cc.constraint_name = ccu.constraint_name
   WHERE ccu.table_name = 'partner_economics_policy_events'
     AND ccu.column_name IN ('surface', 'operation', 'decision', 'denial_code');

  IF checks_present = 0 THEN
    RAISE EXCEPTION 'AMD-PRT-ECONOMICS-002: policy-event CHECK constraints are missing; malformed receipts would be storable';
  END IF;

  SELECT count(*) INTO triggers_present
    FROM pg_trigger
   WHERE tgrelid = 'partner_economics_policy_events'::regclass
     AND NOT tgisinternal;

  IF triggers_present < 2 THEN
    RAISE EXCEPTION 'AMD-PRT-ECONOMICS-002: append-only triggers are missing (found %); receipts would be mutable', triggers_present;
  END IF;
END
$mig$;
