/**
 * LoginHistorySettings - View login history
 */

import { AlertTriangle, CheckCircle, History, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface LoginEvent {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'suspicious';
  location: string;
  ip: string;
  device: string;
}

interface LoginHistorySettingsProps {
  className?: string;
}

export const LoginHistorySettings: React.FC<LoginHistorySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const historyData = await Api.getLoginHistory();
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to fetch login history:', error);
      setLoadError(true);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" size={18} aria-label="Successful" />;
      case 'failed':
        return <XCircle className="text-danger-500" size={18} aria-label="Failed" />;
      case 'suspicious':
        return <AlertTriangle className="text-amber-500" size={18} aria-label="Suspicious" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <History size={20} />
          {t('settings.security.loginHistoryTitle', 'Login History')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t('settings.security.loginHistoryDesc', 'Review recent login activity on your account.')}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-c-text-secondary">
          {t('common.loading', 'Loading...')}
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} />
          <span>
            {t(
              'settings.security.loginHistoryError',
              'Unable to load login history. Please try again.'
            )}
          </span>
          <button
            type="button"
            onClick={fetchHistory}
            className="ml-auto text-xs underline hover:no-underline"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {(history || []).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
            >
              <div className="flex items-center gap-4">
                {getStatusIcon(event.status || 'success')}
                <div>
                  <p className="font-medium text-c-text">{event.device || 'Unknown Device'}</p>
                  <p className="text-sm text-c-text-muted">
                    {event.location || 'Unknown Location'} · {event.ip || 'Unknown IP'}
                  </p>
                </div>
              </div>
              <span className="text-sm text-c-text-secondary">
                {formatDate(event.timestamp || new Date().toISOString())}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoginHistorySettings;
