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
});
