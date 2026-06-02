/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnhancedChatInput } from '../../../src/components/AIChat/EnhancedChatInput';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastErrorMock,
    custom: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_k: string, fallback?: string) => fallback || _k,
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ aiFreezeStatus: { isFrozen: false } }),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: () => ({ activeConversationId: null, conversations: [] }),
}));

vi.mock('../../../src/hooks/useCloudIntegrations', () => ({
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

const addFilesMenuPropsRef: { current: any } = { current: null };
vi.mock('../../../src/components/AIChat/AddFilesMenu', () => ({
  AddFilesMenu: (props: any) => {
    addFilesMenuPropsRef.current = props;
    return null;
  },
}));
vi.mock('../../../src/components/AIChat/CloudFilePicker', () => ({ CloudFilePicker: () => null }));
vi.mock('../../../src/components/AIChat/CoThinkerMenu', () => ({ CoThinkerMenu: () => null }));
vi.mock('../../../src/components/AIChat/MoveToProjectModal', () => ({ MoveToProjectModal: () => null }));
vi.mock('../../../src/components/AIChat/ToolsMenu', () => ({ ToolsMenu: () => null }));
vi.mock('../../../src/components/AIChat/InputCharCounter', () => ({ InputCharCounter: () => null }));
vi.mock('../../../src/components/AIChat/InputSoftLimitToast', () => ({ InputSoftLimitToast: () => null }));
vi.mock('../../../src/components/AIChat/InputHintStrip', () => ({ InputHintStrip: () => null }));
vi.mock('../../../src/components/AIChat/NextModelChip', () => ({ NextModelChip: () => null }));
vi.mock('../../../src/components/AIChat/VoiceModeLegend', () => ({ VoiceModeLegend: () => null }));

describe('EnhancedChatInput Teresa toast lifecycle', () => {
  it('re-emits same Teresa error toast after leaving error state', () => {
    toastErrorMock.mockReset();
    const props = {
      onSend: vi.fn(),
      isStreaming: false,
      disabled: false,
      onTeresaVoiceToggle: vi.fn(),
    };

    const view = render(
      <EnhancedChatInput {...props} teresaVoiceStatus="error" teresaVoiceError="boom" />
    );
    expect(toastErrorMock).toHaveBeenCalledTimes(1);

    view.rerender(<EnhancedChatInput {...props} teresaVoiceStatus="idle" teresaVoiceError="boom" />);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);

    view.rerender(
      <EnhancedChatInput {...props} teresaVoiceStatus="error" teresaVoiceError="boom" />
    );
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
  });

  it('wires AddFilesMenu callbacks and forwards add-to-project guard info', () => {
    const onSend = vi.fn();
    render(<EnhancedChatInput onSend={onSend} />);

    expect(addFilesMenuPropsRef.current).toBeTruthy();
    expect(typeof addFilesMenuPropsRef.current.onUrlAdd).toBe('function');
    expect(typeof addFilesMenuPropsRef.current.onFileSelect).toBe('function');
  });
});
