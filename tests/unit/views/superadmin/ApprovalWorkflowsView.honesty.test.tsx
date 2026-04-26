import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import ApprovalWorkflowsView from '@/views/superadmin/iam/ApprovalWorkflowsView';

vi.mock('@/services/api', () => ({
  Api: {
    getApprovalWorkflows: vi.fn(),
    getApprovalRequests: vi.fn(),
    createApprovalWorkflow: vi.fn(),
    deleteApprovalWorkflow: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
  },
}));

describe('ApprovalWorkflowsView honest data states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getApprovalWorkflows).mockRejectedValue(new Error('Approval backend down'));
    vi.mocked(Api.getApprovalRequests).mockResolvedValue([]);
  });

  it('does not render approval load failures as empty workflow or request states', async () => {
    render(<ApprovalWorkflowsView />);

    await waitFor(() => {
      expect(screen.getByText('Approval workflows unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Approval backend down')).toBeInTheDocument();
    expect(screen.queryByText('No workflows configured')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(screen.getByText('Approval requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No approval requests')).not.toBeInTheDocument();
  });
});
