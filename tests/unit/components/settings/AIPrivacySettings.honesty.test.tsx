import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIPrivacySettings } from '@/components/settings/AIPrivacySettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAIPrivacyPreferences: vi.fn(),
    saveAIPrivacyPreferences: vi.fn(),
  },
}));

const initialPreferences = {
  allowProjectData: true,
  allowClientData: true,
  allowFinancialData: false,
  allowPersonalNotes: false,
  optOutTraining: true,
  dataRetention: '30d',
  auditLogEnabled: true,
  anonymizeExports: false,
};

describe('AIPrivacySettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIPrivacyPreferences).mockResolvedValue({ preferences: initialPreferences });
    vi.mocked(Api.saveAIPrivacyPreferences).mockResolvedValue({ success: true });
  });

  it('does not render failed AI privacy loads as editable default privacy controls', async () => {
    vi.mocked(Api.getAIPrivacyPreferences).mockRejectedValue(new Error('AI privacy backend down'));

    render(<AIPrivacySettings />);

    await waitFor(() => {
      expect(screen.getByText('AI privacy settings unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Data Access Scope')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not show success when save read-back returns stale AI privacy settings', async () => {
    vi.mocked(Api.getAIPrivacyPreferences)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({ preferences: initialPreferences });

    render(<AIPrivacySettings />);

    await waitFor(() => {
      expect(screen.getByText('Financial Data')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('switch')[2]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'AI privacy settings were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('AI privacy settings saved');
  });

  it('shows success only after AI privacy settings are confirmed by read-back', async () => {
    vi.mocked(Api.getAIPrivacyPreferences)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({
        preferences: { ...initialPreferences, allowFinancialData: true },
      });

    render(<AIPrivacySettings />);

    await waitFor(() => {
      expect(screen.getByText('Financial Data')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('switch')[2]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('AI privacy settings saved');
    });
  });
});
