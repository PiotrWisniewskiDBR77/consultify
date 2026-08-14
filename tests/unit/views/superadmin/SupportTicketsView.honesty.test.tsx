import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SupportTicketsView } from '@/views/superadmin/support/SupportTicketsView';

vi.mock('@/services/api', () => ({
  Api: {
    addSupportTicketComment: vi.fn(),
    createSupportTicket: vi.fn(),
    getSupportTicketComments: vi.fn(),
    getSupportTickets: vi.fn(),
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

describe('SupportTicketsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed ticket loads as an empty ticket table', async () => {
    vi.mocked(Api.getSupportTickets).mockRejectedValue(new Error('Tickets API down'));

    render(<SupportTicketsView />);

    await waitFor(() => {
      expect(screen.getByText('Support tickets unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Tickets API down')).toBeInTheDocument();
    expect(screen.queryByText('No tickets found')).not.toBeInTheDocument();
  });

  it('does not claim ticket creation success when read-back is stale', async () => {
    vi.mocked(Api.getSupportTickets).mockResolvedValue([]);
    vi.mocked(Api.createSupportTicket).mockResolvedValue({ success: true });

    render(<SupportTicketsView />);

    await screen.findByText('No tickets found');
    fireEvent.click(screen.getByRole('button', { name: /Create Ticket/i }));
    fireEvent.change(screen.getByPlaceholderText('Ticket subject'), {
      target: { value: 'Cannot log in' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe the issue...'), {
      target: { value: 'User cannot log in.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Ticket/i })[1]);

    await waitFor(() => {
      expect(
        screen.getByText('Support ticket creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses safe ticket dates', async () => {
    vi.mocked(Api.getSupportTickets).mockResolvedValue([
      {
        id: 'ticket-1',
        ticket_number: 'T-1',
        subject: 'Bad date ticket',
        priority: 'high',
        status: 'open',
        created_at: 'not-a-date',
      },
    ]);

    render(<SupportTicketsView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped ticket and comment payloads and nested create responses', async () => {
    vi.mocked(Api.getSupportTickets)
      .mockResolvedValueOnce({
        data: {
          data: {
            tickets: [
              {
                id: 'ticket-1',
                ticket_number: 'T-1',
                subject: 'Wrapped ticket',
                priority: 'high',
                status: 'open',
                created_at: 'not-a-date',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            tickets: [
              {
                id: 'ticket-1',
                ticket_number: 'T-1',
                subject: 'Wrapped ticket',
                priority: 'high',
                status: 'open',
                created_at: 'not-a-date',
              },
              {
                id: 'ticket-2',
                ticket_number: 'T-2',
                subject: 'Cannot log in',
                priority: 'medium',
                status: 'open',
                created_at: '2026-04-26T00:00:00.000Z',
              },
            ],
          },
        },
      });
    vi.mocked(Api.getSupportTicketComments).mockResolvedValue({
      data: {
        data: {
          comments: [
            {
              id: 'comment-1',
              commentText: 'Wrapped comment',
              isInternal: false,
              created_at: 'not-a-date',
            },
          ],
        },
      },
    });
    vi.mocked(Api.createSupportTicket).mockResolvedValue({
      data: { data: { ticket: { id: 'ticket-2' } } },
    });

    render(<SupportTicketsView />);

    expect(await screen.findByText('Wrapped ticket')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'View ticket details' }));
    expect(await screen.findByText('Wrapped comment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create Ticket/i }));
    fireEvent.change(screen.getByPlaceholderText('Ticket subject'), {
      target: { value: 'Cannot log in' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe the issue...'), {
      target: { value: 'User cannot log in.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Ticket/i })[1]);

    await waitFor(() => {
      expect(screen.queryByText('Create Support Ticket')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cannot log in')).toBeInTheDocument();
  });

  it('does not render malformed ticket payloads as an empty ticket table', async () => {
    vi.mocked(Api.getSupportTickets).mockResolvedValue({ unexpected: true });

    render(<SupportTicketsView />);

    await waitFor(() => {
      expect(screen.getByText('Support tickets unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Support tickets response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No tickets found')).not.toBeInTheDocument();
  });
});
