/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import CustomerCommunicationView from '../../../src/views/superadmin/customers/CustomerCommunicationView';
import Api from '../../../src/services/api';

vi.mock('../../../src/services/api', () => ({
  __esModule: true,
  default: {
    getCommunications: vi.fn(),
    getCommunicationStats: vi.fn(),
    createCommunication: vi.fn(),
    sendCommunication: vi.fn(),
  },
}));

vi.mock('../../../src/components/shared/InfoButton', () => ({
  InfoButton: () => <div>InfoButton</div>,
}));

describe('CustomerCommunicationView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders governed communication stats from the existing stats contract', async () => {
    vi.mocked(Api.getCommunications).mockResolvedValue([
      {
        id: 'comm-1',
        type: 'email',
        subject: 'Quarterly update',
        recipients_filter: JSON.stringify({ audience: 'all' }),
        recipient_count: 100,
        sent_at: '2026-03-26T10:00:00.000Z',
        status: 'sent',
        open_count: 48,
        click_count: 12,
        created_at: '2026-03-26T09:00:00.000Z',
      },
    ] as any);
    vi.mocked(Api.getCommunicationStats).mockResolvedValue({
      total: 7,
      sent: 5,
      avg_open_rate: 42.4,
    } as any);

    render(<CustomerCommunicationView />);

    await waitFor(() => {
      expect(Api.getCommunications).toHaveBeenCalledTimes(1);
      expect(Api.getCommunicationStats).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByTestId('communication-stat-total')).toHaveTextContent('7');
    expect(screen.getByTestId('communication-stat-sent')).toHaveTextContent('5');
    expect(screen.getByTestId('communication-stat-open-rate')).toHaveTextContent('42%');
    expect(screen.getByText('Quarterly update')).toBeInTheDocument();
  });
});
