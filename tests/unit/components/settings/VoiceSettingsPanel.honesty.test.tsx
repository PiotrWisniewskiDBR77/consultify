import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { VoiceSettingsPanel } from '@/components/settings/VoiceSettingsPanel';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const initialSettings = {
  inputMode: 'click-to-talk',
  autoSendDelay: 1.5,
  ttsVoice: 'nova',
  ttsSpeed: 1,
  ttsProvider: 'openai',
  sttProvider: 'whisper',
  autoSpeakResponses: true,
  language: 'pl',
  showLiveTranscript: true,
};

describe('VoiceSettingsPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue(initialSettings);
    vi.mocked(Api.post).mockResolvedValue({ success: true });
  });

  it('does not render failed voice setting loads as editable defaults', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Voice backend down'));

    render(<VoiceSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Voice settings unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Input Mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Voice Settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test/i })).toBeDisabled();
  });

  it('shows a save error when voice settings read-back is stale', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce(initialSettings)
      .mockResolvedValueOnce(initialSettings);

    render(<VoiceSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /push to talk/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /push to talk/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Voice Settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Voice settings were not confirmed by the server'
      );
    });
  });

  it('updates parent only after voice settings are confirmed by read-back', async () => {
    const onSettingsChange = vi.fn();
    vi.mocked(Api.get)
      .mockResolvedValueOnce(initialSettings)
      .mockResolvedValueOnce({ ...initialSettings, inputMode: 'push-to-talk' });

    render(<VoiceSettingsPanel onSettingsChange={onSettingsChange} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /push to talk/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /push to talk/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Voice Settings/i }));

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ inputMode: 'push-to-talk' })
      );
    });
  });
});
