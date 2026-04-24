import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EnhancedChatInput } from '../EnhancedChatInput';

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastError,
    custom: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (_k: string, fallback?: string) => fallback || _k,
  }),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({ aiFreezeStatus: { isFrozen: false } }),
}));

vi.mock('../../../store/useConversationStore', () => ({
  useConversationStore: () => ({ activeConversationId: null, conversations: [] }),
}));

vi.mock('../../../hooks/useCloudIntegrations', () => ({
  useCloudIntegrations: () => ({
    connectedProviderIds: [],
    openFilePicker: vi.fn(),
    connectProvider: vi.fn(),
    isPickerOpen: false,
    activeProvider: null,
    closeFilePicker: vi.fn(),
    selectFile: vi.fn(),
    isImplemented: false,
  }),
}));

// Child UI components (not under test here)
vi.mock('../AddFilesMenu', () => ({ AddFilesMenu: () => null }));
vi.mock('../CloudFilePicker', () => ({ CloudFilePicker: () => null }));
vi.mock('../CoThinkerMenu', () => ({ CoThinkerMenu: () => null }));
vi.mock('../MoveToProjectModal', () => ({ MoveToProjectModal: () => null }));
vi.mock('../ToolsMenu', () => ({ ToolsMenu: () => null }));
vi.mock('../InputCharCounter', () => ({ InputCharCounter: () => null }));
vi.mock('../InputSoftLimitToast', () => ({ InputSoftLimitToast: () => null }));
vi.mock('../InputHintStrip', () => ({ InputHintStrip: () => null }));
vi.mock('../NextModelChip', () => ({ NextModelChip: () => null }));
vi.mock('../VoiceModeLegend', () => ({ VoiceModeLegend: () => null }));

describe('EnhancedChatInput (Teresa voice error UX)', () => {
  it('renders a retry button and emits a toast on error status', () => {
    const onTeresaVoiceToggle = vi.fn();

    render(
      <EnhancedChatInput
        onSend={vi.fn()}
        isStreaming={false}
        disabled={false}
        teresaVoiceStatus="error"
        teresaVoiceError="Missing GEMINI_API_KEY"
        onTeresaVoiceToggle={onTeresaVoiceToggle}
      />
    );

    const btn = screen.getByTitle(/Missing GEMINI_API_KEY/i);
    expect(btn).toBeTruthy();

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onTeresaVoiceToggle).toHaveBeenCalledTimes(1);

    expect(toastError).toHaveBeenCalledWith('Missing GEMINI_API_KEY');
  });
});
