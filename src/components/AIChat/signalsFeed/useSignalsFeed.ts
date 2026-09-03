import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '@/services/api';

import type { SignalDTO, SignalsFeedResponse } from './signalTypes';

export interface SignalsApi {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: unknown) => Promise<unknown>;
}

export function useSignalsFeed(params: {
  projectId?: string | null;
  domain?: string;
  severityMin?: string;
  api?: SignalsApi;
  initialResponse?: SignalsFeedResponse;
}) {
  const api = params.api ?? (Api as unknown as SignalsApi);
  const [signals, setSignals] = useState<SignalDTO[]>(params.initialResponse?.signals ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    params.initialResponse?.nextCursor ?? null
  );
  const [producerEnabled, setProducerEnabled] = useState<boolean | undefined>(
    params.initialResponse?.producerEnabled
  );
  const [loading, setLoading] = useState(!params.initialResponse);
  const [error, setError] = useState<'none' | 'forbidden' | 'failed'>('none');
  const first = useRef(true);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError('none');
      try {
        const query = new URLSearchParams({ limit: '50' });
        if (params.projectId) query.set('projectId', params.projectId);
        if (params.domain) query.set('domain', params.domain);
        if (params.severityMin) query.set('severityMin', params.severityMin);
        if (append && nextCursor) query.set('cursor', nextCursor);
        const response = (await api.get(`/signals?${query}`)) as SignalsFeedResponse;
        // G14 14-16 (dyżur 2026-09-03) — kontrakt `SignalsFeedResponse` ZAWSZE
        // niesie `signals` jako tablicę, ale gdy backend/fixture je złamie
        // (pole brakuje albo ma inny kształt), `setSignals(undefined)` psuje
        // stan cicho tutaj i wybucha DOPIERO w konsumencie
        // (`ChatSignalsFeed.tsx`: `[...feed.signals]` → `TypeError: feed.signals
        // is not iterable`, przechwycone przez ErrorBoundary — cały ekran
        // pusty/błędny). Walidacja fail-closed: nieprawidłowy kształt = pusta
        // lista + sygnał w konsoli, NIE crash całego ekranu.
        const incomingSignals = Array.isArray(response?.signals) ? response.signals : [];
        if (!Array.isArray(response?.signals)) {
          // eslint-disable-next-line no-console
          console.error(
            '[useSignalsFeed] Odpowiedź /signals nie ma tablicy `signals` — kontrakt złamany, renderuję pustą listę zamiast crashować.',
            response
          );
        }
        setSignals((current) => (append ? [...current, ...incomingSignals] : incomingSignals));
        setNextCursor(response.nextCursor);
        // FIX-10 (dyżur 26 chat-signals-front, odbiór P2.10) — `POST
        // /signals/refresh` może ustawić `producerEnabled: false` (stan 3a),
        // po czym natychmiast woła `reload()`. Gdy TA odpowiedź GET nie niesie
        // pola `producerEnabled` (np. starsza wersja endpointu/license F
        // wyłączona), `undefined` nadpisywał już poznaną prawdę z powrotem na
        // „nieznany" (stan 3b) — dokładnie ten sam sygnał w tej samej sesji
        // przestawał być uczciwy. Jawny `false`/`true` zawsze wygrywa;
        // `undefined` zachowuje ostatnią znaną wartość zamiast ją gubić.
        setProducerEnabled((current) =>
          response.producerEnabled === undefined ? current : response.producerEnabled
        );
      } catch (cause) {
        const status = (cause as { status?: number })?.status;
        setError(status === 401 || status === 403 ? 'forbidden' : 'failed');
        if (!append) setSignals([]);
      } finally {
        setLoading(false);
      }
    },
    [api, nextCursor, params.domain, params.projectId, params.severityMin]
  );

  useEffect(() => {
    if (first.current && params.initialResponse) {
      first.current = false;
      return;
    }
    first.current = false;
    void load(false);
  }, [params.domain, params.severityMin]);

  return {
    signals,
    setSignals,
    nextCursor,
    producerEnabled,
    setProducerEnabled,
    loading,
    error,
    reload: () => load(false),
    loadMore: () => load(true),
    api,
  };
}
