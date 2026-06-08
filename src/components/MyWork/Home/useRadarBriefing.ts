import { useEffect, useRef, useState } from 'react';

import Api from '@/services/api';

import type { RadarBriefing } from './homeV2Types';

type BriefingState = {
  briefing: RadarBriefing | null;
  loading: boolean;
};

/**
 * Fetches Teresa's on-demand AI briefing for the selected radar signal.
 * Hybrid model: the panel always renders its deterministic baseline first; this
 * hook upgrades it to a personalized AI briefing once the signal is opened.
 * Results are memoized per signal id so re-selecting is instant and free.
 */
export function useRadarBriefing(signalId: string | null): BriefingState {
  const [state, setState] = useState<BriefingState>({ briefing: null, loading: false });
  const cacheRef = useRef<Map<string, RadarBriefing | null>>(new Map());

  useEffect(() => {
    if (!signalId) {
      setState({ briefing: null, loading: false });
      return;
    }

    if (cacheRef.current.has(signalId)) {
      setState({ briefing: cacheRef.current.get(signalId) ?? null, loading: false });
      return;
    }

    let cancelled = false;
    setState({ briefing: null, loading: true });

    (async () => {
      try {
        const response = await Api.get(
          `/my-work/radar/signal/${encodeURIComponent(signalId)}/briefing`
        );
        const briefing = (response?.data?.briefing as RadarBriefing | null) ?? null;
        cacheRef.current.set(signalId, briefing);
        if (!cancelled) setState({ briefing, loading: false });
      } catch {
        // Soft-fail: keep the deterministic baseline (do not cache failures).
        if (!cancelled) setState({ briefing: null, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signalId]);

  return state;
}
