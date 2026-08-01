/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KpiOkrView } from '../../../src/views/KpiOkrView';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
  useLocation: () => ({ search: '?tab=scorecards', hash: '#team' }),
}));

vi.mock('../../../src/routes/routeConfig', () => ({
  ROUTES: {
    RESULTS: '/results',
  },
}));

describe('KpiOkrView redirect shim', () => {
  it('redirects the legacy kpi-okr entry to the canonical results lane', () => {
    render(<KpiOkrView />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/results?tab=scorecards#team');
  });
});
