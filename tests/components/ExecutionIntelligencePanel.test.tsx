/**
 * @vitest-environment jsdom
 *
 * M14/F7 — Execution Intelligence panel: renders predictions + triage, fails soft.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ExecutionIntelligencePanel, {
  IntelligenceResponse,
} from '../../src/components/Execution/ExecutionIntelligencePanel';

const sample: IntelligenceResponse = {
  predictions: [
    { initiativeId: 'i1', name: 'Migracja ERP', overall: 'CRITICAL', reasons: ['SPI 0.7 (severely behind schedule)'] },
    { initiativeId: 'i2', name: 'Rollout CRM', overall: 'HIGH', reasons: ['3 day(s) behind plan'] },
    { initiativeId: 'i3', name: 'Healthy one', overall: 'LOW', reasons: [] },
  ],
  triage: { topActions: ['escalate to sponsor', 'unblock'] },
  summary: { atRisk: 2 },
};

describe('ExecutionIntelligencePanel', () => {
  it('renders at-risk count and only HIGH/CRITICAL predictions', async () => {
    render(<ExecutionIntelligencePanel projectId="p1" fetcher={() => Promise.resolve(sample)} />);
    await waitFor(() => expect(screen.getByTestId('intel-list')).toBeTruthy());
    expect(screen.getByTestId('intel-atrisk').textContent).toContain('2');
    expect(screen.getByText('Migracja ERP')).toBeTruthy();
    expect(screen.getByText('Rollout CRM')).toBeTruthy();
    // LOW initiative is filtered out of the ranked list
    expect(screen.queryByText('Healthy one')).toBeNull();
    // cited reason is shown
    expect(screen.getByText('SPI 0.7 (severely behind schedule)')).toBeTruthy();
  });

  it('shows top actions', async () => {
    render(<ExecutionIntelligencePanel projectId="p1" fetcher={() => Promise.resolve(sample)} />);
    await waitFor(() => expect(screen.getByTestId('intel-actions')).toBeTruthy());
    expect(screen.getByText('escalate to sponsor')).toBeTruthy();
  });

  it('renders empty state when no high-risk initiatives', async () => {
    render(
      <ExecutionIntelligencePanel
        projectId="p1"
        fetcher={() => Promise.resolve({ predictions: [{ initiativeId: 'x', overall: 'LOW' }], summary: { atRisk: 0 } })}
      />
    );
    await waitFor(() => expect(screen.getByTestId('intel-empty')).toBeTruthy());
  });

  it('fails soft on fetch error (cockpit not blocked)', async () => {
    render(
      <ExecutionIntelligencePanel projectId="p1" fetcher={() => Promise.reject(new Error('boom'))} />
    );
    await waitFor(() => expect(screen.getByTestId('intel-failed')).toBeTruthy());
  });

  it('does not fetch without a projectId', () => {
    const spy = vi.fn(() => Promise.resolve(sample));
    render(<ExecutionIntelligencePanel projectId={null} fetcher={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
