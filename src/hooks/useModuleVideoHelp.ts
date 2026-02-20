import { useCallback, useEffect, useRef, useState } from 'react';

import { getVideosForModule, type VideoTutorial } from '../config/videoTutorialsContent';
import { trackFunnelEvent } from '../services/funnelAnalytics';

const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('consultinity-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
};

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

type DismissedMap = Record<string, string>;

let dismissedCache: DismissedMap | null = null;
let dismissedCacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadDismissed(): Promise<DismissedMap> {
  if (dismissedCache && Date.now() - dismissedCacheLoadedAt < CACHE_TTL_MS) {
    return dismissedCache;
  }
  try {
    const res = await fetch('/api/help/micro-video/dismissed', { headers: buildHeaders() });
    if (!res.ok) return dismissedCache || {};
    const data = await res.json();
    dismissedCache = data.dismissed || {};
    dismissedCacheLoadedAt = Date.now();
    return dismissedCache!;
  } catch {
    return dismissedCache || {};
  }
}

function invalidateCache() {
  dismissedCache = null;
  dismissedCacheLoadedAt = 0;
}

export interface UseModuleVideoHelpReturn {
  shouldShow: boolean;
  video: VideoTutorial | null;
  dismiss: (action: 'watched' | 'skipped' | 'dont_show_again') => Promise<void>;
  trackEvent: (
    eventType: 'view_started' | 'view_completed' | 'view_skipped' | 'dont_show_again',
    opts?: { watchTimeSeconds?: number; progressPercent?: number }
  ) => Promise<void>;
  loading: boolean;
}

export function useModuleVideoHelp(moduleId: string | null | undefined): UseModuleVideoHelpReturn {
  const [shouldShow, setShouldShow] = useState(false);
  const [video, setVideo] = useState<VideoTutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!moduleId) {
      setShouldShow(false);
      setVideo(null);
      setLoading(false);
      return undefined;
    }

    const videos = getVideosForModule(moduleId);
    if (videos.length === 0) {
      setShouldShow(false);
      setVideo(null);
      setLoading(false);
      return undefined;
    }

    if (checkedRef.current) return undefined;
    checkedRef.current = true;

    let cancelled = false;
    setLoading(true);

    loadDismissed()
      .then((dismissed) => {
        if (cancelled) return;
        if (dismissed[moduleId]) {
          setShouldShow(false);
          setVideo(null);
        } else {
          setShouldShow(true);
          setVideo(videos[0]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const dismiss = useCallback(
    async (action: 'watched' | 'skipped' | 'dont_show_again') => {
      if (!moduleId) return;
      setShouldShow(false);

      if (dismissedCache) {
        dismissedCache[moduleId] = action;
      }

      try {
        await fetch('/api/help/micro-video/dismiss', {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({ moduleId, action }),
        });
      } catch {
        // Silently fail — local state already updated
      }

      if (action === 'watched') {
        trackFunnelEvent('help_video_watched', { moduleId });
      } else if (action === 'skipped') {
        trackFunnelEvent('help_video_skipped', { moduleId });
      } else {
        trackFunnelEvent('help_video_dont_show', { moduleId });
      }
    },
    [moduleId]
  );

  const trackEvent = useCallback(
    async (
      eventType: 'view_started' | 'view_completed' | 'view_skipped' | 'dont_show_again',
      opts?: { watchTimeSeconds?: number; progressPercent?: number }
    ) => {
      if (!moduleId || !video) return;
      try {
        await fetch('/api/help/micro-video/event', {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            moduleId,
            videoId: video.id,
            eventType,
            watchTimeSeconds: opts?.watchTimeSeconds,
            progressPercent: opts?.progressPercent,
          }),
        });
      } catch {
        // Non-critical
      }
    },
    [moduleId, video]
  );

  return { shouldShow, video, dismiss, trackEvent, loading };
}

export { invalidateCache as invalidateVideoHelpCache };
