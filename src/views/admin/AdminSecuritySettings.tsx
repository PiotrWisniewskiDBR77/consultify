/**
 * AdminSecuritySettings - Organization security settings
 *
 * HubSpot/ClickUp style enterprise security configuration
 */

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Key,
  Lock,
  RefreshCw,
  Shield,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface OAuthStatus {
  google: { configured: boolean; loginUrl: string };
  microsoft: { configured: boolean; loginUrl: string };
  linkedin: { configured: boolean; loginUrl: string };
}

interface AdminSecuritySettingsProps {
  className?: string;
}

interface SecuritySettingsSnapshot {
  mfaRequired: boolean;
  ssoEnabled: boolean;
  sessionTimeout: number;
  ipWhitelist: string;
  loginMaxAttempts: number;
  lockoutDuration: number;
}

const ADMIN_SECURITY_COPY = {
  loadUnavailableTitle: 'Security settings unavailable',
  loadUnavailableBody:
    'We could not load organization security settings. Retry before making policy changes.',
  oauthUnavailable: 'OAuth provider status unavailable',
  saveFailed: 'Failed to save security settings. Please try again.',
  saveNotConfirmed: 'Security settings save was not confirmed by the server',
};

function parseErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).code;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOAuthStatusPayload(raw: unknown): OAuthStatus {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const normalizeProvider = (provider: unknown): { configured: boolean; loginUrl: string } => {
    const entry =
      provider && typeof provider === 'object' ? (provider as Record<string, unknown>) : {};
    return {
      configured: Boolean(entry.configured),
      loginUrl: typeof entry.loginUrl === 'string' ? entry.loginUrl : '',
    };
  };
  return {
    google: normalizeProvider(value.google),
    microsoft: normalizeProvider(value.microsoft),
    linkedin: normalizeProvider(value.linkedin),
  };
}

const settingsMatch = (actual: SecuritySettingsSnapshot, expected: SecuritySettingsSnapshot) =>
  actual.mfaRequired === expected.mfaRequired &&
  actual.ssoEnabled === expected.ssoEnabled &&
  Number(actual.sessionTimeout) === Number(expected.sessionTimeout) &&
  actual.ipWhitelist === expected.ipWhitelist &&
  Number(actual.loginMaxAttempts) === Number(expected.loginMaxAttempts) &&
  Number(actual.lockoutDuration) === Number(expected.lockoutDuration);

export const AdminSecuritySettings: React.FC<AdminSecuritySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [loginMaxAttempts, setLoginMaxAttempts] = useState(5);
  const [lockoutDuration, setLockoutDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [oauthLoadError, setOauthLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchOAuthStatus();
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      setOauthLoadError(null);
      const response = await fetch('/api/auth/oauth/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setOAuthStatus(normalizeOAuthStatusPayload(data));
    } catch (error: unknown) {
      setOAuthStatus(null);
      setOauthLoadError(ADMIN_SECURITY_COPY.oauthUnavailable);
    }
  };

  const fetchSettings = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      setLoadError(null);
      const response = await fetch('/api/security/admin-settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const snapshot = {
        mfaRequired: data.mfaRequired ?? false,
        ssoEnabled: data.ssoEnabled ?? false,
        sessionTimeout: data.sessionTimeout ?? 30,
        ipWhitelist: data.ipWhitelist ?? '',
        loginMaxAttempts: data.loginMaxAttempts ?? 5,
        lockoutDuration: data.lockoutDuration ?? 30,
      } satisfies SecuritySettingsSnapshot;
      setMfaRequired(snapshot.mfaRequired);
      setSsoEnabled(snapshot.ssoEnabled);
      setSessionTimeout(snapshot.sessionTimeout);
      setIpWhitelist(snapshot.ipWhitelist);
      setLoginMaxAttempts(snapshot.loginMaxAttempts);
      setLockoutDuration(snapshot.lockoutDuration);
      return snapshot;
    } catch (error: unknown) {
      setLoadError(ADMIN_SECURITY_COPY.loadUnavailableBody);
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveErrorCode(null);
    try {
      const expected = {
        mfaRequired,
        ssoEnabled,
        sessionTimeout,
        ipWhitelist,
        loginMaxAttempts,
        lockoutDuration,
      } satisfies SecuritySettingsSnapshot;
      const response = await fetch('/api/security/admin-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(expected),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setSaveErrorCode(parseErrorCode(data));
        throw new Error(ADMIN_SECURITY_COPY.saveFailed);
      }
      const persisted = await fetchSettings(false);
      if (!persisted || !settingsMatch(persisted, expected)) {
        throw new Error(ADMIN_SECURITY_COPY.saveNotConfirmed);
      }
      toast.success(t('admin.security.saved', 'Security settings saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, ADMIN_SECURITY_COPY.saveFailed);
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 p-12"
        role="status"
        aria-live="polite"
        aria-label="Loading security settings"
      >
        <Clock className="w-8 h-8 text-slate-300 animate-spin" />
        <span className="text-sm text-c-text-muted">
          {t('admin.security.loading', 'Loading security settings...')}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
          <Shield size={24} />
          {t('admin.security.title', 'Security Settings')}
        </h2>
        <p className="text-sm text-c-text-muted mt-1">
          {t('admin.security.desc', 'Configure security policies for your organization')}
        </p>
      </div>

      {loadError ? (
        <div role="alert">
          <DegradedState title={ADMIN_SECURITY_COPY.loadUnavailableTitle} description={loadError} />
        </div>
      ) : (
        <>
          {/* MFA Requirement */}
          <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Key className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-c-text">
                    {t('admin.security.mfaTitle', 'Require Two-Factor Authentication')}
                  </h3>
                  <p className="text-sm text-c-text-muted mt-1">
                    {t(
                      'admin.security.mfaDesc',
                      'All users must enable 2FA to access the platform'
                    )}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={mfaRequired}
                  onChange={(e) => setMfaRequired(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          </div>

          {/* SSO */}
          <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Users className="text-primary-600 dark:text-primary-400" size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-c-text">
                    {t('admin.security.ssoTitle', 'Single Sign-On (SSO)')}
                  </h3>
                  <p className="text-sm text-c-text-muted mt-1">
                    {t(
                      'admin.security.ssoDesc',
                      'Allow users to sign in with your identity provider'
                    )}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={(e) => setSsoEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            {ssoEnabled && (
              <div className="mt-4 p-4 bg-c-surface-raised/50 rounded-lg">
                <p className="text-sm text-c-text-secondary">
                  {t('admin.security.ssoConfig', 'Contact support to configure your SSO provider.')}
                </p>
              </div>
            )}
          </div>

          {/* Session Timeout */}
          <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="flex gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="text-amber-600 dark:text-amber-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-c-text">
                  {t('admin.security.sessionTitle', 'Session Timeout')}
                </h3>
                <p className="text-sm text-c-text-muted mt-1">
                  {t('admin.security.sessionDesc', 'Automatically log out inactive users')}
                </p>
                <div className="mt-4">
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    className="px-3 py-2 border border-c-border rounded-lg bg-c-surface"
                  >
                    <option value={15}>15 {t('common.minutes', 'minutes')}</option>
                    <option value={30}>30 {t('common.minutes', 'minutes')}</option>
                    <option value={60}>1 {t('common.hour', 'hour')}</option>
                    <option value={120}>2 {t('common.hours', 'hours')}</option>
                    <option value={480}>8 {t('common.hours', 'hours')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* IP Whitelist */}
          <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="flex gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Lock className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-c-text">
                  {t('admin.security.ipTitle', 'IP Whitelist')}
                </h3>
                <p className="text-sm text-c-text-muted mt-1">
                  {t(
                    'admin.security.ipDesc',
                    'Restrict access to specific IP addresses (one per line)'
                  )}
                </p>
                <textarea
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  placeholder="192.168.1.0/24&#10;10.0.0.1"
                  rows={4}
                  className="mt-4 w-full px-3 py-2 border border-c-border rounded-lg bg-c-surface font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Login Protection */}
          <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="flex gap-4">
              <div className="p-3 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                <Shield className="text-danger-600 dark:text-danger-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-c-text">
                  {t('admin.security.loginProtection', 'Login Protection')}
                </h3>
                <p className="text-sm text-c-text-muted mt-1">
                  {t('admin.security.loginProtectionDesc', 'Protect against brute force attacks')}
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-c-text-secondary mb-1">
                      {t('admin.security.maxAttempts', 'Max Login Attempts')}
                    </label>
                    <select
                      value={loginMaxAttempts}
                      onChange={(e) => setLoginMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-c-border rounded-lg bg-c-surface"
                    >
                      <option value={3}>3 attempts</option>
                      <option value={5}>5 attempts</option>
                      <option value={10}>10 attempts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-c-text-secondary mb-1">
                      {t('admin.security.lockoutDuration', 'Lockout Duration')}
                    </label>
                    <select
                      value={lockoutDuration}
                      onChange={(e) => setLockoutDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-c-border rounded-lg bg-c-surface"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={1440}>24 hours</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OAuth Provider Status */}
          {oauthStatus ? (
            <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
              <div className="flex gap-4">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Zap className="text-primary-600 dark:text-primary-400" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-c-text">
                    {t('admin.security.oauthProviders', 'OAuth Providers')}
                  </h3>
                  <p className="text-sm text-c-text-muted mt-1">
                    {t('admin.security.oauthDesc', 'Social login providers for your users')}
                  </p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Google */}
                    <div
                      className={`p-4 rounded-lg border ${
                        oauthStatus.google.configured
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-c-surface-raised/50 border-c-border-subtle'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {oauthStatus.google.configured ? (
                          <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                        ) : (
                          <XCircle className="text-c-text-muted" size={18} />
                        )}
                        <span className="font-medium text-c-text">Google</span>
                      </div>
                      <p className="text-xs text-c-text-muted mt-1">
                        {oauthStatus.google.configured ? 'Configured' : 'Not configured'}
                      </p>
                    </div>

                    {/* Microsoft */}
                    <div
                      className={`p-4 rounded-lg border ${
                        oauthStatus.microsoft?.configured
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-c-surface-raised/50 border-c-border-subtle'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {oauthStatus.microsoft?.configured ? (
                          <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                        ) : (
                          <XCircle className="text-c-text-muted" size={18} />
                        )}
                        <span className="font-medium text-c-text">
                          Microsoft
                        </span>
                      </div>
                      <p className="text-xs text-c-text-muted mt-1">
                        {oauthStatus.microsoft?.configured ? 'Configured' : 'Not configured'}
                      </p>
                    </div>

                    {/* LinkedIn */}
                    <div
                      className={`p-4 rounded-lg border ${
                        oauthStatus.linkedin.configured
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-c-surface-raised/50 border-c-border-subtle'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {oauthStatus.linkedin.configured ? (
                          <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                        ) : (
                          <XCircle className="text-c-text-muted" size={18} />
                        )}
                        <span className="font-medium text-c-text">LinkedIn</span>
                      </div>
                      <p className="text-xs text-c-text-muted mt-1">
                        {oauthStatus.linkedin.configured ? 'Configured' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : oauthLoadError ? (
            <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
              <div role="alert">
                <DegradedState
                  title={ADMIN_SECURITY_COPY.oauthUnavailable}
                  description="Retry later or verify identity provider configuration before changing SSO policy."
                />
              </div>
            </div>
          ) : null}

          {/* Security Alert */}
          {saveError && (
            <div
              role="alert"
              className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
            >
              <p>{saveError}</p>
              {saveErrorCode ? (
                <p className="mt-1 font-mono text-xs">Code: {saveErrorCode}</p>
              ) : null}
            </div>
          )}

          {/* Security Alert */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0" size={20} />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t(
                'admin.security.warning',
                'Changes to security settings may affect all users immediately. Make sure to communicate changes to your team.'
              )}
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !!loadError}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors font-medium"
            >
              {saving && <RefreshCw size={16} className="animate-spin" />}
              {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminSecuritySettings;
