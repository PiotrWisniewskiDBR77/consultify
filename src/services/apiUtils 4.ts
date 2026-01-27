import { tokenService } from './tokenService';

export const API_URL = '/api';

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
  correlationId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('correlationId', correlationId);
}

export const getHeaders = () => {
  const token = tokenService.getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Correlation-ID': correlationId as string,
  };
};

export const fetchWithRetry = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = { ...getHeaders(), ...((options.headers as Record<string, string>) || {}) };
  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    console.log('[Api] Got 401, attempting token refresh...');
    const newToken = await tokenService.refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    } else {
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
  }

  return res;
};

export const handleResponse = async (res: Response, defaultError: string) => {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }

  const data = await res.json().catch(() => ({}));

  if (
    res.status === 403 &&
    (data.code === 'DEMO_BLOCKED' || data.errorCode === 'DEMO_ACTION_BLOCKED')
  ) {
    window.dispatchEvent(
      new CustomEvent('DEMO_ACTION_BLOCKED', {
        detail: {
          message: data.message || data.error,
          action: data.action,
        },
      })
    );
    return null;
  }

  if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
    const { useAppStore } = await import('../store/useAppStore');
    const store = useAppStore.getState();
    store.setAiFreezeStatus({
      isFrozen: true,
      reason: data.error,
      scope: data.budgetStatus?.scope || 'Global',
    });
    throw new Error(data.error || 'AI Budget Exhausted');
  }

  throw new Error(data.error || data.message || defaultError);
};

export const handleBlobResponse = async (res: Response, defaultError: string) => {
  if (res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || data.message || defaultError);
};
