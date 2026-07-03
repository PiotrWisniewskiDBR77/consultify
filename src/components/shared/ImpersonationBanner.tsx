import { Eye, LogOut, Shield } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

const API_URL = '/api';

function parseToken(): { impersonatorId?: string; name?: string; email?: string } | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export const ImpersonationBanner: React.FC = () => {
  const { t } = useTranslation();
  const [reverting, setReverting] = useState(false);
  const payload = parseToken();

  const handleExit = useCallback(async () => {
    setReverting(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/auth/revert-impersonation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to revert');
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        trackFunnelEvent('superadmin_impersonation_ended', {});
        window.location.href = '/superadmin';
      }
    } catch {
      toast.error(t('impersonation.exitFailed', 'Failed to stop impersonation'));
      setReverting(false);
    }
  }, [t]);

  if (!payload?.impersonatorId) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-toast bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Shield size={16} />
          <Eye size={16} />
        </div>
        <span className="text-sm font-medium">
          {t(
            'impersonation.banner',
            'You are in a read-only impersonation session (max 30 minutes)'
          )}
        </span>
        {payload.name && (
          <span className="text-xs bg-amber-600 px-2 py-0.5 rounded">
            {payload.name} ({payload.email})
          </span>
        )}
      </div>
      <button
        onClick={handleExit}
        disabled={reverting}
        className="flex items-center gap-1.5 px-3 py-1 bg-white text-amber-700 rounded-md text-xs font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
      >
        <LogOut size={14} />
        {reverting
          ? t('impersonation.reverting', 'Reverting...')
          : t('impersonation.exit', 'Stop Impersonating')}
      </button>
    </div>
  );
};

export default ImpersonationBanner;
