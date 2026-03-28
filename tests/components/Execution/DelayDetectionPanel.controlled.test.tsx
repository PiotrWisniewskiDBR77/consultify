import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DelayDetectionPanel } from '../../../src/components/Execution/DelayDetectionPanel';

const trackFunnelEventMock = vi.fn();
const detectDelaySignalsMock = vi.fn();
const getDelaySignalsMock = vi.fn();
const dismissDelaySignalMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: any[]) => trackFunnelEventMock(...args),
}));

vi.mock('../../../src/services/api/v8/execution-control', () => ({
  shouldFallbackToLegacyExecutionControl: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
  V8ExecutionControlApi: {
    detectDelaySignals: (...args: any[]) => detectDelaySignalsMock(...args),
    getDelaySignals: (...args: any[]) => getDelaySignalsMock(...args),
    dismissDelaySignal: (...args: any[]) => dismissDelaySignalMock(...args),
  },
}));

describe('DelayDetectionPanel controlled mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as any).fetch = undefined;
  });

  it('renders provided delay signals without triggering detect/fetch flows', () => {
    render(
      <DelayDetectionPanel
        signals={[
          {
            id: 'delay-1',
            entityType: 'INITIATIVE',
            entityId: 'init-1',
            entityName: 'Alpha',
            deviationType: 'OVERDUE',
            severity: 'CRITICAL',
            daysDeviation: 12,
            plannedDate: '2026-03-01',
            actualOrCurrent: null,
            whySlipReasons: [{ reason: 'BLOCKED', detail: 'Waiting for approval' }],
            isDismissed: false,
          },
        ]}
        loading={false}
      />
    );

    expect(screen.getByText('execution.delay.title')).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(detectDelaySignalsMock).not.toHaveBeenCalled();
    expect(getDelaySignalsMock).not.toHaveBeenCalled();
  });

  it('refreshes parent truth after dismissing a controlled delay signal', async () => {
    localStorage.setItem('token', 't-1');
    dismissDelaySignalMock.mockResolvedValue({ success: true, signalId: 'delay-1' });
    const onRefresh = vi.fn();

    render(
      <DelayDetectionPanel
        signals={[
          {
            id: 'delay-1',
            entityType: 'INITIATIVE',
            entityId: 'init-1',
            entityName: 'Alpha',
            deviationType: 'OVERDUE',
            severity: 'CRITICAL',
            daysDeviation: 12,
            plannedDate: '2026-03-01',
            actualOrCurrent: null,
            whySlipReasons: [{ reason: 'BLOCKED', detail: 'Waiting for approval' }],
            isDismissed: false,
          },
        ]}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'execution.delay.dismiss' }));

    await waitFor(() =>
      expect(dismissDelaySignalMock).toHaveBeenCalledWith({
        signalId: 'delay-1',
        entityType: 'INITIATIVE',
        entityId: 'init-1',
        deviationType: 'OVERDUE',
      })
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
