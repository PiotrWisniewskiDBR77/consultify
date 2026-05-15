import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { GlobalSecurityPostureView } from '@/views/superadmin/GlobalSecurityPostureView';

vi.mock('@/services/api', () => ({
  Api: {
    getSystemHealth: vi.fn(),
    getSuperAdminOperatorOverview: vi.fn(),
  },
}));

describe('GlobalSecurityPostureView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getSystemHealth).mockRejectedValue(new Error('Posture backend down'));
    vi.mocked(Api.getSuperAdminOperatorOverview).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render unavailable posture as zero-valued evidence', async () => {
    render(<GlobalSecurityPostureView />);

    await waitFor(() => {
      expect(screen.getByText('Global security posture unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Posture backend down')).toBeInTheDocument();
    expect(screen.queryByText('Privileged sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit debt')).not.toBeInTheDocument();
    expect(screen.queryByText('Platform health')).not.toBeInTheDocument();
  });
});
