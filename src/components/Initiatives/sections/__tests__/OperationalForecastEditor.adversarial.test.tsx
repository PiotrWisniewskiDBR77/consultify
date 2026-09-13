import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeApiError } from '@/services/initiatives-execution/runtimeApi';

import type { InitiativeContextValue } from '../InitiativeContext';
import { InitiativeContext } from '../InitiativeContext';
import { OperationalForecastEditor } from '../OperationalForecastEditor';

const runtimeApi = vi.hoisted(() => ({
  readInitiativeCapabilities: vi.fn(),
  readRegisteredInitiative: vi.fn(),
  updateInitiativeForecast: vi.fn(),
}));

const refreshStore = vi.hoisted(() => ({ bumpInitiativeRefresh: vi.fn() }));
const appScope = vi.hoisted(() => ({
  organizationId: 'org-a',
  userId: 'owner-a',
  role: 'OWNER',
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>();
  return { ...original, ...runtimeApi };
});

vi.mock('@/store/useInitiativeRefreshStore', () => refreshStore);
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentOrganization: { id: appScope.organizationId },
      currentUser: { id: appScope.userId, role: appScope.role },
    }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function contextFor(
  initiativeId: string,
  forecastStartDate: string | null | undefined,
  forecastEndDate: string | null | undefined
): InitiativeContextValue {
  return {
    initiative: {
      id: initiativeId,
      name: initiativeId,
      ...(forecastStartDate !== undefined ? { forecastStartDate } : {}),
      ...(forecastEndDate !== undefined ? { forecastEndDate } : {}),
    },
    initiativeId,
    isPolish: false,
    fetchAll: vi.fn(async () => undefined),
    setStartDate: vi.fn(),
    setEndDate: vi.fn(),
  } as unknown as InitiativeContextValue;
}

function registration(
  initiativeId: string,
  version: number,
  forecastStartDate?: string | null,
  forecastEndDate?: string | null
) {
  return {
    version,
    updatedAt: '2026-09-13T12:00:00.000Z',
    initiative: {
      initiativeId,
      lifecycleState: 'SCHEDULED',
      ...(forecastStartDate !== undefined ? { forecastStartDate } : {}),
      ...(forecastEndDate !== undefined ? { forecastEndDate } : {}),
    },
  };
}

function capability(available = true) {
  return {
    actorId: appScope.userId,
    canView: true,
    canUpdate: available,
    canReview: false,
    canSelfApprove: false,
    executionWrites: {
      forecast: {
        available,
        canonicalCommand: 'initiative.forecast.update',
        denialAt: available ? null : 'AUTHORIZATION',
        denialCode: available ? null : 'FORBIDDEN',
        legacyDenialAt: 'BRAMKA_LEGACY',
        legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      },
    },
  };
}

function renderEditor(context: InitiativeContextValue) {
  return render(
    <InitiativeContext.Provider value={context}>
      <OperationalForecastEditor />
    </InitiativeContext.Provider>
  );
}

describe('OperationalForecastEditor independent stale-scope and date integrity review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appScope.organizationId = 'org-a';
    appScope.userId = 'owner-a';
    appScope.role = 'OWNER';
  });

  it('reloads same-id registration and capability on organization scope change and ignores late old-scope reads', async () => {
    const registrationA = deferred<ReturnType<typeof registration>>();
    const registrationB = deferred<ReturnType<typeof registration>>();
    const capabilityA = deferred<ReturnType<typeof capability>>();
    const capabilityB = deferred<ReturnType<typeof capability>>();
    runtimeApi.readRegisteredInitiative
      .mockReturnValueOnce(registrationA.promise)
      .mockReturnValueOnce(registrationB.promise);
    runtimeApi.readInitiativeCapabilities
      .mockReturnValueOnce(capabilityA.promise)
      .mockReturnValueOnce(capabilityB.promise);
    const context = contextFor('initiative-shared-id', undefined, undefined);
    const view = renderEditor(context);

    await waitFor(() => expect(runtimeApi.readRegisteredInitiative).toHaveBeenCalledTimes(1));
    appScope.organizationId = 'org-b';
    appScope.userId = 'owner-b';
    view.rerender(
      <InitiativeContext.Provider value={context}>
        <OperationalForecastEditor />
      </InitiativeContext.Provider>
    );

    await waitFor(() => expect(runtimeApi.readRegisteredInitiative).toHaveBeenCalledTimes(2));
    expect(runtimeApi.readInitiativeCapabilities).toHaveBeenCalledTimes(2);
    registrationB.resolve(registration('initiative-shared-id', 9, '2027-04-01', '2027-05-01'));
    capabilityB.resolve(capability(true));
    expect(await screen.findByText('Version 9')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('01/04/2027');

    await act(async () => {
      registrationA.resolve(registration('initiative-shared-id', 4, '2026-01-01', '2026-02-01'));
      capabilityA.resolve(capability(false));
      await Promise.all([registrationA.promise, capabilityA.promise]);
    });
    expect(screen.getByText('Version 9')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('01/04/2027');
    expect(screen.getByRole('button', { name: 'Save forecast' })).toBeInTheDocument();
  });

  it('does not reuse a same-object module forecast from the previous organization while the new scope loads', async () => {
    const registrationA = deferred<ReturnType<typeof registration>>();
    const registrationB = deferred<ReturnType<typeof registration>>();
    const capabilityA = deferred<ReturnType<typeof capability>>();
    const capabilityB = deferred<ReturnType<typeof capability>>();
    runtimeApi.readRegisteredInitiative
      .mockReturnValueOnce(registrationA.promise)
      .mockReturnValueOnce(registrationB.promise);
    runtimeApi.readInitiativeCapabilities
      .mockReturnValueOnce(capabilityA.promise)
      .mockReturnValueOnce(capabilityB.promise);
    const context = contextFor('initiative-same-object', '2026-03-01', '2026-04-01');
    const view = renderEditor(context);

    registrationA.resolve(registration('initiative-same-object', 4));
    capabilityA.resolve(capability(true));
    expect(await screen.findByText('Version 4')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('01/03/2026');

    appScope.organizationId = 'org-b';
    appScope.userId = 'owner-b';
    view.rerender(
      <InitiativeContext.Provider value={context}>
        <OperationalForecastEditor />
      </InitiativeContext.Provider>
    );
    await waitFor(() => expect(runtimeApi.readRegisteredInitiative).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Checking forecast availability…')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('current-forecast-start')).not.toHaveTextContent('01/03/2026');

    await act(async () => {
      registrationB.resolve(registration('initiative-same-object', 9));
      capabilityB.resolve(capability(false));
      await Promise.all([registrationB.promise, capabilityB.promise]);
    });
    expect(screen.getByText('Version 9')).toBeInTheDocument();
  });

  it('ignores a late successful submission after the visible Initiative changes', async () => {
    runtimeApi.readRegisteredInitiative.mockImplementation((initiativeId: string) =>
      Promise.resolve(
        initiativeId === 'initiative-a'
          ? registration('initiative-a', 7, '2026-10-10', '2026-12-20')
          : registration('initiative-b', 11, '2027-05-01', '2027-06-01')
      )
    );
    runtimeApi.readInitiativeCapabilities.mockResolvedValue(capability(true));
    const submissionA = deferred<{
      status: 'APPLIED';
      aggregateVersion: number;
      response: {
        initiativeId: string;
        before: { forecastStartDate: string | null; forecastEndDate: string | null };
        after: { forecastStartDate: string | null; forecastEndDate: string | null };
        receiptId: string;
        observedAt: string;
      };
    }>();
    runtimeApi.updateInitiativeForecast.mockReturnValue(submissionA.promise);
    const contextA = contextFor('initiative-a', '2026-10-10', '2026-12-20');
    const contextB = contextFor('initiative-b', '2027-05-01', '2027-06-01');
    const view = renderEditor(contextA);

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2027-01-15' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'A changed while the user navigated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));
    await waitFor(() => expect(runtimeApi.updateInitiativeForecast).toHaveBeenCalledTimes(1));

    view.rerender(
      <InitiativeContext.Provider value={contextB}>
        <OperationalForecastEditor />
      </InitiativeContext.Provider>
    );
    expect(await screen.findByText('Version 11')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('01/06/2027');

    await act(async () => {
      submissionA.resolve({
        status: 'APPLIED',
        aggregateVersion: 8,
        response: {
          initiativeId: 'initiative-a',
          before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-12-20' },
          after: { forecastStartDate: '2026-10-10', forecastEndDate: '2027-01-15' },
          receiptId: 'receipt-a',
          observedAt: '2026-09-13T12:10:00.000Z',
        },
      });
      await submissionA.promise;
    });
    expect(screen.getByText('Version 11')).toBeInTheDocument();
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('01/06/2027');
    expect(refreshStore.bumpInitiativeRefresh).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(contextA.fetchAll).not.toHaveBeenCalled();
    expect(contextB.fetchAll).not.toHaveBeenCalled();
  });

  it('renders an impossible calendar date as unknown instead of normalizing it', async () => {
    runtimeApi.readRegisteredInitiative.mockResolvedValue(
      registration('initiative-invalid-date', 2)
    );
    runtimeApi.readInitiativeCapabilities.mockResolvedValue(capability(false));
    renderEditor(contextFor('initiative-invalid-date', '2026-02-31', null));

    await screen.findByText('Version 2');
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('current-forecast-start')).not.toHaveTextContent('03/03/2026');
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('Not scheduled');
  });

  it('prefers present canonical forecast fields over an older module projection', async () => {
    runtimeApi.readRegisteredInitiative.mockResolvedValue(
      registration('initiative-canonical-newer', 12, '2027-08-01', '2027-09-15')
    );
    runtimeApi.readInitiativeCapabilities.mockResolvedValue(capability(true));
    renderEditor(contextFor('initiative-canonical-newer', '2026-03-01', '2026-04-01'));

    await screen.findByText('Version 12');
    expect(screen.getByTestId('current-forecast-start')).toHaveTextContent('01/08/2027');
    expect(screen.getByTestId('current-forecast-end')).toHaveTextContent('15/09/2027');
  });

  it('shows a range correction for range-invalid 409 instead of a version-conflict claim', async () => {
    runtimeApi.readRegisteredInitiative.mockResolvedValue(
      registration('initiative-invalid-range', 7, '2026-10-10', '2026-12-20')
    );
    runtimeApi.readInitiativeCapabilities.mockResolvedValue(capability(true));
    runtimeApi.updateInitiativeForecast.mockRejectedValue(
      new RuntimeApiError(
        409,
        'INITIATIVE_FORECAST_RANGE_INVALID',
        'INITIATIVE_FORECAST_RANGE_INVALID'
      )
    );
    renderEditor(contextFor('initiative-invalid-range', '2026-10-10', '2026-12-20'));

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Invalid range should have an actionable correction' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Forecast start cannot be later than forecast end.'
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('forecast changed');
  });

  it('does not show an old saved-refresh warning after the visible Initiative changes', async () => {
    runtimeApi.readRegisteredInitiative.mockImplementation((initiativeId: string) =>
      Promise.resolve(
        initiativeId === 'initiative-refresh-a'
          ? registration('initiative-refresh-a', 7, '2026-10-10', '2026-12-20')
          : registration('initiative-refresh-b', 11, '2027-05-01', '2027-06-01')
      )
    );
    runtimeApi.readInitiativeCapabilities.mockResolvedValue(capability(true));
    const refreshA = deferred<void>();
    const contextA = contextFor('initiative-refresh-a', '2026-10-10', '2026-12-20');
    contextA.fetchAll = vi.fn(() => refreshA.promise);
    const contextB = contextFor('initiative-refresh-b', '2027-05-01', '2027-06-01');
    runtimeApi.updateInitiativeForecast.mockResolvedValue({
      status: 'APPLIED',
      aggregateVersion: 8,
      response: {
        initiativeId: 'initiative-refresh-a',
        before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-12-20' },
        after: { forecastStartDate: '2026-10-10', forecastEndDate: '2027-01-15' },
        receiptId: 'receipt-refresh-a',
        observedAt: '2026-09-13T12:10:00.000Z',
      },
    });
    const view = renderEditor(contextA);

    await screen.findByText('Version 7');
    fireEvent.click(screen.getByLabelText('Change forecast end'));
    fireEvent.change(screen.getByLabelText('New end (leave empty to clear)'), {
      target: { value: '2027-01-15' },
    });
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'Saved before navigation' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save forecast' }));
    await waitFor(() => expect(contextA.fetchAll).toHaveBeenCalledTimes(1));

    view.rerender(
      <InitiativeContext.Provider value={contextB}>
        <OperationalForecastEditor />
      </InitiativeContext.Provider>
    );
    expect(await screen.findByText('Version 11')).toBeInTheDocument();

    await act(async () => {
      // Reject the post-save refresh only after B is the visible card.
      // The stale completion must not write a notice into B's state.
      refreshA.reject(new Error('refresh failed after navigation'));
      await Promise.resolve();
    });
    expect(
      screen.queryByText('Forecast saved, but the card did not refresh automatically.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Version 11')).toBeInTheDocument();
  });
});
