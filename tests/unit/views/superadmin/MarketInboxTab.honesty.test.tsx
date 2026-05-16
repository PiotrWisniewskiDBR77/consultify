import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MarketInboxTab } from '@/views/superadmin/AIPlatformModule/Operations/MarketInboxTab';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getLLMMarketInbox: vi.fn(),
    syncOpenRouterMarket: vi.fn(),
    updateMarketInboxItem: vi.fn(),
    applyMarketInboxItem: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const inboxRow = {
  id: 'inbox-1',
  source: 'openrouter',
  change_type: 'model_added',
  model_id: 'openai/gpt-4o',
  provider_type: 'llm',
  origin_vendor: 'openai',
  status: 'new',
  created_at: '2026-04-26T10:00:00.000Z',
};

describe('MarketInboxTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMMarketInbox).mockResolvedValue({ inbox: [inboxRow] });
    vi.mocked(Api.syncOpenRouterMarket).mockResolvedValue({ success: true });
    vi.mocked(Api.updateMarketInboxItem).mockResolvedValue({ success: true });
    vi.mocked(Api.applyMarketInboxItem).mockResolvedValue({ success: true });
  });

  it('does not render market inbox load failures as an empty inbox with active sync', async () => {
    vi.mocked(Api.getLLMMarketInbox).mockRejectedValue(new Error('Market inbox down'));

    render(<MarketInboxTab />);

    await waitFor(() => {
      expect(screen.getByText('Market inbox unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Market inbox down')).toBeInTheDocument();
    expect(screen.queryByText('Inbox is empty.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync now/i })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('refetches inbox after sync, approve, and apply workflows', async () => {
    vi.mocked(Api.getLLMMarketInbox)
      .mockResolvedValueOnce({ inbox: [inboxRow] })
      .mockResolvedValueOnce({ inbox: [inboxRow] })
      .mockResolvedValueOnce({ inbox: [] })
      .mockResolvedValueOnce({ inbox: [{ ...inboxRow, status: 'approved' }] })
      .mockResolvedValueOnce({ inbox: [] });

    render(<MarketInboxTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync now/i }));
    await waitFor(() => {
      expect(Api.syncOpenRouterMarket).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(Api.getLLMMarketInbox).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: /Approve openai\/gpt-4o/i }));
    await waitFor(() => {
      expect(Api.updateMarketInboxItem).toHaveBeenCalledWith('inbox-1', { status: 'approved' });
    });
    await waitFor(() => {
      expect(Api.getLLMMarketInbox).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Apply openai\/gpt-4o/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply openai\/gpt-4o/i }));
    await waitFor(() => {
      expect(Api.applyMarketInboxItem).toHaveBeenCalledWith('inbox-1');
    });
    await waitFor(() => {
      expect(Api.getLLMMarketInbox).toHaveBeenCalledTimes(5);
    });
  });

  it('accepts deep wrapped inbox payloads', async () => {
    vi.mocked(Api.getLLMMarketInbox).mockResolvedValue({
      data: {
        data: {
          inbox: [inboxRow],
        },
      },
    });

    render(<MarketInboxTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    });
    expect(screen.queryByText('Market inbox unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed inbox payloads as an empty healthy inbox', async () => {
    vi.mocked(Api.getLLMMarketInbox).mockResolvedValue({ inbox: { unexpected: true } });

    render(<MarketInboxTab />);

    await waitFor(() => {
      expect(screen.getByText('Market inbox unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Market inbox response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Inbox is empty.')).not.toBeInTheDocument();
  });

  it('surfaces stale read-back after approval instead of reporting success', async () => {
    vi.mocked(Api.getLLMMarketInbox)
      .mockResolvedValueOnce({ inbox: [inboxRow] })
      .mockResolvedValueOnce({ inbox: [inboxRow] });

    render(<MarketInboxTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Approve openai\/gpt-4o/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Market inbox update was not confirmed by the server'
      );
    });
  });
});
