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
        setSignals((current) => (append ? [...current, ...response.signals] : response.signals));
        setNextCursor(response.nextCursor);
        setProducerEnabled(response.producerEnabled);
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
