/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() =>
  vi.fn(({ initialTab, createNonce, canonicalCutoverMount }) => (
    <div data-testid="canonical-scorecards">
      {initialTab}:{createNonce}:{String(canonicalCutoverMount)}
    </div>
  ))
);

vi.mock('@/components/ResultsVNext/ResultsKpiRegistryPage', () => ({
  ResultsKpiRegistryPage: registry,
}));

import { ResultsKpiScorecardsView } from '../ResultsKpiScorecardsView';

describe('ResultsKpiScorecardsView canonical cutover mount', () => {
  it('mounts the full canonical scorecards registry and forwards the hub create trigger', () => {
    render(
      <ResultsKpiScorecardsView
        activeFilters={[]}
        onFilterChange={() => {}}
        initiatives={[]}
        createNonce={7}
      />
    );

    expect(screen.getByTestId('canonical-scorecards')).toHaveTextContent('scorecards:7:true');
    expect(registry).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTab: 'scorecards',
        createNonce: 7,
        canonicalCutoverMount: true,
      }),
      undefined
    );
  });
});
