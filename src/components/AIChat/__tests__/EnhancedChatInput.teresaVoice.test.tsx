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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnhancedChatInput } from '../../../components/AIChat/EnhancedChatInput';

const toastError = vi.hoisted(() => vi.fn());

const renderInput = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

vi.mock('react-hot-toast', () => ({
  default: { error: toastError, custom: vi.fn(), success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallbackOrValues?: string | Record<string, unknown>) => {
      if (typeof fallbackOrValues === 'string') return fallbackOrValues;
      const values = fallbackOrValues || {};
      const messages: Record<string, string> = {
        'aiChat.attachments.imageBadge': 'Image',
        'aiChat.attachments.imagePreviewAlt': 'Preview of {{name}}',
        'aiChat.attachments.imageCountExceeded':
          'You can attach one image per message. Remove the current image to choose another.',
        'aiChat.attachments.imageSizeExceeded':
          'Image "{{name}}" exceeds the {{maxMb}} MB limit.',
      };
      return (messages[key] || key).replace(/\{\{(\w+)\}\}/g, (_match, name) =>
        String(values[name] ?? '')
      );
    },
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

vi.mock('../../../components/AIChat/AddFilesMenu', () => ({
  AddFilesMenu: ({ onFileSelect }: { onFileSelect: (files: File[]) => void }) => (
    <input
      data-testid="test-chat-file-picker"
      type="file"
      multiple
      onChange={(event) => onFileSelect(Array.from(event.currentTarget.files || []))}
    />
  ),
}));
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
  beforeEach(() => toastError.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it('rejects a pasted image before rendering an attachment chip', () => {
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const input = screen.getByRole('textbox');
    const image = new File(['png'], 'screen.png', { type: 'image/png' });

    fireEvent.paste(input, {
      clipboardData: {
        files: { length: 1, item: (index: number) => (index === 0 ? image : null) },
        getData: () => '',
      },
    });

    expect(toastError).toHaveBeenCalledWith(
      'Images are not supported yet. You can attach PDF, DOCX, TXT, MD, CSV, or JSON files.'
    );
    expect(screen.queryByText('screen.png')).not.toBeInTheDocument();
  });

  it('rejects a dropped image even when its filename has a supported extension', () => {
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const input = screen.getByRole('textbox');
    const image = new File(['png'], 'screen.txt', { type: 'image/png' });

    fireEvent.drop(input, {
      dataTransfer: {
        files: { length: 1, item: (index: number) => (index === 0 ? image : null) },
      },
    });

    expect(toastError).toHaveBeenCalledWith(
      'Images are not supported yet. You can attach PDF, DOCX, TXT, MD, CSV, or JSON files.'
    );
    expect(screen.queryByText('screen.txt')).not.toBeInTheDocument();
  });

  it('accepts a pasted image behind the flag, renders a thumbnail and sends the File', async () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:screen');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const onSend = vi.fn();
    const { unmount } = renderInput(
      <EnhancedChatInput onSend={onSend} teresaVoiceAvailable={false} />
    );
    const input = screen.getByRole('textbox');
    const image = new File(['png'], 'screen.png', { type: 'image/png' });

    fireEvent.paste(input, {
      clipboardData: {
        files: { length: 1, item: (index: number) => (index === 0 ? image : null) },
        getData: () => '',
      },
    });

    expect(await screen.findByAltText('Preview of screen.png')).toHaveAttribute(
      'src',
      'blob:screen'
    );
    const attachmentChip = screen.getByText('screen.png').closest('div');
    expect(attachmentChip).toHaveClass(
      'border-c-border',
      'bg-c-surface-raised',
      'text-c-text-secondary'
    );
    expect(attachmentChip?.className).not.toMatch(/(?:bg|text)-(?:slate|navy)-/);
    expect(screen.getByRole('button', { name: '×' })).toHaveClass(
      'text-c-text-muted',
      'hover:text-c-text'
    );
    await userEvent.type(input, 'Describe this{enter}');
    expect(onSend).toHaveBeenCalledWith('Describe this', [image]);
    expect(toastError).not.toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:screen'));
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('accepts a dropped image behind the flag and rejects an image above 5MB', async () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dropped');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const input = screen.getByRole('textbox');
    const image = new File(['png'], 'drop.webp', { type: 'image/webp' });

    fireEvent.drop(input, {
      dataTransfer: {
        files: { length: 1, item: (index: number) => (index === 0 ? image : null) },
      },
    });
    expect(await screen.findByAltText('Preview of drop.webp')).toBeInTheDocument();

    const oversized = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.paste(input, {
      clipboardData: {
        files: { length: 1, item: (index: number) => (index === 0 ? oversized : null) },
        getData: () => '',
      },
    });
    expect(toastError).toHaveBeenCalledWith('Image "huge.jpg" exceeds the 5 MB limit.');
    expect(screen.queryByText('huge.jpg')).not.toBeInTheDocument();
  });

  it('keeps one image from a multi-image picker selection while allowing a document', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:picked');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const first = new File(['1'], 'first.png', { type: 'image/png' });
    const second = new File(['2'], 'second.jpg', { type: 'image/jpeg' });
    const document = new File(['notes'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(screen.getByTestId('test-chat-file-picker'), {
      target: { files: [first, second, document] },
    });

    expect(screen.getByText('first.png')).toBeInTheDocument();
    expect(screen.queryByText('second.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      'You can attach one image per message. Remove the current image to choose another.'
    );
  });

  it('accepts only the first of two images pasted together', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pasted');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const first = new File(['1'], 'paste-one.webp', { type: 'image/webp' });
    const second = new File(['2'], 'paste-two.gif', { type: 'image/gif' });
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        files: {
          length: 2,
          item: (index: number) => [first, second][index] || null,
        },
        getData: () => '',
      },
    });

    expect(screen.getByText('paste-one.webp')).toBeInTheDocument();
    expect(screen.queryByText('paste-two.gif')).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      'You can attach one image per message. Remove the current image to choose another.'
    );
  });

  it('rejects a dropped second image while preserving the current image', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:current');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderInput(<EnhancedChatInput onSend={vi.fn()} teresaVoiceAvailable={false} />);
    const current = new File(['1'], 'current.png', { type: 'image/png' });
    const replacement = new File(['2'], 'replacement.png', { type: 'image/png' });
    const input = screen.getByRole('textbox');

    fireEvent.paste(input, {
      clipboardData: {
        files: { length: 1, item: () => current },
        getData: () => '',
      },
    });
    fireEvent.drop(input, {
      dataTransfer: {
        files: { length: 1, item: () => replacement },
      },
    });

    expect(screen.getByText('current.png')).toBeInTheDocument();
    expect(screen.queryByText('replacement.png')).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      'You can attach one image per message. Remove the current image to choose another.'
    );
  });

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
