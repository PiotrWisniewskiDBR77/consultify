import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerCommunicationView from '@/views/superadmin/customers/CustomerCommunicationView';

vi.mock('@/services/api', () => ({
  default: {
    createCommunication: vi.fn(),
    getCommunicationStats: vi.fn(),
    getCommunications: vi.fn(),
    sendCommunication: vi.fn(),
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

vi.mock('@/components/shared/CommunicationSurfaceModelPanel', () => ({
  CommunicationSurfaceModelPanel: () => <div data-testid="communication-surface" />,
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

describe('CustomerCommunicationView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render communication load failures as zero stats', async () => {
    vi.mocked(Api.getCommunications).mockRejectedValue(new Error('Communications API down'));
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 0, sent: 0, avg_open_rate: 0 });

    render(<CustomerCommunicationView />);

    await waitFor(() => {
      expect(screen.getByText('Customer communications unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Communications API down')).toBeInTheDocument();
    expect(screen.queryByText('No communications sent yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Total messages')).not.toBeInTheDocument();
  });

  it('does not close compose when send read-back is stale', async () => {
    vi.mocked(Api.getCommunications).mockResolvedValue([]);
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 0, sent: 0, avg_open_rate: 0 });
    vi.mocked(Api.createCommunication).mockResolvedValue({ success: true, id: 'comm-1' });
    vi.mocked(Api.sendCommunication).mockResolvedValue({ success: true });

    render(<CustomerCommunicationView />);

    await screen.findByText('No communications sent yet');
    fireEvent.click(screen.getByRole('button', { name: /New Message/i }));
    fireEvent.change(screen.getByPlaceholderText('Message subject...'), {
      target: { value: 'Hello customers' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write your message...'), {
      target: { value: 'Important update.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByText('Communication send was not confirmed by the server')).toBeInTheDocument();
    });

    expect(screen.getByText('Compose Email')).toBeInTheDocument();
  });

  it('does not send or close compose when communication creation is not confirmed', async () => {
    vi.mocked(Api.getCommunications).mockResolvedValue([
      {
        id: 'comm-old',
        type: 'email',
        subject: 'Hello customers',
        sent_at: '2026-01-01',
        status: 'sent',
        created_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 1, sent: 1, avg_open_rate: 0 });
    vi.mocked(Api.createCommunication).mockResolvedValue({ success: false });

    render(<CustomerCommunicationView />);

    await screen.findByText('Hello customers');
    fireEvent.click(screen.getByRole('button', { name: /New Message/i }));
    fireEvent.change(screen.getByPlaceholderText('Message subject...'), {
      target: { value: 'Hello customers' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write your message...'), {
      target: { value: 'Important update.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Communication creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(Api.sendCommunication).not.toHaveBeenCalled();
    expect(screen.getByText('Compose Email')).toBeInTheDocument();
  });

  it('does not accept a matching subject as send read-back confirmation', async () => {
    vi.mocked(Api.getCommunications)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'comm-old',
          type: 'email',
          subject: 'Hello customers',
          sent_at: '2026-01-01',
          status: 'sent',
          created_at: '2026-01-01',
        },
      ]);
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 1, sent: 1, avg_open_rate: 0 });
    vi.mocked(Api.createCommunication).mockResolvedValue({ success: true, id: 'comm-new' });
    vi.mocked(Api.sendCommunication).mockResolvedValue({ success: true });

    render(<CustomerCommunicationView />);

    await screen.findByText('No communications sent yet');
    fireEvent.click(screen.getByRole('button', { name: /New Message/i }));
    fireEvent.change(screen.getByPlaceholderText('Message subject...'), {
      target: { value: 'Hello customers' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write your message...'), {
      target: { value: 'Important update.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByText('Communication send was not confirmed by the server')).toBeInTheDocument();
    });

    expect(screen.getByText('Compose Email')).toBeInTheDocument();
  });

  it('renders invalid sent dates as Unknown date', async () => {
    vi.mocked(Api.getCommunications).mockResolvedValue([
      {
        id: 'comm-1',
        type: 'email',
        subject: 'Bad date',
        sent_at: 'not-a-date',
        status: 'sent',
        created_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 1, sent: 1, avg_open_rate: 0 });

    render(<CustomerCommunicationView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped communications, stats, and nested create responses', async () => {
    vi.mocked(Api.getCommunications)
      .mockResolvedValueOnce({
        data: {
          data: {
            communications: [
              {
                id: 'comm-1',
                type: 'email',
                subject: 'Wrapped message',
                sent_at: 'not-a-date',
                status: 'sent',
                recipient_count: 'bad-count',
                open_count: 'bad-open',
                created_at: '2026-01-01',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            communications: [
              {
                id: 'comm-2',
                type: 'email',
                subject: 'Hello customers',
                sent_at: '2026-01-01',
                status: 'sent',
                created_at: '2026-01-01',
              },
            ],
          },
        },
      });
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({
      data: { data: { total: 'bad-total', sent: 1, avg_open_rate: 'bad-rate' } },
    });
    vi.mocked(Api.createCommunication).mockResolvedValue({
      data: { data: { communication: { id: 'comm-2' } } },
    });
    vi.mocked(Api.sendCommunication).mockResolvedValue({ success: true });

    const { container } = render(<CustomerCommunicationView />);

    expect(await screen.findByText('Wrapped message')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('bad-');

    fireEvent.click(screen.getByRole('button', { name: /New Message/i }));
    fireEvent.change(screen.getByPlaceholderText('Message subject...'), {
      target: { value: 'Hello customers' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write your message...'), {
      target: { value: 'Important update.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Compose Email')).not.toBeInTheDocument();
    });
    expect(Api.sendCommunication).toHaveBeenCalledWith('comm-2');
    expect(screen.getByText('Hello customers')).toBeInTheDocument();
  });

  it('does not render malformed communications payloads as empty communications', async () => {
    vi.mocked(Api.getCommunications).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({ total: 0, sent: 0, avg_open_rate: 0 });

    render(<CustomerCommunicationView />);

    await waitFor(() => {
      expect(screen.getByText('Customer communications unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Communications response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No communications sent yet')).not.toBeInTheDocument();
  });
});
