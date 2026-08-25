import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlLoopReport } from '../ControlLoopReport';

const api = vi.hoisted(() => ({ listManagementSignals: vi.fn(), listInterventions: vi.fn() }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => api);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data }: any) => (
    <div data-testid="standard-table">
      {data.map((row: any) => (
        <span key={`${row.kind}:${row.id}`}>
          {row.title} · {row.verification}
        </span>
      ))}
    </div>
  ),
}));

describe('Management Control Loop report', () => {
  beforeEach(() => {
    api.listManagementSignals.mockReset();
    api.listInterventions.mockReset();
  });

  it('renders bidirectional lineage from signal through decision, work and verification', async () => {
    api.listManagementSignals.mockResolvedValue({
      signals: [
        { signalId: 's1', title: 'Capacity risk', decisionId: 'd1', taskId: 't1', version: 2 },
      ],
    });
    api.listInterventions.mockResolvedValue({
      interventions: [
        {
          interventionId: 'x1',
          title: 'Rebalance',
          decisionId: 'd1',
          taskId: 't1',
          evidenceRefs: ['e1'],
          status: 'CLOSED',
          version: 3,
        },
      ],
    });
    render(<ControlLoopReport />);
    expect(await screen.findByText(/SIGNAL:s1 → decision:d1 → work:t1/)).toBeInTheDocument();
    expect(
      screen.getByText(/INTERVENTION:x1 → decision:d1 → work:t1 → verification:VERIFIED/)
    ).toBeInTheDocument();
  });

  it('marks a closed intervention without evidence as NOT_VERIFIED', async () => {
    api.listManagementSignals.mockResolvedValue({ signals: [] });
    api.listInterventions.mockResolvedValue({
      interventions: [{ interventionId: 'x1', title: 'Closed without proof', status: 'RESOLVED' }],
    });
    render(<ControlLoopReport />);
    expect(await screen.findByTestId('standard-table')).toHaveTextContent(
      'Closed without proof · NOT_VERIFIED'
    );
  });

  it('reconciles KPI counts to the unified register', async () => {
    api.listManagementSignals.mockResolvedValue({
      signals: [{ signalId: 's1' }, { signalId: 's2' }],
    });
    api.listInterventions.mockResolvedValue({ interventions: [{ interventionId: 'x1' }] });
    render(<ControlLoopReport />);
    await screen.findByRole('heading', { name: 'Management Control Loop' });
    expect(screen.getByText('signals · 2/3 · CALCULATED')).toBeInTheDocument();
    expect(screen.getByText('interventions · 1/3 · CALCULATED')).toBeInTheDocument();
  });

  it('renders honest error and empty states', async () => {
    api.listManagementSignals.mockRejectedValueOnce(new Error('HTTP 503'));
    api.listInterventions.mockResolvedValueOnce({ interventions: [] });
    const { unmount } = render(<ControlLoopReport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
    unmount();
    api.listManagementSignals.mockResolvedValueOnce({ signals: [] });
    api.listInterventions.mockResolvedValueOnce({ interventions: [] });
    render(<ControlLoopReport />);
    expect(await screen.findByText('No control records')).toBeInTheDocument();
    expect(screen.getByText(/BRAK_API_FORECAST/)).toBeInTheDocument();
  });
});
