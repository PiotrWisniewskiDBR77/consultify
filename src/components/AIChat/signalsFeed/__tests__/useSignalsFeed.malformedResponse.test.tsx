/**
 * @vitest-environment jsdom
 *
 * G14 13-16 (dyżur 2026-09-03) — regresja dla `teresa-chipy-sugestii` /
 * `chat-signals-feed`: `TypeError: feed.signals is not iterable`.
 *
 * Root cause: `useSignalsFeed` ustawiał stan `signals` wprost na
 * `response.signals` bez sprawdzenia, że to tablica. Gdy odpowiedź (fixture
 * albo realny backend łamiący kontrakt `SignalsFeedResponse`) nie ma pola
 * `signals`, konsument (`ChatSignalsFeed.tsx`: `[...feed.signals]`) wybuchał
 * i cały ekran renderował się jako pusty/błędny (ErrorBoundary).
 *
 * Ten test dowodzi fail-closed: malformowana odpowiedź → pusta lista, NIE
 * `undefined`, NIE crash.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSignalsFeed, type SignalsApi } from '../useSignalsFeed';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSignalsFeed — walidacja fail-closed odpowiedzi /signals', () => {
  it('nie ustawia signals na undefined, gdy odpowiedź nie ma pola signals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api: SignalsApi = {
      // Odpowiedź łamiąca kontrakt SignalsFeedResponse — brak `signals`.
      get: vi.fn().mockResolvedValue({ nextCursor: null, producerEnabled: true } as any),
      post: vi.fn(),
    };

    const { result } = renderHook(() => useSignalsFeed({ api }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Array.isArray(result.current.signals)).toBe(true);
    expect(result.current.signals).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('utrzymuje poprawną tablicę, gdy odpowiedź ma prawidłowy kształt', async () => {
    const dto = {
      key: 's1',
      type: 'x',
      title: 't',
      body: 'b',
      severity: 'INFO',
      createdAt: '2026-09-03T00:00:00Z',
      projectId: null,
      projectName: null,
      entityType: 'x',
      entityId: 'e1',
      domain: 'EXECUTION',
      origin: 'DETERMINISTIC',
      source: { evidence: [], ruleId: 'r1', ruleVersion: 1 },
      freshness: { lastObservedAt: '2026-09-03T00:00:00Z', runAt: '2026-09-03T00:00:00Z', nextRunAt: null },
      destination: { kind: 'none' },
      isMine: false,
    } as any;
    const api: SignalsApi = {
      get: vi.fn().mockResolvedValue({ signals: [dto], nextCursor: null, producerEnabled: true }),
      post: vi.fn(),
    };

    const { result } = renderHook(() => useSignalsFeed({ api }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.signals).toEqual([dto]);
  });
});
