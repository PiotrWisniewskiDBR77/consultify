import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '@/services/api';

import type { TriageCategory, TriagePriorityLevel, TriageSignal, TriageState } from './homeV2Types';

export interface TriageFilters {
  category?: TriageCategory;
  priorityLevel?: TriagePriorityLevel;
  triageState?: TriageState;
}

interface TriageDataState {
  signals: TriageSignal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRadarTriageData(filters?: TriageFilters): TriageDataState {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<TriageSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    const isInitial = !hasLoadedRef.current;
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.priorityLevel) params.set('priorityLevel', filters.priorityLevel);
      if (filters?.triageState) params.set('triageState', filters.triageState);
      const qs = params.toString();
      const url = `/v8/radar-triage/signals${qs ? `?${qs}` : ''}`;
      const response = await Api.get(url);
      const data = (response?.data as { data?: TriageSignal[] })?.data ?? [];
      setSignals(data);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('myWork.radar.loadError'));
      if (isInitial) setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.category, filters?.priorityLevel, filters?.triageState, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { signals, loading, error, refresh };
}

export async function executeTriageHandoff(signalId: string): Promise<{
  targetModule: string;
  targetPayload: Record<string, unknown>;
} | null> {
  try {
    const response = await Api.post(`/v8/radar-triage/signals/${signalId}/handoff`, {});
    return (response?.data as { data?: any })?.data ?? null;
  } catch {
    return null;
  }
}
