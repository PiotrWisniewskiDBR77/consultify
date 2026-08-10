/**
 * AP-11 — Finance lineage navigator contract tests.
 *
 * Split out of the former `workspaceContracts.test.ts` (AP-0 wave prep).
 * Shared fixtures and the "why there is no database here" rationale live in
 * `workspaceTestFixtures.ts`.
 *
 * NOTE — LIVE COUPLING TO THE DB LAYER: the runtime import of `stageRank` from
 * `../../canonical/lineageService.js` is deliberate (it is the cross-check that
 * keeps this package's stage order from drifting away from the real one), and it
 * pulls `PostgresDatabase.js` into the module graph. No connection is opened,
 * but the import is real — keep it in mind when touching module-load side effects.
 */
import { describe, expect, it } from 'vitest';

import { FinanceArtifactTypeValues } from '../../../../types/finance/ArtifactRef.js';
import { stageRank } from '../../canonical/lineageService.js';
import type { LineageEdgeRow } from '../../canonical/lineageService.js';
import {
  LINEAGE_FULL_GRAPH_VIEW,
  LINEAGE_NAV_STACK_MAX_DEPTH,
  LINEAGE_RELATED_DRAWER,
  allowedDownstreamCreations,
  applyWorkspaceRestorePoint,
  buildLineageTrail,
  buildRelatedPanel,
  captureWorkspaceRestorePoint,
  closeRelatedDrawer,
  computeDepths,
  createNavigationStack,
  createRelatedDrawerState,
  hasTenantAnomalies,
  isOrphaned,
  isTerminalVersionStatus,
  lineageStageRank,
  loadLineageNavigator,
  openRelatedDrawer,
  peekNavigation,
  popNavigation,
  pushNavigation,
  type LineageMetadataResolver,
  type LineageNavigationEntry,
  type LineageNodeMetadata,
  type LineageServicePort,
  type LineageTrailNode,
} from '../lineageNavigatorContract.js';
import { createEmptyWorkspaceState, type FinanceWorkspaceState } from '../../../../types/finance/WorkspaceState.js';
import { ORG, artifactRef } from './workspaceTestFixtures.js';

// ===========================================================================
// AP-11 — lineage navigator
// ===========================================================================

function edge(
  source: string,
  sourceType: LineageEdgeRow['source_artifact_type'],
  target: string,
  targetType: LineageEdgeRow['target_artifact_type'],
  edgeType: LineageEdgeRow['edge_type'],
  createdAt = '2026-08-01T00:00:00.000Z'
): LineageEdgeRow {
  return {
    id: `${source}->${target}:${edgeType}`,
    organization_id: ORG,
    source_version_id: source,
    source_artifact_type: sourceType,
    target_version_id: target,
    target_artifact_type: targetType,
    edge_type: edgeType,
    transformation_kind: 'COMPUTE',
    assumption_snapshot_hash: null,
    assumption_snapshot_id: null,
    compute_run_id: null,
    author_id: 'user-1',
    created_at: createdAt,
  };
}

/**
 * Fixture nodes without the tenant field — `NODES` below stamps every one of
 * them with `ORG`. Tests that need a foreign node build it explicitly with
 * `foreignNode()`, so a cross-tenant fixture can never appear by accident.
 */
const NODE_SHAPES: Record<string, Omit<LineageNodeMetadata, 'organizationId'>> = {
  sp3: {
    versionId: 'sp3',
    artifactId: 'sp',
    artifactType: 'STATEMENT_PACK',
    name: 'Statement pack',
    versionLabel: 'v3',
    periodLabel: 'FY2024',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  an2: {
    versionId: 'an2',
    artifactId: 'an',
    artifactType: 'HISTORICAL_ANALYSIS',
    name: 'Analysis',
    versionLabel: 'v2',
    periodLabel: 'FY2024',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  bm4: {
    versionId: 'bm4',
    artifactId: 'bm',
    artifactType: 'BASELINE_MODEL',
    name: 'Baseline model',
    versionLabel: 'v4',
    periodLabel: 'FY2025-FY2029',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  sc2: {
    versionId: 'sc2',
    artifactId: 'sc',
    artifactType: 'PREDICTION_SCENARIO',
    name: 'Scenario',
    versionLabel: 'v2',
    periodLabel: 'FY2025-FY2029',
    status: 'APPROVED',
    freshness: 'STALE_SOURCE',
    variantLabel: 'Bull',
  },
  val1: {
    versionId: 'val1',
    artifactId: 'val',
    artifactType: 'VALUATION_CASE',
    name: 'Valuation',
    versionLabel: 'v1',
    periodLabel: 'FY2025',
    status: 'DRAFT',
    freshness: 'NEVER_COMPUTED',
    variantLabel: null,
  },
  rep1: {
    versionId: 'rep1',
    artifactId: 'rep',
    artifactType: 'REPORT_EXPORT',
    name: 'Report',
    versionLabel: 'v1',
    periodLabel: null,
    status: 'DRAFT',
    freshness: 'CURRENT',
    variantLabel: null,
  },
};

const NODES: Record<string, LineageNodeMetadata> = Object.fromEntries(
  Object.entries(NODE_SHAPES).map(([versionId, shape]) => [
    versionId,
    { organizationId: ORG, ...shape } satisfies LineageNodeMetadata,
  ])
);

const OTHER_ORG = 'org-intruder';

/** A version that genuinely resolves — but belongs to somebody else. */
function foreignNode(overrides: Partial<LineageNodeMetadata> & { versionId: string }): LineageNodeMetadata {
  return {
    organizationId: OTHER_ORG,
    artifactId: 'foreign-artifact',
    artifactType: 'BASELINE_MODEL',
    name: 'Konkurencja — model',
    versionLabel: 'v9',
    periodLabel: 'FY2024',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
    ...overrides,
  };
}

const resolve: LineageMetadataResolver = (versionId) => NODES[versionId];

/** Ancestors of `val1` — the shape `lineageService.getAncestors` really returns: flat, distinct, unordered. */
const ANCESTOR_EDGES: LineageEdgeRow[] = [
  edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
  edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
  edge('an2', 'HISTORICAL_ANALYSIS', 'bm4', 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL'),
  edge('sp3', 'STATEMENT_PACK', 'bm4', 'BASELINE_MODEL', 'STATEMENT_TO_MODEL'),
  edge('sp3', 'STATEMENT_PACK', 'an2', 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS'),
];

describe('AP-11 lineageNavigatorContract — stage order does not drift from lineageService', () => {
  it('derives the same rank as the real stageRank for every artifact type', () => {
    for (const artifactType of FinanceArtifactTypeValues) {
      expect(lineageStageRank(artifactType)).toBe(stageRank(artifactType));
    }
  });
});

describe('AP-11 lineageNavigatorContract — compact trail', () => {
  it('builds the register\'s example chain as STRUCTURED data, root -> focus', () => {
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    expect(nodes.map((n) => n.displayName)).toEqual([
      'Statement pack v3',
      'Analysis v2',
      'Baseline model v4',
      'Scenario Bull v2',
      'Valuation v1',
    ]);
    // Structured, not a string: every element carries its own status/freshness/period.
    expect(nodes[3].metadata.status).toBe('APPROVED');
    expect(nodes[3].metadata.periodLabel).toBe('FY2025-FY2029');
    expect(nodes[4].isFocus).toBe(true);
    expect(nodes.slice(0, 4).every((n) => n.isFocus === false)).toBe(true);
    expect(trail.totalNodeCount).toBe(5);
    expect(trail.unresolvedVersionIds).toEqual([]);
  });

  it('carries a stale badge per element instead of one badge for the whole chain', () => {
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    expect(nodes[0].staleBadge).toBeNull(); // Statement pack is CURRENT
    expect(nodes[3].staleBadge?.kind).toBe('SOURCE_CHANGED'); // Scenario is STALE_SOURCE
    expect(nodes[4].staleBadge?.kind).toBe('NEVER_COMPUTED'); // Valuation was never computed
  });

  it('picks a deterministic primary parent when a node has two (and flags the alternate)', () => {
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    expect(trail.hasAlternatePaths).toBe(true); // bm4 has both sp3 and an2 as parents
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    // Nearest upstream stage wins: HISTORICAL_ANALYSIS (rank 1) over STATEMENT_PACK (rank 0).
    expect(nodes[1].metadata.versionId).toBe('an2');
    // Same input in a different order must give the same trail.
    const shuffled = buildLineageTrail({ organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: [...ANCESTOR_EDGES].reverse(),
      resolve,
    });
    expect(shuffled.items.filter((i) => i.kind === 'node').map((i) => (i as LineageTrailNode).displayName)).toEqual(
      nodes.map((n) => n.displayName)
    );
  });

  it('collapses the middle when the chain exceeds the compact budget', () => {
    const trail = buildLineageTrail({ organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve,
      maxNodes: 3,
    });
    expect(trail.items).toHaveLength(3);
    expect(trail.items[0]).toMatchObject({ kind: 'node' });
    expect(trail.items[1]).toMatchObject({ kind: 'collapsed', hiddenCount: 3 });
    expect((trail.items[2] as LineageTrailNode).isFocus).toBe(true);
    expect(trail.totalNodeCount).toBe(5);
  });

  it('reports an unresolvable version instead of silently dropping the chain', () => {
    const partial: LineageMetadataResolver = (id) => (id === 'bm4' ? undefined : NODES[id]);
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve: partial });
    expect(trail.unresolvedVersionIds).toEqual(['bm4']);
  });

  it('terminates on a root with no ancestor edges at all', () => {
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'sp3', ancestorEdges: [], resolve });
    expect(trail.items).toHaveLength(1);
    expect((trail.items[0] as LineageTrailNode).isFocus).toBe(true);
    expect(trail.hasAlternatePaths).toBe(false);
  });
});

describe('AP-11 lineageNavigatorContract — Related panel', () => {
  const DESCENDANT_EDGES: LineageEdgeRow[] = [
    edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
    edge('bm4', 'BASELINE_MODEL', 'val1', 'VALUATION_CASE', 'MODEL_TO_VALUATION'),
    edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
    edge('val1', 'VALUATION_CASE', 'rep1', 'REPORT_EXPORT', 'VERSION_TO_REPORT'),
  ];

  it('separates direct parents, direct children and indirect descendants with counts', () => {
    const panel = buildRelatedPanel({ organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(panel).not.toBeNull();
    expect(panel.parents.map((g) => [g.artifactType, g.count])).toEqual([
      ['STATEMENT_PACK', 1],
      ['HISTORICAL_ANALYSIS', 1],
    ]);
    expect(panel.children.map((g) => [g.artifactType, g.count])).toEqual([
      ['PREDICTION_SCENARIO', 1],
      ['VALUATION_CASE', 1],
    ]);
    expect(panel.indirectDescendants.map((g) => g.artifactType)).toEqual(['REPORT_EXPORT']);
    expect(panel.indirectDescendants[0].entries[0].depth).toBe(2);
  });

  it('offers "+ New" for every permitted downstream type with the exact source version preselected', () => {
    const panel = buildRelatedPanel({ organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(panel.createNew.map((c) => c.targetArtifactType)).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
      'REPORT_EXPORT',
    ]);
    for (const action of panel.createNew) {
      expect(action.preselectedSource).toEqual({
        artifactId: 'bm',
        artifactType: 'BASELINE_MODEL',
        businessVersionId: 'bm4',
      });
    }
  });

  it('flags downstream staleness on a node that is itself current', () => {
    const panel = buildRelatedPanel({ organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(NODES.bm4.freshness).toBe('CURRENT');
    expect(panel.focusBadges.map((b) => b.kind)).toEqual(['DOWNSTREAM_STALE']);
  });

  it('flags an orphan: an Analysis with no STATEMENT_TO_ANALYSIS parent', () => {
    expect(isOrphaned('HISTORICAL_ANALYSIS', [])).toBe(true);
    expect(isOrphaned('STATEMENT_PACK', [])).toBe(false); // roots are never orphans
    const panel = buildRelatedPanel({ organizationId: ORG,
      focusVersionId: 'an2',
      ancestorEdges: [],
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.focusBadges.map((b) => b.kind)).toContain('ORPHANED');
  });

  it('treats a management-adjusted variant edge as a sibling, not an ancestor', () => {
    const variantEdge = edge('sc2', 'PREDICTION_SCENARIO', 'sc9', 'PREDICTION_SCENARIO', 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT');
    const withVariant = [...ANCESTOR_EDGES, variantEdge];
    const trail = buildLineageTrail({ organizationId: ORG, focusVersionId: 'val1', ancestorEdges: withVariant, resolve });
    expect(trail.items.filter((i) => i.kind === 'node')).toHaveLength(5); // unchanged chain
    const panel = buildRelatedPanel({ organizationId: ORG,
      focusVersionId: 'sc2',
      ancestorEdges: withVariant,
      descendantEdges: [],
      resolve: (id) =>
        id === 'sc9'
          ? { ...NODES.sc2, versionId: 'sc9', versionLabel: 'v9', variantLabel: 'Bear', freshness: 'CURRENT' }
          : NODES[id],
    })!;
    expect(panel.siblings.map((s) => s.displayName)).toEqual(['Scenario Bear v9']);
  });

  it('returns null when the focus version itself cannot be resolved', () => {
    expect(
      buildRelatedPanel({ organizationId: ORG, focusVersionId: 'ghost', ancestorEdges: [], descendantEdges: [], resolve })
    ).toBeNull();
  });

  it('computes BFS depths in both directions', () => {
    const down = computeDepths({
      edges: DESCENDANT_EDGES,
      rootVersionId: 'bm4',
      direction: 'downstream',
      organizationId: ORG,
    }).depths;
    expect(down.get('sc2')).toBe(1);
    expect(down.get('val1')).toBe(1);
    expect(down.get('rep1')).toBe(2);
    expect(down.has('bm4')).toBe(false);
    const up = computeDepths({
      edges: ANCESTOR_EDGES,
      rootVersionId: 'val1',
      direction: 'upstream',
      organizationId: ORG,
    }).depths;
    expect(up.get('sc2')).toBe(1);
    expect(up.get('bm4')).toBe(2);
    expect(up.get('sp3')).toBe(3);
  });
});

describe('AP-11 lineageNavigatorContract — downstream topology and the auxiliary graph', () => {
  it('derives the permitted "+ New" targets from the DAG rules', () => {
    expect(allowedDownstreamCreations('STATEMENT_PACK', 'APPROVED')).toEqual([
      'HISTORICAL_ANALYSIS',
      'BASELINE_MODEL',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('HISTORICAL_ANALYSIS', 'APPROVED')).toEqual(['BASELINE_MODEL', 'REPORT_EXPORT']);
    // Addendum section 6.1: Scenario is OPTIONAL — a Model may go straight to Valuation.
    expect(allowedDownstreamCreations('BASELINE_MODEL', 'APPROVED')).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('VALUATION_CASE', 'APPROVED')).toEqual(['REPORT_EXPORT']);
    expect(allowedDownstreamCreations('REPORT_EXPORT', 'APPROVED')).toEqual([]);
  });

  it('keeps the full graph an auxiliary, off-by-default view (OWN-FIN-022)', () => {
    expect(LINEAGE_FULL_GRAPH_VIEW.auxiliary).toBe(true);
    expect(LINEAGE_FULL_GRAPH_VIEW.defaultVisible).toBe(false);
    expect(LINEAGE_FULL_GRAPH_VIEW.entryPoint).toBe('related-panel-footer');
  });
});

describe('AP-11 lineageNavigatorContract — wraps lineageService through an injectable port', () => {
  it('assembles trail + related panel from mocked getAncestors/getDescendants', async () => {
    const calls: string[] = [];
    const port: LineageServicePort = {
      async getAncestors(organizationId, businessVersionId) {
        calls.push(`ancestors:${organizationId}:${businessVersionId}`);
        return ANCESTOR_EDGES;
      },
      async getDescendants(organizationId, businessVersionId) {
        calls.push(`descendants:${organizationId}:${businessVersionId}`);
        return [edge('val1', 'VALUATION_CASE', 'rep1', 'REPORT_EXPORT', 'VERSION_TO_REPORT')];
      },
    };

    const model = await loadLineageNavigator({
      port,
      organizationId: ORG,
      focusVersionId: 'val1',
      resolve,
    });

    expect(calls.sort()).toEqual(['ancestors:org-test:val1', 'descendants:org-test:val1']);
    expect(
      model.trail.items.filter((i): i is LineageTrailNode => i.kind === 'node').map((n) => n.displayName)
    ).toEqual(['Statement pack v3', 'Analysis v2', 'Baseline model v4', 'Scenario Bull v2', 'Valuation v1']);
    expect(model.related?.children[0]).toMatchObject({ artifactType: 'REPORT_EXPORT', count: 1 });
    expect(model.fullGraph.defaultVisible).toBe(false);
  });
});
// ===========================================================================
// AP-11 — ADVERSARIAL: cross-tenant isolation at the NAVIGATOR level.
//
// These tests do not ask "does the SQL filter work" (canonicalServices.pg.test.ts
// answers that against a real Postgres). They ask the opposite question: if the
// navigator is HANDED contaminated input — because a caller merged two edge
// sets, a cache was keyed on version id alone, or the metadata resolver reached
// another tenant — does it still refuse to render it? Before this contract
// existed the answer was no: nothing in the module read organization_id.
// ===========================================================================

/** Same edge, re-stamped as another tenant's row (what a merged/cached edge set looks like). */
function crossTenantEdge(row: LineageEdgeRow): LineageEdgeRow {
  return { ...row, id: `foreign:${row.id}`, organization_id: OTHER_ORG };
}

describe('AP-11 lineageNavigatorContract — cross-tenant defence (adversarial)', () => {
  /**
   * The intruder is built to WIN the primary-parent tie-break: same artifact
   * type as bm4 (so equal stage rank), same edge type (so equal priority), but
   * created later — `pickPrimaryParent` sorts newest-first. Without the tenant
   * guard this edge, not bm4, is what the trail would show.
   */
  const INTRUDER_PARENT_EDGE = crossTenantEdge(
    edge('bmX', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO', '2026-08-09T00:00:00.000Z')
  );
  const POISONED_ANCESTORS: LineageEdgeRow[] = [...ANCESTOR_EDGES, INTRUDER_PARENT_EDGE];
  /** A resolver that happily describes the intruder — the caller has no org-awareness at all. */
  const poisonedResolve: LineageMetadataResolver = (versionId) =>
    versionId === 'bmX' ? foreignNode({ versionId: 'bmX' }) : NODES[versionId];

  it('POSITIVE CONTROL — a foreign edge that would win the parent tie-break is refused and reported', () => {
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: POISONED_ANCESTORS,
      resolve: poisonedResolve,
    });
    const names = trail.items
      .filter((i): i is LineageTrailNode => i.kind === 'node')
      .map((n) => n.displayName);
    // The intruder is nowhere in the rendered chain...
    expect(names).not.toContain('Konkurencja — model v9');
    expect(names.some((n) => n.includes('Konkurencja'))).toBe(false);
    // ...and the chain is exactly the clean one, i.e. bm4 kept its place.
    expect(names).toEqual([
      'Statement pack v3',
      'Analysis v2',
      'Baseline model v4',
      'Scenario Bull v2',
      'Valuation v1',
    ]);
    // The drop is reported, not silent.
    expect(trail.tenant.foreignEdgeIds).toEqual([INTRUDER_PARENT_EDGE.id]);
    expect(hasTenantAnomalies(trail.tenant)).toBe(true);
  });

  it('POSITIVE CONTROL — a resolver returning another tenant\'s version is dropped, and is NOT reported as unresolved', () => {
    // Edges are clean here: the ONLY contamination is the resolver, which the
    // SQL layer cannot see at all.
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve: (versionId) => (versionId === 'an2' ? foreignNode({ versionId: 'an2' }) : NODES[versionId]),
    });
    const names = trail.items
      .filter((i): i is LineageTrailNode => i.kind === 'node')
      .map((n) => n.displayName);
    expect(names).toEqual(['Statement pack v3', 'Baseline model v4', 'Scenario Bull v2', 'Valuation v1']);
    expect(trail.tenant.foreignVersionIds).toEqual(['an2']);
    // A tenant leak must not be mistaken for missing data.
    expect(trail.unresolvedVersionIds).toEqual([]);
  });

  it('POSITIVE CONTROL — the Related panel drops foreign children, indirect descendants and siblings', () => {
    const cleanDescendants = [
      edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
      edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
    ];
    const foreignChild = crossTenantEdge(
      edge('bm4', 'BASELINE_MODEL', 'valX', 'VALUATION_CASE', 'MODEL_TO_VALUATION')
    );
    const foreignIndirect = crossTenantEdge(
      edge('valX', 'VALUATION_CASE', 'repX', 'REPORT_EXPORT', 'VERSION_TO_REPORT')
    );
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [...cleanDescendants, foreignChild, foreignIndirect],
      // The caller also hands us a sibling id from the other tenant.
      siblingVersionIds: ['sibX'],
      resolve: (versionId) =>
        versionId === 'valX' || versionId === 'repX' || versionId === 'sibX'
          ? foreignNode({ versionId })
          : NODES[versionId],
    })!;
    expect(panel.children.map((g) => g.artifactType)).toEqual(['PREDICTION_SCENARIO']);
    expect(panel.indirectDescendants.map((g) => g.artifactType)).toEqual(['VALUATION_CASE']);
    expect(
      [...panel.children, ...panel.indirectDescendants]
        .flatMap((g) => g.entries)
        .every((e) => e.metadata.organizationId === ORG)
    ).toBe(true);
    expect(panel.siblings).toEqual([]);
    // Copy before sorting: `foreignEdgeIds` is `readonly string[]`, so an
    // in-place `.sort()` is both a type error and a mutation of the contract's
    // own output.
    expect([...panel.tenant.foreignEdgeIds].sort()).toEqual([foreignChild.id, foreignIndirect.id].sort());
    expect(panel.tenant.foreignVersionIds).toEqual(['sibX']);
  });

  it('POSITIVE CONTROL — a focus version from another tenant yields no panel at all', () => {
    expect(
      buildRelatedPanel({
        organizationId: ORG,
        focusVersionId: 'bmX',
        ancestorEdges: [],
        descendantEdges: [],
        resolve: poisonedResolve,
      })
    ).toBeNull();
  });

  it('POSITIVE CONTROL — computeDepths never walks a foreign edge', () => {
    const result = computeDepths({
      edges: [
        edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
        crossTenantEdge(edge('sc2', 'PREDICTION_SCENARIO', 'valX', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION')),
      ],
      rootVersionId: 'bm4',
      direction: 'downstream',
      organizationId: ORG,
    });
    expect(result.depths.get('sc2')).toBe(1);
    expect(result.depths.has('valX')).toBe(false);
    expect(result.foreignEdgeIds).toHaveLength(1);
  });

  it('POSITIVE CONTROL — a port that ignores its org argument cannot leak through loadLineageNavigator', async () => {
    // This is the realistic regression: a future batch/cached implementation of
    // the port that forgets the predicate. The navigator must still hold.
    const leakyPort: LineageServicePort = {
      async getAncestors() {
        return POISONED_ANCESTORS;
      },
      async getDescendants() {
        return [crossTenantEdge(edge('val1', 'VALUATION_CASE', 'repX', 'REPORT_EXPORT', 'VERSION_TO_REPORT'))];
      },
    };
    const model = await loadLineageNavigator({
      port: leakyPort,
      organizationId: ORG,
      focusVersionId: 'val1',
      resolve: (versionId) =>
        versionId === 'repX' ? foreignNode({ versionId, artifactType: 'REPORT_EXPORT' }) : poisonedResolve(versionId),
    });
    expect(
      model.trail.items.filter((i): i is LineageTrailNode => i.kind === 'node').map((n) => n.displayName)
    ).toEqual(['Statement pack v3', 'Analysis v2', 'Baseline model v4', 'Scenario Bull v2', 'Valuation v1']);
    expect(model.related?.children).toEqual([]);
    expect(hasTenantAnomalies(model.trail.tenant)).toBe(true);
    expect(hasTenantAnomalies(model.related!.tenant)).toBe(true);
  });

  it('NEGATIVE CONTROL — clean single-tenant data reports no anomalies and is unchanged', () => {
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve,
    });
    expect(trail.tenant).toEqual({ foreignEdgeIds: [], foreignVersionIds: [] });
    expect(hasTenantAnomalies(trail.tenant)).toBe(false);
    expect(trail.totalNodeCount).toBe(5);

    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO')],
      resolve,
    })!;
    expect(hasTenantAnomalies(panel.tenant)).toBe(false);
    expect(panel.children.map((g) => g.count)).toEqual([1]);
  });

  it('NEGATIVE CONTROL — the guard is scoped to the org asked for, not to a hard-coded one', () => {
    // The very same edges/nodes, viewed AS the other tenant, render fine — the
    // rule is "must match the caller's organization", not "must match ORG".
    const otherOrgEdges = ANCESTOR_EDGES.map(crossTenantEdge);
    const otherOrgResolve: LineageMetadataResolver = (versionId) =>
      NODES[versionId] ? { ...NODES[versionId], organizationId: OTHER_ORG } : undefined;
    const trail = buildLineageTrail({
      organizationId: OTHER_ORG,
      focusVersionId: 'val1',
      ancestorEdges: otherOrgEdges,
      resolve: otherOrgResolve,
    });
    expect(trail.totalNodeCount).toBe(5);
    expect(hasTenantAnomalies(trail.tenant)).toBe(false);
  });
});

// ===========================================================================
// AP-11 — terminal lifecycle states (ARCHIVED / SUPERSEDED / INVALIDATED).
// ===========================================================================

describe('AP-11 lineageNavigatorContract — terminal versions', () => {
  const archived = (versionId: string): LineageNodeMetadata => ({
    ...NODES[versionId],
    status: 'ARCHIVED',
  });

  it('POSITIVE CONTROL — "+ Nowy" is refused from a terminal node, with a stated reason', () => {
    for (const status of ['ARCHIVED', 'SUPERSEDED', 'INVALIDATED'] as const) {
      expect(isTerminalVersionStatus(status)).toBe(true);
      expect(allowedDownstreamCreations('BASELINE_MODEL', status)).toEqual([]);
      expect(allowedDownstreamCreations('STATEMENT_PACK', status)).toEqual([]);
    }
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [],
      resolve: (id) => (id === 'bm4' ? archived('bm4') : NODES[id]),
    })!;
    expect(panel.createNew).toEqual([]);
    expect(panel.createNewBlockedReason).toBe('TERMINAL_SOURCE_STATUS');
    expect(panel.createNewBlockedLabel?.pl).toContain('zamknięta');
    expect(panel.focusBadges.map((b) => b.kind)).toContain('ARCHIVED');
  });

  it('NEGATIVE CONTROL — every live status still offers the full downstream set', () => {
    for (const status of ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'NEEDS_CHANGES'] as const) {
      expect(isTerminalVersionStatus(status)).toBe(false);
      expect(allowedDownstreamCreations('BASELINE_MODEL', status)).toEqual([
        'PREDICTION_SCENARIO',
        'VALUATION_CASE',
        'REPORT_EXPORT',
      ]);
    }
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.createNew).toHaveLength(3);
    expect(panel.createNewBlockedReason).toBeNull();
  });

  it('distinguishes "no downstream type exists" from "this version is closed"', () => {
    // A REPORT_EXPORT is the last stage: empty for a structural reason, not a lifecycle one.
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'rep1',
      ancestorEdges: [edge('val1', 'VALUATION_CASE', 'rep1', 'REPORT_EXPORT', 'VERSION_TO_REPORT')],
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.createNew).toEqual([]);
    expect(panel.createNewBlockedReason).toBe('NO_DOWNSTREAM_TYPE');
  });

  it('keeps an archived ANCESTOR in the trail but marks and dims it', () => {
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve: (id) => (id === 'bm4' ? archived('bm4') : NODES[id]),
    });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    // The chain is intact — hiding a closed ancestor would falsify provenance.
    expect(nodes.map((n) => n.displayName)).toEqual([
      'Statement pack v3',
      'Analysis v2',
      'Baseline model v4',
      'Scenario Bull v2',
      'Valuation v1',
    ]);
    const bm = nodes.find((n) => n.metadata.versionId === 'bm4')!;
    expect(bm.isDimmed).toBe(true);
    expect(bm.stateBadge?.kind).toBe('ARCHIVED');
    // Orthogonal to freshness: sc2 is stale but live, bm4 is closed but current.
    expect(bm.staleBadge).toBeNull();
    const sc = nodes.find((n) => n.metadata.versionId === 'sc2')!;
    expect(sc.isDimmed).toBe(false);
    expect(sc.staleBadge?.kind).toBe('SOURCE_CHANGED');
    expect(sc.stateBadge).toBeNull();
  });

  it('dims terminal relatives by default and can hide them on request — with a count', () => {
    const descendants = [
      edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
      edge('bm4', 'BASELINE_MODEL', 'val1', 'VALUATION_CASE', 'MODEL_TO_VALUATION'),
    ];
    // sc2 is forced CURRENT so the only stale child is the closed one; otherwise
    // the DOWNSTREAM_STALE assertion below would be answered by sc2, not by the rule.
    const withArchivedChild: LineageMetadataResolver = (id) =>
      id === 'val1'
        ? { ...NODES.val1, status: 'INVALIDATED' }
        : id === 'sc2'
          ? { ...NODES.sc2, freshness: 'CURRENT' }
          : NODES[id];

    const dimmed = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: descendants,
      resolve: withArchivedChild,
    })!;
    expect(dimmed.terminalVisibility).toBe('dim');
    expect(dimmed.children.map((g) => g.artifactType)).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
    ]);
    expect(dimmed.children.flatMap((g) => g.entries).filter((e) => e.isDimmed)).toHaveLength(1);
    expect(dimmed.hiddenTerminalCount).toBe(0);
    // val1 is NEVER_COMPUTED, but it is closed — no actionable downstream staleness.
    expect(dimmed.focusBadges.map((b) => b.kind)).not.toContain('DOWNSTREAM_STALE');

    const hidden = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: descendants,
      resolve: withArchivedChild,
      terminalVisibility: 'hide',
    })!;
    expect(hidden.children.map((g) => g.artifactType)).toEqual(['PREDICTION_SCENARIO']);
    expect(hidden.hiddenTerminalCount).toBe(1);
  });

  it('NEGATIVE CONTROL — with no terminal relatives, hide mode changes nothing', () => {
    const descendants = [edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO')];
    const hidden = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: descendants,
      resolve,
      terminalVisibility: 'hide',
    })!;
    expect(hidden.hiddenTerminalCount).toBe(0);
    expect(hidden.children.map((g) => g.count)).toEqual([1]);
    expect(hidden.parents.flatMap((g) => g.entries).every((e) => e.isDimmed === false)).toBe(true);
  });
});

// ===========================================================================
// AP-11 — a cycle in the DATA is an anomaly to REPORT, not to swallow.
//
// The DB trigger `finance_lineage_prevent_cycle` and the rank rule in
// lineageService are the enforcement; these tests are about what the navigator
// does when it is nevertheless handed a loop (a hand-assembled edge set, a
// restored dump, a regression in the trigger). It used to end the walk in
// total silence.
// ===========================================================================

describe('AP-11 lineageNavigatorContract — cycle anomalies', () => {
  /**
   * val1 -> bm4 closes the loop bm4 -> sc2 -> val1. The row is nonsense by the
   * rank rule (that is the point: only corrupt data can look like this), so it
   * is spelled out explicitly rather than produced by any legal path.
   */
  const BACK_EDGE = edge(
    'val1',
    'VALUATION_CASE',
    'bm4',
    'BASELINE_MODEL',
    'STATEMENT_TO_MODEL',
    '2026-08-02T00:00:00.000Z'
  );
  const CYCLIC_ANCESTORS: LineageEdgeRow[] = [
    edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
    edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
    BACK_EDGE,
  ];

  it('POSITIVE CONTROL — buildLineageTrail terminates AND reports the loop', () => {
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: CYCLIC_ANCESTORS,
      resolve,
    });
    // Still terminates (it always did) ...
    expect(trail.totalNodeCount).toBeGreaterThan(0);
    // ... but no longer silently: the anomaly is in the result, next to
    // unresolvedVersionIds, for a caller to log or badge.
    expect(trail.cycleVersionIds).toContain('val1');
    // No node is rendered twice despite the loop.
    const ids = trail.items
      .filter((i): i is LineageTrailNode => i.kind === 'node')
      .map((n) => n.metadata.versionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('POSITIVE CONTROL — computeDepths and the Related panel report it too', () => {
    const down = computeDepths({
      edges: CYCLIC_ANCESTORS,
      rootVersionId: 'bm4',
      direction: 'downstream',
      organizationId: ORG,
    });
    expect(down.cycleVersionIds).toContain('bm4');
    expect(down.depths.has('bm4')).toBe(false); // the root is still stripped

    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: [],
      descendantEdges: CYCLIC_ANCESTORS,
      resolve,
    })!;
    expect(panel.cycleVersionIds).toContain('bm4');
  });

  it('NEGATIVE CONTROL — a DAG DIAMOND is not a cycle', () => {
    // sp3 feeds both an2 and bm4, and an2 also feeds bm4: bm4 is reached twice.
    // "Already visited" would call this a cycle; the on-stack test does not.
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve,
    });
    expect(trail.cycleVersionIds).toEqual([]);
    expect(trail.hasAlternatePaths).toBe(true); // the diamond IS there, just legal

    const diamondDown = computeDepths({
      edges: [
        edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
        edge('bm4', 'BASELINE_MODEL', 'val1', 'VALUATION_CASE', 'MODEL_TO_VALUATION'),
        edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
      ],
      rootVersionId: 'bm4',
      direction: 'downstream',
      organizationId: ORG,
    });
    expect(diamondDown.cycleVersionIds).toEqual([]);
    expect(diamondDown.depths.get('val1')).toBe(1);
  });

  it('NEGATIVE CONTROL — a self-referencing FOREIGN edge is dropped, not reported as our cycle', () => {
    // Tenant guard runs first: a loop that is not ours is not our anomaly.
    const trail = buildLineageTrail({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: [
        ...ANCESTOR_EDGES,
        { ...BACK_EDGE, id: 'foreign-back-edge', organization_id: 'org-intruder' },
      ],
      resolve,
    });
    expect(trail.cycleVersionIds).toEqual([]);
    expect(trail.tenant.foreignEdgeIds).toEqual(['foreign-back-edge']);
  });
});

// ===========================================================================
// AP-11 — ancestors/descendants symmetry.
// ===========================================================================

describe('AP-11 lineageNavigatorContract — indirect ancestors', () => {
  it('POSITIVE CONTROL — the upstream routes the trail did not take are in the panel', () => {
    // val1's trail is sc2 -> bm4 -> an2 -> sp3 (one primary parent per node);
    // sp3 -> bm4 is a second route upstream that the trail cannot show.
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.parents.map((g) => [g.artifactType, g.count])).toEqual([['PREDICTION_SCENARIO', 1]]);
    const indirect = panel.indirectAncestors.flatMap((g) => g.entries);
    expect(indirect.map((e) => e.metadata.versionId).sort()).toEqual(['an2', 'bm4', 'sp3']);
    // Depths are real BFS distances, not a flat "2".
    expect(indirect.find((e) => e.metadata.versionId === 'bm4')!.depth).toBe(2);
    expect(indirect.find((e) => e.metadata.versionId === 'an2')!.depth).toBe(3);
    expect(indirect.find((e) => e.metadata.versionId === 'sp3')!.depth).toBe(3);
    // Grouped in stage order, exactly like every other group in the panel.
    expect(panel.indirectAncestors.map((g) => g.artifactType)).toEqual([
      'STATEMENT_PACK',
      'HISTORICAL_ANALYSIS',
      'BASELINE_MODEL',
    ]);
  });

  it('never lists a DIRECT parent again as an indirect ancestor', () => {
    // sp3 is both a direct parent of bm4 and an indirect one (via an2).
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.parents.flatMap((g) => g.entries).map((e) => e.metadata.versionId).sort()).toEqual([
      'an2',
      'sp3',
    ]);
    expect(panel.indirectAncestors).toEqual([]);
  });

  it('NEGATIVE CONTROL — a node with only a direct parent has no indirect ancestors', () => {
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'an2',
      ancestorEdges: [edge('sp3', 'STATEMENT_PACK', 'an2', 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS')],
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.parents.map((g) => g.artifactType)).toEqual(['STATEMENT_PACK']);
    expect(panel.indirectAncestors).toEqual([]);
  });

  it('applies the terminal filter to indirect ancestors like every other group', () => {
    const panel = buildRelatedPanel({
      organizationId: ORG,
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: [],
      resolve: (id) => (id === 'sp3' ? { ...NODES.sp3, status: 'ARCHIVED' } : NODES[id]),
      terminalVisibility: 'hide',
    })!;
    expect(panel.indirectAncestors.flatMap((g) => g.entries).map((e) => e.metadata.versionId).sort()).toEqual(
      ['an2', 'bm4']
    );
    expect(panel.hiddenTerminalCount).toBe(1);
  });
});

// ===========================================================================
// AP-11 — the Related drawer and coming BACK from a lineage jump.
// ===========================================================================

function workspaceStateFixture(overrides: Partial<FinanceWorkspaceState> = {}): FinanceWorkspaceState {
  const base = createEmptyWorkspaceState({
    organizationId: ORG,
    userId: 'user-1',
    artifactRef: artifactRef({ artifactType: 'BASELINE_MODEL', artifactId: 'bm', businessVersionId: 'bm4' }),
    sourceWorkingRevisionId: 'wr-1',
    now: () => '2026-08-10T10:00:00.000Z',
  });
  return { ...base, ...overrides };
}

/** A workspace the user has actually worked in: filtered, scrolled, with a row selected. */
function workedInState(): FinanceWorkspaceState {
  return workspaceStateFixture({
    selection: {
      activeCell: { rowKey: 'revenue', columnKey: 'FY2025' } as never,
      ranges: [],
    },
    filters: { raw: { onlyExceptions: true, segment: 'EMEA' } },
    scroll: { scrollTop: 1200, scrollLeft: 0, firstVisibleRowKey: 'revenue' },
    unsavedOperationStack: [],
  });
}

describe('AP-11 lineageNavigatorContract — Related drawer', () => {
  it('opens with a focus, a section and everything a close has to settle', () => {
    const restorePoint = captureWorkspaceRestorePoint(workedInState(), { viewId: 'pnl' });
    const closed = createRelatedDrawerState();
    expect(closed.open).toBe(false);
    expect(closed.focusVersionId).toBeNull();

    const open = openRelatedDrawer({
      focusVersionId: 'bm4',
      restorePoint,
      returnFocusControlId: 'finance.baseline.related',
      section: 'children',
    });
    expect(open.open).toBe(true);
    expect(open.focusVersionId).toBe('bm4');
    expect(open.activeSection).toBe('children');

    const { state, restore, returnFocusControlId } = closeRelatedDrawer(open);
    expect(state).toEqual(createRelatedDrawerState()); // no leftover focus/section
    expect(restore).toBe(restorePoint);
    // a11y: focus goes back to the control that opened the drawer, not to <body>.
    expect(returnFocusControlId).toBe('finance.baseline.related');
    expect(LINEAGE_RELATED_DRAWER.restoresDomFocus).toBe(true);
    expect(LINEAGE_RELATED_DRAWER.modality).toBe('non-modal');
    // The shortcut the AP-10 adapters may adopt; deliberately not wired here.
    expect(LINEAGE_RELATED_DRAWER.keyboardCommandId).toBe('finance.related');
  });
});

describe('AP-11 lineageNavigatorContract — restore point', () => {
  it('POSITIVE CONTROL — filters, scroll and selection survive a round trip', () => {
    const before = workedInState();
    const restorePoint = captureWorkspaceRestorePoint(before, { viewId: 'pnl' });
    // The user comes back to a freshly loaded (empty) workspace for the same artifact.
    const reloaded = workspaceStateFixture();
    expect(reloaded.filters.raw).toEqual({});
    const result = applyWorkspaceRestorePoint(reloaded, restorePoint);
    expect(result.ok).toBe(true);
    const restored = (result as { ok: true; state: FinanceWorkspaceState }).state;
    expect(restored.filters.raw).toEqual({ onlyExceptions: true, segment: 'EMEA' });
    expect(restored.scroll.scrollTop).toBe(1200);
    expect(restored.scroll.firstVisibleRowKey).toBe('revenue');
    expect(restored.selection.activeCell).toEqual({ rowKey: 'revenue', columnKey: 'FY2025' });
  });

  it('never carries uncommitted edits into the snapshot', () => {
    // AP-04 owns unsavedOperationStack; a second copy inside a navigation entry
    // would be a diverging source of truth for pending work.
    const restorePoint = captureWorkspaceRestorePoint(workedInState());
    expect(Object.keys(restorePoint)).not.toContain('unsavedOperationStack');
    const live = workspaceStateFixture({ sourceWorkingRevisionId: 'wr-99' });
    const result = applyWorkspaceRestorePoint(live, restorePoint);
    expect((result as { ok: true; state: FinanceWorkspaceState }).state.sourceWorkingRevisionId).toBe('wr-99');
  });

  it('is decoupled from the live state — later edits do not mutate the snapshot', () => {
    const state = workedInState();
    const restorePoint = captureWorkspaceRestorePoint(state);
    state.filters.raw.segment = 'APAC';
    state.scroll.scrollTop = 5;
    expect(restorePoint.filters.raw.segment).toBe('EMEA');
    expect(restorePoint.scroll.scrollTop).toBe(1200);
  });

  it('POSITIVE CONTROL — refuses a snapshot from another artifact or another tenant', () => {
    const restorePoint = captureWorkspaceRestorePoint(workedInState());
    const otherArtifact = workspaceStateFixture({
      artifactRef: artifactRef({ artifactType: 'VALUATION_CASE', artifactId: 'val', businessVersionId: 'val1' }),
    });
    expect(applyWorkspaceRestorePoint(otherArtifact, restorePoint)).toMatchObject({
      ok: false,
      code: 'RESTORE_POINT_MISMATCH',
    });
    const otherOrg = workspaceStateFixture({ organizationId: OTHER_ORG });
    expect(applyWorkspaceRestorePoint(otherOrg, restorePoint)).toMatchObject({
      ok: false,
      code: 'RESTORE_POINT_FOREIGN_ORG',
    });
  });
});

describe('AP-11 lineageNavigatorContract — navigation stack', () => {
  const entryFor = (
    artifactId: string,
    businessVersionId: string,
    targetVersionId: string
  ): LineageNavigationEntry => ({
    restorePoint: captureWorkspaceRestorePoint(
      workspaceStateFixture({
        artifactRef: artifactRef({ artifactType: 'BASELINE_MODEL', artifactId, businessVersionId }),
      })
    ),
    via: 'related-panel',
    targetVersionId,
  });

  it('remembers the order of a multi-hop excursion', () => {
    let stack = createNavigationStack(ORG);
    stack = pushNavigation(stack, entryFor('bm', 'bm4', 'sc2'));
    stack = pushNavigation(stack, entryFor('sc', 'sc2', 'val1'));
    expect(stack.entries).toHaveLength(2);
    expect(peekNavigation(stack)?.targetVersionId).toBe('val1');
    const first = popNavigation(stack);
    expect(first.entry?.targetVersionId).toBe('val1');
    const second = popNavigation(first.stack);
    expect(second.entry?.targetVersionId).toBe('sc2');
    expect(popNavigation(second.stack).entry).toBeNull();
  });

  it('is bounded — the oldest hop is dropped, the newest is never refused', () => {
    let stack = createNavigationStack(ORG);
    for (let i = 0; i < LINEAGE_NAV_STACK_MAX_DEPTH + 3; i += 1) {
      stack = pushNavigation(stack, entryFor(`a${i}`, `v${i}`, `t${i}`));
    }
    expect(stack.entries).toHaveLength(LINEAGE_NAV_STACK_MAX_DEPTH);
    expect(peekNavigation(stack)?.targetVersionId).toBe(`t${LINEAGE_NAV_STACK_MAX_DEPTH + 2}`);
    expect(stack.entries[0].targetVersionId).toBe('t3');
  });

  it('refreshes in place instead of growing when the same workspace is re-entered', () => {
    let stack = createNavigationStack(ORG);
    stack = pushNavigation(stack, entryFor('bm', 'bm4', 'sc2'));
    stack = pushNavigation(stack, entryFor('bm', 'bm4', 'val1'));
    expect(stack.entries).toHaveLength(1);
    expect(peekNavigation(stack)?.targetVersionId).toBe('val1');
  });

  it('POSITIVE CONTROL — a stack refuses an entry from another tenant', () => {
    const foreignEntry: LineageNavigationEntry = {
      restorePoint: captureWorkspaceRestorePoint(workspaceStateFixture({ organizationId: OTHER_ORG })),
      via: 'trail',
      targetVersionId: 'bmX',
    };
    const stack = pushNavigation(createNavigationStack(ORG), foreignEntry);
    expect(stack.entries).toEqual([]);
  });
});
