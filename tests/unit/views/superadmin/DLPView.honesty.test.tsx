import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import DLPView from '@/views/superadmin/iam/DLPView';

vi.mock('@/services/api', () => ({
  Api: {
    getDLPPolicies: vi.fn(),
    getDLPViolations: vi.fn(),
    getDLPStats: vi.fn(),
    createDLPPolicy: vi.fn(),
    toggleDLPPolicy: vi.fn(),
    deleteDLPPolicy: vi.fn(),
    resolveDLPViolation: vi.fn(),
  },
}));

describe('DLPView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getDLPPolicies).mockRejectedValue(new Error('DLP backend down'));
    vi.mocked(Api.getDLPViolations).mockResolvedValue([]);
    vi.mocked(Api.getDLPStats).mockResolvedValue({
      policies: {
        total: 0,
        active: 0,
      },
      violations: {
        total: 0,
        unresolved: 0,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      },
    });
  });

  it('does not render DLP load failures as empty policies or violations', async () => {
    render(<DLPView />);

    await waitFor(() => {
      expect(screen.getByText('DLP data unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('DLP backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('DLP policies unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No DLP policies found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Policies')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Policy/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Violations/i }));

    expect(screen.getByText('DLP violations unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No unresolved violations')).not.toBeInTheDocument();
    expect(Api.createDLPPolicy).not.toHaveBeenCalled();
    expect(Api.toggleDLPPolicy).not.toHaveBeenCalled();
    expect(Api.deleteDLPPolicy).not.toHaveBeenCalled();
    expect(Api.resolveDLPViolation).not.toHaveBeenCalled();
  });
});
