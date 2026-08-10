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
  // OKR-E001 (docs/product/results-vnext/OKR_E001_DESIGN.md §7, Decision P3)
  // — appended, never reordered/removed relative to the values above. NOT
  // for ABAC rows (Program/Cycle use plain organization_id scoping, per
  // Decision P2) — only because PlatformEventEnvelope.aggregateType is
  // typed to this union and every event OKR-E001 writes needs a value from
  // it. 'okr_set' (already present above) stays untouched, reserved for
  // OKR-E002.
  'okr_program',
  'okr_cycle',
] as const;

export type RvnResourceType = (typeof RVN_RESOURCE_TYPES)[number];
