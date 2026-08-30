import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import FinanceValuePanelsScreen from '../../../../dev-render/screens/finance-value-panels';

describe('finance value panels screenshot harness', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it.each([
    ['monte-carlo', 'mc-histogram'],
    ['real-options', 'ro-defer-result'],
    ['frontier', 'frontier-chart'],
    ['sensitivity', 'sens-heatmap-chart'],
    ['scenarios', 'scenario-fan-chart'],
  ])('renders a computed result for %s', async (panel, resultTestId) => {
    render(<FinanceValuePanelsScreen panelOverride={panel} stateOverride="populated" />);

    await waitFor(() => expect(screen.getByTestId(resultTestId)).toBeInTheDocument());
  });
});
