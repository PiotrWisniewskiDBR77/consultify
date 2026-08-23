/**
 * @vitest-environment jsdom
 *
 * EnhancedChatInput — Teresa voice CTA (Module 01, P1-4).
 *
 * Asserts the composer's "talking Teresa" affordances:
 * - The voice button renders and fires `onTeresaVoiceToggle` when clicked.
 * - When voice is unavailable, the button is disabled and surfaces the reason.
 * - When voice is live, the button switches to a stop affordance.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EnhancedChatInput } from '../../../components/AIChat/EnhancedChatInput';

const renderInput = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), custom: vi.fn(), success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_k: string, fallback?: string) => fallback || _k,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({ aiFreezeStatus: { isFrozen: false } }),
}));

const conversationState = {
  activeConversationId: null,
  conversations: [],
  activeMessages: [],
};
vi.mock('../../../store/useConversationStore', () => ({
  useConversationStore: (selector?: (s: typeof conversationState) => unknown) =>
    selector ? selector(conversationState) : conversationState,
}));

const chatProjectState = { projects: [] };
vi.mock('../../../store/useChatProjectStore', () => ({
  useChatProjectStore: (selector?: (s: typeof chatProjectState) => unknown) =>
    selector ? selector(chatProjectState) : chatProjectState,
}));

vi.mock('../../../hooks/useKnowledgeSearch', () => ({
  useKnowledgeSearch: () => ({ data: [] }),
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

vi.mock('../../../components/AIChat/AddFilesMenu', () => ({ AddFilesMenu: () => null }));
vi.mock('../../../components/AIChat/CloudFilePicker', () => ({ CloudFilePicker: () => null }));
// M01-P05: `EnhancedChatInput` also renders `CoThinkerActivePill` (the active
// Co-Thinker persona indicator, added after this mock was written) right
// next to the voice CTA — an incomplete mock here isn't a stylistic gap, it
// crashes the render entirely ("No CoThinkerActivePill export is defined on
// the mock"), which took out all 3 assertions in this file with an error
// unrelated to voice. Both real exports are stubbed to `null` so the
// component tree still mounts; neither stub loosens any assertion below —
// they render nothing, so they can't satisfy or interfere with a
// `getByTitle`/`toHaveBeenCalledTimes` check on the voice button itself.
vi.mock('../../../components/AIChat/CoThinkerMenu', () => ({
  CoThinkerMenu: () => null,
  CoThinkerActivePill: () => null,
}));
vi.mock('../../../components/AIChat/MoveToProjectModal', () => ({
  MoveToProjectModal: () => null,
}));
vi.mock('../../../components/AIChat/ToolsMenu', () => ({ ToolsMenu: () => null }));
vi.mock('../../../components/AIChat/InputCharCounter', () => ({ InputCharCounter: () => null }));
vi.mock('../../../components/AIChat/InputSoftLimitToast', () => ({
  InputSoftLimitToast: () => null,
}));
vi.mock('../../../components/AIChat/InputHintStrip', () => ({ InputHintStrip: () => null }));
vi.mock('../../../components/AIChat/NextModelChip', () => ({ NextModelChip: () => null }));
vi.mock('../../../components/AIChat/VoiceModeLegend', () => ({ VoiceModeLegend: () => null }));

describe('EnhancedChatInput — Teresa voice CTA', () => {
  it('shows the restrained pulse only while the composer is empty, enabled and idle', async () => {
    const { container } = renderInput(
      <EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />
    );
    const composer = container.querySelector('[data-idle-pulse]');
    const input = screen.getByRole('textbox');
    expect(composer).toHaveAttribute('data-idle-pulse', 'true');
    expect(composer).toHaveClass('chat-composer-idle-pulse');

    fireEvent.focus(input);
    expect(composer).toHaveAttribute('data-idle-pulse', 'false');
    expect(composer).not.toHaveClass('chat-composer-idle-pulse');

    await userEvent.type(input, 'Client context');
    fireEvent.blur(input);
    expect(composer).toHaveAttribute('data-idle-pulse', 'false');

    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(composer).toHaveAttribute('data-idle-pulse', 'true');
  });

  it('never pulses when the composer is disabled', () => {
    const { container } = renderInput(
      <EnhancedChatInput onSend={vi.fn()} disabled teresaVoiceAvailable={false} />
    );
    const composer = container.querySelector('[data-idle-pulse]');
    expect(composer).toHaveAttribute('data-idle-pulse', 'false');
    expect(composer).not.toHaveClass('chat-composer-idle-pulse');
  });

  it('always exposes an accessible Send button and dispatches Enter', async () => {
    const onSend = vi.fn();
    renderInput(<EnhancedChatInput onSend={onSend} teresaVoiceAvailable={false} />);

    const send = screen.getByRole('button', { name: 'Send' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Keep this a presentation{enter}');
    expect(onSend).toHaveBeenCalledWith('Keep this a presentation', undefined);
  });

  it('uses Shift+Enter for a newline without dispatching', async () => {
    const onSend = vi.fn();
    renderInput(<EnhancedChatInput onSend={onSend} teresaVoiceAvailable={false} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'NPV{shift>}{enter}{/shift}scenario');
    expect(onSend).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toBe('NPV\nscenario');
  });

  it('renders the voice button and fires onTeresaVoiceToggle when clicked', async () => {
    const onTeresaVoiceToggle = vi.fn();
    renderInput(
      <EnhancedChatInput
        onSend={vi.fn()}
        onTeresaVoiceToggle={onTeresaVoiceToggle}
        teresaVoiceAvailable
        teresaVoiceStatus="idle"
      />
    );

    const button = screen.getByTitle('Start voice conversation with Teresa');
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(button);
    expect(onTeresaVoiceToggle).toHaveBeenCalledTimes(1);
  });

  it('disables voice with product-safe guidance without leaking provider diagnostics', () => {
    renderInput(
      <EnhancedChatInput
        onSend={vi.fn()}
        onTeresaVoiceToggle={vi.fn()}
        teresaVoiceAvailable={false}
        teresaVoiceStatus="idle"
        teresaVoiceUnavailableReason="Voice needs a server key"
      />
    );

    const button = screen.getByRole('button', {
      name: 'Voice is unavailable. You can continue by text or dictation.',
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button).toHaveAttribute(
      'title',
      'Voice is unavailable. You can continue by text or dictation.'
    );
    expect(screen.queryByText('Voice needs a server key')).not.toBeInTheDocument();
  });

  it('switches to a stop affordance while voice is live', async () => {
    const onTeresaVoiceToggle = vi.fn();
    renderInput(
      <EnhancedChatInput
        onSend={vi.fn()}
        onTeresaVoiceToggle={onTeresaVoiceToggle}
        teresaVoiceAvailable
        teresaVoiceStatus="live"
      />
    );

    const stopButton = screen.getByTitle('Stop voice conversation');
    expect(stopButton).toBeTruthy();

    await userEvent.click(stopButton);
    expect(onTeresaVoiceToggle).toHaveBeenCalledTimes(1);
  });
});
