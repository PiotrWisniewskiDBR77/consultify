import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { readInitiativeWorkload } = vi.hoisted(() => ({ readInitiativeWorkload: vi.fn() }));

vi.mock('@/services/initiatives/initiativeWorkloadApi', () => ({
  readInitiativeWorkload,
}));

import { InitiativeWorkloadSurface } from '../InitiativeWorkloadSurface';

const renderSurface = () =>
  render(
    <MemoryRouter initialEntries={['/initiatives?tab=capacity']}>
      <InitiativeWorkloadSurface
        initiatives={[
          {
            id: 'i1',
            name: 'A',
            projectId: 'p1',
            projectName: 'Apollo',
            status: 'PENDING_APPROVAL',
          },
        ]}
      />
    </MemoryRouter>
  );

const response = {
  asOf: '2026-09-14T09:00:00.000Z',
  weeks: ['2026-09-14', '2026-09-21'],
  rows: [
    {
      userId: 'anna',
      name: 'Anna Adams',
      role: 'Consultant',
      weekStart: '2026-09-14',
      demandHours: 32,
      supplyHours: 40,
      utilizationPercent: 80,
      gapHours: 8,
      backlogHours: 0,
      taskCount: 2,
      supplySource: 'PROFIL',
    },
    {
      userId: 'anna',
      name: 'Anna Adams',
      role: 'Consultant',
      weekStart: '2026-09-21',
      demandHours: 38,
      supplyHours: 40,
      utilizationPercent: 95,
      gapHours: 2,
      backlogHours: 0,
      taskCount: 2,
      supplySource: 'PROFIL',
    },
    {
      userId: 'ben',
      name: 'Ben Brown',
      role: 'Engineer',
      weekStart: '2026-09-14',
      demandHours: 48,
      supplyHours: 40,
      utilizationPercent: 120,
      gapHours: -8,
      backlogHours: 0,
      taskCount: 3,
      supplySource: 'PROFIL',
    },
  ],
  people: [
    {
      userId: 'anna',
      name: 'Anna Adams',
      role: 'Consultant',
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
      supplySource: 'PROFIL',
      backlogHours: 0,
      unscheduledHours: 0,
    },
    {
      userId: 'ben',
      name: 'Ben Brown',
      role: 'Engineer',
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
      supplySource: 'PROFIL',
      backlogHours: 0,
      unscheduledHours: 0,
    },
  ],
  summary: {
    peopleCount: 2,
    demandHours: 118,
    supplyHours: 120,
    gapHours: 2,
    utilizationPercent: 98,
    overloadedCount: 1,
    peopleWithoutProfileSupply: 0,
    backlogHoursTotal: 0,
    backlogPeople: 0,
  },
};

describe('InitiativeWorkloadSurface E1', () => {
  beforeEach(() => {
    readInitiativeWorkload.mockReset();
    readInitiativeWorkload.mockResolvedValue(response);
  });

  it('renders the exact green/amber/red workload bands per person and week', async () => {
    renderSurface();

    expect(await screen.findByText('Anna Adams')).toBeInTheDocument();
    expect(screen.getByTestId('workload-anna-2026-09-14')).toHaveAttribute(
      'data-workload-band',
      'green'
    );
    expect(screen.getByTestId('workload-anna-2026-09-21')).toHaveAttribute(
      'data-workload-band',
      'amber'
    );
    expect(screen.getByTestId('workload-ben-2026-09-14')).toHaveAttribute(
      'data-workload-band',
      'red'
    );
  });

  it('passes project and initiative status filters to the governed server read', async () => {
    renderSurface();
    await screen.findByText('Anna Adams');

    fireEvent.change(screen.getByLabelText('Project scope'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('Initiative status'), {
      target: { value: 'PENDING_APPROVAL' },
    });

    await waitFor(() =>
      expect(readInitiativeWorkload).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectId: 'p1', initiativeStatuses: ['PENDING_APPROVAL'] }),
        expect.any(AbortSignal)
      )
    );
  });
});
