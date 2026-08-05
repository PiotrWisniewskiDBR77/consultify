/**
 * SecurityOverviewPage — Consolidated Security Dashboard
 *
 * Professional security overview with:
 * 1. Security Score ring with visual indicator
 * 2. Status cards for Password, 2FA, Sessions, Recovery
 * 3. Recent security events feed
 * 4. Security recommendations
 *
 * Uses unified SettingsSection pattern for consistency with DataControlsSettings.
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Fingerprint,
  History,
  Key,
  LifeBuoy,
  Monitor,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '../../../lib/utils';
import { ROUTES } from '../../../routes/routeConfig';
import { Api } from '../../../services/api';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { isMfaMvpEnabled } from '../../../utils/mfaMvpFlag';
import { DegradedState } from '../../Admin/AdminState';
import { SettingsDivider, SettingsSection } from '../shared';

interface SecurityOverviewPageProps {
  currentUser: User;
  onUpdateUser?: (updates: Partial<User>) => void;
  className?: string;
}

interface SecurityStatus {
  passwordLastChanged?: string;
  mfaEnabled: boolean;
  mfaMethod?: string;
  activeSessions: number;
  recoveryEmail: boolean;
  recoveryPhone: boolean;
  backupCodes: boolean;
  backupCodesCount: number;
}

interface LoginEvent {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'suspicious';
  location: string;
  ip: string;
  device: string;
}

interface ActiveSessionsResponse {
  sessions?: unknown[];
}

interface MfaStatusResponse {
  isEnabled?: boolean;
  method?: string;
}

const DEFAULT_STATUS: SecurityStatus = {
  mfaEnabled: false,
  activeSessions: 1,
  recoveryEmail: false,
  recoveryPhone: false,
  backupCodes: false,
  backupCodesCount: 0,
};

export const SecurityOverviewPage: React.FC<SecurityOverviewPageProps> = ({
  currentUser,
  className = '',
}) => {
  const { t } = useTranslation();
  const mfaMvpEnabled = isMfaMvpEnabled();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SecurityStatus>(DEFAULT_STATUS);
  const [recentEvents, setRecentEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSecurityData = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const [sessionsRes, historyRes, recoveryRes, mfaRes] = await Promise.all([
        Api.getActiveSessions(),
        Api.getLoginHistory(),
        Api.get('/settings/recovery'),
        mfaMvpEnabled ? Api.get('/api/mfa/status') : Promise.resolve({ isEnabled: false }),
      ]);
      if (!sessionsRes || !Array.isArray(historyRes) || !recoveryRes || !mfaRes) {
        throw new Error('Security overview response was missing required data');
      }

      const sessions = (sessionsRes as ActiveSessionsResponse).sessions ?? [];
      const mfa = mfaRes as MfaStatusResponse;

      setStatus({
        mfaEnabled: currentUser?.mfaEnabled || mfa.isEnabled || false,
        mfaMethod: mfa.method || 'totp',
        activeSessions: sessions.length,
        recoveryEmail: !!recoveryRes?.recoveryEmail,
        recoveryPhone: !!recoveryRes?.recoveryPhone,
        backupCodes: (recoveryRes?.backupCodesCount || 0) > 0,
        backupCodesCount: recoveryRes?.backupCodesCount || 0,
      });

      setRecentEvents(historyRes.slice(0, 5));
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load security overview'));
    } finally {
      setLoading(false);
    }
  }, [currentUser?.mfaEnabled, mfaMvpEnabled]);

  useEffect(() => {
    void loadSecurityData();
  }, [currentUser.id, loadSecurityData]);

  const securityScore = useMemo(() => {
    // Score is computed only from real, verifiable signals. Password strength
    // for an already-set password is not available client-side, so it is not
    // factored in (no fabricated value).
    let score = 0;
    const maxScore = mfaMvpEnabled ? 5 : 1.5;

    if (mfaMvpEnabled && status.mfaEnabled) score += 2.5;
    if (status.recoveryEmail) score += 0.75;
    if (status.recoveryPhone) score += 0.75;
    if (mfaMvpEnabled && status.backupCodes) score += 1;

    return { score: Math.min(score, maxScore), maxScore };
  }, [mfaMvpEnabled, status]);

  const scorePercentage = Math.round((securityScore.score / securityScore.maxScore) * 100);

  const scoreColor =
    scorePercentage >= 80
      ? 'text-emerald-400'
      : scorePercentage >= 50
        ? 'text-amber-400'
        : 'text-danger-400';

  const scoreRingColor =
    scorePercentage >= 80
      ? 'stroke-emerald-500'
      : scorePercentage >= 50
        ? 'stroke-amber-500'
        : 'stroke-danger-500';

  const scoreBgColor =
    scorePercentage >= 80
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : scorePercentage >= 50
        ? 'bg-amber-500/10 border-amber-500/20'
        : 'bg-danger-500/10 border-danger-500/20';

  const scoreLabel =
    scorePercentage >= 80
      ? t('settings.securityOverview.scoreExcellent', 'Excellent')
      : scorePercentage >= 50
        ? t('settings.securityOverview.scoreGood', 'Good')
        : t('settings.securityOverview.scoreWeak', 'Needs Improvement');

  const navigateTo = (section: string) => {
    navigate(`${ROUTES.SETTINGS.ROOT}/${section}`);
  };

  const statusCards = [
    {
      id: 'password',
      icon: Key,
      title: t('settings.securityOverview.password', 'Password'),
      status: true,
      statusLabel: t('settings.securityOverview.passwordSet', 'Set'),
      description: status.passwordLastChanged
        ? t('settings.securityOverview.lastChanged', 'Last changed {{date}}', {
            date: new Date(status.passwordLastChanged).toLocaleDateString(),
          })
        : t('settings.securityOverview.updateRegularly', 'Update regularly for best security'),
      action: () => navigateTo('auth-access'),
      actionLabel: t('settings.securityOverview.change', 'Change'),
      color: 'violet' as const,
    },
    {
      id: 'mfa',
      icon: Fingerprint,
      title: t('settings.securityOverview.twoFactor', 'Two-Factor Auth'),
      status: mfaMvpEnabled && status.mfaEnabled,
      statusLabel: !mfaMvpEnabled
        ? t('settings.securityOverview.deferred', 'Deferred')
        : status.mfaEnabled
          ? t('settings.securityOverview.enabled', 'Enabled')
          : t('settings.securityOverview.disabled', 'Disabled'),
      description: !mfaMvpEnabled
        ? t('settings.securityOverview.mfaDeferred', 'Not included in the MVP demo')
        : status.mfaEnabled
          ? t(
              'settings.securityOverview.mfaActive',
              'Your account has an extra layer of protection'
            )
          : t('settings.securityOverview.mfaInactive', 'Add 2FA to protect your account'),
      action: () => navigateTo('auth-access'),
      actionLabel: !mfaMvpEnabled
        ? t('settings.securityOverview.viewAvailability', 'View availability')
        : status.mfaEnabled
          ? t('settings.securityOverview.manage', 'Manage')
          : t('settings.securityOverview.enable', 'Enable'),
      color: 'blue' as const,
    },
    {
      id: 'sessions',
      icon: Monitor,
      title: t('settings.securityOverview.sessions', 'Active Sessions'),
      status: true,
      statusLabel: t('settings.securityOverview.sessionCount', '{{count}} active', {
        count: status.activeSessions,
      }),
      description: t(
        'settings.securityOverview.sessionsDesc',
        'Devices currently logged into your account'
      ),
      action: () => navigateTo('auth-access'),
      actionLabel: t('settings.securityOverview.viewAll', 'View All'),
      color: 'emerald' as const,
    },
    {
      id: 'recovery',
      icon: LifeBuoy,
      title: t('settings.securityOverview.recovery', 'Recovery Options'),
      status: status.recoveryEmail || status.recoveryPhone || status.backupCodes,
      statusLabel: (() => {
        const count = [
          status.recoveryEmail,
          status.recoveryPhone,
          ...(mfaMvpEnabled ? [status.backupCodes] : []),
        ].filter(Boolean).length;
        const expectedCount = mfaMvpEnabled ? 3 : 2;
        return count === expectedCount
          ? t('settings.securityOverview.allSet', 'All Set')
          : count > 0
            ? t('settings.securityOverview.partial', '{{count}}/{{total}} configured', {
                count,
                total: expectedCount,
              })
            : t('settings.securityOverview.notConfigured', 'Not Configured');
      })(),
      description: t(
        'settings.securityOverview.recoveryDesc',
        'Methods to recover your account if locked out'
      ),
      action: () => navigateTo('auth-access'),
      actionLabel: t('settings.securityOverview.configure', 'Configure'),
      color: 'amber' as const,
    },
  ];

  const recommendations = useMemo(() => {
    const recs: Array<{
      icon: React.ElementType;
      text: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    if (mfaMvpEnabled && !status.mfaEnabled) {
      recs.push({
        icon: Fingerprint,
        text: t(
          'settings.securityOverview.recMfa',
          'Enable two-factor authentication for maximum account protection'
        ),
        priority: 'high',
      });
    }
    if (!status.recoveryEmail && !status.recoveryPhone) {
      recs.push({
        icon: LifeBuoy,
        text: t(
          'settings.securityOverview.recRecovery',
          'Set up recovery options to avoid being locked out of your account'
        ),
        priority: 'high',
      });
    }
    if (mfaMvpEnabled && !status.backupCodes) {
      recs.push({
        icon: Key,
        text: t(
          'settings.securityOverview.recBackup',
          'Generate backup codes as a failsafe for account access'
        ),
        priority: 'medium',
      });
    }
    if (status.activeSessions > 3) {
      recs.push({
        icon: Monitor,
        text: t(
          'settings.securityOverview.recSessions',
          'You have many active sessions — review and revoke unused ones'
        ),
        priority: 'low',
      });
    }

    return recs;
  }, [mfaMvpEnabled, status, t]);

  const getStatusIcon = (eventStatus: string) => {
    switch (eventStatus) {
      case 'success':
        return <CheckCircle size={16} className="text-emerald-500" />;
      case 'failed':
        return <XCircle size={16} className="text-danger-500" />;
      case 'suspicious':
        return <AlertTriangle size={16} className="text-amber-500" />;
      default:
        return <CheckCircle size={16} className="text-c-text-secondary" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  const colorMap = {
    violet: {
      icon: 'bg-c-accent-soft text-c-accent',
      statusOk: 'text-emerald-400',
      statusBad: 'text-amber-400',
    },
    blue: {
      icon: 'bg-blue-500/10 text-blue-400',
      statusOk: 'text-emerald-400',
      statusBad: 'text-danger-400',
    },
    emerald: {
      icon: 'bg-emerald-500/10 text-emerald-400',
      statusOk: 'text-emerald-400',
      statusBad: 'text-c-text-secondary',
    },
    amber: {
      icon: 'bg-amber-500/10 text-amber-400',
      statusOk: 'text-emerald-400',
      statusBad: 'text-amber-400',
    },
  };

  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (scorePercentage / 100) * circumference;

  if (loadError) {
    return (
      <SettingsSection
        icon={Shield}
        title={t('settings.securityOverview.title', 'Security Overview')}
        description={t(
          'settings.securityOverview.description',
          'Monitor your account security status and manage protection settings'
        )}
        cardId="settings-security-overview"
        loading={loading}
        className={className}
      >
        <DegradedState title="Security overview unavailable" description={loadError} />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      icon={Shield}
      title={t('settings.securityOverview.title', 'Security Overview')}
      description={t(
        'settings.securityOverview.description',
        'Monitor your account security status and manage protection settings'
      )}
      cardId="settings-security-overview"
      loading={loading}
      className={className}
    >
      <div className="space-y-6">
        {/* Security Score Banner */}
        <div className={cn('p-5 rounded-lg border flex items-center gap-6', scoreBgColor)}>
          {/* Score Ring */}
          <div className="relative flex-shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-white/5"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className={cn(scoreRingColor, 'transition-all duration-1000 ease-out')}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-bold', scoreColor)}>{scorePercentage}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {scorePercentage >= 80 ? (
                <ShieldCheck size={18} className="text-emerald-400" />
              ) : (
                <ShieldAlert size={18} className={scoreColor} />
              )}
              <h4 className={cn('text-sm font-bold uppercase tracking-wider', scoreColor)}>
                {scoreLabel}
              </h4>
            </div>
            <p className="text-xs text-c-text-secondary leading-relaxed">
              {scorePercentage >= 80
                ? t(
                    'settings.securityOverview.scoreExcellentDesc',
                    'Your account is well-protected. Keep up the good security practices.'
                  )
                : scorePercentage >= 50
                  ? t(
                      'settings.securityOverview.scoreGoodDesc',
                      'Your account has basic protection. Enable additional features below for better security.'
                    )
                  : t(
                      'settings.securityOverview.scoreWeakDesc',
                      'Your account needs attention. Follow the recommendations below to improve security.'
                    )}
            </p>
          </div>
        </div>

        {/* Status Cards Grid */}
        <div>
          <h4 className="text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4">
            <Shield size={14} className="text-c-accent" />
            {t('settings.securityOverview.protectionStatus', 'Protection Status')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {statusCards.map((card) => {
              const Icon = card.icon;
              const colors = colorMap[card.color];
              return (
                <button
                  key={card.id}
                  onClick={card.action}
                  className="bg-c-surface-raised border border-c-border-subtle rounded-lg p-4 text-left hover:border-c-accent hover:bg-c-accent-soft transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', colors.icon)}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{card.title}</p>
                        <p
                          className={cn(
                            'text-xs font-semibold',
                            card.status ? colors.statusOk : colors.statusBad
                          )}
                        >
                          {card.statusLabel}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-c-text-secondary group-hover:text-c-accent transition-colors mt-1"
                    />
                  </div>
                  <p className="text-xs text-c-text-muted leading-relaxed">{card.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <>
            <SettingsDivider />
            <div>
              <h4 className="text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-amber-400" />
                {t('settings.securityOverview.recommendations', 'Recommendations')}
              </h4>
              <div className="space-y-2">
                {recommendations.map((rec, i) => {
                  const RecIcon = rec.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border',
                        rec.priority === 'high'
                          ? 'bg-danger-500/5 border-danger-500/15'
                          : rec.priority === 'medium'
                            ? 'bg-amber-500/5 border-amber-500/15'
                            : 'bg-c-surface/[0.02] border-white/5'
                      )}
                    >
                      <RecIcon
                        size={14}
                        className={cn(
                          'flex-shrink-0 mt-0.5',
                          rec.priority === 'high'
                            ? 'text-danger-400'
                            : rec.priority === 'medium'
                              ? 'text-amber-400'
                              : 'text-c-text-muted'
                        )}
                      />
                      <p className="text-xs text-c-text-secondary leading-relaxed">{rec.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Recent Security Events */}
        <SettingsDivider />
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2">
              <History size={14} className="text-c-accent" />
              {t('settings.securityOverview.recentActivity', 'Recent Activity')}
            </h4>
            <button
              onClick={() => navigateTo('auth-access')}
              className="text-xs text-c-accent hover:text-c-accent transition-colors flex items-center gap-1"
            >
              {t('settings.securityOverview.viewFullHistory', 'View full history')}
              <ArrowRight size={12} />
            </button>
          </div>

          {recentEvents.length > 0 ? (
            <div className="space-y-1.5">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <p className="text-sm text-white">{event.device || 'Unknown Device'}</p>
                      <p className="text-xs text-c-text-muted">
                        {event.location || 'Unknown'} · {event.ip || ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-c-text-muted">
                    {event.timestamp ? formatTimestamp(event.timestamp) : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 bg-c-surface-raised rounded-full mb-3">
                <History size={20} className="text-c-text-muted" />
              </div>
              <p className="text-sm text-c-text-muted">
                {t('settings.securityOverview.noEvents', 'No recent security events')}
              </p>
              <p className="text-xs text-c-text-secondary mt-1">
                {t(
                  'settings.securityOverview.noEventsDesc',
                  'Login attempts and security events will appear here'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
};

export default SecurityOverviewPage;
