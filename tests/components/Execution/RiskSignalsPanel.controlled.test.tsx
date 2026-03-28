import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RiskSignalsPanel } from '../../../src/components/Execution/RiskSignalsPanel';

const trackFunnelEventMock = vi.fn();
const getRiskSignalsMock = vi.fn();
const dismissRiskSignalMock = vi.fn();

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
    getRiskSignals: (...args: any[]) => getRiskSignalsMock(...args),
    dismissRiskSignal: (...args: any[]) => dismissRiskSignalMock(...args),
  },
}));

describe('RiskSignalsPanel controlled mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as any).fetch = undefined;
  });

  it('renders provided signals without fetching its own runtime truth', () => {
    render(
      <RiskSignalsPanel
        signals={[
          {
            id: 'sig-1',
            initiativeId: 'init-1',
            initiativeName: 'Alpha',
            signalType: 'BLOCKED_LONG',
            severity: 'HIGH',
            title: 'Blocked too long',
            description: 'Execution is blocked',
            suggestedAction: 'Escalate',
          },
        ]}
        loading={false}
      />
    );

    expect(screen.getByText('execution.riskSignals.title')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Blocked too long')).toBeInTheDocument();
    expect(getRiskSignalsMock).not.toHaveBeenCalled();
  });

  it('refreshes the parent truth after dismissing a controlled signal', async () => {
    localStorage.setItem('token', 't-1');
    dismissRiskSignalMock.mockResolvedValue({ success: true, signalId: 'sig-1' });
    const onRefresh = vi.fn();

    render(
      <RiskSignalsPanel
        signals={[
          {
            id: 'sig-1',
            initiativeId: 'init-1',
            initiativeName: 'Alpha',
            signalType: 'BLOCKED_LONG',
            severity: 'HIGH',
            title: 'Blocked too long',
            description: 'Execution is blocked',
            suggestedAction: 'Escalate',
          },
        ]}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText('Blocked too long'));
    fireEvent.click(screen.getByRole('button', { name: 'execution.riskSignals.dismiss' }));

    await waitFor(() => expect(dismissRiskSignalMock).toHaveBeenCalledWith('sig-1'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
