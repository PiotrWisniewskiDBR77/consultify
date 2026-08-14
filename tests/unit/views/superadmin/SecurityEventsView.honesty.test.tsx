import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SecurityEventsView } from '@/views/superadmin/security/SecurityEventsView';

vi.mock('@/services/api', () => ({
  Api: {
    getSecurityEvents: vi.fn(),
    resolveSecurityEvent: vi.fn(),
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

describe('SecurityEventsView honest UI', () => {
  const openResolveAction = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Resolve event' }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed event loads as an empty event table', async () => {
    vi.mocked(Api.getSecurityEvents).mockRejectedValue(new Error('Security events API down'));

    render(<SecurityEventsView />);

    await waitFor(() => {
      expect(screen.getByText('Security events unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Security events API down')).toBeInTheDocument();
    expect(screen.queryByText('No security events found')).not.toBeInTheDocument();
  });

  it('uses safe dates and does not claim resolve success on stale read-back', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue([
      {
        id: 'event-1',
        created_at: 'not-a-date',
        event_type: 'LOGIN_FAILED',
        severity: 'high',
        resolved: false,
      },
    ]);
    vi.mocked(Api.resolveSecurityEvent).mockResolvedValue({ success: true });

    render(<SecurityEventsView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
    openResolveAction();

    await waitFor(() => {
      expect(
        screen.getByText('Security event resolution was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not claim resolve success when read-back is unavailable', async () => {
    vi.mocked(Api.getSecurityEvents)
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          created_at: '2026-04-26T00:00:00.000Z',
          event_type: 'LOGIN_FAILED',
          severity: 'high',
          resolved: false,
        },
      ])
      .mockRejectedValueOnce(new Error('Read-back failed'));
    vi.mocked(Api.resolveSecurityEvent).mockResolvedValue({ success: true });

    render(<SecurityEventsView />);

    await screen.findByText('LOGIN_FAILED');
    openResolveAction();

    await waitFor(() => {
      expect(
        screen.getByText('Security event resolution was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('renders malformed event fields with safe fallbacks', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue([
      {
        id: 'event-1',
        created_at: 'not-a-date',
        event_type: null,
        severity: null,
        ip_address: null,
        location_city: null,
        location_country: null,
        resolved: true,
      },
    ]);

    render(<SecurityEventsView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
    expect(screen.getByText('Unknown event')).toBeInTheDocument();
    expect(screen.getByText('unknown')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('accepts nested wrapped event payloads', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue({
      data: {
        data: {
          events: [
            {
              id: 'event-1',
              created_at: 'not-a-date',
              event_type: 'LOGIN_FAILED',
              severity: 'high',
              resolved: false,
            },
          ],
        },
      },
    });

    render(<SecurityEventsView />);

    expect(await screen.findByText('LOGIN_FAILED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('does not treat string false resolved values as resolved', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue([
      {
        id: 'event-1',
        created_at: '2026-04-26T00:00:00.000Z',
        event_type: 'LOGIN_FAILED',
        severity: 'high',
        resolved: 'false',
      },
    ]);

    render(<SecurityEventsView />);

    expect(await screen.findByText('Open')).toBeInTheDocument();
    const row = screen.getByText('LOGIN_FAILED').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByText('Resolved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });
});
