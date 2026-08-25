import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isExecutionFlagEnabled } from '../../executionFeatureFlags';
import { ExecutionReportsIntelligenceEntry } from '../ExecutionReportsIntelligenceEntry';

const { listReportRuns } = vi.hoisted(() => ({ listReportRuns: vi.fn() }));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportRuns,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { count?: number }) =>
      fallback.replace('{{count}}', String(options?.count ?? '')),
  }),
}));

function RouteHarness({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <ExecutionReportsIntelligenceEntry />
  ) : (
    <section data-testid="execution-current-work-register">Current work register</section>
  );
}

describe('Execution reports intelligence flag', () => {
  beforeEach(() => {
    listReportRuns.mockReset();
    window.history.replaceState({}, '', '/execution?tab=work');
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the current register mounted and performs zero report requests while OFF', () => {
    render(<RouteHarness enabled={isExecutionFlagEnabled('execReportsIntelligence')} />);

    expect(screen.getByTestId('execution-current-work-register')).toBeInTheDocument();
    expect(screen.queryByTestId('execution-reports-intelligence')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Work Intelligence Report' })).toBeNull();
    expect(listReportRuns).toHaveBeenCalledTimes(0);
  });

  it('stays OFF by default in the demo acceptance profile and on a production host', () => {
    expect(
      isExecutionFlagEnabled('execReportsIntelligence', {
        hostname: 'demo.consultify.local',
        search: '?demoAcceptance=1',
      })
    ).toBe(false);
    expect(isExecutionFlagEnabled('execReportsIntelligence')).toBe(false);
  });

  it('does not unlock another Execution intelligence surface', () => {
    window.localStorage.setItem('ff.exec_reports_intel', '1');
    window.localStorage.setItem('ff.exec_intelligence', '0');

    expect(isExecutionFlagEnabled('execReportsIntelligence')).toBe(true);
    expect(isExecutionFlagEnabled('intelligence')).toBe(false);
  });

  it('mounts a visibly different report and reads runtime-v1 when explicitly ON', async () => {
    listReportRuns.mockResolvedValueOnce({ items: [{ id: 'run-1' }, { id: 'run-2' }] });
    window.localStorage.setItem('ff.exec_reports_intel', '1');

    render(<RouteHarness enabled={isExecutionFlagEnabled('execReportsIntelligence')} />);

    expect(screen.queryByTestId('execution-current-work-register')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work Intelligence Report' })).toBeInTheDocument();
    await waitFor(() => expect(listReportRuns).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('2 governed report runs')).toBeInTheDocument();
  });

  it('renders an honest error instead of replacing it with fabricated data', async () => {
    listReportRuns.mockRejectedValueOnce(new Error('HTTP 503'));

    render(<RouteHarness enabled />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Report register is unavailable');
    expect(screen.getByText('HTTP 503')).toBeInTheDocument();
  });
});
