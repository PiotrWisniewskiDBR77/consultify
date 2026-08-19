/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { EnhancedChatInput } from '../../../src/components/AIChat/EnhancedChatInput';

const makeQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

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
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_k: string, fallback?: string) => fallback || _k,
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ aiFreezeStatus: { isFrozen: false } }),
}));

const conversationState = { activeConversationId: null, conversations: [], activeMessages: [] };
vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: (s: typeof conversationState) => unknown) =>
    selector ? selector(conversationState) : conversationState,
}));

const chatProjectState = { projects: [] };
vi.mock('../../../src/store/useChatProjectStore', () => ({
  useChatProjectStore: (selector?: (s: typeof chatProjectState) => unknown) =>
    selector ? selector(chatProjectState) : chatProjectState,
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
vi.mock('../../../src/components/AIChat/CoThinkerMenu', () => ({
  CoThinkerMenu: () => null,
  CoThinkerActivePill: () => null,
}));
vi.mock('../../../src/components/AIChat/MoveToProjectModal', () => ({ MoveToProjectModal: () => null }));
vi.mock('../../../src/components/AIChat/ToolsMenu', () => ({ ToolsMenu: () => null }));
vi.mock('../../../src/components/AIChat/InputCharCounter', () => ({ InputCharCounter: () => null }));
vi.mock('../../../src/components/AIChat/InputSoftLimitToast', () => ({ InputSoftLimitToast: () => null }));
vi.mock('../../../src/components/AIChat/InputHintStrip', () => ({ InputHintStrip: () => null }));
vi.mock('../../../src/components/AIChat/NextModelChip', () => ({ NextModelChip: () => null }));
vi.mock('../../../src/components/AIChat/VoiceModeLegend', () => ({ VoiceModeLegend: () => null }));

describe('EnhancedChatInput Teresa toast lifecycle', () => {
  it('preserves the text and attachments when message transport rejects', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('transport unavailable'));
    render(<EnhancedChatInput onSend={onSend} />, { wrapper: makeQueryWrapper() });

    const attachment = new File(['evidence'], 'evidence.txt', { type: 'text/plain' });
    act(() => {
      addFilesMenuPropsRef.current.onFileSelect([attachment]);
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Do not lose this Teresa draft' },
    });
    fireEvent.click(screen.getByTestId('chat-send-btn'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Do not lose this Teresa draft', [attachment]));
    expect(screen.getByRole('textbox')).toHaveValue('Do not lose this Teresa draft');
    expect(screen.getByText('evidence.txt')).toBeInTheDocument();
  });

  it('clears the composer only after message transport succeeds', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<EnhancedChatInput onSend={onSend} />, { wrapper: makeQueryWrapper() });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Send this draft' } });
    fireEvent.click(screen.getByTestId('chat-send-btn'));

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(onSend).toHaveBeenCalledWith('Send this draft', undefined);
  });

  it('re-emits same Teresa error toast after leaving error state', () => {
    toastErrorMock.mockReset();
    const props = {
      onSend: vi.fn(),
      isStreaming: false,
      disabled: false,
      onTeresaVoiceToggle: vi.fn(),
    };

    const view = render(
      <EnhancedChatInput {...props} teresaVoiceStatus="error" teresaVoiceError="boom" />,
      { wrapper: makeQueryWrapper() }
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
    render(<EnhancedChatInput onSend={onSend} />, { wrapper: makeQueryWrapper() });

    expect(addFilesMenuPropsRef.current).toBeTruthy();
    expect(typeof addFilesMenuPropsRef.current.onUrlAdd).toBe('function');
    expect(typeof addFilesMenuPropsRef.current.onFileSelect).toBe('function');
  });
});
