-- Wave 11: Planning continuity + execution visibility query paths
-- WBS rows live in v8_initiative_decompositions (canonical WBS / decomposition store).
-- v8_execution_signals has no initiative_id column (initiative scope is modeled as
-- source_object_type = 'initiative' + source_object_id).

CREATE INDEX IF NOT EXISTS idx_v8_wbs_initiative
  ON v8_initiative_decompositions(initiative_id, organization_id);

-- Initiative-scoped signal reads (dashboard, blockers, rollup by initiative)
CREATE INDEX IF NOT EXISTS idx_v8_exec_signals_initiative
  ON v8_execution_signals(organization_id, source_object_id)
  WHERE source_object_type = 'initiative';

CREATE INDEX IF NOT EXISTS idx_v8_decisions_org
  ON v8_decision_chains(organization_id);
