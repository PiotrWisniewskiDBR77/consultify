import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceSettings } from '@/components/settings/VoiceSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/services/api', () => ({
  Api: {
    getAIVoice: vi.fn(),
    saveAIVoice: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

const preferences = {
  ttsEnabled: false,
  sttEnabled: false,
  voice: 'alloy',
  speed: 1,
  autoPlay: false,
};

describe('VoiceSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed voice loads as editable defaults', async () => {
    vi.mocked(Api.getAIVoice).mockRejectedValue(new Error('Voice API down'));

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.getByText('Voice settings unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Voice API down')).toBeInTheDocument();
    expect(screen.queryByText('Voice & TTS')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale voice preferences', async () => {
    vi.mocked(Api.getAIVoice)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.saveAIVoice).mockResolvedValue({ success: true });

    render(<VoiceSettings />);

    await screen.findByText('Voice & TTS');
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Voice settings save was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
