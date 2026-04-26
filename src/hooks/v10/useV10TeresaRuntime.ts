import React from 'react';

type V10TeresaRuntimeState = {
  loading: boolean;
  available: boolean;
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  model?: string | null;
  voiceEnabled?: boolean;
  reason?: string | null;
};

export function useV10TeresaRuntime(): V10TeresaRuntimeState {
  const [state, setState] = React.useState<V10TeresaRuntimeState>({
    loading: true,
    available: false,
    status: 'loading',
  });

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/v10/teresa/voice-config', { credentials: 'include' })
      .then(async (res) => {
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

