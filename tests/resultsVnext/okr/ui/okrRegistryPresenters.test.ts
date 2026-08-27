import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildOkrSetColumns,
  buildOkrSetRowMenu,
} from '../../../../src/components/ResultsVNext/okr/okrRegistryPresenters';
import type { OkrSetDto } from '../../../../src/components/ResultsVNext/okr/okrApi';

describe('OKR registry — concise owner-approved row menu', () => {
  it('shows executable navigation and preview without fake disabled Edit or Archive actions', () => {
    const row = { setId: 'set-1', status: 'submitted' } as OkrSetDto;
    const menu = buildOkrSetRowMenu(row, true, {
      onPreview: vi.fn(),
      onOpenWorkspace: vi.fn(),
      onOpenObjectives: vi.fn(),
    });

    expect(menu.primary?.map((action) => action.label)).toEqual(['Otwórz', 'Cele (Objectives)']);
    expect(menu.statusTransitions).toEqual([]);
    expect(menu.universalHandlers).toEqual({ preview: expect.any(Function) });
  });
});

describe('OKR registry — owner and check-in presentation', () => {
  const row = {
    setId: 'set-1',
    ownerUserId: 'user-anna-kowalska',
    lastCheckinAt: '2026-08-01T00:00:00.000Z',
    nextCheckinDueAt: '2026-08-15T00:00:00.000Z',
  } as OkrSetDto;

  it('renders the organization member name instead of a technical owner id', () => {
    const columns = buildOkrSetColumns(true, () => 'Anna Kowalska');
    render(
      React.createElement(
        React.Fragment,
        null,
        columns.find((column) => column.id === 'owner')?.render?.(row)
      )
    );
    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    expect(screen.queryByText('user-anna-kowalska')).not.toBeInTheDocument();
  });

  it('keeps last and next check-in as separate values in the registry', () => {
    const columns = buildOkrSetColumns(false);
    const checkins = columns.find((column) => column.id === 'checkins');
    expect(checkins?.label).toBe('Last / next check-in');
    render(React.createElement(React.Fragment, null, checkins?.render?.(row)));
    expect(screen.getAllByText(/Aug/)).toHaveLength(2);
  });
});
