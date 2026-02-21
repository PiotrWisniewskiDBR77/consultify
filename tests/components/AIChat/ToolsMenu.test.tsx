import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import toast from 'react-hot-toast';

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

    // Default fetch mock for custom instructions load/save.
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

    // Provide SpeechSynthesis so TTS submenu + test button are executable.
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
        { name: 'German Voice', lang: 'de-DE', voiceURI: 'de' }, // filtered out
      ],
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, writable: true });
  });

  it('toggles an AI mode and emits tool select (showReasoning syncs maxMode)', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' }));

    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: true });
    expect(setAIConfigMock).toHaveBeenCalledWith({ maxMode: true });
    expect(onToolSelect).toHaveBeenCalledWith('toggle:showReasoning');
    expect(toast.success).toHaveBeenCalled();
  });

  it('supports Co-Thinker toggles and response style selection', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /idea maker/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: 'idea_maker' });
    expect(onToolSelect).toHaveBeenCalledWith('cothinker:idea_maker');

    fireEvent.click(screen.getByRole('button', { name: /styl odpowiedzi/i }));
    const concise = await screen.findByRole('button', { name: /aiChat\.menu\.styles\.concise/i });
    fireEvent.click(concise);
    expect(setAIConfigMock).toHaveBeenCalledWith({ responseStyle: 'concise' });
    expect(onToolSelect).toHaveBeenCalledWith('style:concise');
  });

  it('loads and saves custom instructions via API', async () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai-memory', expect.anything()));

    fireEvent.click(screen.getByRole('button', { name: /moje instrukcje/i }));
    const textbox = screen.getByRole('textbox');
    expect(textbox).toHaveValue('Be concise.');

    fireEvent.change(textbox, { target: { value: 'Always answer in Polish.' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /ustawienia głosu/i }));

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1.2' } });
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsRate: 1.2 });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pl' } });
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsVoice: 'pl' });
    expect(toast.success).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /formal/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ ttsRate: 0.9, ttsPitch: 0.9 });

    fireEvent.click(screen.getByRole('button', { name: /testuj głos/i }));
    expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
  });

  it('does not open when disabled', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} disabled />);

    const trigger = screen.getByTestId('chat-tools-button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByText(/tryby ai/i)).not.toBeInTheDocument();
  });

  it('toggling showReasoning twice disables maxMode', () => {
    const { rerender } = render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    setAIConfigMock.mockClear();

    const btn = screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' });
    fireEvent.click(btn);
    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: true });
    expect(setAIConfigMock).toHaveBeenCalledWith({ maxMode: true });

    // Simulate store update so the second click truly toggles off.
    aiConfigState = { ...aiConfigState, showReasoning: true, maxMode: true };
    rerender(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByTestId('chat-tools-button'));
    setAIConfigMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'aiChat.menu.modes.showReasoning.label' }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ showReasoning: false });
    expect(setAIConfigMock).toHaveBeenCalledWith({ maxMode: false });
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

    fireEvent.click(screen.getByRole('button', { name: /moje instrukcje/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('closes the menu on outside click', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    expect(screen.getByText(/tryby ai/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/tryby ai/i)).not.toBeInTheDocument();
  });
});
