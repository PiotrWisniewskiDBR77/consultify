-- =============================================================================
-- Finance v3 — extend business-version immutability to `SUPERSEDED`, closing
-- the last hole in the terminal-status envelope.
--
-- ADDITIVE. Replaces the body of `finance_bv_enforce_immutability()` only
-- (CREATE OR REPLACE FUNCTION); no table, column, index or trigger definition
-- is touched, and both already-applied
-- `20260809_finance_v3_b01_core_artifacts.sql` and
-- `20260823_finance_v3_bv_terminal_immutability.sql` are left byte-identical.
-- The existing `trg_finance_bv_immutability` trigger keeps pointing at this
-- same function name, so re-running this file is idempotent.
--
-- WHY (BUG-APWAVE-SUPERSEDED, 2026-08-10):
--   `20260823_finance_v3_bv_terminal_immutability.sql` closed the content hole
--   for `ARCHIVED`/`INVALIDATED` and explicitly reported `SUPERSEDED` as the
--   same defect left open, because SUPERSEDED is reached ROUTINELY (every T9
--   supersede-parent inside `approveVersion`) and therefore deserved its own
--   blast-radius analysis rather than a silent bundle. This migration is that
--   follow-up. Evidence:
--   docs/validation/finance-v3/generated/gate-d/FIX_SUPERSEDED_IMMUTABILITY_report.md
--
--   Measured on the pre-fix schema, on a row driven to SUPERSEDED through the
--   REAL services (approve v1 -> reopen -> approve v2, which fires T9), with
--   FK-valid donor values borrowed from v2 so that only the TRIGGER could
--   possibly reject:
--     content_semantic_hash      : UPDATE ACCEPTED (changes=1)
--     compute_snapshot_id        : UPDATE ACCEPTED (changes=1)
--     source_working_revision_id : UPDATE ACCEPTED (changes=1)
--     status -> 'DRAFT'          : UPDATE ACCEPTED (changes=1)  [resurrection]
--   i.e. the financial content of every version ever displaced by a newer one
--   was freely rewritable, and the row could be walked back out of its
--   terminal state. `SUPERSEDED` is in `lifecycleService.TERMINAL_STATUSES`
--   and has ZERO outgoing transitions in `TRANSITIONS`, so neither is
--   legitimate.
--
-- BLAST RADIUS — who legitimately writes a SUPERSEDED row today (exhaustive
-- sweep of `server/src`, `server/scripts` and `server/migrations`; every hit
-- checked against its own WHERE clause):
--   * d01c retained-earnings trigger,
--     20260810_finance_v3_d01c_real_company_integrity_fix.sql:288 —
--       `UPDATE ... SET result_quality = ... WHERE business_version_id = NEW...
--        AND status <> 'APPROVED'`. This filter targets SUPERSEDED rows among
--       others, so `result_quality` MUST stay writable. Already allow-listed
--       for ARCHIVED/INVALIDATED by the 08-23 migration for the same reason.
--   * the freshness-propagation stream — `freshness`, `freshness_reason`,
--       `stale_since`. Allow-listed on APPROVED rows since b01 and on
--       ARCHIVED/INVALIDATED rows since 08-23; a displaced version's inputs
--       must still be markable stale. Keeping them writable here is what makes
--       SUPERSEDED behave like its two sibling terminal statuses instead of
--       being a special case.
--   * `updated_at` — written by this trigger itself.
--   NOT writers of a SUPERSEDED row, verified rather than assumed:
--     - `artifactVersionService.transition()` — every transition's `from`
--       excludes SUPERSEDED, and the UPDATE additionally carries
--       `AND status = <current.status>`.
--     - `approveVersion()` T9 supersede-parent — `WHERE ... AND status =
--       'APPROVED'`, so OLD.status is APPROVED and it lands in the APPROVED
--       branch below, untouched by this change.
--     - `approveVersion()` status flip, `createArtifact()` /
--       `reopenVersion()` `source_working_revision_id` backfills — all target
--       a DRAFT/IN_REVIEW row.
--     - `statementReconciliationService.ts:789` — `AND status = 'DRAFT'`.
--     - `server/scripts/finance-v3-backfill-dry-run.ts:314` — supersedes a
--       parent with `WHERE ... status NOT IN ('SUPERSEDED','ARCHIVED',
--       'INVALIDATED')`, i.e. it already refuses to re-write an
--       already-superseded row.
--     - `server/src/services/demo/atelierFinanceSeed.ts` — zero references to
--       `finance_business_versions` (legacy `financial_*` tables only).
--     - the other two triggers on this table
--       (`trg_finance_bv_mark_advisor_stale_on_recompute`,
--        `trg_finance_bv_freeze_advisor_on_approval`) are AFTER triggers that
--       write valuation-advisor tables, never this one.
--   So the allow-list needed for SUPERSEDED is exactly the one already in use
--   for the other two terminal statuses — no widening, no new exception.
--
-- IMPLEMENTATION: rather than duplicating the 08-23 branch, its guard is
-- widened from the two-status literal to the full terminal set, mirroring
-- `lifecycleService.TERMINAL_STATUSES = ['SUPERSEDED','ARCHIVED','INVALIDATED']`
-- 1:1. Message wording, allow-list and idiom are carried over unchanged. If a
-- future transition ever legitimately leaves a terminal status, THIS guard is
-- the single place that has to learn about it.
--
-- The APPROVED branch is carried over verbatim from b01 / 08-23.
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
  -- lifecycleService.TERMINAL_STATUSES, 1:1. Statuses with no outgoing
  -- transition in `TRANSITIONS`.
  terminal_statuses TEXT[] := ARRAY['SUPERSEDED', 'ARCHIVED', 'INVALIDATED'];
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

  -- A version retired by T9 `supersede` / T10 `archive` / T11 `invalidate`
  -- stays retired, and its contents stay exactly as they were at the moment of
  -- approval. (08-23 covered ARCHIVED/INVALIDATED; this migration adds
  -- SUPERSEDED, the routinely-reached one.)
  IF TG_OP = 'UPDATE' AND OLD.status = ANY(terminal_statuses) THEN
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
