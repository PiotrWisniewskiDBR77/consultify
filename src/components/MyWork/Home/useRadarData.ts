import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '@/services/api';

import type { RadarViewPayload } from './homeV2Types';

type RadarDataState = {
  data: RadarViewPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useRadarData(refreshTrigger?: number): RadarDataState {
  const { t } = useTranslation();
  const [data, setData] = useState<RadarViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const followUpAttemptsRef = useRef(0);
  const followUpTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await Api.get('/my-work/radar');
      setData(response?.data as RadarViewPayload);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('myWork.radar.loadError'));
      if (isInitialLoad) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshTrigger]);

  useEffect(() => {
    if (followUpTimerRef.current) {
      window.clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }

    if (!data?.localization?.pendingCount) {
      followUpAttemptsRef.current = 0;
      return;
    }

    if (followUpAttemptsRef.current >= 3) return;

    const delayMs = 1500 * (followUpAttemptsRef.current + 1);
    followUpAttemptsRef.current += 1;
    followUpTimerRef.current = window.setTimeout(() => {
      void refresh();
    }, delayMs);

    return () => {
      if (followUpTimerRef.current) {
        window.clearTimeout(followUpTimerRef.current);
        followUpTimerRef.current = null;
      }
    };
  }, [data?.generatedAt, data?.localization?.pendingCount, refresh]);

  return { data, loading, error, refresh };
}
