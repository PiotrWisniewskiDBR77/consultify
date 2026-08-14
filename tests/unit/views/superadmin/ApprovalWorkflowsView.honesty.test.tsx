import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  const chooseRowAction = (name: string, rowText?: string) => {
    const scope = rowText ? within(screen.getByText(rowText).closest('tr') as HTMLElement) : screen;
    fireEvent.click(scope.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
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
    expect(screen.queryByText('Pending Requests')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(screen.getByText('Approval requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No approval requests')).not.toBeInTheDocument();
  });

  it('refetches workflows after create and delete instead of trusting local optimistic state', async () => {
    vi.mocked(Api.getApprovalWorkflows)
      .mockResolvedValueOnce([
        {
          id: 'wf-1',
          name: 'Billing approval',
          description: 'Approve billing changes',
          resource_type: 'billing',
          triggerConditions: {},
          approvers: ['admin@example.com'],
          isActive: true,
          created_at: '2026-04-26T09:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'wf-2',
          name: 'Security approval',
          description: 'Approve security changes',
          resource_type: 'organization',
          triggerConditions: {},
          approvers: ['security@example.com'],
          isActive: true,
          created_at: '2026-04-26T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(Api.getApprovalRequests).mockResolvedValue([]);
    vi.mocked(Api.createApprovalWorkflow).mockResolvedValue({ id: 'wf-2' });
    vi.mocked(Api.deleteApprovalWorkflow).mockResolvedValue({ message: 'Workflow deleted' });

    render(<ApprovalWorkflowsView />);

    await waitFor(() => {
      expect(screen.getByText('Billing approval')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Workflow/i }));
    fireEvent.change(screen.getByPlaceholderText('Workflow name'), {
      target: { value: 'Security approval' },
    });
    fireEvent.change(screen.getByPlaceholderText('Workflow description'), {
      target: { value: 'Approve security changes' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@example.com, manager@example.com'), {
      target: { value: 'security@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(Api.createApprovalWorkflow).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Security approval')).toBeInTheDocument();
    });
    expect(Api.getApprovalWorkflows).toHaveBeenCalledTimes(2);

    chooseRowAction('Delete', 'Security approval');
    fireEvent.click(screen.getByRole('button', { name: /^Delete Workflow$/i }));

    await waitFor(() => {
      expect(Api.deleteApprovalWorkflow).toHaveBeenCalledWith('wf-2');
      expect(screen.queryByText('Security approval')).not.toBeInTheDocument();
    });
    expect(Api.getApprovalWorkflows).toHaveBeenCalledTimes(3);
  });

  it('refetches requests after approve and reject decisions', async () => {
    vi.mocked(Api.getApprovalWorkflows).mockResolvedValue([]);
    vi.mocked(Api.getApprovalRequests)
      .mockResolvedValueOnce([
        {
          id: 'req-1',
          workflow_id: 'wf-1',
          workflow_name: 'Billing approval',
          resource_type: 'billing',
          resource_id: 'invoice-1',
          requester_id: 'user-1',
          requester_email: 'requester@example.com',
          status: 'pending',
          current_step: 1,
          approvers: [],
          requestData: {},
          created_at: '2026-04-26T09:00:00.000Z',
        },
        {
          id: 'req-2',
          workflow_id: 'wf-1',
          workflow_name: 'Security approval',
          resource_type: 'organization',
          resource_id: 'org-1',
          requester_id: 'user-2',
          requester_email: 'security@example.com',
          status: 'pending',
          current_step: 1,
          approvers: [],
          requestData: {},
          created_at: '2026-04-26T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'req-2',
          workflow_id: 'wf-1',
          workflow_name: 'Security approval',
          resource_type: 'organization',
          resource_id: 'org-1',
          requester_id: 'user-2',
          requester_email: 'security@example.com',
          status: 'pending',
          current_step: 1,
          approvers: [],
          requestData: {},
          created_at: '2026-04-26T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(Api.approveRequest).mockResolvedValue({ message: 'Request approved' });
    vi.mocked(Api.rejectRequest).mockResolvedValue({ message: 'Request rejected' });

    render(<ApprovalWorkflowsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Requests/i }));
    await waitFor(() => {
      expect(screen.getByText('Billing approval')).toBeInTheDocument();
    });

    chooseRowAction('Approve', 'Billing approval');
    await waitFor(() => {
      expect(Api.approveRequest).toHaveBeenCalledWith('req-1');
      expect(screen.queryByText('Billing approval')).not.toBeInTheDocument();
    });

    chooseRowAction('Reject', 'Security approval');
    await waitFor(() => {
      expect(Api.rejectRequest).toHaveBeenCalledWith('req-2');
      expect(screen.queryByText('Security approval')).not.toBeInTheDocument();
    });

    expect(Api.getApprovalRequests).toHaveBeenCalledTimes(3);
  });

  it('does not claim approval success when request read-back remains pending', async () => {
    const pendingRequest = {
      id: 'req-1',
      workflow_id: 'wf-1',
      workflow_name: 'Billing approval',
      resource_type: 'billing',
      resource_id: 'invoice-1',
      requester_id: 'user-1',
      requester_email: 'requester@example.com',
      status: 'pending',
      current_step: 1,
      approvers: [],
      requestData: {},
      created_at: '2026-04-26T09:00:00.000Z',
    };

    vi.mocked(Api.getApprovalWorkflows).mockResolvedValue([]);
    vi.mocked(Api.getApprovalRequests).mockResolvedValue([pendingRequest]);
    vi.mocked(Api.approveRequest).mockResolvedValue({ message: 'Request approved' });

    render(<ApprovalWorkflowsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Requests/i }));
    await screen.findByText('Billing approval');
    chooseRowAction('Approve');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Approval request approval was not confirmed by the server'
      );
    });
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('accepts wrapped workflow and request payloads', async () => {
    vi.mocked(Api.getApprovalWorkflows).mockResolvedValue({
      data: {
        data: {
          workflows: [
            {
              id: 'wf-1',
              name: 'Billing approval',
              description: 'Approve billing changes',
              resource_type: 'billing',
              triggerConditions: {},
              approvers: ['admin@example.com'],
              isActive: true,
              created_at: 'not-a-date',
            },
          ],
        },
      },
    });
    vi.mocked(Api.getApprovalRequests).mockResolvedValue({
      data: {
        data: {
          requests: [
            {
              id: 'req-1',
              workflow_id: 'wf-1',
              workflow_name: 'Billing approval',
              resource_type: 'billing',
              resource_id: 'invoice-1',
              requester_id: 'user-1',
              requester_email: 'requester@example.com',
              status: 'pending',
              current_step: 1,
              approvers: [],
              requestData: {},
              created_at: 'not-a-date',
            },
          ],
        },
      },
    });

    render(<ApprovalWorkflowsView />);

    expect(await screen.findByText('Billing approval')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(await screen.findByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('keeps create modal open when wrapped create response is not confirmed by read-back', async () => {
    vi.mocked(Api.getApprovalWorkflows).mockResolvedValue([]);
    vi.mocked(Api.getApprovalRequests).mockResolvedValue([]);
    vi.mocked(Api.createApprovalWorkflow).mockResolvedValue({
      data: { workflow: { id: 'wf-2' } },
    });

    render(<ApprovalWorkflowsView />);

    await screen.findByText('No workflows configured');
    fireEvent.click(screen.getByRole('button', { name: /Create Workflow/i }));
    fireEvent.change(screen.getByPlaceholderText('Workflow name'), {
      target: { value: 'Security approval' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Approval workflow creation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Create Approval Workflow')).toBeInTheDocument();
  });

  it('does not render malformed workflow payloads as empty states', async () => {
    vi.mocked(Api.getApprovalWorkflows).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getApprovalRequests).mockResolvedValue([]);

    render(<ApprovalWorkflowsView />);

    await waitFor(() => {
      expect(screen.getByText('Approval workflows unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Approval workflows response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No workflows configured')).not.toBeInTheDocument();
  });
});
