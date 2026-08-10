/**
 * AP-11 — Finance Lineage Navigator: a presentation contract WRAPPING the
 * lineage DAG that already exists.
 *
 * It does not re-implement lineage. `server/src/services/finance/canonical/lineageService.ts`
 * already owns the edges, the cycle rule and the recursive `getAncestors` /
 * `getDescendants` queries (migration
 * `20260809_finance_v3_b03_lineage_freshness.sql`). This module turns those
 * flat edge rows into the four things OWN-FIN-022 asks for:
 *
 *   1. a COMPACT TRAIL — `Statement pack v3 → Analysis v2 → Baseline model v4
 *      → Scenario Bull v2 → Valuation v1` — returned as STRUCTURED DATA, never
 *      a pre-joined string (a string cannot carry per-element status,
 *      freshness or a click target, which is exactly what the register demands:
 *      "z okresem, statusem i aktualnością każdego elementu");
 *   2. a RELATED PANEL with direct parents, direct children, indirect
 *      descendants, siblings and `+ New z preselected source`;
 *   3. STALE BADGES (`source changed` / `downstream stale` / `orphaned`);
 *   4. the FULL GRAPH declared explicitly as an AUXILIARY view, off by default
 *      ("pełny graf tylko jako widok pomocniczy").
 *
 * SCOPE: pure logic plus one injectable port. No React, no DOM. The DB access
 * is reached only through `LineageServicePort`, so every function here is
 * testable against mocked `lineageService` results with no database — see the
 * report's "Why the tests have no database" section.
 *
 * DELIBERATE NON-IMPORT: this file imports `LineageEdgeRow` / `LineageEdgeType`
 * from `lineageService.ts` as TYPES ONLY. A runtime import would pull
 * `PostgresDatabase.js` into every consumer (including the browser bundle a
 * future component lives in) purely to read a rank table. The stage order is
 * therefore derived from `FinanceArtifactTypeValues` in AP-00's
 * `ArtifactRef.ts`, whose array order IS the B03 rank order — and a test
 * imports the real `stageRank` to prove the two never drift.
 */

import {
  FinanceArtifactTypeValues,
  type FinanceArtifactType,
} from '../../../types/finance/ArtifactRef.js';
import type { FinanceArtifactFreshness } from '../../../types/finance/financeValueSemantics.js';
import type { BusinessVersionStatus } from '../canonical/lifecycleService.js';
import type { LineageEdgeRow, LineageEdgeType } from '../canonical/lineageService.js';
import type { WorkspaceBarLabel } from './workspaceBarContract.js';

// ---------------------------------------------------------------------------
// Stage order + edge topology (mirrors WP-B03; drift-tested).
// ---------------------------------------------------------------------------

/** `FinanceArtifactTypeValues` is declared in B03 rank order, so its index IS `stageRank`. */
export function lineageStageRank(artifactType: FinanceArtifactType): number {
  return FinanceArtifactTypeValues.indexOf(artifactType);
}

/** Sibling/variant annotation, not a downstream flow edge — excluded from ancestor walks (WP-B06 4.5). */
export const LINEAGE_SIBLING_EDGE_TYPES: readonly LineageEdgeType[] = [
  'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT',
];

export interface LineageEdgeTopology {
  edgeType: LineageEdgeType;
  /** `'any-upstream'` = every artifact type whose stage rank is lower than the target's (VERSION_TO_REPORT). */
  sourceTypes: readonly FinanceArtifactType[] | 'any-upstream';
  targetType: FinanceArtifactType | 'same-as-source';
}

export const LINEAGE_EDGE_TOPOLOGY: readonly LineageEdgeTopology[] = [
  { edgeType: 'STATEMENT_TO_ANALYSIS', sourceTypes: ['STATEMENT_PACK'], targetType: 'HISTORICAL_ANALYSIS' },
  { edgeType: 'STATEMENT_TO_MODEL', sourceTypes: ['STATEMENT_PACK'], targetType: 'BASELINE_MODEL' },
  { edgeType: 'ANALYSIS_TO_MODEL', sourceTypes: ['HISTORICAL_ANALYSIS'], targetType: 'BASELINE_MODEL' },
  { edgeType: 'MODEL_TO_SCENARIO', sourceTypes: ['BASELINE_MODEL'], targetType: 'PREDICTION_SCENARIO' },
  { edgeType: 'MODEL_TO_VALUATION', sourceTypes: ['BASELINE_MODEL'], targetType: 'VALUATION_CASE' },
  { edgeType: 'SCENARIO_TO_VALUATION', sourceTypes: ['PREDICTION_SCENARIO'], targetType: 'VALUATION_CASE' },
  { edgeType: 'VERSION_TO_REPORT', sourceTypes: 'any-upstream', targetType: 'REPORT_EXPORT' },
  {
    edgeType: 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT',
    sourceTypes: 'any-upstream',
    targetType: 'same-as-source',
  },
];

/**
 * Which artifact types the Related panel may offer `+ New` for, given the
 * artifact currently open. Derived from the edge topology instead of restated,
 * so a new edge type automatically appears in the UI contract.
 *
 * Addendum section 6 point 1 is honoured by construction: Scenario is optional
 * (BASELINE_MODEL offers both PREDICTION_SCENARIO and VALUATION_CASE), and
 * Analysis is a parallel child of Statement Pack rather than a mandatory link
 * in a chain.
 */
export function allowedDownstreamCreations(
  sourceType: FinanceArtifactType
): readonly FinanceArtifactType[] {
  const sourceRank = lineageStageRank(sourceType);
  const out: FinanceArtifactType[] = [];
  for (const topology of LINEAGE_EDGE_TOPOLOGY) {
    if (topology.targetType === 'same-as-source') continue; // sibling variant, not a "+ New downstream"
    const sourceAllowed =
      topology.sourceTypes === 'any-upstream'
        ? lineageStageRank(topology.targetType) > sourceRank
        : topology.sourceTypes.includes(sourceType);
    if (!sourceAllowed) continue;
    if (lineageStageRank(topology.targetType) <= sourceRank) continue; // rank rule (B03 section 4)
    if (!out.includes(topology.targetType)) out.push(topology.targetType);
  }
  return out;
}

/**
 * Parent edge types an artifact of this type is EXPECTED to have. Missing them
 * all makes the node `orphaned` (B03 section on "orphaned" = a simple
 * `NOT EXISTS` over required `edge_type` per `target_artifact_type`). Inner
 * arrays are OR-groups: a Baseline Model may be anchored on a Statement Pack
 * or on an Analysis (or both).
 */
export const LINEAGE_REQUIRED_PARENT_EDGES: Readonly<
  Record<FinanceArtifactType, readonly LineageEdgeType[]>
> = {
  STATEMENT_PACK: [], // root of the DAG
  HISTORICAL_ANALYSIS: ['STATEMENT_TO_ANALYSIS'],
  BASELINE_MODEL: ['STATEMENT_TO_MODEL', 'ANALYSIS_TO_MODEL'],
  PREDICTION_SCENARIO: ['MODEL_TO_SCENARIO'],
  VALUATION_CASE: ['MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION'],
  REPORT_EXPORT: ['VERSION_TO_REPORT'],
};

// ---------------------------------------------------------------------------
// Node metadata — supplied by the caller, not fetched here.
// ---------------------------------------------------------------------------

/**
 * Everything the trail/panel shows about one version. Fetching it is NOT this
 * module's job (it lives on `business_versions` + the artifact tables, which
 * `artifactVersionService` owns); the navigator takes a resolver so it stays a
 * pure transformation.
 */
export interface LineageNodeMetadata {
  /**
   * The tenant this version belongs to. REQUIRED, and checked on every node the
   * navigator renders — see the "Tenant isolation" section below for why the
   * SQL-level filter one layer down was not enough.
   */
  organizationId: string;
  versionId: string;
  artifactId: string;
  artifactType: FinanceArtifactType;
  /** The artifact's editable name — the same value the Workspace Bar shows. */
  name: string;
  /** e.g. `v3`. OWN-FIN-022: relations are keyed on immutable version IDs, never on names; the label is display only. */
  versionLabel: string;
  periodLabel: string | null;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  /** Named variant, e.g. `Bull` — carried so the trail can render `Scenario Bull v2`. */
  variantLabel: string | null;
}

export type LineageMetadataResolver = (versionId: string) => LineageNodeMetadata | undefined;

/** `Scenario Bull v2` / `Statement pack v3` — assembled from metadata, never parsed back out of a string. */
export function lineageNodeDisplayName(metadata: LineageNodeMetadata): string {
  const variant = metadata.variantLabel ? ` ${metadata.variantLabel}` : '';
  return `${metadata.name}${variant} ${metadata.versionLabel}`;
}

// ---------------------------------------------------------------------------
// Tenant isolation — the navigator's OWN guard, not the SQL layer's.
// ---------------------------------------------------------------------------

/**
 * `lineageService.getAncestors`/`getDescendants` already filter on
 * `organization_id` in SQL and every `LineageEdgeRow` carries the column — but
 * that was, until this section existed, the ONLY defence. No function in this
 * module read the field. `loadLineageNavigator` took an `organizationId` purely
 * to forward it to the port. So the navigator would faithfully render whatever
 * it was handed:
 *
 *   - a caller that merged two edge sets, or a cache keyed on `version_id`
 *     alone (version ids are UUIDs, so nothing about the KEY says which tenant
 *     it belongs to);
 *   - a `LineageMetadataResolver` that reached another tenant's version — the
 *     resolver is caller-supplied and completely untyped with respect to org;
 *   - a future batch/preload path that fetches edges without the org predicate.
 *
 * Relying on the layer below is exactly the "ochrona, której nie ma" pattern:
 * the guarantee exists in a place the reader of THIS file cannot see, and
 * disappears the moment someone assembles the inputs differently. The
 * navigator therefore re-establishes the boundary itself, on both inputs it
 * accepts (edges AND resolved metadata), and REPORTS what it dropped instead of
 * hiding it — a silent filter would turn a tenant-leak bug into a
 * "mysteriously short trail".
 *
 * Defence in depth, not a replacement: the SQL predicate stays authoritative
 * for what is fetched; this is the presentation layer refusing to render
 * anything that does not belong to the organization it was asked about.
 */
export interface LineageTenantAnomalies {
  /** Edge ids dropped because `organization_id` did not match — never traversed. */
  foreignEdgeIds: readonly string[];
  /** Version ids whose resolved metadata belonged to another organization — never rendered. */
  foreignVersionIds: readonly string[];
}

export const EMPTY_TENANT_ANOMALIES: LineageTenantAnomalies = Object.freeze({
  foreignEdgeIds: Object.freeze([]) as readonly string[],
  foreignVersionIds: Object.freeze([]) as readonly string[],
});

export function hasTenantAnomalies(anomalies: LineageTenantAnomalies): boolean {
  return anomalies.foreignEdgeIds.length > 0 || anomalies.foreignVersionIds.length > 0;
}

/** Splits an edge set into "this organization's" and "everything else", by id. */
export function partitionEdgesByOrganization(
  edges: readonly LineageEdgeRow[],
  organizationId: string
): { own: LineageEdgeRow[]; foreignEdgeIds: string[] } {
  const own: LineageEdgeRow[] = [];
  const foreignEdgeIds: string[] = [];
  for (const edge of edges) {
    if (edge.organization_id === organizationId) own.push(edge);
    else foreignEdgeIds.push(edge.id);
  }
  return { own, foreignEdgeIds };
}

export interface LineageTenantScopedResolver {
  /** Same shape as the caller's resolver, but returns `undefined` for a foreign version. */
  resolve: LineageMetadataResolver;
  /** Accumulates while the traversal runs; read it after building. */
  foreignVersionIds: readonly string[];
  isForeign(versionId: string): boolean;
}

/**
 * Wraps a caller-supplied resolver so a version belonging to another
 * organization can never enter a trail, a panel group, a sibling list or a
 * `+ Nowy` preselected source. Memoized per version id so the same lookup is
 * not charged twice and the anomaly is reported once.
 */
export function createTenantScopedResolver(
  resolve: LineageMetadataResolver,
  organizationId: string
): LineageTenantScopedResolver {
  const foreign = new Set<string>();
  const foreignVersionIds: string[] = [];
  return {
    resolve: (versionId: string) => {
      const metadata = resolve(versionId);
      if (!metadata) return undefined;
      if (metadata.organizationId !== organizationId) {
        if (!foreign.has(versionId)) {
          foreign.add(versionId);
          foreignVersionIds.push(versionId);
        }
        return undefined;
      }
      return metadata;
    },
    foreignVersionIds,
    isForeign: (versionId: string) => foreign.has(versionId),
  };
}

// ---------------------------------------------------------------------------
// Stale badges.
// ---------------------------------------------------------------------------

export type LineageStaleBadgeKind =
  | 'SOURCE_CHANGED'
  | 'ASSUMPTIONS_CHANGED'
  | 'DOWNSTREAM_STALE'
  | 'ORPHANED'
  | 'NEVER_COMPUTED'
  | 'COMPUTE_FAILED';

export interface LineageStaleBadge {
  kind: LineageStaleBadgeKind;
  label: WorkspaceBarLabel;
  /** A11y: the badge must read as text, never as a colour alone (handoff section 11). */
  severity: 'info' | 'warning' | 'error';
}

const STALE_BADGES: Readonly<Record<LineageStaleBadgeKind, LineageStaleBadge>> = {
  SOURCE_CHANGED: {
    kind: 'SOURCE_CHANGED',
    label: { key: 'finance.lineage.badge.sourceChanged', pl: 'Źródło się zmieniło' },
    severity: 'warning',
  },
  ASSUMPTIONS_CHANGED: {
    kind: 'ASSUMPTIONS_CHANGED',
    label: { key: 'finance.lineage.badge.assumptionsChanged', pl: 'Założenia się zmieniły' },
    severity: 'warning',
  },
  DOWNSTREAM_STALE: {
    kind: 'DOWNSTREAM_STALE',
    label: { key: 'finance.lineage.badge.downstreamStale', pl: 'Potomkowie nieaktualni' },
    severity: 'warning',
  },
  ORPHANED: {
    kind: 'ORPHANED',
    label: { key: 'finance.lineage.badge.orphaned', pl: 'Brak źródła (sierota)' },
    severity: 'error',
  },
  NEVER_COMPUTED: {
    kind: 'NEVER_COMPUTED',
    label: { key: 'finance.lineage.badge.neverComputed', pl: 'Nie przeliczono' },
    severity: 'info',
  },
  COMPUTE_FAILED: {
    kind: 'COMPUTE_FAILED',
    label: { key: 'finance.lineage.badge.computeFailed', pl: 'Błąd przeliczenia' },
    severity: 'error',
  },
};

export function staleBadgeFromFreshness(freshness: FinanceArtifactFreshness): LineageStaleBadge | null {
  switch (freshness) {
    case 'CURRENT':
      return null;
    case 'STALE_SOURCE':
      return STALE_BADGES.SOURCE_CHANGED;
    case 'STALE_ASSUMPTIONS':
      return STALE_BADGES.ASSUMPTIONS_CHANGED;
    case 'NEVER_COMPUTED':
      return STALE_BADGES.NEVER_COMPUTED;
    case 'COMPUTE_FAILED':
      return STALE_BADGES.COMPUTE_FAILED;
    default:
      return null;
  }
}

export function orphanBadge(): LineageStaleBadge {
  return STALE_BADGES.ORPHANED;
}

export function downstreamStaleBadge(): LineageStaleBadge {
  return STALE_BADGES.DOWNSTREAM_STALE;
}

/** True when none of the parent edge types the artifact type requires is present. */
export function isOrphaned(
  artifactType: FinanceArtifactType,
  incomingEdges: readonly LineageEdgeRow[]
): boolean {
  const required = LINEAGE_REQUIRED_PARENT_EDGES[artifactType];
  if (required.length === 0) return false;
  return !incomingEdges.some((edge) => required.includes(edge.edge_type));
}

// ---------------------------------------------------------------------------
// Compact trail.
// ---------------------------------------------------------------------------

/**
 * When a node has several parents, the compact trail must still be ONE line.
 * The chosen parent is the nearest upstream STAGE (highest source rank), then
 * this edge-type order, then newest first, then version id — fully
 * deterministic, so the trail does not flicker between reloads. The paths not
 * taken are not lost: `hasAlternatePaths` flags them and the Related panel +
 * full-graph view carry them.
 */
export const LINEAGE_PRIMARY_PARENT_EDGE_PRIORITY: readonly LineageEdgeType[] = [
  'SCENARIO_TO_VALUATION',
  'MODEL_TO_VALUATION',
  'MODEL_TO_SCENARIO',
  'ANALYSIS_TO_MODEL',
  'STATEMENT_TO_MODEL',
  'STATEMENT_TO_ANALYSIS',
  'VERSION_TO_REPORT',
  'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT',
];

export interface LineageTrailNode {
  kind: 'node';
  metadata: LineageNodeMetadata;
  displayName: string;
  isFocus: boolean;
  /** The edge that leads FROM this node to the next one in the trail; `null` on the focus node. */
  outgoingEdgeType: LineageEdgeType | null;
  staleBadge: LineageStaleBadge | null;
}

export interface LineageTrailCollapsed {
  kind: 'collapsed';
  hiddenCount: number;
  hiddenVersionIds: readonly string[];
}

export type LineageTrailItem = LineageTrailNode | LineageTrailCollapsed;

export interface LineageTrail {
  /** Ordered ROOT → FOCUS, i.e. the reading order of `Statement pack v3 → … → Valuation v1`. */
  items: readonly LineageTrailItem[];
  /** Node count before collapsing, so a caller can decide whether the full graph is worth offering. */
  totalNodeCount: number;
  /** At least one node in the chain had more than one eligible parent. */
  hasAlternatePaths: boolean;
  /** Version ids the resolver could not describe — surfaced instead of silently dropped. */
  unresolvedVersionIds: readonly string[];
  /** Cross-tenant input the navigator refused to render. Empty on healthy data. */
  tenant: LineageTenantAnomalies;
}

/** Minimum that still shows root + ellipsis + focus. */
export const LINEAGE_TRAIL_MIN_NODES = 3;
export const LINEAGE_TRAIL_DEFAULT_MAX_NODES = 5;

export interface BuildLineageTrailParams {
  /** REQUIRED tenant scope — every edge and every resolved node is checked against it. */
  organizationId: string;
  focusVersionId: string;
  /** Whatever `lineageService.getAncestors` returned (flat, de-duplicated, unordered). */
  ancestorEdges: readonly LineageEdgeRow[];
  resolve: LineageMetadataResolver;
  maxNodes?: number;
}

export function buildLineageTrail(params: BuildLineageTrailParams): LineageTrail {
  const maxNodes = Math.max(params.maxNodes ?? LINEAGE_TRAIL_DEFAULT_MAX_NODES, LINEAGE_TRAIL_MIN_NODES);

  const { own: ownEdges, foreignEdgeIds } = partitionEdgesByOrganization(
    params.ancestorEdges,
    params.organizationId
  );
  const scoped = createTenantScopedResolver(params.resolve, params.organizationId);

  const parentsByTarget = new Map<string, LineageEdgeRow[]>();
  for (const edge of ownEdges) {
    if (LINEAGE_SIBLING_EDGE_TYPES.includes(edge.edge_type)) continue;
    const list = parentsByTarget.get(edge.target_version_id);
    if (list) list.push(edge);
    else parentsByTarget.set(edge.target_version_id, [edge]);
  }

  const unresolvedVersionIds: string[] = [];
  const chain: Array<{ versionId: string; outgoingEdgeType: LineageEdgeType | null }> = [];
  const visited = new Set<string>();
  let hasAlternatePaths = false;

  let currentVersionId: string | null = params.focusVersionId;
  let edgeToChild: LineageEdgeType | null = null;
  while (currentVersionId && !visited.has(currentVersionId)) {
    visited.add(currentVersionId);
    chain.push({ versionId: currentVersionId, outgoingEdgeType: edgeToChild });
    const candidates = parentsByTarget.get(currentVersionId) ?? [];
    if (candidates.length > 1) hasAlternatePaths = true;
    const primary = pickPrimaryParent(candidates);
    if (!primary) break;
    edgeToChild = primary.edge_type;
    currentVersionId = primary.source_version_id;
  }

  // `chain` is FOCUS → ROOT; the trail reads ROOT → FOCUS.
  chain.reverse();

  const nodes: LineageTrailNode[] = [];
  for (const entry of chain) {
    const metadata = scoped.resolve(entry.versionId);
    if (!metadata) {
      // A foreign node is NOT "unresolved" — it resolved fine and was refused.
      // Keeping the two apart stops a tenant leak from being read as bad data.
      if (!scoped.isForeign(entry.versionId)) unresolvedVersionIds.push(entry.versionId);
      continue;
    }
    nodes.push({
      kind: 'node',
      metadata,
      displayName: lineageNodeDisplayName(metadata),
      isFocus: entry.versionId === params.focusVersionId,
      outgoingEdgeType: entry.outgoingEdgeType,
      staleBadge: staleBadgeFromFreshness(metadata.freshness),
    });
  }

  return {
    items: collapseTrail(nodes, maxNodes),
    totalNodeCount: nodes.length,
    hasAlternatePaths,
    unresolvedVersionIds,
    tenant: { foreignEdgeIds, foreignVersionIds: scoped.foreignVersionIds },
  };
}

function pickPrimaryParent(candidates: readonly LineageEdgeRow[]): LineageEdgeRow | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const sorted = [...candidates].sort((a, b) => {
    const rankDelta = lineageStageRank(b.source_artifact_type) - lineageStageRank(a.source_artifact_type);
    if (rankDelta !== 0) return rankDelta;
    const priorityDelta =
      LINEAGE_PRIMARY_PARENT_EDGE_PRIORITY.indexOf(a.edge_type) -
      LINEAGE_PRIMARY_PARENT_EDGE_PRIORITY.indexOf(b.edge_type);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.source_version_id < b.source_version_id ? -1 : 1;
  });
  return sorted[0];
}

/** Keep the root, collapse the middle, keep the tail ending at the focus node. */
function collapseTrail(nodes: readonly LineageTrailNode[], maxNodes: number): LineageTrailItem[] {
  if (nodes.length <= maxNodes) return [...nodes];
  const tailLength = maxNodes - 2; // root + ellipsis + tail
  const head = nodes[0];
  const tail = nodes.slice(nodes.length - tailLength);
  const hidden = nodes.slice(1, nodes.length - tailLength);
  return [
    head,
    {
      kind: 'collapsed',
      hiddenCount: hidden.length,
      hiddenVersionIds: hidden.map((node) => node.metadata.versionId),
    },
    ...tail,
  ];
}

// ---------------------------------------------------------------------------
// Related panel.
// ---------------------------------------------------------------------------

export interface LineageRelatedEntry {
  metadata: LineageNodeMetadata;
  displayName: string;
  edgeType: LineageEdgeType;
  /** 1 = direct parent/child; >1 = indirect. */
  depth: number;
  staleBadge: LineageStaleBadge | null;
}

export interface LineageRelatedGroup {
  artifactType: FinanceArtifactType;
  /** OWN-FIN-007: "listami i licznikami". */
  count: number;
  entries: readonly LineageRelatedEntry[];
}

export interface LineageCreateNewAction {
  targetArtifactType: FinanceArtifactType;
  label: WorkspaceBarLabel;
  /** OWN-FIN-007: "+ New z preselected source" — the exact immutable version, never the artifact name. */
  preselectedSource: { artifactId: string; artifactType: FinanceArtifactType; businessVersionId: string };
}

export interface LineageRelatedPanel {
  focus: LineageNodeMetadata;
  /** Direct parents (depth 1 upstream), grouped by artifact type. */
  parents: readonly LineageRelatedGroup[];
  /** Direct children (depth 1 downstream). */
  children: readonly LineageRelatedGroup[];
  /** Indirect descendants (depth >= 2) — the "pośrednich potomków" of OWN-FIN-022. */
  indirectDescendants: readonly LineageRelatedGroup[];
  /** Other versions/variants of the SAME artifact, plus explicit variant edges. */
  siblings: readonly LineageRelatedEntry[];
  createNew: readonly LineageCreateNewAction[];
  /** Focus-node badges: freshness-derived, plus `orphaned` and `downstream stale` which need the graph to compute. */
  focusBadges: readonly LineageStaleBadge[];
  /** Cross-tenant input the navigator refused to render. Empty on healthy data. */
  tenant: LineageTenantAnomalies;
}

export interface BuildRelatedPanelParams {
  /** REQUIRED tenant scope — every edge and every resolved node is checked against it. */
  organizationId: string;
  focusVersionId: string;
  ancestorEdges: readonly LineageEdgeRow[];
  descendantEdges: readonly LineageEdgeRow[];
  resolve: LineageMetadataResolver;
  /** Other business versions of the same artifact, resolved by the caller (`artifactVersionService`, not lineage). */
  siblingVersionIds?: readonly string[];
}

export function buildRelatedPanel(params: BuildRelatedPanelParams): LineageRelatedPanel | null {
  const ancestors = partitionEdgesByOrganization(params.ancestorEdges, params.organizationId);
  const descendants = partitionEdgesByOrganization(params.descendantEdges, params.organizationId);
  const foreignEdgeIds = [...ancestors.foreignEdgeIds, ...descendants.foreignEdgeIds];
  const scoped = createTenantScopedResolver(params.resolve, params.organizationId);

  // A focus node from another tenant is not a degraded panel, it is a refusal:
  // there is nothing legitimate to show and no partial answer worth rendering.
  const focus = scoped.resolve(params.focusVersionId);
  if (!focus) return null;

  const ancestorEdges = ancestors.own;
  const descendantEdges = descendants.own;

  const incoming = ancestorEdges.filter((e) => e.target_version_id === params.focusVersionId);

  const parentEntries = toEntries(
    incoming.filter((e) => !LINEAGE_SIBLING_EDGE_TYPES.includes(e.edge_type)),
    (edge) => edge.source_version_id,
    1,
    scoped.resolve
  );

  const descendantDepths = computeDepths({
    edges: descendantEdges,
    rootVersionId: params.focusVersionId,
    direction: 'downstream',
    organizationId: params.organizationId,
  }).depths;
  const directChildEdges = descendantEdges.filter(
    (e) => e.source_version_id === params.focusVersionId && !LINEAGE_SIBLING_EDGE_TYPES.includes(e.edge_type)
  );
  const childEntries = toEntries(directChildEdges, (edge) => edge.target_version_id, 1, scoped.resolve);

  const directChildIds = new Set(directChildEdges.map((e) => e.target_version_id));
  const indirectEdges = descendantEdges.filter(
    (e) =>
      !LINEAGE_SIBLING_EDGE_TYPES.includes(e.edge_type) &&
      e.target_version_id !== params.focusVersionId &&
      !directChildIds.has(e.target_version_id)
  );
  const indirectEntries = dedupeByVersionId(
    indirectEdges.map((edge) => {
      const metadata = scoped.resolve(edge.target_version_id);
      if (!metadata) return null;
      return {
        metadata,
        displayName: lineageNodeDisplayName(metadata),
        edgeType: edge.edge_type,
        depth: descendantDepths.get(edge.target_version_id) ?? 2,
        staleBadge: staleBadgeFromFreshness(metadata.freshness),
      } satisfies LineageRelatedEntry;
    })
  );

  const variantEdges = [...ancestorEdges, ...descendantEdges].filter((e) =>
    LINEAGE_SIBLING_EDGE_TYPES.includes(e.edge_type)
  );
  const siblingIds = new Set<string>(params.siblingVersionIds ?? []);
  for (const edge of variantEdges) {
    if (edge.source_version_id !== params.focusVersionId) siblingIds.add(edge.source_version_id);
    if (edge.target_version_id !== params.focusVersionId) siblingIds.add(edge.target_version_id);
  }
  siblingIds.delete(params.focusVersionId);
  const siblings = dedupeByVersionId(
    [...siblingIds].map((versionId) => {
      const metadata = scoped.resolve(versionId);
      if (!metadata) return null;
      return {
        metadata,
        displayName: lineageNodeDisplayName(metadata),
        edgeType: 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT' as LineageEdgeType,
        depth: 0,
        staleBadge: staleBadgeFromFreshness(metadata.freshness),
      } satisfies LineageRelatedEntry;
    })
  );

  const focusBadges: LineageStaleBadge[] = [];
  const ownBadge = staleBadgeFromFreshness(focus.freshness);
  if (ownBadge) focusBadges.push(ownBadge);
  if (isOrphaned(focus.artifactType, incoming)) focusBadges.push(orphanBadge());
  const anyDescendantStale = [...childEntries, ...indirectEntries].some(
    (entry) => entry.metadata.freshness !== 'CURRENT'
  );
  if (anyDescendantStale) focusBadges.push(downstreamStaleBadge());

  return {
    focus,
    parents: groupByArtifactType(parentEntries),
    children: groupByArtifactType(childEntries),
    indirectDescendants: groupByArtifactType(indirectEntries),
    siblings,
    createNew: allowedDownstreamCreations(focus.artifactType).map((targetArtifactType) => ({
      targetArtifactType,
      label: {
        key: `finance.lineage.createNew.${targetArtifactType}`,
        pl: `+ Nowy: ${ARTIFACT_TYPE_LABEL_PL[targetArtifactType]}`,
      },
      preselectedSource: {
        artifactId: focus.artifactId,
        artifactType: focus.artifactType,
        businessVersionId: focus.versionId,
      },
    })),
    focusBadges,
    tenant: { foreignEdgeIds, foreignVersionIds: scoped.foreignVersionIds },
  };
}

export const ARTIFACT_TYPE_LABEL_PL: Readonly<Record<FinanceArtifactType, string>> = {
  STATEMENT_PACK: 'Sprawozdanie',
  HISTORICAL_ANALYSIS: 'Analiza',
  BASELINE_MODEL: 'Model bazowy',
  PREDICTION_SCENARIO: 'Scenariusz',
  VALUATION_CASE: 'Wycena',
  REPORT_EXPORT: 'Raport / eksport',
};

function toEntries(
  edges: readonly LineageEdgeRow[],
  pick: (edge: LineageEdgeRow) => string,
  depth: number,
  resolve: LineageMetadataResolver
): LineageRelatedEntry[] {
  return dedupeByVersionId(
    edges.map((edge) => {
      const metadata = resolve(pick(edge));
      if (!metadata) return null;
      return {
        metadata,
        displayName: lineageNodeDisplayName(metadata),
        edgeType: edge.edge_type,
        depth,
        staleBadge: staleBadgeFromFreshness(metadata.freshness),
      } satisfies LineageRelatedEntry;
    })
  );
}

function dedupeByVersionId(entries: Array<LineageRelatedEntry | null>): LineageRelatedEntry[] {
  const seen = new Set<string>();
  const out: LineageRelatedEntry[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (seen.has(entry.metadata.versionId)) continue;
    seen.add(entry.metadata.versionId);
    out.push(entry);
  }
  return out;
}

function groupByArtifactType(entries: readonly LineageRelatedEntry[]): LineageRelatedGroup[] {
  const byType = new Map<FinanceArtifactType, LineageRelatedEntry[]>();
  for (const entry of entries) {
    const list = byType.get(entry.metadata.artifactType);
    if (list) list.push(entry);
    else byType.set(entry.metadata.artifactType, [entry]);
  }
  return FinanceArtifactTypeValues.filter((type) => byType.has(type)).map((artifactType) => {
    const list = byType.get(artifactType) ?? [];
    return { artifactType, count: list.length, entries: list };
  });
}

/**
 * BFS depth from `rootVersionId`. `getAncestors`/`getDescendants` strip their
 * recursive `depth` column via `SELECT DISTINCT`, so depth has to be recovered
 * here — and recovering it from the edge set is cheaper and less brittle than
 * changing a shipped, tested SQL query that other callers depend on.
 */
export interface ComputeDepthsParams {
  edges: readonly LineageEdgeRow[];
  rootVersionId: string;
  direction: 'upstream' | 'downstream';
  /** REQUIRED tenant scope — foreign edges are dropped before the walk, and reported. */
  organizationId: string;
}

export interface LineageDepthComputation {
  depths: Map<string, number>;
  /** Edge ids dropped because they belong to another organization. */
  foreignEdgeIds: readonly string[];
}

export function computeDepths(params: ComputeDepthsParams): LineageDepthComputation {
  const { rootVersionId, direction } = params;
  const { own, foreignEdgeIds } = partitionEdgesByOrganization(params.edges, params.organizationId);
  const adjacency = new Map<string, string[]>();
  for (const edge of own) {
    if (LINEAGE_SIBLING_EDGE_TYPES.includes(edge.edge_type)) continue;
    const from = direction === 'downstream' ? edge.source_version_id : edge.target_version_id;
    const to = direction === 'downstream' ? edge.target_version_id : edge.source_version_id;
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  }
  const depths = new Map<string, number>([[rootVersionId, 0]]);
  const queue: string[] = [rootVersionId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const depth = depths.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (depths.has(next)) continue;
      depths.set(next, depth + 1);
      queue.push(next);
    }
  }
  depths.delete(rootVersionId);
  return { depths, foreignEdgeIds };
}

// ---------------------------------------------------------------------------
// Full graph — explicitly auxiliary.
// ---------------------------------------------------------------------------

/**
 * OWN-FIN-022: "kompaktowy breadcrumb + panel relacji, a pełny graf tylko jako
 * widok pomocniczy"; addendum section 6 point 2: "Minimalny typed version-edge
 * ledger najpierw; pełny graf później". Declaring this as data (rather than
 * just not building it) means a future component cannot promote the graph to a
 * default view without editing a flag that says, in writing, why it is off.
 */
export const LINEAGE_FULL_GRAPH_VIEW = {
  id: 'finance.lineage.fullGraph',
  label: { key: 'finance.lineage.fullGraph', pl: 'Pełny graf powiązań' } as WorkspaceBarLabel,
  auxiliary: true,
  defaultVisible: false,
  /** Reachable only from the Related panel's footer — never a Workspace Bar view or a direct control. */
  entryPoint: 'related-panel-footer',
  rationale:
    'OWN-FIN-022 + addendum section 6.2 — the compact trail and the Related panel are the primary navigation; the graph is a fallback for genuinely branched cases.',
} as const;

// ---------------------------------------------------------------------------
// The port over the real service + the assembled model.
// ---------------------------------------------------------------------------

/** Structurally satisfied by `lineageService.getAncestors`/`getDescendants` as they exist today. */
export interface LineageServicePort {
  getAncestors(
    organizationId: string,
    businessVersionId: string,
    maxDepth?: number
  ): Promise<LineageEdgeRow[]>;
  getDescendants(
    organizationId: string,
    businessVersionId: string,
    maxDepth?: number
  ): Promise<LineageEdgeRow[]>;
}

export interface LineageNavigatorModel {
  trail: LineageTrail;
  related: LineageRelatedPanel | null;
  fullGraph: typeof LINEAGE_FULL_GRAPH_VIEW;
}

/**
 * `organizationId` is used TWICE on purpose: once as the SQL predicate the port
 * applies, and once as the navigator's own guard over whatever came back (plus
 * over whatever the caller's `resolve` produces, which the port never sees).
 * The second use is the one that survives a caller assembling the inputs by
 * hand — see the "Tenant isolation" section.
 */
export async function loadLineageNavigator(params: {
  port: LineageServicePort;
  organizationId: string;
  focusVersionId: string;
  resolve: LineageMetadataResolver;
  siblingVersionIds?: readonly string[];
  maxTrailNodes?: number;
  maxDepth?: number;
}): Promise<LineageNavigatorModel> {
  const [ancestorEdges, descendantEdges] = await Promise.all([
    params.port.getAncestors(params.organizationId, params.focusVersionId, params.maxDepth),
    params.port.getDescendants(params.organizationId, params.focusVersionId, params.maxDepth),
  ]);
  return {
    trail: buildLineageTrail({
      organizationId: params.organizationId,
      focusVersionId: params.focusVersionId,
      ancestorEdges,
      resolve: params.resolve,
      maxNodes: params.maxTrailNodes,
    }),
    related: buildRelatedPanel({
      organizationId: params.organizationId,
      focusVersionId: params.focusVersionId,
      ancestorEdges,
      descendantEdges,
      resolve: params.resolve,
      siblingVersionIds: params.siblingVersionIds,
    }),
    fullGraph: LINEAGE_FULL_GRAPH_VIEW,
  };
}
