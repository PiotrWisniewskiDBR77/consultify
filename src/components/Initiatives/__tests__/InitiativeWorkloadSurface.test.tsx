import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  readInitiativeWorkload: vi.fn(),
  updateInitiativeWorkloadAvailability: vi.fn(),
  proposeInitiativeWorkloadMoves: vi.fn(),
  listReportDefinitions: vi.fn(),
  getReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  transitionReportRun: vi.fn(),
}));

vi.mock('@/services/initiatives/initiativeWorkloadApi', () => ({
  readInitiativeWorkload: mocks.readInitiativeWorkload,
  updateInitiativeWorkloadAvailability: mocks.updateInitiativeWorkloadAvailability,
  proposeInitiativeWorkloadMoves: mocks.proposeInitiativeWorkloadMoves,
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportDefinitions: mocks.listReportDefinitions,
  getReportDefinition: mocks.getReportDefinition,
  createReportRun: mocks.createReportRun,
  transitionReportRun: mocks.transitionReportRun,
}));

import { InitiativeWorkloadSurface } from '../InitiativeWorkloadSurface';

const renderSurface = (proposalRequestId = 0) =>
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
        currentUserId="anna"
        proposalRequestId={proposalRequestId}
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
    vi.unstubAllEnvs();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.readInitiativeWorkload.mockResolvedValue(response);
    mocks.updateInitiativeWorkloadAvailability.mockResolvedValue({
      userId: 'anna',
      weeklyCapacityHours: 32,
      availabilityPercent: 80,
    });
    mocks.proposeInitiativeWorkloadMoves.mockResolvedValue({
      proposals: [],
      applied: false,
      planningOnly: true,
    });
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

  it('renders positive demand with zero capacity as a critical state', async () => {
    mocks.readInitiativeWorkload.mockResolvedValueOnce({
      ...response,
      rows: [
        ...response.rows,
        {
          userId: 'zero-capacity',
          name: 'Zero Capacity',
          role: 'Analyst',
          weekStart: '2026-09-14',
          demandHours: 8,
          supplyHours: 0,
          utilizationPercent: 0,
          capacityExceeded: true,
          gapHours: -8,
          backlogHours: 0,
          taskCount: 1,
          supplySource: 'PROFIL',
        },
      ],
      people: [
        ...response.people,
        {
          userId: 'zero-capacity',
          name: 'Zero Capacity',
          role: 'Analyst',
          weeklyCapacityHours: 0,
          availabilityPercent: 100,
          supplySource: 'PROFIL',
          backlogHours: 0,
          unscheduledHours: 0,
        },
      ],
    });
    renderSurface();

    const cell = await screen.findByTestId('workload-zero-capacity-2026-09-14');
    expect(cell).toHaveAttribute('data-workload-band', 'red');
    expect(cell).toHaveTextContent('None');
    expect(cell).toHaveAttribute('title', expect.stringContaining('No capacity'));
    expect(cell).toHaveAttribute('aria-label', expect.stringContaining('No capacity'));
  });

  it('passes project and initiative status filters to the governed server read', async () => {
    renderSurface();
    await screen.findByText('Anna Adams');

    fireEvent.click(within(screen.getByTestId('workload-project-filter')).getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Apollo' }));
    fireEvent.click(within(screen.getByTestId('workload-status-filter')).getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: /pending/i }));

    await waitFor(() =>
      expect(mocks.readInitiativeWorkload).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectId: 'p1', initiativeStatuses: ['PENDING_APPROVAL'] }),
        expect.any(AbortSignal)
      )
    );
  });

  it('persists a selected person weekly availability through the profile writer', async () => {
    renderSurface();
    fireEvent.click(await screen.findByText('Anna Adams'));
    fireEvent.change(screen.getByLabelText('Hours per week'), { target: { value: '32' } });
    fireEvent.change(screen.getByLabelText('Availability percent'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    await waitFor(() =>
      expect(mocks.updateInitiativeWorkloadAvailability).toHaveBeenCalledWith('anna', {
        weeklyCapacityHours: 32,
        availabilityPercent: 80,
      })
    );
  });

  it('shows planning-only AI proposals without applying a task mutation', async () => {
    mocks.proposeInitiativeWorkloadMoves.mockResolvedValueOnce({
      applied: false,
      planningOnly: true,
      proposals: [
        {
          proposalId: 'task-1:anna:2026-09-14',
          taskId: 'task-1',
          taskTitle: 'Prepare rollout',
          initiativeId: 'i1',
          initiativeStatus: 'APPROVED',
          weekStart: '2026-09-14',
          fromUserId: 'ben',
          fromUserName: 'Ben Brown',
          toUserId: 'anna',
          toUserName: 'Anna Adams',
          proposedHours: 8,
          rationale: 'Rule',
          requiresHumanApproval: true,
          applied: false,
        },
      ],
    });
    renderSurface(1);

    expect(await screen.findByText('Prepare rollout')).toBeInTheDocument();
    expect(screen.getByText('Ben Brown → Anna Adams')).toBeInTheDocument();
    expect(screen.getByText(/do not change running assignments/i)).toBeInTheDocument();
  });
});
