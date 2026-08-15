import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
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
      expect(screen.getByText('Audit events backend down')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit events backend down')).toBeInTheDocument();
    expect(screen.getByText('Events unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No audit events found')).not.toBeInTheDocument();
    expect(screen.queryByText('0 events')).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText('Resource type')).toBeDisabled();
    expect(screen.getByPlaceholderText('Actor ID')).toBeDisabled();
  });

  it('renders malformed audit timestamps as unknown date instead of Invalid Date', async () => {
    vi.mocked(Api.getAuditEvents).mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          actor_id: 'admin-1',
          actor_type: 'admin',
          action: 'policy.update',
          resource_type: 'policy',
          resource_id: 'pol-1',
          metadata: { changed: true },
          created_at: 'not-a-date',
        },
      ],
      total: 1,
    });

    render(<AuditEventsViewer />);

    expect(await screen.findByText('policy.update')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('treats malformed audit response shape as degraded instead of empty events', async () => {
    vi.mocked(Api.getAuditEvents).mockResolvedValue({
      data: { id: 'evt-1', action: 'policy.update' },
      total: 'bad-total',
    });

    render(<AuditEventsViewer />);

    expect(await screen.findByText('Audit events response was not a list')).toBeInTheDocument();
    expect(screen.getByText('Audit events response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No audit events found')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN|bad-total/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped audit event payloads with nested totals', async () => {
    vi.mocked(Api.getAuditEvents).mockResolvedValue({
      data: {
        data: {
          events: [
            {
              id: 'evt-1',
              actor_id: 'admin-1',
              actor_type: 'admin',
              action: 'policy.update',
              resource_type: 'policy',
              resource_id: 'pol-1',
              metadata: { changed: true },
              created_at: 'not-a-date',
            },
          ],
          total: 1,
        },
      },
    });

    render(<AuditEventsViewer />);

    expect(await screen.findByText('policy.update')).toBeInTheDocument();
    expect(screen.getByText('1 event')).toBeInTheDocument();
    expect(screen.queryByText('No audit events found')).not.toBeInTheDocument();
  });
});
