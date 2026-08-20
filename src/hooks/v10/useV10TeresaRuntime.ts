import React from 'react';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

type V10TeresaRuntimeStatus = 'loading' | 'ready' | 'unavailable' | 'error';

type V10TeresaRuntimeState = {
  loading: boolean;
  available: boolean;
  status: V10TeresaRuntimeStatus;
  model?: string | null;
  voiceName?: string | null;
  voiceEnabled?: boolean;
  reason?: string | null;
  httpStatus?: number | null;
};

/**
 * Reads the Teresa voice runtime config for the AI OS diagnostics panel.
 *
 * Goes through the canonical `Api` client so the request carries the app's auth
 * (with 401 refresh + cookie fallback) — this avoids the load-time race where a
 * raw fetch fired before auth hydration would 401, fall back to an empty body,
 * and render a misleading "not configured / unavailable" state.
 *
 * The three honest outcomes are kept distinct:
 *   - ready        → backend reported voice enabled
 *   - unavailable  → backend reachable but voice disabled (shows the real reason)
 *   - error        → the request itself failed (auth/network/5xx) — never silently
 *                    collapsed into "not configured".
 */
export function useV10TeresaRuntime(): V10TeresaRuntimeState {
  const isAuthenticated = useAppStore(
    (state) => state.isAuthInitializing === false && state.currentUser?.isAuthenticated === true
  );
  const [state, setState] = React.useState<V10TeresaRuntimeState>({
    loading: true,
    available: false,
    status: 'loading',
  });

  React.useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setState({
        loading: false,
        available: false,
        status: 'unavailable',
        reason: 'Authenticated workspace session required.',
        httpStatus: null,
      });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await Api.get('/api/v10/teresa/voice-config');
        const body =
          res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)
            ? ((res as { data?: unknown }).data ?? {})
            : (res ?? {});
        if (cancelled) return;

        const b = (body || {}) as Record<string, any>;
        const enabled = Boolean(b.enabled ?? b.available);
        setState({
          loading: false,
          available: enabled,
          status: enabled ? 'ready' : 'unavailable',
          model: b.model || b.voiceModel || null,
          voiceName: b.voiceName || null,
          voiceEnabled: Boolean(b.enabled ?? b.voiceEnabled),
          reason: b.unavailableReason || b.reason || b.message || null,
          httpStatus: 200,
        });
      } catch (err: any) {
        if (cancelled) return;
        const httpStatus = Number(err?.status || err?.response?.status || err?.statusCode) || null;
        setState({
          loading: false,
          available: false,
          status: 'error',
          reason: err?.message || 'V10 Teresa runtime config request failed',
          httpStatus,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return state;
}
