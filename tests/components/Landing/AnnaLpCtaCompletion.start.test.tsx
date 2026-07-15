/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { persistAnnaLpCtaContext } from '../../../src/services/annaLpCtaContext';
import { AuthStep, SessionMode } from '../../../src/types';
import { AuthView } from '../../../src/views/AuthView';
import { TrialEntryView } from '../../../src/views/TrialEntryView';
import { ContactView } from '../../../src/views/legal/ContactView';

describe('Anna LP CTA completion — start events', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.defineProperty(i18n, 'language', { configurable: true, value: 'en' });
    Object.defineProperty(i18n, 'resolvedLanguage', { configurable: true, value: 'en' });
    sessionStorage.clear();

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const href = typeof url === 'string' ? url : String(url?.url || url);
      // Keep AnnaAssistantWidget quiet (voice-config fetch).
      if (href.includes('/api/public/anna/voice-config')) {
        return { ok: false, status: 503, json: async () => ({}) } as any;
      }
      // Funnel events are accepted.
      if (href.includes('/api/public/anna/funnel-event')) {
        return { ok: true, status: 202, json: async () => ({ success: true }) } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }));
  });

  it('records anna_lp.cta.start on TrialEntryView mount when CTA context exists', async () => {
    persistAnnaLpCtaContext({
      session_id: 'sess-trial',
      cta_type: 'trial',
      language: 'en',
      channel: 'text',
      turn_id: 'turn-1',
      source_intent: 'get_started',
    });

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <TrialEntryView onStartTrial={vi.fn()} />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect((globalThis.fetch as any) as any).toHaveBeenCalled();
    });

    const calls = (globalThis.fetch as any as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]: any[]) => String(url).includes('/api/public/anna/funnel-event')
    );
    expect(calls.length).toBeGreaterThan(0);
    const body = JSON.parse(String(calls[0][1]?.body || '{}'));
    expect(body).toEqual(
      expect.objectContaining({
        eventName: 'anna_lp.cta.start',
        session_id: 'sess-trial',
        cta_type: 'trial',
        language: 'en',
        channel: 'text',
        turn_id: 'turn-1',
        source_intent: 'get_started',
      })
    );
  });

  it('records anna_lp.cta.start on ContactView mount when CTA context exists', async () => {
    persistAnnaLpCtaContext({
      session_id: 'sess-contact',
      cta_type: 'contact',
      language: 'en',
      channel: 'text',
      turn_id: 'turn-2',
      source_intent: 'talk_to_human',
    });

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <ContactView />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect((globalThis.fetch as any) as any).toHaveBeenCalled();
    });

    const calls = (globalThis.fetch as any as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]: any[]) => String(url).includes('/api/public/anna/funnel-event')
    );
    const hasStart = calls.some(([, init]: any[]) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return body?.eventName === 'anna_lp.cta.start' && body?.cta_type === 'contact';
    });
    expect(hasStart).toBe(true);
  });

  it('records anna_lp.cta.start on AuthView mount in demo mode when CTA context exists', async () => {
    persistAnnaLpCtaContext({
      session_id: 'sess-demo',
      cta_type: 'demo',
      language: 'en',
      channel: 'text',
      turn_id: 'turn-3',
      source_intent: 'evaluate_fit',
    });

    render(
      <I18nextProvider i18n={i18n}>
        <AuthView
          initialStep={AuthStep.REGISTER}
          targetMode={SessionMode.DEMO}
          onAuthSuccess={vi.fn()}
          onBack={vi.fn()}
        />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect((globalThis.fetch as any) as any).toHaveBeenCalled();
    });

    const calls = (globalThis.fetch as any as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]: any[]) => String(url).includes('/api/public/anna/funnel-event')
    );
    const hasStart = calls.some(([, init]: any[]) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return body?.eventName === 'anna_lp.cta.start' && body?.cta_type === 'demo';
    });
    expect(hasStart).toBe(true);
  });
});

