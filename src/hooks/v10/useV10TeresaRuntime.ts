import React from 'react';

type V10TeresaRuntimeState = {
  loading: boolean;
  available: boolean;
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  model?: string | null;
  voiceEnabled?: boolean;
  reason?: string | null;
};

const RUNTIME_BACKOFF_BASE_MS = 1000;
const RUNTIME_BACKOFF_MAX_MS = 60_000;
const RUNTIME_BACKOFF_STORAGE_KEY = 'consultify-v10-runtime-backoff';
let runtimeBackoffMs = 0;
let runtimeBlockedUntil = 0;
let runtimeBackoffHydrated = false;

const hydrateRuntimeBackoff = () => {
  if (runtimeBackoffHydrated || typeof window === 'undefined') return;
  runtimeBackoffHydrated = true;
  try {
    const raw = sessionStorage.getItem(RUNTIME_BACKOFF_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { backoffMs?: number; blockedUntil?: number };
    const now = Date.now();
    runtimeBackoffMs = Number(parsed?.backoffMs || 0);
    runtimeBlockedUntil =
      Number(parsed?.blockedUntil || 0) > now ? Number(parsed?.blockedUntil) : 0;
  } catch {
    // no-op
  }
};

const persistRuntimeBackoff = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      RUNTIME_BACKOFF_STORAGE_KEY,
      JSON.stringify({ backoffMs: runtimeBackoffMs, blockedUntil: runtimeBlockedUntil })
    );
  } catch {
    // no-op
  }
};

const hasAuthToken = (): boolean => {
  try {
    return Boolean(localStorage.getItem('token'));
  } catch {
    return false;
  }
};

const getAuthHeaders = (): Record<string, string> => {
  let token = '';
  try {
    token = localStorage.getItem('token') || '';
  } catch {
    token = '';
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const bumpRuntimeBackoff = () => {
  hydrateRuntimeBackoff();
  runtimeBackoffMs =
    runtimeBackoffMs > 0
      ? Math.min(runtimeBackoffMs * 2, RUNTIME_BACKOFF_MAX_MS)
      : RUNTIME_BACKOFF_BASE_MS;
  runtimeBlockedUntil = Date.now() + runtimeBackoffMs;
  persistRuntimeBackoff();
};

const resetRuntimeBackoff = () => {
  hydrateRuntimeBackoff();
  runtimeBackoffMs = 0;
  runtimeBlockedUntil = 0;
  persistRuntimeBackoff();
};

export function useV10TeresaRuntime(): V10TeresaRuntimeState {
  hydrateRuntimeBackoff();
  const [state, setState] = React.useState<V10TeresaRuntimeState>({
    loading: true,
    available: false,
    status: 'loading',
  });

  React.useEffect(() => {
    let cancelled = false;

    if (!hasAuthToken()) {
      setState({
        loading: false,
        available: false,
        status: 'unavailable',
        reason: 'Authentication required for voice runtime config.',
      });
      return () => {
        cancelled = true;
      };
    }

    if (Date.now() < runtimeBlockedUntil) {
      setState({
        loading: false,
        available: false,
        status: 'unavailable',
        reason: 'Voice runtime check is temporarily paused after repeated failures.',
      });
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/v10/teresa/voice-config', {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!res.ok && (res.status === 401 || res.status === 403 || res.status === 429)) {
          bumpRuntimeBackoff();
        } else if (res.ok) {
          resetRuntimeBackoff();
        }
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        const available = Boolean(body?.available || body?.enabled);
        setState({
          loading: false,
          available,
          status: available ? 'ready' : 'unavailable',
          model: body?.model || body?.voiceModel || null,
          voiceEnabled: Boolean(body?.enabled || body?.voiceEnabled),
          reason: body?.reason || body?.message || null,
        });
      })
      .catch((err) => {
        bumpRuntimeBackoff();
        if (cancelled) return;
        setState({
          loading: false,
          available: false,
          status: 'error',
          reason: err?.message || 'V10 Teresa runtime config unavailable',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
