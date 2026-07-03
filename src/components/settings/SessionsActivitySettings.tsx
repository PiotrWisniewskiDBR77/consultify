/**
 * SessionsActivitySettings — Merged Active Sessions + Login History
 *
 * Combines two previously separate pages into a single professional view
 * using SettingsSection and consistent dark-theme styling.
 */

import {
  AlertTriangle,
  CheckCircle,
  Globe,
  History,
  Monitor,
  RefreshCw,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection } from './shared/SettingsSection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

interface LoginEvent {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'suspicious';
  location: string;
  ip: string;
  device: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getDeviceIcon = (deviceInfo: string) => {
  const info = (deviceInfo || '').toLowerCase();
  if (info.includes('mobile') || info.includes('tablet')) return Smartphone;
  return Monitor;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    label: 'Success',
  },
  failed: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Failed' },
  suspicious: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    label: 'Suspicious',
  },
} as const;

// ---------------------------------------------------------------------------
// Tab Toggle
// ---------------------------------------------------------------------------
type Tab = 'sessions' | 'history';

const TabToggle: React.FC<{ active: Tab; onChange: (t: Tab) => void }> = ({ active, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-lg bg-navy-900/50 p-0.5">
      {[
        {
          id: 'sessions' as Tab,
          icon: Globe,
          label: t('settings.security.tabSessions', 'Active Sessions'),
        },
        {
          id: 'history' as Tab,
          icon: History,
          label: t('settings.security.tabHistory', 'Login History'),
        },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            active === tab.id
              ? 'bg-c-accent text-white shadow-sm'
              : 'text-c-text-secondary hover:text-white hover:bg-c-surface-raised'
          )}
        >
          <tab.icon size={13} />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const SessionsActivitySettings: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('sessions');

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsLoadError, setSessionsLoadError] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchSessions = useCallback(async (): Promise<Session[] | null> => {
    setSessionsLoading(true);
    try {
      setSessionsLoadError(null);
      const response = await Api.getActiveSessions();
      const nextSessions = Array.isArray(response?.sessions) ? response.sessions : [];
      setSessions(nextSessions);
      return nextSessions;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.security.sessionsError', 'Failed to load active sessions')
      );
      setSessionsLoadError(message);
      toast.error(message);
      setSessions([]);
      return null;
    } finally {
      setSessionsLoading(false);
    }
  }, [t]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const historyData = await Api.getLoginHistory();
      setHistory(historyData);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchHistory();
  }, [fetchSessions, fetchHistory]);

  // ---------------------------------------------------------------------------
  // Session actions
  // ---------------------------------------------------------------------------
  const terminateSession = useCallback(
    async (sessionId: string) => {
      try {
        setSessionActionError(null);
        await Api.revokeSession(sessionId);
        const refreshed = await fetchSessions();
        if (!refreshed || refreshed.some((session) => session.id === sessionId)) {
          throw new Error('Session termination was not confirmed by the server');
        }
        toast.success(t('settings.security.sessionTerminated', 'Session terminated'));
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(
          error,
          t('settings.security.sessionError', 'Failed to terminate session')
        );
        setSessionActionError(message);
        toast.error(message);
      }
    },
    [fetchSessions, t]
  );

  const revokeAll = useCallback(async () => {
    try {
      setSessionActionError(null);
      await Api.revokeAllSessions();
      const refreshed = await fetchSessions();
      if (!refreshed || refreshed.some((session) => !session.current)) {
        throw new Error('Session revocation was not confirmed by the server');
      }
      toast.success(t('settings.security.allSessionsRevoked', 'All other sessions revoked'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.security.revokeAllError', 'Failed to revoke all sessions')
      );
      setSessionActionError(message);
      toast.error(message);
    }
  }, [fetchSessions, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SettingsSection
      icon={Globe}
      title={t('settings.security.sessionsActivityTitle', 'Sessions & Activity')}
      description={t(
        'settings.security.sessionsActivityDesc',
        'Monitor your active sessions and review login history'
      )}
      cardId="security-sessions-activity"
      actions={
        <div className="flex items-center gap-2">
          <TabToggle active={tab} onChange={setTab} />
          {tab === 'sessions' && (
            <button
              onClick={fetchSessions}
              className="p-1.5 text-c-text-muted hover:text-c-text-muted transition-colors rounded-lg hover:bg-c-surface-raised"
              title={t('common.refresh', 'Refresh')}
            >
              <RefreshCw size={14} className={sessionsLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      }
    >
      {/* ── Active Sessions Tab ── */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessionsLoadError && (
            <DegradedState title="Active sessions unavailable" description={sessionsLoadError} />
          )}
          {sessionActionError && <Banner variant="danger" title={sessionActionError} />}
          {sessionsLoading ? (
            <LoadingSkeleton rows={3} />
          ) : sessions.length === 0 && !sessionsLoadError ? (
            <EmptyState
              icon={Globe}
              message={t('settings.security.noSessions', 'No active sessions found')}
            />
          ) : !sessionsLoadError ? (
            <>
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.deviceInfo || session.device || '');
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-colors',
                      'bg-c-surface/[0.02] border border-white/[0.04]',
                      'hover:bg-c-surface/[0.04]'
                    )}
                  >
                    <div className="p-2 rounded-lg bg-c-surface/[0.05] flex-shrink-0">
                      <DeviceIcon size={16} className="text-c-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-c-text-muted truncate">
                          {session.deviceInfo || session.device || 'Unknown Device'}
                          {session.browser ? ` · ${session.browser}` : ''}
                        </p>
                        {session.current && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full flex-shrink-0">
                            {t('settings.security.currentSession', 'Current')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-c-text-muted mt-0.5 truncate">
                        {session.location || session.ipAddress || 'Unknown'} ·{' '}
                        {session.lastActive || session.lastUsedAt || 'Recently'}
                      </p>
                    </div>
                    {!session.current && (
                      <button
                        onClick={() => terminateSession(session.id)}
                        className="p-1.5 text-c-text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
                        title={t('settings.security.terminate', 'Terminate session')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}

              {sessions.length > 1 && (
                <>
                  <SettingsDivider className="my-3" />
                  <div className="flex justify-end">
                    <button
                      onClick={revokeAll}
                      className="text-xs font-medium text-rose-400/80 hover:text-rose-400 transition-colors"
                    >
                      {t('settings.security.signOutAll', 'Sign Out All Other Devices')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Login History Tab ── */}
      {tab === 'history' && (
        <div className="space-y-2">
          {historyLoading ? (
            <LoadingSkeleton rows={5} />
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              message={t('settings.security.noHistory', 'No login history available')}
            />
          ) : (
            history.map((event) => {
              const cfg = statusConfig[event.status] || statusConfig.success;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl',
                    'bg-c-surface/[0.02] border border-white/[0.04]'
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg flex-shrink-0', cfg.bg)}>
                    <StatusIcon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-c-text-muted truncate">
                      {event.device || 'Unknown Device'}
                    </p>
                    <p className="text-xs text-c-text-muted mt-0.5 truncate">
                      {event.location || 'Unknown'} · {event.ip || 'Unknown IP'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[11px] text-c-text-muted">
                      {formatDate(event.timestamp || new Date().toISOString())}
                    </span>
                    <span className={cn('text-[10px] font-medium mt-0.5', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </SettingsSection>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const LoadingSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-14 bg-c-surface/[0.03] rounded-xl" />
    ))}
  </div>
);

const EmptyState: React.FC<{ icon: React.ElementType; message: string }> = ({
  icon: Icon,
  message,
}) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="p-3 rounded-xl bg-c-surface/[0.03] mb-3">
      <Icon size={24} className="text-c-text-secondary" />
    </div>
    <p className="text-sm text-c-text-muted">{message}</p>
  </div>
);

export default SessionsActivitySettings;
