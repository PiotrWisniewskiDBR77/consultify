import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { FinanceValuePanelsSurface } from '../FinanceValuePanelsSurface';

describe('day200 Finance value panels registry', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps all 21 panels unreachable while the existing front flag is OFF', () => {
    const { container } = render(<FinanceValuePanelsSurface />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes exactly 21 panel tabs behind the explicit flag and preserves Monte Carlo as active', () => {
    window.localStorage.setItem('ff.finance_value_panels', '1');
    render(<FinanceValuePanelsSurface />);

    expect(screen.getAllByRole('tab')).toHaveLength(21);
    expect(screen.getByRole('tab', { name: 'Monte Carlo NPV' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
