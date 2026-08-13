/**
 * @vitest-environment jsdom
 *
 * INDEPENDENT VERIFICATION (gate-e, FIX-C) — not written by the FIX-C author.
 *
 * Author's claim: `SourceStep.tsx` used to read ONLY `lineage.ancestors[0]`, even though
 * `getAncestors()` (server/src/services/finance/canonical/lineageService.ts) is a recursive CTE
 * that returns the FULL ancestor chain (Statement Pack -> Baseline -> Scenario, etc.) with no
 * LIMIT and no ORDER BY. This test proves — independently, against the CURRENT (fixed) component
 * — that a 3-edge lineage chain renders all 3 edges, not just the first one.
 *
 * This is a regression guard: if a future change reintroduces `ancestors[0]`, this test must fail.
 */
import { render, screen } from '@testing-library/react';

import { SourceStep } from '@/components/Finance/Valuation/steps/SourceStep';
import type { ValuationLineageDto } from '@/services/api/financeV2.types';

function makeLineage(): ValuationLineageDto {
  return {
    businessVersionId: 'bv-valuation-1',
    ancestors: [
      {
        edgeId: 'edge-1-pack-to-baseline',
        sourceVersionId: 'bv-statement-pack-1',
        sourceArtifactType: 'statement_pack',
        targetVersionId: 'bv-baseline-1',
        targetArtifactType: 'baseline',
        edgeType: 'derived_from',
        transformationKind: 'BASELINE_FROM_PACK',
        assumptionSnapshotHash: null,
        computeRunId: null,
        authorId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        edgeId: 'edge-2-baseline-to-scenario',
        sourceVersionId: 'bv-baseline-1',
        sourceArtifactType: 'baseline',
        targetVersionId: 'bv-scenario-1',
        targetArtifactType: 'scenario',
        edgeType: 'derived_from',
        transformationKind: 'SCENARIO_FROM_BASELINE',
        assumptionSnapshotHash: 'hash-abc',
        computeRunId: 'run-1',
        authorId: 'user-1',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        edgeId: 'edge-3-scenario-to-valuation',
        sourceVersionId: 'bv-scenario-1',
        sourceArtifactType: 'scenario',
        targetVersionId: 'bv-valuation-1',
        targetArtifactType: 'valuation',
        edgeType: 'VALUATION_SOURCE',
        transformationKind: 'VALUATION_FROM_SCENARIO',
        assumptionSnapshotHash: 'hash-def',
        computeRunId: 'run-2',
        authorId: 'user-2',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ] as any,
    descendants: [],
  };
}

describe('SourceStep — FIXC lineage chain regression (independent verification)', () => {
  it('renders ALL ancestor edges, not just ancestors[0]', () => {
    const lineage = makeLineage();
    render(<SourceStep businessVersionId="bv-valuation-1" variant={null} lineage={lineage} />);

    // All three source version ids must be present in the DOM somewhere — proof the component
    // is not silently dropping edges past the first. (`bv-baseline-1` and `bv-scenario-1` each
    // appear twice — once as a target, once as a source of the next edge — hence getAllByText.)
    expect(screen.getAllByText('bv-statement-pack-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bv-baseline-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bv-scenario-1').length).toBeGreaterThan(0);

    // One rendered "edge card" per ancestor edge (data-testid="source-edge-<edgeId>").
    expect(screen.getByTestId('source-edge-edge-1-pack-to-baseline')).toBeTruthy();
    expect(screen.getByTestId('source-edge-edge-2-baseline-to-scenario')).toBeTruthy();
    expect(screen.getByTestId('source-edge-edge-3-scenario-to-valuation')).toBeTruthy();

    // Regression guard: a naive re-introduction of `ancestors[0]` would render exactly ONE card.
    const cards = screen.getAllByText(/Krok \d\/3/);
    expect(cards.length).toBe(3);
  });

  it('still handles the single-edge and zero-edge cases (no regression for the simple paths)', () => {
    const single: ValuationLineageDto = {
      businessVersionId: 'bv-2',
      ancestors: [
        {
          edgeId: 'only-edge',
          sourceVersionId: 'bv-source-only',
          sourceArtifactType: 'baseline',
          targetVersionId: 'bv-2',
          targetArtifactType: 'valuation',
          edgeType: 'VALUATION_SOURCE',
          transformationKind: null,
          assumptionSnapshotHash: null,
          computeRunId: null,
          authorId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
      ],
      descendants: [],
    };
    const { unmount } = render(<SourceStep businessVersionId="bv-2" variant={null} lineage={single} />);
    expect(screen.getByTestId('source-edge-only-edge')).toBeTruthy();
    unmount();

    const empty: ValuationLineageDto = { businessVersionId: 'bv-3', ancestors: [], descendants: [] };
    render(<SourceStep businessVersionId="bv-3" variant={null} lineage={empty} />);
    expect(screen.getByTestId('source-edge-missing')).toBeTruthy();
  });
});
