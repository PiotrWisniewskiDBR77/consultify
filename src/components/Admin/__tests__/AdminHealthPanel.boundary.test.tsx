import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { AdminHealthPanel } from '../AdminHealthPanel';

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../services/api', () => ({
  Api: {
    getHealthPanelProbes: vi.fn(),
    runHealthPanelProbes: vi.fn(),
    runHealthPanelProbe: vi.fn(),
  },
}));

const mockedApi = Api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getHealthPanelProbes.mockResolvedValue({
    envAllowed: true,
    summary: { total: 1, passed: 1, failed: 0, unknown: 0, overall: 'pass' },
    results: [
      {
        probeId: 'tenant-readback',
        module: 'Tenant',
        title: 'Tenant readback',
        description: 'Checks the customer-safe readback.',
        status: 'pass',
        durationMs: 20,
        errorMessage: null,
        ranAt: '2026-08-21T12:00:00.000Z',
      },
    ],
  });
});

describe('AdminHealthPanel platform boundary', () => {
  it('keeps probe execution absent from the customer-admin view', async () => {
    render(<AdminHealthPanel />);

    await waitFor(() => expect(mockedApi.getHealthPanelProbes).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Tenant readback')).not.toBeInTheDocument();
    expect(screen.queryByText('Checks the customer-safe readback.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run all' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-run' })).not.toBeInTheDocument();
    expect(screen.getByText(/platform operator/i)).toBeInTheDocument();
  });

  it('exposes probe execution only when the platform capability is explicit', async () => {
    render(<AdminHealthPanel canRunDiagnostics />);

    await waitFor(() => expect(mockedApi.getHealthPanelProbes).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Run all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-run' })).toBeInTheDocument();
  });
});
