/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() =>
  vi.fn(({ initialTab, createNonce }) => (
    <div data-testid="canonical-scorecards">
      {initialTab}:{createNonce}
    </div>
  ))
);

vi.mock('@/components/ResultsVNext/ResultsKpiRegistryPage', () => ({
  ResultsKpiRegistryPage: registry,
}));

import { ResultsKpiScorecardsView } from '../ResultsKpiScorecardsView';

// FIX-6 (2026-08-25 odbiór dnia 4, nadzorca wariant a): the dedicated
// `canonicalCutoverMount` bypass prop was removed from both
// `ResultsKpiScorecardsView` and `ResultsKpiRegistryPage`. The new mechanic
// is `initialTab === 'scorecards'` itself acting as the enablement signal
// inside `ResultsKpiRegistryPage`'s `enabled` computation (see that file) —
// this adapter's only job now is to forward `initialTab="scorecards"` and
// `createNonce`, nothing else. Same edge case coverage as before: this test
// still pins that the historical hub's scorecards mount is NEVER gated
// behind the `kpiRegistry` rollout flag, just via a smaller prop surface.
describe('ResultsKpiScorecardsView canonical mount', () => {
  it('mounts the canonical scorecards registry and forwards the hub create trigger, with no bypass prop', () => {
    render(
      <ResultsKpiScorecardsView
        activeFilters={[]}
        onFilterChange={() => {}}
        initiatives={[]}
        createNonce={7}
      />
    );

    expect(screen.getByTestId('canonical-scorecards')).toHaveTextContent('scorecards:7');
    expect(registry).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTab: 'scorecards',
        createNonce: 7,
      }),
      undefined
    );
    // No `canonicalCutoverMount` (or any other) extra prop is forwarded —
    // `initialTab`/`createNonce` are the complete, intentional prop surface.
    expect(registry.mock.calls[0][0]).not.toHaveProperty('canonicalCutoverMount');
    expect(Object.keys(registry.mock.calls[0][0]).sort()).toEqual(['createNonce', 'initialTab']);
  });
});
