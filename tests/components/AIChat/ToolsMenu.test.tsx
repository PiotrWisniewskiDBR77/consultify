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

  it('supports Co-Thinker toggles and response style selection', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    fireEvent.click(screen.getByRole('button', { name: /idea maker/i }));
    expect(setAIConfigMock).toHaveBeenCalledWith({ coThinkerMode: 'idea_maker' });
    expect(onToolSelect).toHaveBeenCalledWith('cothinker:idea_maker');

    fireEvent.click(screen.getByRole('button', { name: /styl odpowiedzi/i }));
    fireEvent.click(screen.getByRole('button', { name: /aiChat\.menu\.styles\.concise/i }));
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

  it('closes the menu on outside click', () => {
    render(<ToolsMenu onToolSelect={onToolSelect} />);

    fireEvent.click(screen.getByTestId('chat-tools-button'));
    expect(screen.getByText(/tryby ai/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/tryby ai/i)).not.toBeInTheDocument();
  });
});
