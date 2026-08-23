import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Key,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface SecuritySettingsProps {
  currentUser: User;
}

interface Session {
  id: string;
  deviceInfo: string;
  ip: string;
  createdAt: string;
  lastUsed?: string;
  isCurrent?: boolean;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ currentUser }) => {
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

  // Password validation
  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    passwordsMatch: newPassword === confirmPassword && confirmPassword.length > 0,
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  // Fetch sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await Api.getActiveSessions();
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoadingSessions(false);
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

      // Refresh sessions as old ones were invalidated
      fetchSessions();
    } catch (error: any) {
      setPasswordError(
        error.message || t('settings.security.passwordChangeFailed', 'Failed to change password')
      );
      toast.error(error.message || 'Failed to change password');
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
    } catch (error) {
      toast.error(t('settings.security.sessionRevokeFailed', 'Failed to revoke session'));
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
    } catch (error) {
      toast.error(t('settings.security.revokeAllFailed', 'Failed to revoke sessions'));
    }
  };

  const getDeviceIcon = (deviceInfo: string) => {
    if (deviceInfo?.toLowerCase().includes('mobile')) return <Smartphone className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-c-text">
            {t('settings.security.title', 'Security')}
          </h2>
          <p className="text-sm text-c-text-muted">
            {t('settings.security.subtitle', 'Manage your password and active sessions')}
          </p>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden">
        <div className="p-6 border-b border-c-border-subtle dark:border-navy-700">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Key className="w-5 h-5 text-c-accent" />
            {t('settings.security.changePassword', 'Change Password')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.security.changePasswordDescription',
              'Update your password to keep your account secure'
            )}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.security.currentPassword', 'Current Password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-secondary" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.security.newPassword', 'New Password')}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-secondary" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Requirements */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                {
                  key: 'minLength',
                  label: t('settings.security.minLength', 'At least 8 characters'),
                },
                {
                  key: 'hasUppercase',
                  label: t('settings.security.hasUppercase', 'One uppercase letter'),
                },
                {
                  key: 'hasLowercase',
                  label: t('settings.security.hasLowercase', 'One lowercase letter'),
                },
                { key: 'hasNumber', label: t('settings.security.hasNumber', 'One number') },
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

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.security.confirmPassword', 'Confirm New Password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-secondary" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent transition-all"
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
              {t(
                'settings.security.passwordChangedSuccess',
                'Your password has been changed successfully. All other sessions have been logged out.'
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleChangePassword}
            disabled={!isPasswordValid || !currentPassword || isChangingPassword}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-c-accent-soft to-c-accent text-white font-medium hover:from-c-accent-soft hover:to-c-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('settings.security.changing', 'Changing...')}
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                {t('settings.security.changePasswordBtn', 'Change Password')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Sessions Section */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden">
        <div className="p-6 border-b border-c-border-subtle dark:border-navy-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              {t('settings.security.activeSessions', 'Active Sessions')}
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'settings.security.activeSessionsDescription',
                'Devices and browsers where you are currently logged in'
              )}
            </p>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAllSessions}
              className="px-4 py-2 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('settings.security.logoutAll', 'Log Out All Others')}
            </button>
          )}
        </div>

        <div className="divide-y divide-c-border-subtle dark:divide-white/5">
          {isLoadingSessions ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-c-accent" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-c-text-muted">
              {t('settings.security.noSessions', 'No active sessions found')}
            </div>
          ) : (
            (sessions || []).map((session) => (
              <div key={session.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-c-surface-raised flex items-center justify-center text-c-text-muted">
                    {getDeviceIcon(session.deviceInfo || '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-c-text">
                        {session.deviceInfo || 'Unknown Device'}
                      </p>
                      {session.isCurrent && (
                        <StatusChip
                          tone="success"
                          label={t('settings.security.currentSession', 'Current')}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-c-text-muted mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {session.ip || 'Unknown IP'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.createdAt
                          ? formatDate(session.createdAt)
                          : t('common.unknown', 'Unknown')}
                      </span>
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={isRevokingSession === session.id}
                    className="px-3 py-1.5 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isRevokingSession === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('settings.security.revoke', 'Revoke')
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Documents Section */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden">
        <div className="p-6 border-b border-c-border-subtle dark:border-navy-700">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-c-text-muted" />
            {t('settings.security.documents', 'Security Documentation')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.security.documentsDescription',
              'Learn about our security practices and compliance'
            )}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SecurityDocLink
            to="/security"
            icon={<Shield className="w-4 h-4" />}
            title="Security Overview"
            description="Our security practices"
          />
          <SecurityDocLink
            to="/legal/customer-security"
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Customer Data Security"
            description="How we protect your data"
          />
          <SecurityDocLink
            to="/legal/subprocessors"
            icon={<Users className="w-4 h-4" />}
            title="Sub-processors"
            description="Third-party services"
          />
        </div>
      </div>
    </div>
  );
};

interface SecurityDocLinkProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const SecurityDocLink: React.FC<SecurityDocLinkProps> = ({ to, icon, title, description }) => (
  <Link
    to={to}
    className="flex items-start gap-3 p-3 bg-c-surface-raised rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors group"
  >
    <div className="text-c-text-secondary group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-c-text-secondary group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
          {title}
        </span>
        <ExternalLink className="w-3 h-3 text-c-text-secondary" />
      </div>
      <span className="text-xs text-c-text-muted">{description}</span>
    </div>
  </Link>
);

export default SecuritySettings;
