/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InitiativeStatus } from '@/types';

import { ExecutionWorkloadView } from '../ExecutionWorkloadView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : _key),
  }),
}));

describe('ExecutionWorkloadView status badge', () => {
  it('renders an APPROVED allocation in the detail modal without the retired duplicate IN_EXECUTION branch', async () => {
    const startDate = new Date('2026-09-07T00:00:00.000Z');
    render(
      <ExecutionWorkloadView
        initiatives={[
          {
            id: 'initiative-1',
            name: 'Approved initiative',
            status: InitiativeStatus.APPROVED,
            startDate: '2026-09-07T00:00:00.000Z',
            plannedEndDate: '2026-09-20T00:00:00.000Z',
            ownerBusiness: { id: 'user-1', firstName: 'Anna', lastName: 'Kowalska' },
            ownerExecution: null,
          } as any,
        ]}
        onInitiativeClick={vi.fn()}
        showControls={false}
        controls={{
          viewMode: 'weekly',
          setViewMode: vi.fn(),
          weekCount: 1,
          setWeekCount: vi.fn(),
          monthCount: 1,
          setMonthCount: vi.fn(),
          startDate,
          setStartDate: vi.fn(),
        }}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /80%/ }));

    expect(await screen.findByText('Approved initiative')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });
});
