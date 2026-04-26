import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import AuditEventsViewer from '@/views/superadmin/iam/AuditEventsViewer';

vi.mock('@/services/api', () => ({
  Api: {
    getAuditEvents: vi.fn(),
  },
}));

describe('AuditEventsViewer honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAuditEvents).mockRejectedValue(new Error('Audit events backend down'));
  });

  it('does not render audit load failures as an empty audit trail', async () => {
    render(<AuditEventsViewer />);

    await waitFor(() => {
      expect(screen.getByText('Audit events unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit events backend down')).toBeInTheDocument();
    expect(screen.getByText('Events unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No audit events found')).not.toBeInTheDocument();
    expect(screen.queryByText('0 events')).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText('Resource type')).toBeDisabled();
    expect(screen.getByPlaceholderText('Actor ID')).toBeDisabled();
  });
});
