/**
 * PasswordSecuritySettings - Combined Password & Security Tab
 *
 * Consolidates:
 * - Password Change
 * - Two-Factor Authentication (MFA)
 * - Active Sessions
 * - Recovery Options
 * - Security Events
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { MFASetup } from '../Profile/MFASetup';

interface PasswordSecuritySettingsProps {
  currentUser: User;
}

interface Session {
  id: string;
  deviceInfo: string;
  device?: string;
  browser?: string;
  location?: string;
  ipAddress?: string;
  ip?: string;
  lastActive?: string;
  lastUsedAt?: string;
  createdAt?: string;
  current: boolean;
  isCurrent?: boolean;
}

interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  ipAddress: string;
  location?: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

interface RecoveryOptions {
  recoveryEmail: string;
  recoveryPhone: string;
  backupCodesCount: number;
  lastBackupCodesGenerated?: string;
}

const normalizeRecoveryOptions = (response: Partial<RecoveryOptions> | null): RecoveryOptions => ({
  recoveryEmail: response?.recoveryEmail || '',
  recoveryPhone: response?.recoveryPhone || '',
  backupCodesCount: response?.backupCodesCount || 0,
  lastBackupCodesGenerated: response?.lastBackupCodesGenerated,
});

const recoveryOptionsMatch = (
  actual: RecoveryOptions,
  expected: Pick<RecoveryOptions, 'recoveryEmail' | 'recoveryPhone'>
) =>
  actual.recoveryEmail === expected.recoveryEmail &&
  actual.recoveryPhone === expected.recoveryPhone;

export const PasswordSecuritySettings: React.FC<PasswordSecuritySettingsProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  // Recovery options state
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOptions>({
    recoveryEmail: '',
    recoveryPhone: '',
    backupCodesCount: 0,
  });
  const [editingRecovery, setEditingRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);
  const [recoveryLoadError, setRecoveryLoadError] = useState<string | null>(null);
  const [recoveryActionError, setRecoveryActionError] = useState<string | null>(null);

  // Security events state
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    password: true,
    mfa: false,
    sessions: false,
    recovery: false,
    events: false,
  });

  // Password validation
  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    passwordsMatch: newPassword === confirmPassword && confirmPassword.length > 0,
  };

  const passwordStrength = Object.values(passwordRequirements).filter(Boolean).length;
  const isPasswordValid =
    passwordRequirements.minLength &&
    passwordRequirements.hasUppercase &&
    passwordRequirements.hasLowercase &&
    passwordRequirements.hasNumber &&
    passwordRequirements.passwordsMatch;

  useEffect(() => {
    fetchSessions();
    fetchSecurityEvents();
    fetchRecoveryOptions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await Api.getActiveSessions();
      setSessions(response.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      setLoadingEvents(true);
      const response = await Api.get('/api/security/events?limit=10');
      setSecurityEvents(response.events || []);
    } catch {
      setSecurityEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchRecoveryOptions = async () => {
    try {
      setRecoveryLoadError(null);
      const response = await Api.get('/api/settings/recovery');
      const snapshot = normalizeRecoveryOptions(response);
      setRecoveryOptions(snapshot);
      setRecoveryEmail(snapshot.recoveryEmail);
      setRecoveryPhone(snapshot.recoveryPhone);
      return snapshot;
    } catch (error: unknown) {
      setRecoveryLoadError(normalizeApiErrorMessage(error, 'Failed to load recovery options'));
      return null;
    }
  };

  const handleChangePassword = async () => {
    if (!isPasswordValid) {
      setPasswordError(
        t('settings.security.invalidPassword', 'Please meet all password requirements')
      );
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await Api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settings.security.passwordChanged', 'Password changed successfully!'));
      fetchSessions();
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.security.passwordChangeFailed', 'Failed to change password')
      );
      setPasswordError(message);
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevokingSession(sessionId);
    try {
      await Api.revokeSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success(t('settings.security.sessionRevoked', 'Session revoked successfully'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.security.sessionRevokeFailed', 'Failed to revoke session')
        )
      );
    } finally {
      setIsRevokingSession(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (
      !confirm(
        t(
          'settings.security.revokeAllConfirm',
          'Are you sure you want to log out of all other devices?'
        )
      )
    ) {
      return;
    }
    try {
      await Api.revokeAllSessions();
      fetchSessions();
      toast.success(
        t('settings.security.allSessionsRevoked', 'All other sessions have been logged out')
      );
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.security.revokeAllFailed', 'Failed to revoke sessions')
        )
      );
    }
  };

  const handleSaveRecovery = async () => {
    setSavingRecovery(true);
    setRecoveryActionError(null);
    try {
      const expected = { recoveryEmail, recoveryPhone };
      await Api.put('/api/settings/recovery', {
        recoveryEmail,
        recoveryPhone,
      });
      const persisted = await fetchRecoveryOptions();
      if (!persisted || !recoveryOptionsMatch(persisted, expected)) {
        throw new Error('Recovery options were not confirmed by the server');
      }
      setEditingRecovery(false);
      toast.success('Recovery options updated');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to update recovery options');
      setRecoveryActionError(message);
      toast.error(message);
    } finally {
      setSavingRecovery(false);
    }
  };

  const getDeviceIcon = (deviceInfo: string) => {
    const info = (deviceInfo || '').toLowerCase();
    if (info.includes('mobile') || info.includes('iphone') || info.includes('android'))
      return Smartphone;
    return Monitor;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Styles
  const sectionClass =
    'bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden';
  const sectionHeaderClass =
    'p-4 flex items-center justify-between cursor-pointer hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors';
  const inputClass =
    'w-full px-4 py-3 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <ShieldCheck className="w-6 h-6 text-c-text" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-c-text">
            {t('settings.security.title', 'Password & Security')}
          </h2>
          <p className="text-sm text-c-text-muted">
            {t('settings.security.subtitle', 'Manage your password, 2FA, and account security')}
          </p>
        </div>
      </div>

      {/* Password Change Section */}
      <div className={sectionClass}>
        <button onClick={() => toggleSection('password')} className={sectionHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-c-accent-soft dark:bg-c-accent-soft rounded-lg">
              <Key className="w-5 h-5 text-c-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-c-text">
                {t('settings.security.changePassword', 'Change Password')}
              </h3>
              <p className="text-sm text-c-text-muted">
                {t('settings.security.changePasswordDescription', 'Update your password regularly')}
              </p>
            </div>
          </div>
          {expandedSections.password ? (
            <ChevronDown className="w-5 h-5 text-c-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-muted" />
          )}
        </button>

        {expandedSections.password && (
          <div className="p-6 border-t border-c-border-subtle dark:border-navy-700 space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.security.currentPassword', 'Current Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-muted" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass + ' pl-11 pr-11'}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted hover:text-c-text-secondary"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.security.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-muted" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass + ' pl-11 pr-11'}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted hover:text-c-text-secondary"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength */}
              {newPassword && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= passwordStrength
                            ? passwordStrength <= 2
                              ? 'bg-danger-500'
                              : passwordStrength <= 4
                                ? 'bg-yellow-500'
                                : 'bg-emerald-500'
                            : 'bg-c-surface-raised'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'minLength', label: 'At least 8 characters' },
                      { key: 'hasUppercase', label: 'One uppercase letter' },
                      { key: 'hasLowercase', label: 'One lowercase letter' },
                      { key: 'hasNumber', label: 'One number' },
                      { key: 'hasSpecial', label: 'One special character' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {passwordRequirements[key as keyof typeof passwordRequirements] ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-c-border-subtle" />
                        )}
                        <span
                          className={
                            passwordRequirements[key as keyof typeof passwordRequirements]
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-c-text-muted'
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.security.confirmPassword', 'Confirm New Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-muted" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass + ' pl-11 pr-11'}
                  placeholder="••••••••"
                />
                {confirmPassword && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordRequirements.passwordsMatch ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-danger-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error/Success Messages */}
            {passwordError && (
              <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 text-danger-700 dark:text-danger-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Password changed successfully!
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleChangePassword}
              disabled={!isPasswordValid || !currentPassword || isChangingPassword}
              className="w-full py-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Change Password
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div className={sectionClass}>
        <button onClick={() => toggleSection('mfa')} className={sectionHeaderClass}>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${currentUser.mfaEnabled ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-c-surface-raised'}`}
            >
              <Shield
                className={`w-5 h-5 ${currentUser.mfaEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-c-text-muted'}`}
              />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-c-text">
                  {t('settings.security.twoFactor', 'Two-Factor Authentication')}
                </h3>
                {currentUser.mfaEnabled ? (
                  <StatusChip tone="success" label="Enabled" />
                ) : (
                  <StatusChip tone="warning" label="Not enabled" />
                )}
              </div>
              <p className="text-sm text-c-text-muted">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          {expandedSections.mfa ? (
            <ChevronDown className="w-5 h-5 text-c-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-muted" />
          )}
        </button>

        {expandedSections.mfa && (
          <div className="p-6 border-t border-c-border-subtle dark:border-navy-700">
            <MFASetup
              isEnabled={!!currentUser.mfaEnabled}
              onUpdate={() => window.location.reload()}
            />
          </div>
        )}
      </div>

      {/* Active Sessions Section */}
      <div className={sectionClass}>
        <button onClick={() => toggleSection('sessions')} className={sectionHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-c-text">
                {t('settings.security.activeSessions', 'Active Sessions')}
              </h3>
              <p className="text-sm text-c-text-muted">
                {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {expandedSections.sessions ? (
            <ChevronDown className="w-5 h-5 text-c-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-muted" />
          )}
        </button>

        {expandedSections.sessions && (
          <div className="border-t border-c-border-subtle dark:border-navy-700">
            {sessions.length > 1 && (
              <div className="p-4 border-b border-c-border-subtle dark:border-navy-700 flex justify-end">
                <button
                  onClick={handleRevokeAllSessions}
                  className="px-4 py-2 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out All Others
                </button>
              </div>
            )}
            <div className="divide-y divide-c-border-subtle dark:divide-white/5">
              {isLoadingSessions ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-c-accent" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-c-text-muted">
                  No active sessions found
                </div>
              ) : (
                sessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.deviceInfo || session.device || '');
                  return (
                    <div key={session.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-c-surface-raised flex items-center justify-center text-c-text-muted">
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-c-text">
                              {session.deviceInfo || session.device || 'Unknown Device'}
                              {session.browser && ` - ${session.browser}`}
                            </p>
                            {(session.current || session.isCurrent) && (
                              <StatusChip tone="success" label="Current" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-c-text-muted mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.location || session.ipAddress || session.ip || 'Unknown'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.lastActive ||
                                session.lastUsedAt ||
                                (session.createdAt ? formatDate(session.createdAt) : 'Recently')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!(session.current || session.isCurrent) && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={isRevokingSession === session.id}
                          className="px-3 py-1.5 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isRevokingSession === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Revoke'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recovery Options Section */}
      <div className={sectionClass}>
        <button onClick={() => toggleSection('recovery')} className={sectionHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-c-text">
                {t('settings.security.recoveryOptions', 'Recovery Options')}
              </h3>
              <p className="text-sm text-c-text-muted">
                Backup methods to recover your account
              </p>
            </div>
          </div>
          {expandedSections.recovery ? (
            <ChevronDown className="w-5 h-5 text-c-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-muted" />
          )}
        </button>

        {expandedSections.recovery && (
          <div className="p-6 border-t border-c-border-subtle dark:border-navy-700 space-y-4">
            {recoveryLoadError ? (
              <div
                role="alert"
                className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
              >
                Recovery options unavailable: {recoveryLoadError}
              </div>
            ) : !editingRecovery ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-c-text-muted" />
                      <div>
                        <p className="text-sm font-medium text-c-text-secondary">
                          Recovery Email
                        </p>
                        <p className="text-sm text-c-text-muted">
                          {recoveryOptions.recoveryEmail || 'Not set'}
                        </p>
                      </div>
                    </div>
                    {recoveryOptions.recoveryEmail ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-c-text-muted" />
                      <div>
                        <p className="text-sm font-medium text-c-text-secondary">
                          Recovery Phone
                        </p>
                        <p className="text-sm text-c-text-muted">
                          {recoveryOptions.recoveryPhone || 'Not set'}
                        </p>
                      </div>
                    </div>
                    {recoveryOptions.recoveryPhone ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
                    <div className="flex items-center gap-3">
                      <Download className="w-5 h-5 text-c-text-muted" />
                      <div>
                        <p className="text-sm font-medium text-c-text-secondary">
                          Backup Codes
                        </p>
                        <p className="text-sm text-c-text-muted">
                          {recoveryOptions.backupCodesCount > 0
                            ? `${recoveryOptions.backupCodesCount} codes remaining`
                            : 'Generate via 2FA settings'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setEditingRecovery(true)}
                  className="w-full py-2 text-sm font-medium text-c-accent hover:bg-c-accent-soft dark:hover:bg-c-accent-soft rounded-lg transition-colors"
                >
                  Edit Recovery Options
                </button>
              </>
            ) : (
              <div className="space-y-4">
                {recoveryActionError && (
                  <div
                    role="alert"
                    className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
                  >
                    {recoveryActionError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Recovery Email
                  </label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="backup@example.com"
                    className={inputClass}
                  />
                  <p className="text-xs text-c-text-muted mt-1">
                    Use a different email than your primary account email
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Recovery Phone
                  </label>
                  <input
                    type="tel"
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(e.target.value)}
                    placeholder="+1234567890"
                    className={inputClass}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveRecovery}
                    disabled={savingRecovery}
                    className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingRecovery ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => setEditingRecovery(false)}
                    className="px-6 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-700 text-c-text-secondary rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security Events Section */}
      <div className={sectionClass}>
        <button onClick={() => toggleSection('events')} className={sectionHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-c-surface-raised rounded-lg">
              <Activity className="w-5 h-5 text-c-text-secondary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-c-text">
                {t('settings.security.recentActivity', 'Security Events')}
              </h3>
              <p className="text-sm text-c-text-muted">
                Recent security-related activity on your account
              </p>
            </div>
          </div>
          {expandedSections.events ? (
            <ChevronDown className="w-5 h-5 text-c-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-c-text-muted" />
          )}
        </button>

        {expandedSections.events && (
          <div className="border-t border-c-border-subtle dark:border-navy-700">
            {loadingEvents ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-c-accent" />
              </div>
            ) : securityEvents.length === 0 ? (
              <div className="p-8 text-center text-c-text-muted">
                No recent security events
              </div>
            ) : (
              <div className="divide-y divide-c-border-subtle dark:divide-white/5">
                {securityEvents.map((event) => (
                  <div key={event.id} className="p-4 flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        event.status === 'success'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20'
                          : event.status === 'warning'
                            ? 'bg-amber-100 dark:bg-amber-500/20'
                            : 'bg-danger-100 dark:bg-danger-500/20'
                      }`}
                    >
                      {event.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : event.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-c-text">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-c-text-muted mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location || event.ipAddress}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordSecuritySettings;
