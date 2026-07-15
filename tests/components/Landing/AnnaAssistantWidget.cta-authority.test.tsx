/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLiveConnect = vi.fn(async ({ callbacks }: { callbacks?: { onopen?: () => void } }) => {
  callbacks?.onopen?.();
  return {
    close: vi.fn(),
    sendClientContent: vi.fn(),
    sendRealtimeInput: vi.fn(),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    live = {
      connect: mockLiveConnect,
    };
  },
  Modality: {
    AUDIO: 'audio',
  },
}));

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { AnnaAssistantWidget } from '../../../src/components/Landing/AnnaAssistantWidget';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderWidget(
  props?: Partial<React.ComponentProps<typeof AnnaAssistantWidget>>
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AnnaAssistantWidget {...props} />
    </I18nextProvider>,
  );
}

describe('AnnaAssistantWidget CTA authority', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.defineProperty(i18n, 'language', { configurable: true, value: 'en' });
    Object.defineProperty(i18n, 'resolvedLanguage', { configurable: true, value: 'en' });
    navigateMock.mockReset();
    mockLiveConnect.mockReset();
    mockLiveConnect.mockImplementation(async ({ callbacks }: { callbacks?: { onopen?: () => void } }) => {
      callbacks?.onopen?.();
      return {
        close: vi.fn(),
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
      };
    });
    sessionStorage.clear();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'anna-session-id' },
    });
  });

  function getTrackedEventNames() {
    return (
      JSON.parse(sessionStorage.getItem('funnel_events') || '[]') as Array<{ eventName: string }>
    ).map((entry) => entry.eventName);
  }

  it('routes demo, trial, and contact handoffs through shared callbacks when provided', () => {
    const onDemoClick = vi.fn();
    const onTrialClick = vi.fn();
    const onContactClick = vi.fn();

    renderWidget({ onDemoClick, onTrialClick, onContactClick });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Contact' }));

    expect(onDemoClick).toHaveBeenCalledTimes(1);
    expect(onTrialClick).toHaveBeenCalledTimes(1);
    expect(onContactClick).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(getTrackedEventNames()).toEqual([
      'landing_anna_widget_opened',
      'landing_anna_handoff_clicked',
      'landing_anna_widget_opened',
      'landing_anna_handoff_clicked',
      'landing_anna_widget_opened',
      'landing_anna_handoff_clicked',
    ]);
  });

  it('falls back to canonical public routes when shared callbacks are not provided', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Contact' }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/demo');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/trial');
    expect(navigateMock).toHaveBeenNthCalledWith(3, '/contact');
  });

  it('does not track another widget-open event when anna:open fires while the widget is already open', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    window.dispatchEvent(new Event('anna:open'));

    expect(getTrackedEventNames()).toEqual(['landing_anna_widget_opened']);
    expect(screen.getByRole('button', { name: 'Close Anna' })).toBeInTheDocument();
  });

  it('opens Anna with a prefilled guided-entry prompt when anna:open carries prompt detail', async () => {
    renderWidget();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('anna:open', {
          detail: { prompt: 'Is Consultify right for my team?' },
        }),
      );
    });

    await waitFor(() => {
      expect(getTrackedEventNames()).toEqual(['landing_anna_widget_opened']);
      expect(screen.getByRole('button', { name: 'Close Anna' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Ask Anna about the product...')).toHaveValue(
        'Is Consultify right for my team?',
      );
    });
  });

  it('surfaces the polite rate-limit message instead of collapsing to a generic error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({
              message:
                'Please wait a moment before sending another message. In the meantime, you can use the demo, trial, or contact options.',
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Tell me more about pricing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Please wait a moment before sending another message. In the meantime, you can use the demo, trial, or contact options.',
        ),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('I could not reach Anna. Please try again in a moment.')).not.toBeInTheDocument();
    expect(getTrackedEventNames()).toContain('landing_anna_message_sent');
    expect(getTrackedEventNames()).toContain('landing_anna_fallback_shown');
  });

  it('surfaces the English unsupported-language note from Anna when the visitor writes in another language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              message:
                'Anna currently supports full conversations in English, Polish, Spanish, German, Japanese, and Arabic. Please continue in one of those languages, or use the demo, trial, or contact options if you prefer.',
              language: 'en',
              fallbackReason: 'unsupported_language',
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: '안녕하세요, 가격을 알고 싶어요' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Anna currently supports full conversations in English, Polish, Spanish, German, Japanese, and Arabic. Please continue in one of those languages, or use the demo, trial, or contact options if you prefer.',
        ),
      ).toBeInTheDocument();
    });
    expect(getTrackedEventNames()).toContain('landing_anna_message_sent');
    expect(getTrackedEventNames()).toContain('landing_anna_fallback_shown');
  });

  it('surfaces a Spanish Anna reply on the visible landing widget path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              message:
                'Consultify ayuda a estructurar decisiones de transformacion y puede ser un buen punto de partida para un demo.',
              knowledgeSources: ['landing-doc'],
              matchedProducts: ['consultify'],
              primaryProducts: ['consultify'],
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Hola, quiero entender mejor Consultify' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Consultify ayuda a estructurar decisiones de transformacion y puede ser un buen punto de partida para un demo.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('surfaces a German Anna reply on the visible landing widget path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              message:
                'Consultify hilft dabei, Transformationsentscheidungen zu strukturieren und kann ein guter Ausgangspunkt fur ein Demo sein.',
              knowledgeSources: ['landing-doc'],
              matchedProducts: ['consultify'],
              primaryProducts: ['consultify'],
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Hallo, ich mochte Consultify besser verstehen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Consultify hilft dabei, Transformationsentscheidungen zu strukturieren und kann ein guter Ausgangspunkt fur ein Demo sein.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('surfaces a Japanese Anna reply on the visible landing widget path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              message:
                'Consultifyは変革の意思決定を構造化するのに役立ち、デモを始める良い出発点になります。',
              knowledgeSources: ['landing-doc'],
              matchedProducts: ['consultify'],
              primaryProducts: ['consultify'],
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'こんにちは、Consultifyについてもっと知りたいです' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Consultifyは変革の意思決定を構造化するのに役立ち、デモを始める良い出発点になります。',
        ),
      ).toBeInTheDocument();
    });
  });

  it('surfaces an Arabic Anna reply on the visible landing widget path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              message: 'يساعد Consultify على تنظيم قرارات التحول ويمكن أن يكون نقطة بداية جيدة لعرض تجريبي.',
              knowledgeSources: ['landing-doc'],
              matchedProducts: ['consultify'],
              primaryProducts: ['consultify'],
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'مرحبا، اريد فهم Consultify بشكل افضل' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'يساعد Consultify على تنظيم قرارات التحول ويمكن أن يكون نقطة بداية جيدة لعرض تجريبي.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows the static degraded-state fallback when the Anna request fails before reaching the backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Tell me about Consultify' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.',
        ),
      ).toBeInTheDocument();
    });
    expect(getTrackedEventNames()).toContain('landing_anna_message_sent');
    expect(getTrackedEventNames()).toContain('landing_anna_fallback_shown');
  });

  it('clears the stale transient error banner after close and reopen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const view = renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Tell me about Consultify' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.',
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close Anna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    expect(
      view.container.querySelector('.border-red-400\\/15.bg-red-500\\/10'),
    ).not.toBeInTheDocument();
  });

  it('clears the stale unsent draft after close and reopen', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Draft that should not survive reopen' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close Anna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    expect(screen.getByPlaceholderText('Ask Anna about the product...')).toHaveValue('');
  });

  it('ignores a late Anna reply from the previous visible session after close and reopen', async () => {
    let resolveChat:
      | ((value: { ok: boolean; status: number; json: () => Promise<{ message: string }> }) => void)
      | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/public/anna/chat')) {
          return new Promise((resolve) => {
            resolveChat = resolve as typeof resolveChat;
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'Tell me about Consultify' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('Anna is thinking...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Anna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    expect(screen.queryByText('Anna is thinking...')).not.toBeInTheDocument();

    await act(async () => {
      resolveChat?.({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Late Anna reply that should be ignored' }),
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('Late Anna reply that should be ignored')).not.toBeInTheDocument();
  });

  it('ignores a late voice onopen callback from the previous visible session after close and reopen', async () => {
    let deferredOnOpen: (() => void) | null = null;
    const lateSessionClose = vi.fn();

    mockLiveConnect.mockImplementationOnce(async ({ callbacks }: { callbacks?: { onopen?: () => void } }) => {
      deferredOnOpen = callbacks?.onopen ?? null;
      return {
        close: lateSessionClose,
        sendRealtimeInput: vi.fn(),
      };
    });

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/public/anna/voice-config')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ session: { clientToken: 'voice-test-key' }, enabled: true }),
          });
        }

        if (url.includes('/api/public/anna/voice-context')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ context: 'Voice context' }),
          });
        }

        if (url.includes('/api/public/anna/voice-event')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(screen.getByText('Tap the microphone to start a live voice conversation.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(screen.getByText('Connecting voice mode...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await act(async () => {
      deferredOnOpen?.();
      await Promise.resolve();
    });

    expect(
      screen.queryByText('Anna is listening live.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Tap the microphone to start a live voice conversation.')).toBeInTheDocument();
    expect(lateSessionClose).toHaveBeenCalled();
  });

  it('ignores a late voice onerror callback from the previous visible session after close and reopen', async () => {
    let deferredOnError: ((error: unknown) => void) | null = null;

    mockLiveConnect.mockImplementationOnce(
      async ({ callbacks }: { callbacks?: { onerror?: (error: unknown) => void } }) => {
        deferredOnError = callbacks?.onerror ?? null;
        return {
          close: vi.fn(),
          sendRealtimeInput: vi.fn(),
        };
      },
    );

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/public/anna/voice-config')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ session: { clientToken: 'voice-test-key' }, enabled: true }),
          });
        }

        if (url.includes('/api/public/anna/voice-context')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ context: 'Voice context' }),
          });
        }

        if (url.includes('/api/public/anna/voice-event')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(screen.getByText('Tap the microphone to start a live voice conversation.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(screen.getByText('Connecting voice mode...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await act(async () => {
      deferredOnError?.(new Error('late voice error'));
      await Promise.resolve();
    });

    expect(screen.queryByText('Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.')).not.toBeInTheDocument();
    expect(screen.getByText('Tap the microphone to start a live voice conversation.')).toBeInTheDocument();
  });

  it('keeps live voice transcripts in visible session history for the next typed follow-up', async () => {
    let deferredOnMessage: ((message: {
      serverContent?: {
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
      };
    }) => void) | null = null;

    mockLiveConnect.mockImplementationOnce(
      async ({
        callbacks,
      }: {
        callbacks?: {
          onopen?: () => void;
          onmessage?: (message: {
            serverContent?: {
              inputTranscription?: { text?: string };
              outputTranscription?: { text?: string };
            };
          }) => void;
        };
      }) => {
        deferredOnMessage = callbacks?.onmessage ?? null;
        callbacks?.onopen?.();
        return {
          close: vi.fn(),
          sendRealtimeInput: vi.fn(),
        };
      },
    );

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    let chatRequestBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/public/anna/voice-config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { clientToken: 'voice-test-key' }, voiceName: 'Aoede', enabled: true }),
        });
      }

      if (url.includes('/api/public/anna/voice-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ context: 'Voice context' }),
        });
      }

      if (url.includes('/api/public/anna/chat')) {
        chatRequestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ message: 'We can schedule that next.' }),
        });
      }

      if (url.includes('/api/public/anna/voice-event')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(screen.getByText('Tap the microphone to start a live voice conversation.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(
        screen.getByText('Anna is listening live.'),
      ).toBeInTheDocument();
    });

    expect(mockLiveConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        }),
      }),
    );

    await act(async () => {
      deferredOnMessage?.({
        serverContent: {
          inputTranscription: { text: 'I need help with onboarding.' },
        },
      });
      deferredOnMessage?.({
        serverContent: {
          outputTranscription: { text: 'We can start with a guided demo.' },
        },
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('I need help with onboarding.')).not.toBeInTheDocument();
    expect(screen.queryByText('We can start with a guided demo.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'And what about pricing?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(chatRequestBody).not.toBeNull();
    });

    expect(chatRequestBody).toMatchObject({
      message: 'And what about pricing?',
      history: [],
    });
  });

  it('seeds the current typed session history into live voice bootstrap', async () => {
    const sendClientContent = vi.fn();

    mockLiveConnect.mockImplementationOnce(async ({ callbacks }: { callbacks?: { onopen?: () => void } }) => {
      callbacks?.onopen?.();
      return {
        close: vi.fn(),
        sendClientContent,
        sendRealtimeInput: vi.fn(),
      };
    });

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    let chatCall = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/public/anna/chat')) {
        chatCall += 1;
        if (chatCall === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ message: 'Consultify helps teams run digital transformation.' }),
          });
        }
      }

      if (url.includes('/api/public/anna/voice-config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { clientToken: 'voice-test-key' }, enabled: true }),
        });
      }

      if (url.includes('/api/public/anna/voice-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ context: 'Voice context' }),
        });
      }

      if (url.includes('/api/public/anna/voice-event')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ initBody: init?.body ?? null }),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.change(screen.getByPlaceholderText('Ask Anna about the product...'), {
      target: { value: 'What is Consultify?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Consultify helps teams run digital transformation.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(screen.getByText('Anna is listening live.')).toBeInTheDocument();
    });

    expect(sendClientContent).toHaveBeenCalledWith({
      turns: [
        { role: 'user', parts: [{ text: 'What is Consultify?' }] },
        {
          role: 'model',
          parts: [{ text: 'Consultify helps teams run digital transformation.' }],
        },
      ],
      turnComplete: false,
    });
  });

  it('respects a disabled public voice-config seam even when an API key exists', async () => {
    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/public/anna/voice-config')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ session: { clientToken: 'voice-test-key' }, voiceName: 'Aoede', enabled: false }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      }),
    );

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Live voice is currently unavailable. You can still chat with Anna by text.',
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    expect(mockLiveConnect).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Live voice is currently unavailable. You can still chat with Anna by text.',
      ),
    ).toBeInTheDocument();
  });

  it('stops the live voice session when the launcher button closes the widget', async () => {
    const trackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: trackStop }],
    };

    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/public/anna/voice-config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { clientToken: 'voice-test-key' }, enabled: true }),
        });
      }

      if (url.includes('/api/public/anna/voice-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ context: 'Voice context' }),
        });
      }

      if (url.includes('/api/public/anna/voice-event')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(
        screen.getByText('Tap the microphone to start a live voice conversation.'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(
        screen.getByText('Anna is listening live.'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/public/anna/voice-event',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('does not emit a voice event when voice setup fails before the session reaches live mode', async () => {
    class MockAudioContext {
      currentTime = 0;
      destination = {};

      createMediaStreamSource() {
        return {
          connect: vi.fn(),
        };
      }

      createScriptProcessor() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('mic denied')),
      },
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/public/anna/voice-config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { clientToken: 'voice-test-key' }, enabled: true }),
        });
      }

      if (url.includes('/api/public/anna/voice-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ context: 'Voice context' }),
        });
      }

      if (url.includes('/api/public/anna/voice-event')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(
        screen.getByText('Tap the microphone to start a live voice conversation.'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Live voice ran into an issue. You can continue with Anna by text.',
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close Anna' })).not.toBeInTheDocument();
    });

    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/public/anna/voice-event')),
    ).toBe(false);
  });

  it('shows the static degraded-state voice fallback without exposing technical setup details', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));

    expect(
      screen.getByText(
        'Live voice is currently unavailable. You can still chat with Anna by text.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/NEXT_PUBLIC_GEMINI_API_KEY configured/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/browser microphone/i)).not.toBeInTheDocument();
  });
});
