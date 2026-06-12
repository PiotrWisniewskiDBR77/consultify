import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import toast from 'react-hot-toast';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: any, arg2?: any, arg3?: any) => {
      if (typeof arg2 === 'string') {
        if (arg3 && typeof arg3 === 'object') {
          return arg2.replaceAll('{{label}}', String((arg3 as any).label ?? ''));
        }
        return arg2;
      }
      return String(key);
    },
  }),
}));

const onToolSelect = vi.fn();
const setAIConfigMock = vi.fn();
let aiConfigState: any = {};

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    aiConfig: aiConfigState,
    setAIConfig: setAIConfigMock,
  }),
}));

import { ToolsMenu } from '../../../src/components/AIChat/ToolsMenu';

describe('ToolsMenu (L2)', () => {
  beforeEach(() => {
    onToolSelect.mockReset();
    setAIConfigMock.mockReset();
    (toast.success as any).mockClear?.();
    (toast.error as any).mockClear?.();
    aiConfigState = {
      deepResearch: false,
      webSearch: false,
      showReasoning: false,
      marketResearch: false,
      multiAgent: false,
      textToSpeech: true,
      responseStyle: 'normal',
      ttsRate: 1,
      ttsVoice: null,
      coThinkerMode: null,
    };

    globalThis.fetch = vi.fn(async (url: any, init?: any) => {
      if (String(url).includes('/api/ai-memory/custom_instructions')) {
        return { ok: true, json: async () => ({ success: true }) } as any;
      }
      return {
        ok: true,
        json: async () => ({
          memories: [{ key: 'custom_instructions', value: 'Be concise.' }],
        }),
      } as any;
    }) as any;

    (globalThis as any).SpeechSynthesisUtterance = class {
      rate = 1;
      lang = '';
      voice: any = null;
      constructor(public text: string) {}
    };

    const synth = {
      getVoices: () => [
        { name: 'Polish Voice', lang: 'pl-PL', voiceURI: 'pl' },
        { name: 'English Voice', lang: 'en-US', voiceURI: 'en' },
        { name: 'German Voice', lang: 'de-DE', voiceURI: 'de' },
      ],
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, writable: true });
  });

  it('toggles an AI mode and emits tool select', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' }));

    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: true });
    expect(onToolSelect).toHaveBeenCalledWith('toggle:showReasoning');
    expect(toast.success).toHaveBeenCalled();
  });

  it('supports response style selection via modal card grid', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));

    // Click "Response style" row to open the Grok-style modal
    fireEvent.click(screen.getByRole('button', { name: /response style|styl odpowiedzi/i }));

    // Find the concise card in the modal grid and click it
    const concise = await screen.findByRole('button', { name: /aiChat\.menu\.styles\.concise/i });
    fireEvent.click(concise);
    expect(setAIConfigMock).toHaveBeenCalledWith({ responseStyle: 'concise' });
    expect(onToolSelect).toHaveBeenCalledWith('style:concise');
  });

  it('loads and saves custom instructions via the style modal', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai-memory', expect.anything()));

    // Open the style modal (which now contains custom instructions)
    fireEvent.click(screen.getByRole('button', { name: /response style|styl odpowiedzi/i }));

    const textbox = await screen.findByRole('textbox');
    expect(textbox).toHaveValue('Be concise.');

    fireEvent.change(textbox, { target: { value: 'Always answer in Polish.' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz|save/i }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/ai-memory/custom_instructions',
        expect.objectContaining({ method: 'PUT' })
      )
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('opens TTS settings and allows speed/voice adjustments and voice test', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /voice settings|ustawienia głosu/i }));

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1.2' } });
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsRate: 1.2 });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pl' } });
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsVoice: 'pl' });
    expect(toast.success).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /formal/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsRate: 0.9, ttsPitch: 0.9 });

    fireEvent.click(screen.getByRole('button', { name: /test voice|testuj głos/i }));
    expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
  });

  it('does not open when disabled', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} disabled />);

    const trigger = screen.getByTestId('chat-tools-button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByText(/ai modes/i)).not.toBeInTheDocument();
  });

  it('toggling showReasoning twice flips it on then off', () => {
    const { rerender } = render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    setAIConfigMock.mockClear();

    const btn = screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' });
    fireEvent.click(btn);
    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: true });

    aiConfigState = { ...aiConfigState, showReasoning: true };
    rerender(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByTestId('chat-tools-button'));
    setAIConfigMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: false });
  });

  it('shows toast error when saving custom instructions fails', async () => {
    const userFetch = vi.fn(async (url: any, init?: any) => {
      if (String(url).includes('/api/ai-memory/custom_instructions') && init?.method === 'PUT') {
        throw new Error('fail');
      }
      return {
        ok: true,
        json: async () => ({
          memories: [{ key: 'custom_instructions', value: 'Be concise.' }],
        }),
      } as any;
    });
    globalThis.fetch = userFetch as any;

    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai-memory', expect.anything()));

    // Open style modal to access custom instructions
    fireEvent.click(screen.getByRole('button', { name: /response style|styl odpowiedzi/i }));

    const textbox = await screen.findByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz|save/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('closes the menu on outside click', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    expect(screen.getByText(/ai modes/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/ai modes/i)).not.toBeInTheDocument();
  });

  it('shows active mode badge and header count when modes are enabled', () => {
    aiConfigState = {
      ...aiConfigState,
      deepResearch: true,
      privateMode: true,
    };

    render(<ToolsMenu onToolSelect={onToolSelect} />);

    const trigger = screen.getByTestId('chat-tools-button');
    fireEvent.click(trigger);

    // deepResearch + privateMode + textToSpeech (enabled by default in this test setup)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/3.*active/i)).toBeInTheDocument();
  });

  it('blocks Add to project when there is no active conversation', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} hasActiveConversation={false} />);
    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /add to project/i }));

    expect(onToolSelect).toHaveBeenCalledWith('addToProject');
    expect(toast.error).toHaveBeenCalled();
  });

  it('applies response style preset into custom instructions', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /response style|styl odpowiedzi/i }));

    const analyst = await screen.findByRole('button', {
      name: /aiChat\.menu\.styles\.analyst/i,
    });
    fireEvent.click(analyst);

    const textbox = await screen.findByRole('textbox');
    expect(textbox).toHaveValue('aiChat.menu.stylePresets.analyst');
  });

  it('limits custom instructions to 1000 chars and resets to normal', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /response style|styl odpowiedzi/i }));

    const textbox = await screen.findByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'x'.repeat(1100) } });
    expect((textbox as HTMLTextAreaElement).value.length).toBe(1000);
    expect(screen.getByText(/1000\/1000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ responseStyle: 'normal' });
    expect((textbox as HTMLTextAreaElement).value).toBe('');
  });

  it('renders TTS settings only when textToSpeech is enabled', () => {
    aiConfigState = { ...aiConfigState, textToSpeech: false };
    const { rerender } = render(<ToolsMenu onToolSelect={onToolSelect} />);
    fireEvent.click(screen.getByTestId('chat-tools-button'));
    expect(screen.queryByText(/voice settings/i)).not.toBeInTheDocument();

    aiConfigState = { ...aiConfigState, textToSpeech: true };
    rerender(<ToolsMenu onToolSelect={onToolSelect} />);
    // Menu is still open (component state persists across rerender), so close and re-open.
    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByTestId('chat-tools-button'));
    expect(screen.getByText(/voice settings/i)).toBeInTheDocument();
  });

  it('voice test uses selected voice when available', () => {
    aiConfigState = { ...aiConfigState, textToSpeech: true, ttsVoice: 'en' };
    const speakSpy = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [
          { name: 'English Voice', lang: 'en-US', voiceURI: 'en' },
          { name: 'Polish Voice', lang: 'pl-PL', voiceURI: 'pl' },
        ],
        speak: speakSpy,
        cancel: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
    });

    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByText(/voice settings/i));
    fireEvent.click(screen.getByRole('button', { name: /test voice|testuj głos/i }));

    const utterance = speakSpy.mock.calls[0]?.[0];
    expect(utterance?.voice?.voiceURI).toBe('en');
    expect(utterance?.lang).toBe('en-US');
  });
});
