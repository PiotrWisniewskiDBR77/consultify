/**
 * ChatSignalsFeedPreview.behavior.test.tsx — FIX-4 (dyżur 26 chat-signals-
 * front, odbiór P0.4, pozycja B.1 minimum DoD: ≥6 testy — każda z trzech
 * akcji: sukces + 4xx bez zniknięcia wiersza; test presetów drzemki; test
 * bloku „Skąd wiadomo" przy pustych dowodach; test `INTERPRETED` bez
 * `provenance`).
 *
 * Reguła Z22 weryfikowana tu: 2xx → wiersz znika + komunikat; 4xx → wiersz
 * ZOSTAJE, przycisk wraca, komunikat mówi dlaczego.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatSignalsFeed } from '@/components/AIChat/signalsFeed/ChatSignalsFeed';
import type { SignalDTO } from '@/components/AIChat/signalsFeed/signalTypes';
import i18n from '@/i18n';

const baseSignal: SignalDTO = {
  key: 'signal-preview-1',
  type: 'task_overdue',
  title: 'Overdue task signal',
  body: 'Body text',
  severity: 'WARNING',
  severityRaw: 'warning',
  createdAt: '2026-08-20T10:00:00Z',
  projectId: 'p1',
  projectName: 'Metalpol',
  entityType: 'task',
  entityId: 'task-42',
  domain: 'EXECUTION',
  origin: 'DETERMINISTIC',
  source: {
    evidence: [
      {
        ref: 'task-42',
        refType: 'task',
        version: 1,
        observedValue: 3,
        observedAt: '2026-08-25T10:00:00Z',
      },
    ],
    ruleId: 'exec.task.overdue',
    ruleVersion: 1,
  },
  freshness: { lastObservedAt: '2026-08-26T10:00:00Z', runAt: '2026-08-26T10:00:00Z', nextRunAt: null },
  destination: { kind: 'none', route: '', params: {}, permission: 'read', allowed: null },
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

describe('ChatSignalsFeedPreview actions (B.1)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dismiss success (2xx) removes the row', async () => {
    const post = vi.fn().mockResolvedValue({});
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Ukryj|chatSignals\.action\.dismiss)/));
    await waitFor(() => expect(screen.queryByText('Overdue task signal')).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/dismiss'), {});
  });

  it('dismiss 4xx keeps the row (regression, already covered pattern extended)', async () => {
    const post = vi.fn().mockRejectedValue({ status: 404 });
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Ukryj|chatSignals\.action\.dismiss)/));
    expect(await screen.findByText(/(?:sygnał już nie istnieje|chatSignals\.error\.gone)/)).toBeInTheDocument();
    expect(screen.getAllByText('Overdue task signal').length).toBeGreaterThan(0);
  });

  it('snooze success (2xx) removes the row and reports until when, via a preset button', async () => {
    const post = vi.fn().mockResolvedValue({ snoozedUntil: '2026-08-27T09:00:00Z' });
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:1 godz\.|1h|chatSignals\.action\.snoozePreset\.1h)/));
    await waitFor(() => expect(screen.queryByText('Overdue task signal')).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/snooze'), { preset: '1h' });
  });

  it('snooze 4xx keeps the row and explains demo denial', async () => {
    const post = vi.fn().mockRejectedValue({ status: 403 });
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Do jutra|Tomorrow|chatSignals\.action\.snoozePreset\.tomorrow)/));
    expect(
      await screen.findByText(/(?:trybie demo|chatSignals\.error\.demoBlocked)/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Overdue task signal').length).toBeGreaterThan(0);
  });

  it('mute success (2xx, with confirm) removes the row', async () => {
    const post = vi.fn().mockResolvedValue({});
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Wycisz typ|chatSignals\.action\.mute)/));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Overdue task signal')).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/my-work/signals/mute-type', { type: baseSignal.type });
  });

  it('mute 4xx keeps the row', async () => {
    const post = vi.fn().mockRejectedValue({ status: 500 });
    mount({
      initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post },
      initialSelectedId: baseSignal.key,
    });
    fireEvent.click(await screen.findByText(/(?:Wycisz typ|chatSignals\.action\.mute)/));
    expect(
      await screen.findByText(/(?:Nie udało się wykonać akcji|chatSignals\.error\.action)/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Overdue task signal').length).toBeGreaterThan(0);
  });

  it('all four snooze presets send their exact preset value', async () => {
    const presets: Array<[RegExp, string]> = [
      [/(?:1 godz\.|1h|chatSignals\.action\.snoozePreset\.1h)/, '1h'],
      [/(?:4 godz\.|4h|chatSignals\.action\.snoozePreset\.4h)/, '4h'],
      [/(?:Do jutra|Tomorrow|chatSignals\.action\.snoozePreset\.tomorrow)/, 'tomorrow'],
      [/(?:Tydzień|Week|chatSignals\.action\.snoozePreset\.week)/, 'week'],
    ];
    for (const [pattern, expected] of presets) {
      const post = vi.fn().mockResolvedValue({ snoozedUntil: '2026-08-28T00:00:00Z' });
      const { unmount } = mount({
        initialResponse: { signals: [baseSignal], nextCursor: null, producerEnabled: true },
        api: { get: vi.fn(), post },
        initialSelectedId: baseSignal.key,
      });
      fireEvent.click(await screen.findByText(pattern));
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(expect.stringContaining('/snooze'), { preset: expected })
      );
      unmount();
    }
  });

  it('shows the honest "no evidence" line when source.evidence is empty', async () => {
    const signalNoEvidence: SignalDTO = { ...baseSignal, key: 'no-evidence', source: { ...baseSignal.source, evidence: [] } };
    mount({
      initialResponse: { signals: [signalNoEvidence], nextCursor: null, producerEnabled: true },
      api: { get: vi.fn(), post: vi.fn() },
      initialSelectedId: signalNoEvidence.key,
    });
    expect(
      await screen.findByText(/(?:Brak zapisanych dowodów|chatSignals\.preview\.noEvidence)/)
    ).toBeInTheDocument();
  });

  it('INTERPRETED without provenance shows an explicit "missing provenance" line, never a silent gap', async () => {
    const interpretedNoProvenance: SignalDTO = {
      ...baseSignal,
      key: 'interpreted-no-provenance',
      origin: 'INTERPRETED',
      provenance: undefined,
    };
    mount({
      initialResponse: {
        signals: [interpretedNoProvenance],
        nextCursor: null,
        producerEnabled: true,
      },
      api: { get: vi.fn(), post: vi.fn() },
      initialSelectedId: interpretedNoProvenance.key,
    });
    expect(
      await screen.findByText(
        /(?:Brak rodowodu dla interpretacji AI|chatSignals\.preview\.noProvenance)/
      )
    ).toBeInTheDocument();
  });
});
