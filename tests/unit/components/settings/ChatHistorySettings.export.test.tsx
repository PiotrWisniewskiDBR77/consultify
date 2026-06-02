import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChatHistorySettings from '@/components/settings/ChatHistorySettings';
import { Api } from '@/services/api';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    clearChatHistory: vi.fn(),
    exportChatHistory: vi.fn(),
  },
}));

describe('ChatHistorySettings export and clear governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.clearChatHistory).mockResolvedValue({ success: true } as any);
    vi.mocked(Api.exportChatHistory).mockResolvedValue(new Blob(['{}'], { type: 'application/json' }) as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        (element as HTMLAnchorElement).click = vi.fn();
      }
      return element;
    }) as any);
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows coded error when export fails', async () => {
    const codedError = Object.assign(new Error('Export failed'), {
      data: { code: 'CHAT_HISTORY_EXPORT_FAILED' },
    });
    vi.mocked(Api.exportChatHistory).mockRejectedValueOnce(codedError);
    render(<ChatHistorySettings />);

    fireEvent.click(screen.getByRole('button', { name: /Export History/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to export history (CHAT_HISTORY_EXPORT_FAILED)'
      );
    });
  });

  it('does not call clear API when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockImplementationOnce(() => false);
    render(<ChatHistorySettings />);

    fireEvent.click(screen.getByRole('button', { name: /Clear All History/i }));
    await waitFor(() => {
      expect(Api.clearChatHistory).not.toHaveBeenCalled();
    });
  });

  it('shows coded error when clear fails', async () => {
    const codedError = Object.assign(new Error('Clear failed'), {
      data: { code: 'CHAT_HISTORY_CLEAR_FAILED' },
    });
    vi.mocked(Api.clearChatHistory).mockRejectedValueOnce(codedError);
    render(<ChatHistorySettings />);

    fireEvent.click(screen.getByRole('button', { name: /Clear All History/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to clear history (CHAT_HISTORY_CLEAR_FAILED)'
      );
    });
  });
});
