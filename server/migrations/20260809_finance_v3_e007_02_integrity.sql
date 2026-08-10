-- Finance v3 / ROI-E007 (Stream A): Finance/KPI Seams, part 2/3 — integrity functions/triggers on
-- the three new tables from ..._01_tables.sql.
--
-- Source: docs/validation/finance-v3/generated/gate-d/ROI_E007_finance_kpi_seams_ADR.md sections
-- 3.3, 3.4, 6, Zalacznik A. See ..._01_tables.sql header for the three documented divergences
-- (explicit `status` column, DELETE deny trigger) this file's triggers implement.

BEGIN;

-- ------------------------------------------------------------------
-- 3.3 Anti-spoof: finance_artifact_type must match the referenced finance_artifacts row.
-- Same idiom as finance_lineage_prevent_cycle (WP-B03).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rvn_rfl_check_artifact_type() RETURNS TRIGGER AS $$
DECLARE actual_type TEXT;
BEGIN
  SELECT artifact_type INTO actual_type FROM finance_artifacts WHERE artifact_id = NEW.finance_artifact_id;
  IF actual_type IS DISTINCT FROM NEW.finance_artifact_type THEN
    RAISE EXCEPTION 'rvn_roi_finance_links: finance_artifact_type % does not match actual artifact_type % for artifact %',
      NEW.finance_artifact_type, actual_type, NEW.finance_artifact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_rfl_check_artifact_type ON rvn_roi_finance_links;
CREATE TRIGGER trg_rvn_rfl_check_artifact_type
  BEFORE INSERT ON rvn_roi_finance_links
  FOR EACH ROW EXECUTE FUNCTION rvn_rfl_check_artifact_type();

-- ------------------------------------------------------------------
-- 3.4 Pin immutability: finance_version_id / roi_case_bridge_id / the rest of the pin can never be
-- repinned by UPDATE — only freshness/supersession/status metadata may change. Allow-list-diff
-- idiom (WP-B01 trg_finance_bv_immutability / WP-D09 finance_advisor_outputs_enforce_freeze).
-- `status` is included in the allow-list (divergence from the ADR sketch's 5-column list) because
-- status is exactly the supersession-state field this migration added (..._01_tables.sql
-- divergence 1) — a status transition is metadata, not a repin.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rvn_rfl_enforce_pin_immutability() RETURNS TRIGGER AS $$
DECLARE allowed_keys TEXT[] := ARRAY[
  'status', 'freshness_state', 'freshness_reason', 'stale_since', 'superseded_by_link_id', 'superseded_at'
];
DECLARE old_j JSONB; new_j JSONB;
BEGIN
  old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);
  IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(allowed_keys)))
     IS DISTINCT FROM
     (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(allowed_keys)))
  THEN
    RAISE EXCEPTION 'rvn_roi_finance_links: % is a pin; only status/freshness/supersession metadata may change, never the pinned finance_version_id/roi_case_bridge_id', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_rfl_enforce_pin_immutability ON rvn_roi_finance_links;
CREATE TRIGGER trg_rvn_rfl_enforce_pin_immutability
  BEFORE UPDATE ON rvn_roi_finance_links
  FOR EACH ROW EXECUTE FUNCTION rvn_rfl_enforce_pin_immutability();

-- ------------------------------------------------------------------
-- Divergence 4 (..._01_tables.sql header): rvn_roi_finance_links can never be hard-deleted.
-- API-level DELETE (ADR section 8) must map to UPDATE ... SET status = 'WITHDRAWN', superseded_at
-- = now() instead (orchestrator scope item 1 — soft-delete via status, never a hard DELETE, same
-- append-only philosophy as every other governed table in this program).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rvn_rfl_deny_hard_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'rvn_roi_finance_links: hard DELETE is not permitted (row %); withdraw via UPDATE ... SET status = ''WITHDRAWN'', superseded_at = now() instead', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_rfl_deny_hard_delete ON rvn_roi_finance_links;
CREATE TRIGGER trg_rvn_rfl_deny_hard_delete
  BEFORE DELETE ON rvn_roi_finance_links
  FOR EACH ROW EXECUTE FUNCTION rvn_rfl_deny_hard_delete();

-- ------------------------------------------------------------------
-- rvn_roi_finance_link_events — append-only ledger, identical shape to
-- finance_lineage_edges_deny_mutation (WP-B03).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rvn_roi_finance_link_events_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'rvn_roi_finance_link_events is append-only; % not permitted (row %)', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_rfle_deny_update ON rvn_roi_finance_link_events;
CREATE TRIGGER trg_rvn_rfle_deny_update
  BEFORE UPDATE ON rvn_roi_finance_link_events
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_finance_link_events_deny_mutation();
DROP TRIGGER IF EXISTS trg_rvn_rfle_deny_delete ON rvn_roi_finance_link_events;
CREATE TRIGGER trg_rvn_rfle_deny_delete
  BEFORE DELETE ON rvn_roi_finance_link_events
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_finance_link_events_deny_mutation();

-- ------------------------------------------------------------------
-- 6. Freshness propagation: when Finance approves a NEW version of an artifact, every ACTIVE link
-- still pinned to an older version of that same artifact flips to STALE_SOURCE (never
-- auto-recomputed / never re-pinned — pin immutability above enforces that physically) and gets an
-- append-only event row. Fires for every finance_business_versions UPDATE in the whole system
-- (Statements/Analysis/Baseline/Scenario/Valuation, all Gate D domains) — no-op where no link
-- exists (WP-D09 section 12.3 established this "generic, table-agnostic" idiom for Advisor
-- staleness; reused verbatim here). Scoped to status='ACTIVE' (divergence 1) so a SUPERSEDED or
-- WITHDRAWN link never gets a spurious staleness flip.
-- server/src/services/finance/canonical/artifactVersionService.ts:521 (approveVersion()) is NOT
-- modified by this migration — this trigger is the only integration point (ADR section 6).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rvn_roi_finance_mark_links_stale_on_new_approval() RETURNS TRIGGER AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN
    FOR r IN
      SELECT id, freshness_state FROM rvn_roi_finance_links
      WHERE finance_artifact_id = NEW.artifact_id
        AND finance_version_id <> NEW.business_version_id
        AND status = 'ACTIVE'
    LOOP
      UPDATE rvn_roi_finance_links
        SET freshness_state = 'STALE_SOURCE',
            freshness_reason = 'finance_artifact_id ' || NEW.artifact_id || ' has a newer APPROVED version',
            stale_since = now()
        WHERE id = r.id;
      INSERT INTO rvn_roi_finance_link_events (organization_id, link_id, previous_state, new_state, reason_code, triggering_finance_version_id)
        VALUES (NEW.organization_id, r.id, r.freshness_state::text, 'STALE_SOURCE', 'NEW_APPROVED_VERSION', NEW.business_version_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_bv_mark_roi_links_stale ON finance_business_versions;
CREATE TRIGGER trg_finance_bv_mark_roi_links_stale
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_finance_mark_links_stale_on_new_approval();

COMMIT;
