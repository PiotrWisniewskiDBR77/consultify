/**
 * RN-G1 Platform Foundation — shared resource-type SSOT.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §C.3.
 *
 * `aggregate_type` (rvn_platform_events, §A.1), `object_type`
 * (v8_canonical_object_states, §C.1), `source_type`/`target_type`
 * (link_graph_edges, §C.2) and `resource_type`
 * (rvn_platform_resource_visibility / rvn_platform_resource_acl, §B.1) MUST
 * all draw from this ONE list — never from separate lists per layer.
 * Otherwise Platform adds a fourth parallel resource-naming taxonomy, the
 * exact pattern this program exists to undo (5 ROI systems, 4 KPI tables).
 *
 * These four values are also appended, verbatim and in this order, to
 * `CanonicalObjectTypeValues` in `server/src/types/myWorkRoofPackage.ts`
 * (existing values there are never reordered/removed — see that file).
 */

export const RVN_RESOURCE_TYPES = [
  'kpi',
  'roi_case',
  'okr_set',
  'deviation_case',
  // KPI-E004 (docs/product/results-vnext/KPI_E004_DESIGN.md prerequisite) —
  // appended, never reordered/removed relative to the values above.
  'kpi_scorecard',
] as const;

export type RvnResourceType = (typeof RVN_RESOURCE_TYPES)[number];
