/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../src/i18n';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

async function renderWidget() {
  const mod = await import('../../../src/components/Landing/AnnaAssistantWidget');
  const AnnaAssistantWidget = mod.AnnaAssistantWidget;
  return render(
    <I18nextProvider i18n={i18n}>
      <AnnaAssistantWidget />
    </I18nextProvider>
  );
}

describe('AnnaAssistantWidget P16-B guardrails', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.defineProperty(i18n, 'language', { configurable: true, value: 'en' });
    Object.defineProperty(i18n, 'resolvedLanguage', { configurable: true, value: 'en' });
    sessionStorage.clear();

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'anna-session-id' },
    });

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const href = typeof url === 'string' ? url : String(url?.url || url);
      if (href.includes('/api/public/anna/voice-config')) {
        return { ok: false, status: 503, json: async () => ({}) } as any;
      }
      if (href.includes('/api/public/anna/funnel-event')) {
        return { ok: true, status: 202, json: async () => ({ success: true }) } as any;
      }
      if (href.includes('/api/public/anna/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: 'OK', knowledgeSources: [] }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }));
  });

  it('does not reset the conversation when the UI language changes mid-chat', async () => {
    await renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello Anna' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText('Hello Anna')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    await act(async () => {
      await i18n.changeLanguage('pl');
      Object.defineProperty(i18n, 'language', { configurable: true, value: 'pl' });
      Object.defineProperty(i18n, 'resolvedLanguage', { configurable: true, value: 'pl' });
    });

    expect(screen.getByText('Hello Anna')).toBeInTheDocument();
  });

  it('records a voice-unavailable fallback and allows continuing by text', async () => {
    await renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Anna first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start voice conversation' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Live voice is currently unavailable. You can still chat with Anna by text.'
        )
      ).toBeInTheDocument();
    });

    const calls = (globalThis.fetch as any as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]: any[]) => String(url).includes('/api/public/anna/funnel-event')
    );
    const hasVoiceUnavailable = calls.some(([, init]: any[]) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return body?.eventName === 'landing_anna_fallback_shown' && body?.fallbackReason === 'voice_unavailable';
    });
    expect(hasVoiceUnavailable).toBe(true);
  });
});

