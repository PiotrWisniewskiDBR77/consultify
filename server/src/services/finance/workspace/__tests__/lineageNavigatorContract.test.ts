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
  allowedDownstreamCreations,
  buildLineageTrail,
  buildRelatedPanel,
  computeDepths,
  isOrphaned,
  lineageStageRank,
  loadLineageNavigator,
  type LineageMetadataResolver,
  type LineageNodeMetadata,
  type LineageServicePort,
  type LineageTrailNode,
} from '../lineageNavigatorContract.js';
import { ORG } from './workspaceTestFixtures.js';

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

const NODES: Record<string, LineageNodeMetadata> = {
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
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
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
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    expect(nodes[0].staleBadge).toBeNull(); // Statement pack is CURRENT
    expect(nodes[3].staleBadge?.kind).toBe('SOURCE_CHANGED'); // Scenario is STALE_SOURCE
    expect(nodes[4].staleBadge?.kind).toBe('NEVER_COMPUTED'); // Valuation was never computed
  });

  it('picks a deterministic primary parent when a node has two (and flags the alternate)', () => {
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    expect(trail.hasAlternatePaths).toBe(true); // bm4 has both sp3 and an2 as parents
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    // Nearest upstream stage wins: HISTORICAL_ANALYSIS (rank 1) over STATEMENT_PACK (rank 0).
    expect(nodes[1].metadata.versionId).toBe('an2');
    // Same input in a different order must give the same trail.
    const shuffled = buildLineageTrail({
      focusVersionId: 'val1',
      ancestorEdges: [...ANCESTOR_EDGES].reverse(),
      resolve,
    });
    expect(shuffled.items.filter((i) => i.kind === 'node').map((i) => (i as LineageTrailNode).displayName)).toEqual(
      nodes.map((n) => n.displayName)
    );
  });

  it('collapses the middle when the chain exceeds the compact budget', () => {
    const trail = buildLineageTrail({
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
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve: partial });
    expect(trail.unresolvedVersionIds).toEqual(['bm4']);
  });

  it('terminates on a root with no ancestor edges at all', () => {
    const trail = buildLineageTrail({ focusVersionId: 'sp3', ancestorEdges: [], resolve });
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
    const panel = buildRelatedPanel({
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
    const panel = buildRelatedPanel({
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
    const panel = buildRelatedPanel({
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
    const panel = buildRelatedPanel({
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
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: withVariant, resolve });
    expect(trail.items.filter((i) => i.kind === 'node')).toHaveLength(5); // unchanged chain
    const panel = buildRelatedPanel({
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
      buildRelatedPanel({ focusVersionId: 'ghost', ancestorEdges: [], descendantEdges: [], resolve })
    ).toBeNull();
  });

  it('computes BFS depths in both directions', () => {
    const down = computeDepths(DESCENDANT_EDGES, 'bm4', 'downstream');
    expect(down.get('sc2')).toBe(1);
    expect(down.get('val1')).toBe(1);
    expect(down.get('rep1')).toBe(2);
    expect(down.has('bm4')).toBe(false);
    const up = computeDepths(ANCESTOR_EDGES, 'val1', 'upstream');
    expect(up.get('sc2')).toBe(1);
    expect(up.get('bm4')).toBe(2);
    expect(up.get('sp3')).toBe(3);
  });
});

describe('AP-11 lineageNavigatorContract — downstream topology and the auxiliary graph', () => {
  it('derives the permitted "+ New" targets from the DAG rules', () => {
    expect(allowedDownstreamCreations('STATEMENT_PACK')).toEqual([
      'HISTORICAL_ANALYSIS',
      'BASELINE_MODEL',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('HISTORICAL_ANALYSIS')).toEqual(['BASELINE_MODEL', 'REPORT_EXPORT']);
    // Addendum section 6.1: Scenario is OPTIONAL — a Model may go straight to Valuation.
    expect(allowedDownstreamCreations('BASELINE_MODEL')).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('VALUATION_CASE')).toEqual(['REPORT_EXPORT']);
    expect(allowedDownstreamCreations('REPORT_EXPORT')).toEqual([]);
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