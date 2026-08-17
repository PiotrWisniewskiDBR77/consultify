/**
 * @vitest-environment jsdom
 * AdminHealthPanel — render + interaction tests (HARVARD D-J ETAP 2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { AdminHealthPanel } from '../../../src/components/Admin/AdminHealthPanel';
import { Api } from '../../../src/services/api';

const PROBES = [
  {
    probeId: 'm15_kpi_round_trip',
    module: 'M15',
    title: 'KPI create → read → delete',
    description: 'Creates a KPI and reads it back.',
    status: 'pass',
    durationMs: 12,
    errorMessage: null,
    ranAt: '2026-07-02T10:00:00.000Z',
  },
  {
    probeId: 'm24_member_validate_audit',
    module: 'M24',
    title: 'Add-member validate + audit',
    description: 'Validates add-member and emits audit.',
    status: 'fail',
    durationMs: 34,
    errorMessage: 'Audit entry not readable after emission',
    ranAt: '2026-07-02T10:00:01.000Z',
  },
];

const SUMMARY = { total: 2, passed: 1, failed: 1, unknown: 0, overall: 'fail' };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Api, 'getHealthPanelProbes').mockResolvedValue({
    success: true,
    envAllowed: true,
    catalog: PROBES,
    results: PROBES,
    summary: SUMMARY,
  });
  vi.spyOn(Api, 'runHealthPanelProbes').mockResolvedValue({
    success: true,
    results: PROBES,
    summary: SUMMARY,
  });
  vi.spyOn(Api, 'runHealthPanelProbe').mockResolvedValue({
    success: true,
    result: { ...PROBES[1], status: 'pass', errorMessage: null },
  });
});

describe('AdminHealthPanel', () => {
  it('loads and renders each probe with its module + title', async () => {
    render(<AdminHealthPanel />);
    await waitFor(() => expect(Api.getHealthPanelProbes).toHaveBeenCalled());
    expect(await screen.findByText('KPI create → read → delete')).toBeInTheDocument();
    expect(screen.getByText('Add-member validate + audit')).toBeInTheDocument();
    expect(screen.getByText('M15')).toBeInTheDocument();
    expect(screen.getByText('M24')).toBeInTheDocument();
  });

  it('surfaces the error message for a failing probe', async () => {
    render(<AdminHealthPanel />);
    expect(await screen.findByText('Audit entry not readable after emission')).toBeInTheDocument();
  });

  it('runs all probes when "Run all" is clicked', async () => {
    render(<AdminHealthPanel />);
    const runAll = await screen.findByText('Run all');
    fireEvent.click(runAll);
    await waitFor(() => expect(Api.runHealthPanelProbes).toHaveBeenCalledOnce());
  });

  it('re-runs a single probe from its row action', async () => {
    render(<AdminHealthPanel />);
    await screen.findByText('KPI create → read → delete');
    const rerunButtons = screen.getAllByText('Re-run');
    fireEvent.click(rerunButtons[0]);
    await waitFor(() => expect(Api.runHealthPanelProbe).toHaveBeenCalledOnce());
    expect(Api.runHealthPanelProbe).toHaveBeenCalledWith('m15_kpi_round_trip');
  });

  it('shows the production-safe banner and disables run when env is not allowed', async () => {
    (Api.getHealthPanelProbes as any).mockResolvedValue({
      success: true,
      envAllowed: false,
      catalog: PROBES,
      results: PROBES,
      summary: SUMMARY,
    });
    render(<AdminHealthPanel />);
    expect(await screen.findByText(/disabled in this environment/i)).toBeInTheDocument();
  });

  it('does not present unknown probe metrics as truth after load failure and supports retry', async () => {
    (Api.getHealthPanelProbes as any)
      .mockRejectedValueOnce(new Error('Health unavailable'))
      .mockResolvedValueOnce({
        success: true,
        envAllowed: true,
        catalog: PROBES,
        results: PROBES,
        summary: SUMMARY,
      });
    render(<AdminHealthPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Health unavailable');
    expect(screen.queryByText('Not run')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('KPI create → read → delete')).toBeInTheDocument();
  });
});
