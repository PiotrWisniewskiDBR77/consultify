/**
 * AuthenticationAccessPage — Consolidated Authentication & Access Management
 *
 * Single professional screen covering:
 * 1. Password management (collapsible)
 * 2. Two-Factor Authentication (collapsible)
 * 3. Active Sessions (inline list)
 * 4. Login History (recent feed)
 * 5. Recovery Options (collapsible)
 *
 * Uses unified SettingsSection pattern for consistency with DataControlsSettings.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  History,
  Key,
  LifeBuoy,
  Loader2,
  Lock,
  Mail,
  Monitor,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../lib/utils';
import { Api } from '../../../services/api';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { isMfaMvpEnabled } from '../../../utils/mfaMvpFlag';
import { DegradedState } from '../../Admin/AdminState';
import { MFASetup } from '../../Profile/MFASetup';
import { SettingsDivider, SettingsSection } from '../shared';

interface AuthenticationAccessPageProps {
  currentUser: User;
  onUpdateUser?: (updates: Partial<User>) => void;
  className?: string;
}

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

interface ActiveSessionsResponse {
  sessions?: Session[];
}

interface RecoveryOptionsResponse {
  recoveryEmail?: string;
  recoveryPhone?: string;
  backupCodesCount?: number;
}

type ExpandedPanel = 'password' | 'mfa' | 'recovery' | null;

export const AuthenticationAccessPage: React.FC<AuthenticationAccessPageProps> = ({
  currentUser,
  onUpdateUser,
  className = '',
}) => {
  const { t } = useTranslation();
  const mfaMvpEnabled = isMfaMvpEnabled();
  const [loading, setLoading] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const mfaSectionRef = useRef<HTMLDivElement>(null);

  const openMfaPanel = () => {
    setExpandedPanel('mfa');
    window.requestAnimationFrame(() => {
      mfaSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsLoadError, setSessionsLoadError] = useState<string | null>(null);

  // Login history state
  const [loginHistory, setLoginHistory] = useState<LoginEvent[]>([]);
  const [loginHistoryLoadError, setLoginHistoryLoadError] = useState<string | null>(null);

  // Recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [backupCodesCount, setBackupCodesCount] = useState(0);
  const [editingRecovery, setEditingRecovery] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);
  const [recoveryLoadError, setRecoveryLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [currentUser.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      setSessionsLoadError(null);
      setLoginHistoryLoadError(null);
      setRecoveryLoadError(null);
      const [sessionsRes, historyRes, recoveryRes] = await Promise.allSettled([
        Api.getActiveSessions(),
        Api.getLoginHistory(),
        Api.get('/settings/recovery'),
      ]);

      if (sessionsRes.status === 'fulfilled') {
        setSessions((sessionsRes.value as ActiveSessionsResponse)?.sessions || []);
      } else {
        setSessions([]);
        setSessionsLoadError(
          normalizeApiErrorMessage(sessionsRes.reason, 'Failed to load active sessions')
        );
      }

      if (historyRes.status === 'fulfilled') {
        setLoginHistory(Array.isArray(historyRes.value) ? historyRes.value.slice(0, 10) : []);
      } else {
        setLoginHistory([]);
        setLoginHistoryLoadError(
          normalizeApiErrorMessage(historyRes.reason, 'Failed to load login history')
        );
      }

      if (recoveryRes.status === 'fulfilled' && recoveryRes.value) {
        setRecoveryEmail(recoveryRes.value.recoveryEmail || '');
        setRecoveryPhone(recoveryRes.value.recoveryPhone || '');
        setBackupCodesCount(recoveryRes.value.backupCodesCount || 0);
      } else if (recoveryRes.status === 'rejected') {
        setRecoveryLoadError(
          normalizeApiErrorMessage(recoveryRes.reason, 'Failed to load recovery options')
        );
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load authentication data');
      setSessions([]);
      setLoginHistory([]);
      setRecoveryEmail('');
      setRecoveryPhone('');
      setBackupCodesCount(0);
      setSessionsLoadError(message);
      setLoginHistoryLoadError(message);
      setRecoveryLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  const togglePanel = (panel: ExpandedPanel) => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };

  // ─── Password Logic ───

  const passwordRequirements = [
    {
      met: newPassword.length >= 8,
      text: t('settings.password.req.length', 'At least 8 characters'),
    },
    {
      met: /[A-Z]/.test(newPassword),
      text: t('settings.password.req.uppercase', 'One uppercase letter'),
    },
    {
      met: /[a-z]/.test(newPassword),
      text: t('settings.password.req.lowercase', 'One lowercase letter'),
    },
    { met: /[0-9]/.test(newPassword), text: t('settings.password.req.number', 'One number') },
    {
      met: /[^A-Za-z0-9]/.test(newPassword),
      text: t('settings.password.req.special', 'One special character'),
    },
  ];

  const allRequirementsMet = passwordRequirements.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet || !passwordsMatch) return;

    setSavingPassword(true);
    try {
      await Api.changePassword(currentPassword, newPassword);
      toast.success(t('settings.password.success', 'Password changed successfully'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setExpandedPanel(null);
    } catch (_error) {
      toast.error(t('settings.password.error', 'Failed to change password'));
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Sessions Logic ───

  const terminateSession = async (sessionId: string) => {
    try {
      await Api.revokeSession(sessionId);
      await refreshSessions();
      toast.success(t('settings.security.sessionTerminated', 'Session terminated'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.security.sessionError', 'Failed to terminate session')
        )
      );
    }
  };

  const revokeAllSessions = async () => {
    try {
      await Api.revokeAllSessions();
      await refreshSessions();
      toast.success(t('settings.security.allSessionsRevoked', 'All other sessions revoked'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.security.revokeAllError', 'Failed to revoke sessions')
        )
      );
    }
  };

  const refreshSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await Api.getActiveSessions();
      setSessions((response as ActiveSessionsResponse)?.sessions || []);
      setSessionsLoadError(null);
    } catch (error: unknown) {
      setSessions([]);
      setSessionsLoadError(normalizeApiErrorMessage(error, 'Failed to load active sessions'));
      toast.error(t('settings.security.sessionsError', 'Failed to load sessions'));
    } finally {
      setLoadingSessions(false);
    }
  };

  // ─── Recovery Logic ───

  const handleSaveRecovery = async () => {
    if (!editingRecovery) return;
    setSavingRecovery(true);
    try {
      const updates =
        editingRecovery === 'email' ? { recoveryEmail: editValue } : { recoveryPhone: editValue };

      await Api.put('/settings/recovery', updates);
      const persisted = (await Api.get('/settings/recovery')) as RecoveryOptionsResponse | null;
      if (!persisted) {
        throw new Error('Recovery options were saved but could not be reloaded');
      }
      setRecoveryEmail(persisted.recoveryEmail || '');
      setRecoveryPhone(persisted.recoveryPhone || '');
      setBackupCodesCount(persisted.backupCodesCount || 0);
      toast.success(t('settings.recovery.saved', 'Recovery option updated'));
      setEditingRecovery(null);
      setEditValue('');
    } catch (_error) {
      toast.error(t('settings.recovery.saveFailed', 'Failed to save'));
    } finally {
      setSavingRecovery(false);
    }
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.substring(0, 2)}***@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{2})\d+(\d{2})/, '$1******$2');
  };

  const getDeviceIcon = (deviceInfo: string) => {
    const info = (deviceInfo || '').toLowerCase();
    if (info.includes('mobile') || info.includes('tablet')) return Smartphone;
    return Monitor;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} className="text-emerald-500" />;
      case 'failed':
        return <XCircle size={14} className="text-danger-500" />;
      case 'suspicious':
        return <AlertTriangle size={14} className="text-amber-500" />;
      default:
        return <CheckCircle size={14} className="text-c-text-secondary" />;
    }
  };

  const sectionLabel =
    'text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4';

  return (
    <SettingsSection
      icon={Lock}
      title={t('settings.authAccess.title', 'Authentication & Access')}
      description={t(
        'settings.authAccess.description',
        'Manage your password, two-factor authentication, sessions, and recovery options'
      )}
      cardId="settings-auth-access"
      loading={loading}
      className={className}
    >
      <div className="space-y-6">
        {/* ─── Password Section ─── */}
        <div>
          <h4 className={sectionLabel}>
            <Key size={14} className="text-c-accent" />
            {t('settings.authAccess.passwordSection', 'Password')}
          </h4>
          <div className="bg-c-surface-raised border border-c-border-subtle rounded-lg overflow-hidden">
            <button
              onClick={() => togglePanel('password')}
              className="w-full flex items-center justify-between p-4 hover:bg-c-surface/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-c-accent-soft rounded-lg">
                  <Key size={16} className="text-c-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-c-text">
                    {t('settings.authAccess.changePassword', 'Change Password')}
                  </p>
                  <p className="text-xs text-c-text-muted">
                    {t(
                      'settings.authAccess.changePasswordDesc',
                      'Update your password to keep your account secure'
                    )}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'text-c-text-muted transition-transform duration-200',
                  expandedPanel === 'password' && 'rotate-180'
                )}
              />
            </button>

            {expandedPanel === 'password' && (
              <div className="px-4 pb-4 border-t border-c-border-subtle">
                <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-c-text-secondary mb-1.5">
                      {t('settings.password.current', 'Current Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-c-text-secondary mb-1.5">
                      {t('settings.password.new', 'New Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted hover:text-c-text-muted transition-colors"
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {newPassword && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {passwordRequirements.map((req, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-1.5 text-xs',
                            req.met ? 'text-emerald-400' : 'text-c-text-muted'
                          )}
                        >
                          {req.met ? <Check size={12} /> : <X size={12} />}
                          {req.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-c-text-secondary mb-1.5">
                      {t('settings.password.confirm', 'Confirm New Password')}
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
                    />
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-danger-400 mt-1">
                        {t('settings.password.mismatch', 'Passwords do not match')}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!allRequirementsMet || !passwordsMatch || savingPassword}
                    className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPassword ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Key size={14} />
                    )}
                    {savingPassword
                      ? t('common.saving', 'Saving...')
                      : t('settings.password.update', 'Update Password')}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <SettingsDivider />

        {/* ─── Two-Factor Authentication Section ─── */}
        {mfaMvpEnabled ? (
          <div ref={mfaSectionRef}>
            <h4 className={sectionLabel}>
              <Fingerprint size={14} className="text-c-accent" />
              {t('settings.authAccess.mfaSection', 'Two-Factor Authentication')}
            </h4>
            <div className="bg-c-surface-raised border border-c-border-subtle rounded-lg overflow-hidden">
              <button
                onClick={() => togglePanel('mfa')}
                className="w-full flex items-center justify-between p-4 hover:bg-c-surface/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      currentUser?.mfaEnabled ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    )}
                  >
                    {currentUser?.mfaEnabled ? (
                      <ShieldCheck size={16} className="text-emerald-400" />
                    ) : (
                      <ShieldOff size={16} className="text-amber-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-c-text">
                        {t('settings.authAccess.twoFactor', 'Two-Factor Authentication')}
                      </p>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
                          currentUser?.mfaEnabled
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        )}
                      >
                        {currentUser?.mfaEnabled
                          ? t('settings.authAccess.on', 'ON')
                          : t('settings.authAccess.off', 'OFF')}
                      </span>
                    </div>
                    <p className="text-xs text-c-text-muted">
                      {currentUser?.mfaEnabled
                        ? t(
                            'settings.authAccess.mfaActiveDesc',
                            'Your account is protected with 2FA'
                          )
                        : t(
                            'settings.authAccess.mfaInactiveDesc',
                            'Add an extra layer of security to your account'
                          )}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    'text-c-text-muted transition-transform duration-200',
                    expandedPanel === 'mfa' && 'rotate-180'
                  )}
                />
              </button>

              {expandedPanel === 'mfa' && (
                <div className="border-t border-c-border-subtle pt-4 pb-2">
                  <MFASetup
                    isEnabled={currentUser?.mfaEnabled || false}
                    onUpdate={() => onUpdateUser?.({})}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div data-testid="mfa-mvp-disabled" role="status">
            <h4 className={sectionLabel}>
              <Fingerprint size={14} className="text-c-text-muted" />
              {t('settings.authAccess.mfaSection', 'Two-Factor Authentication')}
            </h4>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
              <p className="text-sm font-medium text-c-text">
                {t('settings.authAccess.mfaDeferredTitle', 'Not available in the MVP demo')}
              </p>
              <p className="mt-1 text-xs text-c-text-muted">
                {t(
                  'settings.authAccess.mfaDeferredDescription',
                  'MFA setup and recovery are deferred to the next hardening round.'
                )}
              </p>
            </div>
          </div>
        )}

        <SettingsDivider />

        {/* ─── Active Sessions Section ─── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className={sectionLabel + ' mb-0'}>
              <Globe size={14} className="text-c-accent" />
              {t('settings.authAccess.sessionsSection', 'Active Sessions')}
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshSessions}
                className="p-1.5 text-c-text-muted hover:text-c-accent transition-colors rounded-md hover:bg-c-surface-raised"
              >
                <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
              </button>
              {sessions.length > 1 && (
                <button
                  onClick={revokeAllSessions}
                  className="text-xs text-danger-400 hover:text-danger-300 transition-colors px-2 py-1 rounded-md hover:bg-danger-500/10"
                >
                  {t('settings.authAccess.revokeAll', 'Revoke All Others')}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.deviceInfo || session.device || '');
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-c-surface-raised rounded-lg">
                      <DeviceIcon size={16} className="text-c-text-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-c-text">
                          {session.deviceInfo || session.device || 'Unknown Device'}
                          {session.browser ? ` · ${session.browser}` : ''}
                        </p>
                        {session.current && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full">
                            {t('settings.authAccess.current', 'Current')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-c-text-muted">
                        {session.location || session.ipAddress || 'Unknown'} ·{' '}
                        {session.lastActive || session.lastUsedAt || 'Recently'}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <button
                      onClick={() => terminateSession(session.id)}
                      className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                      title={t('settings.authAccess.terminate', 'Terminate')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            {sessionsLoadError && (
              <DegradedState title="Active sessions unavailable" description={sessionsLoadError} />
            )}

            {!sessionsLoadError && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Monitor size={20} className="text-c-text-secondary mb-2" />
                <p className="text-xs text-c-text-muted">
                  {t('settings.authAccess.noSessions', 'No active sessions found')}
                </p>
              </div>
            )}
          </div>
        </div>

        <SettingsDivider />

        {/* ─── Login History Section ─── */}
        <div>
          <h4 className={sectionLabel}>
            <History size={14} className="text-c-accent" />
            {t('settings.authAccess.loginHistorySection', 'Login History')}
          </h4>

          {loginHistoryLoadError ? (
            <DegradedState title="Login history unavailable" description={loginHistoryLoadError} />
          ) : loginHistory.length > 0 ? (
            <div className="space-y-1.5">
              {loginHistory.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <p className="text-sm text-c-text">{event.device || 'Unknown Device'}</p>
                      <p className="text-xs text-c-text-muted">
                        {event.location || 'Unknown'} · {event.ip || ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-c-text-muted">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <History size={20} className="text-c-text-secondary mb-2" />
              <p className="text-xs text-c-text-muted">
                {t('settings.authAccess.noHistory', 'No login history available')}
              </p>
            </div>
          )}
        </div>

        <SettingsDivider />

        {/* ─── Recovery Options Section ─── */}
        <div>
          <h4 className={sectionLabel}>
            <LifeBuoy size={14} className="text-c-accent" />
            {t('settings.authAccess.recoverySection', 'Recovery Options')}
          </h4>

          <div className="space-y-3">
            {recoveryLoadError && (
              <DegradedState title="Recovery options unavailable" description={recoveryLoadError} />
            )}
            {!recoveryLoadError && (
              <>
                {/* Recovery Email */}
                <div className="bg-c-surface-raised border border-c-border-subtle rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-c-text">
                          {t('settings.authAccess.recoveryEmail', 'Recovery Email')}
                        </p>
                        {editingRecovery !== 'email' && (
                          <p className="text-xs text-c-text-muted">
                            {recoveryEmail
                              ? maskEmail(recoveryEmail)
                              : t('settings.authAccess.notConfigured', 'Not configured')}
                          </p>
                        )}
                      </div>
                    </div>
                    {editingRecovery !== 'email' && (
                      <div className="flex items-center gap-2">
                        {recoveryEmail && <Check size={14} className="text-emerald-400" />}
                        <button
                          onClick={() => {
                            setEditingRecovery('email');
                            setEditValue(recoveryEmail);
                          }}
                          className="text-xs text-c-accent hover:text-c-accent px-2 py-1 rounded-md hover:bg-c-accent-soft transition-colors"
                        >
                          {recoveryEmail ? t('common.change', 'Change') : t('common.add', 'Add')}
                        </button>
                      </div>
                    )}
                  </div>
                  {editingRecovery === 'email' && (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={t(
                          'settings.authAccess.emailPlaceholder',
                          'Enter recovery email'
                        )}
                        className="flex-1 px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
                      />
                      <button
                        onClick={handleSaveRecovery}
                        disabled={savingRecovery}
                        className="px-3 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {savingRecovery
                          ? t('common.saving', 'Saving...')
                          : t('common.save', 'Save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRecovery(null);
                          setEditValue('');
                        }}
                        className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle text-c-text-secondary rounded-lg text-xs font-medium hover:bg-c-surface-raised transition-colors"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Recovery Phone */}
                <div className="bg-c-surface-raised border border-c-border-subtle rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Phone size={14} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-c-text">
                          {t('settings.authAccess.recoveryPhone', 'Recovery Phone')}
                        </p>
                        {editingRecovery !== 'phone' && (
                          <p className="text-xs text-c-text-muted">
                            {recoveryPhone
                              ? maskPhone(recoveryPhone)
                              : t('settings.authAccess.notConfigured', 'Not configured')}
                          </p>
                        )}
                      </div>
                    </div>
                    {editingRecovery !== 'phone' && (
                      <div className="flex items-center gap-2">
                        {recoveryPhone && <Check size={14} className="text-emerald-400" />}
                        <button
                          onClick={() => {
                            setEditingRecovery('phone');
                            setEditValue(recoveryPhone);
                          }}
                          className="text-xs text-c-accent hover:text-c-accent px-2 py-1 rounded-md hover:bg-c-accent-soft transition-colors"
                        >
                          {recoveryPhone ? t('common.change', 'Change') : t('common.add', 'Add')}
                        </button>
                      </div>
                    )}
                  </div>
                  {editingRecovery === 'phone' && (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="tel"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={t('settings.authAccess.phonePlaceholder', '+48...')}
                        className="flex-1 px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
                      />
                      <button
                        onClick={handleSaveRecovery}
                        disabled={savingRecovery}
                        className="px-3 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {savingRecovery
                          ? t('common.saving', 'Saving...')
                          : t('common.save', 'Save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRecovery(null);
                          setEditValue('');
                        }}
                        className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle text-c-text-secondary rounded-lg text-xs font-medium hover:bg-c-surface-raised transition-colors"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Backup Codes belong to the same deferred MFA contract. */}
                {mfaMvpEnabled && (
                  <div className="bg-c-surface-raised border border-c-border-subtle rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-c-accent-soft rounded-lg">
                          <Key size={14} className="text-c-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-c-text">
                            {t('settings.authAccess.backupCodes', 'Backup Codes')}
                          </p>
                          <p className="text-xs text-c-text-muted">
                            {backupCodesCount > 0
                              ? t(
                                  'settings.authAccess.codesRemaining',
                                  '{{count}} codes remaining',
                                  {
                                    count: backupCodesCount,
                                  }
                                )
                              : currentUser?.mfaEnabled
                                ? t(
                                    'settings.authAccess.noCodesGenerate',
                                    'No backup codes — generate a new set from your 2FA settings'
                                  )
                                : t(
                                    'settings.authAccess.codesNeedMfa',
                                    'Backup codes are created when you set up two-factor authentication'
                                  )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {backupCodesCount > 0 ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <button
                            onClick={openMfaPanel}
                            className="text-xs text-c-accent hover:text-c-accent px-2 py-1 rounded-md hover:bg-c-accent-soft transition-colors whitespace-nowrap"
                          >
                            {currentUser?.mfaEnabled
                              ? t('settings.authAccess.generateCodes', 'Generate codes')
                              : t('settings.authAccess.setUp2fa', 'Set up 2FA')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};

export default AuthenticationAccessPage;
