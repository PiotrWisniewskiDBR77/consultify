import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeApiError } from '@/services/initiatives-execution/runtimeApi';

import type { InitiativeContextValue } from '../InitiativeContext';
import { InitiativeContext } from '../InitiativeContext';
import { TimelineSection } from '../TimelineSection';

const runtimeApi = vi.hoisted(() => ({
  readInitiativeCapabilities: vi.fn(),
  readRegisteredInitiative: vi.fn(),
  updateInitiativeForecast: vi.fn(),
}));

const refreshStore = vi.hoisted(() => ({
  bumpInitiativeRefresh: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentOrganization: { id: 'org-1' },
      currentUser: { id: 'owner-1', role: 'OWNER' },
    }),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>();
  return { ...original, ...runtimeApi };
});

vi.mock('@/store/useInitiativeRefreshStore', () => refreshStore);

vi.mock('react-i18next', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-i18next')>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string; [key: string]: unknown }) =>
        options?.defaultValue || key,
    }),
  };
});

vi.mock('../TimelinePlanner', () => ({
  TimelinePlanner: () => null,
}));

vi.mock('../../calendar', () => ({ InitiativeCalendar: () => null }));
vi.mock('../../gantt', () => ({ InitiativeGantt: () => null }));

function makeContext(overrides: Partial<InitiativeContextValue> = {}): InitiativeContextValue {
  return {
    initiative: {
      id: 'initiative-forecast-1',
      name: 'Operational Initiative',
      forecastStartDate: '2026-10-10',
      forecastEndDate: '2026-12-20',
    },
    initiativeId: 'initiative-forecast-1',
    isPolish: false,
    status: 'SCHEDULED',
    startDate: '2026-10-01',
    setStartDate: vi.fn(),
    endDate: '2026-12-01',
    setEndDate: vi.fn(),
    targetDate: '2026-12-01',
    decisions: [],
    tasks: [],
    setTasks: vi.fn(),
    users: [],
    timelineMilestones: [],
    setTimelineMilestones: vi.fn(),
    timelinePhases: [],
    setTimelinePhases: vi.fn(),
    timelineLocked: true,
    baselineVersion: 3,
    estimatedDurationMonths: 2,
    raidItems: [],
    dependencies: [],
    timelineAiRequest: null,
    clearTimelineAiRequest: vi.fn(),
    fetchAll: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as InitiativeContextValue;
}

function renderTimeline(overrides: Partial<InitiativeContextValue> = {}) {
  const context = makeContext(overrides);
  render(
    <InitiativeContext.Provider value={context}>
      <TimelineSection sectionType={'timeline' as any} expanded onToggle={vi.fn()} />
    </InitiativeContext.Provider>
  );
  return context;
}

describe('operational forecast editor in the real Initiative Timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeApi.readRegisteredInitiative.mockResolvedValue({
      version: 7,
      updatedAt: '2026-09-13T12:00:00.000Z',
      initiative: {
        initiativeId: 'initiative-forecast-1',
        lifecycleState: 'SCHEDULED',
        title: 'Operational Initiative',
        projectId: 'project-1',
        readiness: 'NOT_EVALUATED',
      },
    });
    runtimeApi.readInitiativeCapabilities.mockResolvedValue({
      actorId: 'owner-1',
      canView: true,
      canUpdate: true,
      canReview: false,
      canSelfApprove: false,
      executionWrites: {
        forecast: {
          available: true,
          canonicalCommand: 'initiative.update_forecast',
          denialAt: null,
          denialCode: null,
          legacyDenialAt: 'BRAMKA_LEGACY',
          legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
        },
      },
    });
  });

  it('preserves the locked baseline while exposing the canonical operational correction', async () => {
    renderTimeline();

    expect(
      screen.getByText('initiatives.timelineSection.timelineLockedBaseline')
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Operational forecast' })
    ).toBeInTheDocument();
    expect(screen.getByText('10/10/2026')).toBeInTheDocument();
    expect(screen.getByText('20/12/2026')).toBeInTheDocument();
  });

  it('submits only selected fields, keeps baseline setters untouched, and refreshes the same Initiative', async () => {
    const result = {
      status: 'APPLIED',
      aggregateVersion: 8,
      response: {
        initiativeId: 'initiative-forecast-1',
        before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-12-20' },
        after: { forecastStartDate: '2026-10-10', forecastEndDate: '2027-01-15' },
        receiptId: 'receipt-1',
        observedAt: '2026-09-13T12:10:00.000Z',
      },
      correlationId: 'correlation-1',
      receiptId: 'receipt-1',
      readBackState: 'PENDING',
      readBackUrl: '/api/initiatives?includeExecutionEvidence=1',
    };
    runtimeApi.updateInitiativeForecast.mockResolvedValue(result);
    const context = renderTimeline();

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2027-01-15' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Supplier delay' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));

    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(1));
    expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledWith(
      'initiative-forecast-1',
      expect.objectContaining({
        expectedVersion: 7,
        forecastEndDate: '2027-01-15',
        reason: 'Supplier delay',
        clientRequestId: expect.stringMatching(/^initiative-forecast-initiative-forecast-1-/),
      })
    );
    const submitted = runtimeApi.updateInitiativeForecast.mock.calls[0][1];
    expect(submitted).not.toHaveProperty('forecastStartDate');
    await waitFor(() => expect(context.fetchAll).toHaveBeenCalledTimes(1));
    expect(refreshStore.bumpInitiativeRefresh).toHaveBeenCalledTimes(1);
    expect(context.setStartDate).not.toHaveBeenCalled();
    expect(context.setEndDate).not.toHaveBeenCalled();
    expect(await screen.findByText('Version 8')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('15/01/2027');
  });

  it('distinguishes explicit clear from an omitted forecast field', async () => {
    runtimeApi.updateInitiativeForecast.mockResolvedValue({
      status: 'APPLIED',
      aggregateVersion: 8,
      response: {
        initiativeId: 'initiative-forecast-1',
        before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-12-20' },
        after: { forecastStartDate: null, forecastEndDate: '2026-12-20' },
        receiptId: 'receipt-clear',
        observedAt: '2026-09-13T12:10:00.000Z',
      },
    });
    renderTimeline();

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast start'));
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Start is not scheduled yet' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));

    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(1));
    const submitted = runtimeApi.updateInitiativeForecast.mock.calls[0][1];
    expect(submitted.forecastStartDate).toBeNull();
    expect(submitted).not.toHaveProperty('forecastEndDate');
    expect(await screen.findByTestId('current-forecast-start')).toHaveTextContent('Not scheduled');
  });

  it('keeps the proposal on conflict and uses a new request identity after version refresh', async () => {
    runtimeApi.updateInitiativeForecast
      .mockRejectedValueOnce(
        new RuntimeApiError(409, 'VERSION_OR_IDEMPOTENCY_CONFLICT', 'EXPECTED_VERSION_MISMATCH')
      )
      .mockResolvedValueOnce({
        status: 'APPLIED',
        aggregateVersion: 9,
        response: {
          initiativeId: 'initiative-forecast-1',
          before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-12-20' },
          after: { forecastStartDate: '2026-10-10', forecastEndDate: '2027-02-01' },
          receiptId: 'receipt-after-refresh',
          observedAt: '2026-09-13T12:20:00.000Z',
        },
      });
    runtimeApi.readRegisteredInitiative.mockResolvedValueOnce({
      version: 7,
      initiative: { initiativeId: 'initiative-forecast-1' },
    });
    runtimeApi.readRegisteredInitiative.mockResolvedValueOnce({
      version: 8,
      initiative: { initiativeId: 'initiative-forecast-1' },
    });
    renderTimeline();

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2027-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Customer cutover moved' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This correction no longer matches the current forecast'
    );
    expect(screen.getByLabelText('New end (leave empty to clear)')).toHaveValue('2027-02-01');
    expect(screen.getByLabelText('Reason for correction')).toHaveValue('Customer cutover moved');
    const firstRequestId = runtimeApi.updateInitiativeForecast.mock.calls[0][1].clientRequestId;

    fireEvent.click(screen.getByRole('button', { name: 'Refresh version' }));
    await screen.findByText('Version 8');
    expect(screen.getByLabelText('New end (leave empty to clear)')).toHaveValue('2027-02-01');
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));

    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(2));
    const secondCommand = runtimeApi.updateInitiativeForecast.mock.calls[1][1];
    expect(secondCommand.expectedVersion).toBe(8);
    expect(secondCommand.clientRequestId).not.toBe(firstRequestId);
  });

  it('reuses a request identity for an unchanged uncertain retry and changes it after an edit', async () => {
    runtimeApi.updateInitiativeForecast.mockRejectedValue(new Error('network uncertain'));
    renderTimeline();

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2027-03-01' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Uncertain delivery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));
    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(1));
    const firstId = runtimeApi.updateInitiativeForecast.mock.calls[0][1].clientRequestId;

    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));
    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(2));
    expect(runtimeApi.updateInitiativeForecast.mock.calls[1][1].clientRequestId).toBe(firstId);

    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Uncertain delivery, revised evidence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));
    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(3));
    expect(runtimeApi.updateInitiativeForecast.mock.calls[2][1].clientRequestId).not.toBe(firstId);
  });

  it('shows authoritative lifecycle refusal while keeping unknown distinct from an explicit empty date', async () => {
    runtimeApi.readInitiativeCapabilities.mockResolvedValue({
      actorId: 'owner-1',
      canView: true,
      canUpdate: true,
      canReview: false,
      canSelfApprove: false,
      executionWrites: {
        forecast: {
          available: false,
          denialAt: 'LIFECYCLE',
          denialCode: 'INITIATIVE_FORECAST_LIFECYCLE_INVALID',
        },
      },
    });
    runtimeApi.readRegisteredInitiative.mockResolvedValue({
      version: 7,
      initiative: { initiativeId: 'initiative-forecast-1' },
    });
    renderTimeline({
      initiative: { id: 'initiative-forecast-1', forecastStartDate: null },
      status: 'CLOSED',
    });

    expect(
      await screen.findByText(
        'Operational forecast can be changed only for a scheduled or executing Initiative.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('Not scheduled');
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('Unknown');
    expect(screen.queryByRole('button', { name: 'Save forecast' })).not.toBeInTheDocument();
  });

  it('uses canonical same-ID forecast only when the module detail has no field observation', async () => {
    runtimeApi.readRegisteredInitiative.mockResolvedValue({
      version: 7,
      initiative: {
        initiativeId: 'initiative-forecast-1',
        forecastStartDate: '2026-11-05',
        forecastEndDate: null,
      },
    });
    renderTimeline({ initiative: { id: 'initiative-forecast-1' } });

    await screen.findByText('Version 7');
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('05/11/2026');
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('Not scheduled');
  });

  it('renders malformed calendar input as unknown instead of normalizing it to another day', async () => {
    runtimeApi.readRegisteredInitiative.mockResolvedValue({
      version: 7,
      initiative: { initiativeId: 'initiative-forecast-1' },
    });
    renderTimeline({
      initiative: {
        id: 'initiative-forecast-1',
        forecastStartDate: '2026-02-31',
        forecastEndDate: 'not-a-date',
      },
    });

    await screen.findByText('Version 7');
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('Unknown');
    expect(screen.queryByText('03/03/2026')).not.toBeInTheDocument();
  });
});
