import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SuperAdminAccessRequestsView } from '@/views/superadmin/SuperAdminAccessRequestsView';

vi.mock('@/services/api', () => ({
  Api: {
    approveAccessRequest: vi.fn(),
    getAccessRequests: vi.fn(),
    rejectAccessRequest: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

const pendingRequest = {
  id: 'request-1',
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Nowak',
  phone: null,
  organization_name: 'Acme',
  requested_role: 'ADMIN',
  status: 'pending',
  request_type: 'join',
  requested_at: '2026-01-01T12:00:00Z',
  reviewed_at: null,
  rejection_reason: null,
};

describe('SuperAdminAccessRequestsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed request loads as an empty pending queue', async () => {
    vi.mocked(Api.getAccessRequests).mockRejectedValue(new Error('Access API down'));

    render(<SuperAdminAccessRequestsView />);

    await waitFor(() => {
      expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Access API down')).toBeInTheDocument();
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
  });

  it('does not claim approval success when read-back remains pending', async () => {
    vi.mocked(Api.getAccessRequests).mockResolvedValue([pendingRequest]);
    vi.mocked(Api.approveAccessRequest).mockResolvedValue(undefined);

    render(<SuperAdminAccessRequestsView />);

    await screen.findByText('anna@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Approve access request request-1/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Approve$/i }).at(-1)!);

    await waitFor(() => {
      expect(
        screen.getByText('Access request approval was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Approve Access Request')).toBeInTheDocument();
  });

  it('does not claim rejection success when read-back remains pending', async () => {
    vi.mocked(Api.getAccessRequests).mockResolvedValue([pendingRequest]);
    vi.mocked(Api.rejectAccessRequest).mockResolvedValue(undefined);

    render(<SuperAdminAccessRequestsView />);

    await screen.findByText('anna@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Reject access request request-1/i }));
    fireEvent.change(screen.getByPlaceholderText('Provide a reason for rejection...'), {
      target: { value: 'Missing tenant verification' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Reject$/i }).at(-1)!);

    await waitFor(() => {
      expect(
        screen.getByText('Access request rejection was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Reject Access Request')).toBeInTheDocument();
  });

  it('renders invalid requested dates as Unknown date', async () => {
    vi.mocked(Api.getAccessRequests).mockResolvedValue([
      {
        ...pendingRequest,
        requested_at: 'not-a-date',
      },
    ]);

    render(<SuperAdminAccessRequestsView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped access request payloads and exposes labelled actions', async () => {
    vi.mocked(Api.getAccessRequests).mockResolvedValue({
      data: { data: { requests: [pendingRequest] } },
    });

    render(<SuperAdminAccessRequestsView />);

    expect(await screen.findByText('anna@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Approve access request request-1/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Reject access request request-1/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Access requests unavailable')).not.toBeInTheDocument();
  });

  it('accepts normalized approved status after approval read-back', async () => {
    vi.mocked(Api.getAccessRequests)
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce({
        data: { data: { requests: [{ ...pendingRequest, status: 'APPROVED' }] } },
      });
    vi.mocked(Api.approveAccessRequest).mockResolvedValue(undefined);

    render(<SuperAdminAccessRequestsView />);

    await screen.findByText('anna@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Approve access request request-1/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Approve$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Approve Access Request')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
  });

  it('does not render malformed access request payloads as an empty queue', async () => {
    vi.mocked(Api.getAccessRequests).mockResolvedValue({ unexpected: true });

    render(<SuperAdminAccessRequestsView />);

    await waitFor(() => {
      expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Access requests response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
  });
});
