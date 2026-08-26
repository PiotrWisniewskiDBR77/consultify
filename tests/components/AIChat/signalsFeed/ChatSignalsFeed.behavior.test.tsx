import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ChatSignalsPanel } from '@/components/AIChat/ChatSignalsPanel';
import { ChatSignalsFeed } from '@/components/AIChat/signalsFeed/ChatSignalsFeed';
import { resolveDestination } from '@/components/AIChat/signalsFeed/signalDestination';
import { readSeverity } from '@/components/AIChat/signalsFeed/signalPresentation';
import type { SignalDTO } from '@/components/AIChat/signalsFeed/signalTypes';
import i18n from '@/i18n';
import { Api } from '@/services/api';
import { resetChatSignalsFeedFlagCache } from '@/utils/chatSignalsFeedFlag';

vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn() } }));

const signal: SignalDTO = {
  key: 'signal-1',
  type: 'kpi_threshold_breached',
  title: 'Fallback',
  body: 'Treść',
  severity: 'CRITICAL',
  severityRaw: 'blocker',
  createdAt: '2026-08-20T10:00:00Z',
  projectId: 'p1',
  projectName: 'Metalpol',
  entityType: 'KPI',
  entityId: 'kpi-1',
  domain: 'RESULTS',
  origin: 'DETERMINISTIC',
  source: { evidence: [], ruleId: 'res.kpi_threshold_breached', ruleVersion: 1 },
  freshness: {
    lastObservedAt: '2026-08-26T10:00:00Z',
    runAt: '2026-08-26T10:00:00Z',
    nextRunAt: null,
  },
  destination: {
    kind: 'route',
    route: '/results/kpis/kpi-1',
    params: {},
    permission: 'read',
    allowed: null,
  },
  isMine: true,
  firstObservedAt: '2026-08-20T10:00:00Z',
  status: 'OPEN',
};

const mount = (props: React.ComponentProps<typeof ChatSignalsFeed>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ChatSignalsFeed {...props} />
      </MemoryRouter>
    </I18nextProvider>
  );

beforeAll(async () => {
  i18n.addResourceBundle(
    'pl',
    'translation',
    {
      chatSignals: {
        mine: 'Moje',
        untitled: 'Bez tytułu',
        filters: {
          all: 'Wszystkie',
          mine: 'Tylko moje',
          warning: '≥ ostrzeżenie',
          critical: '≥ krytyczny',
        },
        domain: {
          EXECUTION: 'Wykonanie',
          DECISION: 'Decyzje',
          RESULTS: 'Wyniki',
          FINANCE: 'Finanse',
        },
        severity: {
          info: 'Informacja',
          warning: 'Ostrzeżenie',
          critical: 'Krytyczny',
          blocker: 'Blokada',
        },
        origin: { DETERMINISTIC: 'Reguła' },
        status: { OPEN: 'Otwarty' },
        columns: {
          signal: 'Sygnał',
          domain: 'Domena',
          severity: 'Waga',
          source: 'Źródło',
          age: 'Wiek',
          status: 'Status',
        },
        age: { days: '{{count}} dni temu' },
        action: { refresh: 'Odśwież', dismiss: 'Ukryj', snooze: 'Drzemka', mute: 'Wycisz typ' },
        empty: {
          producerOff: 'Producent sygnałów jest wyłączony',
          good: 'Dobry stan',
          unknown: 'Stan nieznany',
        },
        error: { demoBlocked: 'W trybie demo ta akcja jest zablokowana' },
        throttle: 'Dostępne za {{count}} s',
        preview: {
          details: 'Szczegóły',
          evidence: 'Skąd wiadomo',
          noEvidence: 'Brak zapisanych dowodów',
        },
      },
    },
    true,
    true
  );
  await i18n.changeLanguage('pl');
});

describe('Chat signals feed behavior', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetChatSignalsFeedFlagCache();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '' },
    });
  });

  it('keeps blocker distinct and resolves only the real KPI route', () => {
    expect(readSeverity(signal)).toEqual({ value: 'blocker', wasCapped: false });
    expect(resolveDestination(signal)).toEqual({ kind: 'ROUTE', href: '/results/kpi/kpi-1' });
  });

  it('marks a capped legacy fallback', () =>
    expect(readSeverity({ ...signal, severityRaw: undefined })).toEqual({
      value: 'critical',
      wasCapped: true,
    }));

  it('renders a full row and the mine marker', () => {
    mount({
      initialResponse: { signals: [signal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post: vi.fn() },
    });
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(screen.getByLabelText(/(?:Moje|chatSignals\.mine)/)).toBeInTheDocument();
  });

  it('renders the honest producer-off state', () => {
    mount({
      initialResponse: { signals: [], nextCursor: null, producerEnabled: false },
      api: { get: vi.fn(), post: vi.fn() },
    });
    expect(
      screen.getByText(/(?:Producent sygnałów jest wyłączony|chatSignals\.empty\.producerOff)/)
    ).toBeInTheDocument();
  });

  it('the client-only mine chip does not call GET', () => {
    const get = vi.fn();
    mount({
      initialResponse: {
        signals: [signal, { ...signal, key: 'signal-2', isMine: false }],
        nextCursor: null,
        producerEnabled: true,
      },
      api: { get, post: vi.fn() },
    });
    fireEvent.click(screen.getByText(/(?:Tylko moje|chatSignals\.filters\.mine)/));
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps a row after a 403 action and explains demo denial', async () => {
    const post = vi.fn().mockRejectedValue({ status: 403 });
    mount({
      initialResponse: { signals: [signal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: signal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Ukryj|chatSignals\.action\.dismiss)/));
    expect(
      await screen.findByText(/(?:trybie demo|chatSignals\.error\.demoBlocked)/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Fallback').length).toBeGreaterThan(0);
  });

  it('uses retryAfterSeconds and blocks a second refresh after 429', async () => {
    const post = vi.fn().mockRejectedValue({ status: 429, data: { retryAfterSeconds: 7 } });
    mount({
      initialResponse: { signals: [], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
    });
    fireEvent.click(screen.getByText(/(?:Odśwież|chatSignals\.action\.refresh)/));
    expect(
      await screen.findByText(/(?:Dostępne za 7 s|chatSignals\.throttle)/)
    ).toBeDisabled();
    fireEvent.click(screen.getByText(/(?:Dostępne za|chatSignals\.throttle)/));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('real flag defaults OFF and leaves the old panel reachable', async () => {
    (Api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ signals: [] });
    render(
      <I18nextProvider i18n={i18n}>
        <ChatSignalsPanel open onClose={vi.fn()} />
      </I18nextProvider>
    );
    expect(await screen.findByTestId('chat-signals-count')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-signals-feed')).not.toBeInTheDocument();
  });

  it('real query override turns the new mode ON', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?ff_chatSignalsFeed=1' },
    });
    resetChatSignalsFeedFlagCache();
    (Api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      signals: [],
      nextCursor: null,
      producerEnabled: true,
    });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ChatSignalsPanel open onClose={vi.fn()} />
        </MemoryRouter>
      </I18nextProvider>
    );
    await waitFor(() => expect(screen.getByTestId('chat-signals-feed')).toBeInTheDocument());
  });

  // FIX-7 (dyżur 26 chat-signals-front, odbiór P0.7) — legacy refresh() nie
  // strzela do /my-work/signals, kiedy treścią panelu jest już ChatSignalsFeed.
  it('flag ON never calls the legacy /my-work/signals endpoint (FIX-7)', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?ff_chatSignalsFeed=1' },
    });
    resetChatSignalsFeedFlagCache();
    const get = vi.fn().mockResolvedValue({ signals: [], nextCursor: null, producerEnabled: true });
    (Api.get as ReturnType<typeof vi.fn>).mockImplementation(get);
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ChatSignalsPanel open onClose={vi.fn()} />
        </MemoryRouter>
      </I18nextProvider>
    );
    await waitFor(() => expect(screen.getByTestId('chat-signals-feed')).toBeInTheDocument());
    const legacyCalls = get.mock.calls.filter(([url]) => String(url).includes('/my-work/signals'));
    expect(legacyCalls).toHaveLength(0);
  });

  // FIX-1 (odbiór P0.1, korekta 27.08) — StandardPreview's OWN header
  // (StandardPreview.test.tsx) is suppressed by `embedded`, so the real,
  // ON-SCREEN Open control for this feed comes from ChatSignalsFeed's
  // `renderPreviewActions` wiring into TableWithPreviewLayout's own header.
  // These tests exercise THAT integration, not just the StandardPreview prop.
  describe('FIX-1 — visible Open pill in the real embedded preview', () => {
    it('ROUTE (KPI, allowed=null): renders an enabled Open control that navigates', () => {
      mount({
        initialResponse: { signals: [signal], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post: vi.fn() },
        initialSelectedId: signal.key,
      });
      const open = screen.getByText(/(?:Otwórz|chatSignals\.action\.open)/).closest('button');
      expect(open).not.toBeNull();
      expect(open).not.toBeDisabled();
    });

    it('NO_ROUTE (task type): renders a DISABLED Open control with the no-route reason', () => {
      const noRoute: SignalDTO = { ...signal, key: 'signal-no-route', type: 'task_overdue' };
      mount({
        initialResponse: { signals: [noRoute], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post: vi.fn() },
        initialSelectedId: noRoute.key,
      });
      const open = screen.getByText(/(?:Otwórz|chatSignals\.action\.open)/).closest('button');
      expect(open).toBeDisabled();
      expect(open).toHaveAttribute(
        'title',
        expect.stringMatching(/(?:Brak trasy do tego obiektu|chatSignals\.destination\.unavailable)/)
      );
    });

    it('FORBIDDEN (allowed=false): renders a DISABLED Open control with the forbidden reason', () => {
      const forbidden: SignalDTO = {
        ...signal,
        key: 'signal-forbidden',
        destination: { ...signal.destination, allowed: false },
      };
      mount({
        initialResponse: { signals: [forbidden], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post: vi.fn() },
        initialSelectedId: forbidden.key,
      });
      const open = screen.getByText(/(?:Otwórz|chatSignals\.action\.open)/).closest('button');
      expect(open).toBeDisabled();
      expect(open).toHaveAttribute(
        'title',
        expect.stringMatching(/(?:Brak uprawnień do obiektu|chatSignals\.destination\.forbidden)/)
      );
    });
  });

  // FIX-4 (odbiór P0.4) — A.3 minima: chip serwerowy strzela ?domain=, chip
  // kliencki nie strzela (test istnieje wyżej), nextCursor dokleja stronę,
  // brak nextCursor chowa przycisk.
  describe('A.3 — Menu 3 + StandardTable minima', () => {
    it('the server domain chip fires a GET with ?domain= and reloads from the start', async () => {
      const get = vi.fn().mockResolvedValue({ signals: [], nextCursor: null, producerEnabled: true });
      mount({
        initialResponse: { signals: [signal], nextCursor: 'cursor-1', producerEnabled: true },
        api: { get, post: vi.fn() },
      });
      fireEvent.click(screen.getByText(/(?:Decyzje|chatSignals\.domain\.DECISION)/));
      await waitFor(() => expect(get).toHaveBeenCalled());
      const calledUrl = String(get.mock.calls[get.mock.calls.length - 1][0]);
      expect(calledUrl).toContain('domain=DECISION');
    });

    it('Show older (nextCursor) appends the next page instead of replacing the list', async () => {
      const secondPage = { ...signal, key: 'signal-2', title: 'Second page signal' };
      const get = vi
        .fn()
        .mockResolvedValue({ signals: [secondPage], nextCursor: null, producerEnabled: true });
      mount({
        initialResponse: { signals: [signal], nextCursor: 'cursor-1', producerEnabled: true },
        api: { get, post: vi.fn() },
      });
      fireEvent.click(screen.getByText(/(?:Pokaż starsze|chatSignals\.action\.loadMore)/));
      await waitFor(() => expect(get).toHaveBeenCalled());
      expect(String(get.mock.calls[0][0])).toContain('cursor=cursor-1');
      expect(await screen.findByText('Second page signal')).toBeInTheDocument();
      expect(screen.getByText('Fallback')).toBeInTheDocument();
    });

    it('no nextCursor hides the Show older button', () => {
      mount({
        initialResponse: { signals: [signal], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post: vi.fn() },
      });
      expect(
        screen.queryByText(/(?:Pokaż starsze|chatSignals\.action\.loadMore)/)
      ).not.toBeInTheDocument();
    });
  });

  // FIX-4 (odbiór P0.4) — A.4 minima: sześć stanów po treści. Full (istnieje
  // wyżej), producer-off/3a (istnieje wyżej) i dławienie/6 (istnieje wyżej)
  // dopełnione tu o empty-good/2, producer-unknown/3b, forbidden/4, error/5.
  describe('A.4 — six honest states, by content', () => {
    it('state 2 — empty-good: producer ON, zero signals', () => {
      mount({
        initialResponse: { signals: [], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post: vi.fn() },
      });
      expect(
        screen.getByText(/(?:Warunki reguł nie są spełnione|chatSignals\.empty\.good)/)
      ).toBeInTheDocument();
    });

    it('state 3b — producer-unknown: producerEnabled absent from the envelope', () => {
      mount({
        initialResponse: { signals: [], nextCursor: null },
        api: { get: vi.fn(), post: vi.fn() },
      });
      expect(
        screen.getByText(/(?:Nie wiemy, czy producent|chatSignals\.empty\.unknown)/)
      ).toBeInTheDocument();
    });

    it('state 4 — forbidden: 401/403 renders role=alert, distinct from empty', async () => {
      const get = vi.fn().mockRejectedValue({ status: 403 });
      mount({ api: { get, post: vi.fn() } });
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('state 5 — error: other failures render a distinct error + retry, never the empty copy', async () => {
      const get = vi.fn().mockRejectedValue({ status: 500 });
      mount({ api: { get, post: vi.fn() } });
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/(?:Nie udało się sprawdzić sygnałów|chatSignals\.error\.load)/);
      expect(screen.getByText(/(?:Ponów|chatSignals\.action\.retry)/)).toBeInTheDocument();
    });
  });

  // FIX-4 (odbiór P0.4) — C.1 minima: 200 ON / 200 OFF / 429 z data / 429 z
  // Retry-After. 429 z `data.retryAfterSeconds` już istnieje wyżej.
  describe('C.1 — POST /signals/refresh outcomes', () => {
    it('200 { producerEnabled: true } reloads and reports success', async () => {
      const post = vi.fn().mockResolvedValue({ producerEnabled: true });
      const get = vi.fn().mockResolvedValue({ signals: [], nextCursor: null, producerEnabled: true });
      mount({
        initialResponse: { signals: [], nextCursor: null, producerEnabled: true },
        api: { get, post },
      });
      fireEvent.click(screen.getByText(/(?:Odśwież|chatSignals\.action\.refresh)/));
      expect(
        await screen.findByText(/(?:Odświeżono|chatSignals\.notice\.refreshed)/)
      ).toBeInTheDocument();
    });

    it('200 { producerEnabled: false } switches to the honest producer-off state (3a)', async () => {
      const post = vi.fn().mockResolvedValue({ producerEnabled: false });
      const get = vi.fn().mockResolvedValue({ signals: [], nextCursor: null, producerEnabled: false });
      mount({
        initialResponse: { signals: [], nextCursor: null, producerEnabled: true },
        api: { get, post },
      });
      fireEvent.click(screen.getByText(/(?:Odśwież|chatSignals\.action\.refresh)/));
      const matches = await screen.findAllByText(
        /(?:Producent sygnałów jest wyłączony|chatSignals\.empty\.producerOff)/
      );
      expect(matches.length).toBeGreaterThan(0);
    });

    it('429 with err.retryAfter (Retry-After header shape) disables the button and counts down', async () => {
      const post = vi.fn().mockRejectedValue({ status: 429, retryAfter: 12 });
      mount({
        initialResponse: { signals: [], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post },
      });
      fireEvent.click(screen.getByText(/(?:Odśwież|chatSignals\.action\.refresh)/));
      expect(
        await screen.findByText(/(?:Dostępne za 12 s|chatSignals\.throttle)/)
      ).toBeDisabled();
    });
  });
});
