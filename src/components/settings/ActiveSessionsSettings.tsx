/**
 * ActiveSessionsSettings - View and manage active sessions
 */

import { Globe, Monitor, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface Session {
  id: string;
  deviceInfo: string;
  device?: string;
  browser?: string;
  location?: string;
  ipAddress?: string;
  lastActive?: string;
  lastUsedAt?: string;
  current: boolean;
}

interface ActiveSessionsSettingsProps {
  className?: string;
}

export const ActiveSessionsSettings: React.FC<ActiveSessionsSettingsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await Api.getActiveSessions();
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast.error(t('settings.security.sessionsError', 'Failed to load active sessions'));
      // Set empty state instead of mock data
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      await Api.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success(t('settings.security.sessionTerminated', 'Session terminated'));
    } catch (_error) {
      toast.error(t('settings.security.sessionError', 'Failed to terminate session'));
    }
  };

  const handleRevokeAll = async () => {
    try {
      await Api.revokeAllSessions();
      setSessions((prev) => prev.filter((s) => s.current)); // Keep current session
      toast.success(t('settings.security.allSessionsRevoked', 'All other sessions revoked'));
    } catch (error) {
      toast.error(t('settings.security.revokeAllError', 'Failed to revoke all sessions'));
    }
  };

  const getDeviceIcon = (deviceInfo: string) => {
    const info = (deviceInfo || '').toLowerCase();
    if (info.includes('mobile')) return Smartphone;
    if (info.includes('tablet')) return Smartphone;
    return Monitor;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Globe size={20} />
            {t('settings.security.sessionsTitle', 'Active Sessions')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.security.sessionsDesc',
              "Manage devices where you're currently logged in."
            )}
          </p>
        </div>
        <button
          onClick={fetchSessions}
          className="p-2 text-c-text-secondary hover:text-c-text-secondary"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-3">
        {(sessions || []).map((session) => {
          const DeviceIcon = getDeviceIcon(session.deviceInfo || session.device || '');
          return (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-c-surface rounded-lg">
                  <DeviceIcon size={20} className="text-c-text-secondary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-c-text">
                      {session.deviceInfo || session.device || 'Unknown Device'}{' '}
                      {session.browser ? `- ${session.browser}` : ''}
                    </p>
                    {session.current && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                        {t('settings.security.currentSession', 'Current')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-c-text-muted">
                    {session.location || session.ipAddress || 'Unknown Location'} ·{' '}
                    {session.lastActive || session.lastUsedAt || 'Recently'}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  onClick={() => terminateSession(session.id)}
                  className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                  title={t('settings.security.terminate', 'Terminate session')}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {sessions.length > 1 && (
        <div className="flex justify-end pt-4 border-t border-c-border-subtle dark:border-navy-700">
          <button
            onClick={handleRevokeAll}
            className="px-4 py-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors text-sm font-medium"
          >
            {t('settings.security.signOutAll', 'Sign Out All Devices')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActiveSessionsSettings;
