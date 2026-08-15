import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminCollaborationControlsPanel } from '@/components/Admin/AdminCollaborationControlsPanel';
import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) =>
  (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));

vi.mock('@/services/api', () => ({
  Api: {
    getAdminCollaborationControls: vi.fn(),
    updateAdminCollaborationControls: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminCollaborationControlsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads controls and merges omitted values with defaults', async () => {
    vi.mocked(Api.getAdminCollaborationControls).mockResolvedValueOnce({
      controls: { guestAccessEnabled: true },
    });
    vi.mocked(Api.updateAdminCollaborationControls).mockResolvedValueOnce({ success: true });

    render(<AdminCollaborationControlsPanel />);

    expect(Api.getAdminCollaborationControls).toHaveBeenCalledTimes(1);
    const saveButton = await screen.findByRole('button', { name: /Save controls/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(Api.updateAdminCollaborationControls).toHaveBeenCalledWith({
        guestAccessEnabled: true,
        externalLinkSharing: false,
        toolApprovalRequired: true,
      });
    });
  });

  it('updates the targeted toggle and keeps other values unchanged', async () => {
    vi.mocked(Api.getAdminCollaborationControls).mockResolvedValueOnce({
      controls: {
        guestAccessEnabled: false,
        externalLinkSharing: false,
        toolApprovalRequired: true,
      },
    });
    vi.mocked(Api.updateAdminCollaborationControls).mockResolvedValueOnce({ success: true });

    const { container } = render(<AdminCollaborationControlsPanel />);
    await screen.findByRole('button', { name: /Save controls/i });

    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /Save controls/i }));

    await waitFor(() => {
      expect(Api.updateAdminCollaborationControls).toHaveBeenCalledWith({
        guestAccessEnabled: false,
        externalLinkSharing: true,
        toolApprovalRequired: true,
      });
    });
  });
});
