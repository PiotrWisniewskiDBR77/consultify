import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { FinanceValuePanelsSurface } from '../FinanceValuePanelsSurface';

describe('FinanceValuePanelsSurface', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('leaves the Finance surface unchanged when the flag is OFF', () => {
    const { container } = render(<FinanceValuePanelsSurface />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders real valuation panels when explicitly enabled', async () => {
    window.localStorage.setItem('ff.finance_value_panels', '1');
    render(<FinanceValuePanelsSurface />);

    expect(screen.getByTestId('finance-value-panels-surface')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Monte Carlo NPV' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Scenario compute' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Scenario compute' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
  });
});
