-- =============================================================================
-- Finance v3 — extend business-version immutability to the TERMINAL statuses
-- reached by T10 `archive` / T11 `invalidate`.
--
-- ADDITIVE. Replaces the body of `finance_bv_enforce_immutability()` only
-- (CREATE OR REPLACE FUNCTION); no table, column, index or trigger definition
-- is touched, and the already-applied
-- `20260809_finance_v3_b01_core_artifacts.sql` is left byte-identical. The
-- existing `trg_finance_bv_immutability` trigger keeps pointing at this same
-- function name, so re-running this file is idempotent.
--
-- WHY (BUG-APWAVE-TRANSITION, 2026-08-10):
--   The b01 function guards content with `IF TG_OP = 'UPDATE' AND OLD.status =
--   'APPROVED'`. Until now that was the only status a real artifact could be
--   frozen in via the lifecycle services, because T10/T11 -- the only two
--   transitions whose `from` is APPROVED -- were themselves dead: they issued
--   `version = version + 1`, `version` is not on the allow-list, so every
--   archive/invalidate raised
--     P0001 "finance_business_versions: <id> is APPROVED; only status and its
--            associated metadata columns may change".
--   Fixing `transition()` to stop incrementing `version` (mirroring T9, which
--   has always done exactly that) makes ARCHIVED and INVALIDATED reachable for
--   the first time -- and a row in either status fell OUT of the `OLD.status =
--   'APPROVED'` guard entirely, i.e. its `content_semantic_hash`,
--   `compute_snapshot_id` and every other content column became freely
--   UPDATE-able. Measured, not assumed: on the pre-fix schema an
--   `UPDATE ... SET content_semantic_hash = 'TAMPERED-ARCHIVED'` against an
--   ARCHIVED row was ACCEPTED (1 row), while the same statement against an
--   APPROVED row was REJECTED. Archiving an approved version must not be a way
--   to unlock its contents.
--
-- SCOPE — deliberately ARCHIVED + INVALIDATED only, NOT SUPERSEDED:
--   SUPERSEDED has the identical gap, but it is long-reachable pre-existing
--   behavior (T9 inside `approveVersion`, plus
--   `server/scripts/finance-v3-backfill-dry-run.ts`) and closing it is a wider
--   blast radius than this bugfix owns. It is reported as a separate finding in
--   docs/validation/finance-v3/generated/gate-d/FIX_TRANSITION_TERMINAL_ACTIONS_report.md
--   rather than silently bundled here.
--
-- WHAT STAYS WRITABLE on a terminal row, and why each one is load-bearing:
--   * `updated_at`                              — set by this trigger itself.
--   * `freshness`, `freshness_reason`,
--     `stale_since`                             — the freshness-propagation
--       stream must keep being able to mark an archived version's inputs stale;
--       these three are already allow-listed for APPROVED rows in b01.
--   * `result_quality`                          — written by
--       `finance_stmt_reconciliation_*`'s trigger body in
--       `20260810_finance_v3_d01c_real_company_integrity_fix.sql:288`, whose
--       own `WHERE ... AND status <> 'APPROVED'` filter means it targets
--       exactly these terminal rows today. Keeping it writable is a zero-
--       behavior-change decision; it is a data-quality label, never financial
--       content.
--   Everything else — including `archived_by`/`archived_at`/
--   `invalidated_reason`/`superseded_*` — is frozen, so the record of WHY a
--   version was retired cannot be rewritten after the fact either.
--
-- The APPROVED branch below is carried over verbatim from b01.
-- =============================================================================

CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability() RETURNS TRIGGER AS $$
DECLARE
  allowed_keys TEXT[] := ARRAY[
    'status', 'superseded_by_version_id', 'invalidated_reason', 'updated_at',
    'archived_by', 'archived_at', 'superseded_at',
    'freshness', 'freshness_reason', 'stale_since'
  ];
  -- Strictly narrower than `allowed_keys`: a terminal row's status is settled,
  -- so the status-companion columns are frozen along with the content.
  terminal_allowed_keys TEXT[] := ARRAY[
    'updated_at', 'freshness', 'freshness_reason', 'stale_since', 'result_quality'
  ];
  old_j JSONB;
  new_j JSONB;
BEGIN
  -- "Approved without snapshot" is never allowed (Gate A finding).
  IF NEW.status = 'APPROVED' AND NEW.compute_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'finance_business_versions: cannot APPROVE % without compute_snapshot_id', NEW.business_version_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    IF NEW.status NOT IN ('APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED') THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED and immutable; only SUPERSEDED/ARCHIVED/INVALIDATED transitions allowed', OLD.business_version_id;
    END IF;

    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(allowed_keys)))
       IS DISTINCT FROM
       (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(allowed_keys)))
    THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED; only status and its associated metadata columns may change', OLD.business_version_id;
    END IF;

    IF NEW.status = 'INVALIDATED' AND (NEW.invalidated_reason IS NULL OR NEW.invalidated_reason = '') THEN
      RAISE EXCEPTION 'finance_business_versions: INVALIDATED requires invalidated_reason (DEC-FIN-007)';
    END IF;
  END IF;

  -- NEW (this migration): a version retired by T10/T11 stays retired, and its
  -- contents stay exactly as they were at the moment of approval.
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ARCHIVED', 'INVALIDATED') THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'finance_business_versions: % is % (terminal); no further status transition is allowed', OLD.business_version_id, OLD.status;
    END IF;

    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(terminal_allowed_keys)))
       IS DISTINCT FROM
       (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(terminal_allowed_keys)))
    THEN
      RAISE EXCEPTION 'finance_business_versions: % is %; its contents are frozen, only freshness/result_quality metadata may change', OLD.business_version_id, OLD.status;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
