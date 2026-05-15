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

interface OAuthStatus {
  google: { configured: boolean; loginUrl: string };
  microsoft: { configured: boolean; loginUrl: string };
  linkedin: { configured: boolean; loginUrl: string };
}

interface AdminSecuritySettingsProps {
  className?: string;
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

function sameWhitespaceNormalized(left: string, right: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\r\n/g, '\n');
  return normalize(left) === normalize(right);
}

function normalizeSettingsPayload(raw: unknown): {
  mfaRequired: boolean;
  ssoEnabled: boolean;
  sessionTimeout: number;
  ipWhitelist: string;
  loginMaxAttempts: number;
  lockoutDuration: number;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const parseNumber = (input: unknown, fallback: number): number => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    mfaRequired: Boolean(value.mfaRequired),
    ssoEnabled: Boolean(value.ssoEnabled),
    sessionTimeout: parseNumber(value.sessionTimeout, 30),
    ipWhitelist: typeof value.ipWhitelist === 'string' ? value.ipWhitelist : '',
    loginMaxAttempts: parseNumber(value.loginMaxAttempts, 5),
    lockoutDuration: parseNumber(value.lockoutDuration, 30),
  };
}

function normalizeOAuthPayload(raw: unknown): OAuthStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const normalizeProvider = (
    key: 'google' | 'microsoft' | 'linkedin'
  ): { configured: boolean; loginUrl: string } => {
    const entry =
      value[key] && typeof value[key] === 'object' ? (value[key] as Record<string, unknown>) : {};
    return {
      configured: Boolean(entry.configured),
      loginUrl: typeof entry.loginUrl === 'string' ? entry.loginUrl : '',
    };
  };
  return {
    google: normalizeProvider('google'),
    microsoft: normalizeProvider('microsoft'),
    linkedin: normalizeProvider('linkedin'),
  };
}

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
  const [oauthStatusError, setOauthStatusError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);

  useEffect(() => {
    void Promise.allSettled([fetchSettings(), fetchOAuthStatus()]);
  }, []);

  const fetchOAuthStatus = async () => {
    setOauthStatusError(null);
    try {
      const response = await fetch('/api/auth/oauth/status');
      if (response.ok) {
        const data = await response.json();
        setOAuthStatus(normalizeOAuthPayload(data));
        return;
      }
      setOAuthStatus(null);
      setOauthStatusError(ADMIN_SECURITY_COPY.oauthUnavailable);
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
      setOAuthStatus(null);
      setOauthStatusError(ADMIN_SECURITY_COPY.oauthUnavailable);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/security/admin-settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        setLoadError(ADMIN_SECURITY_COPY.loadUnavailableTitle);
        return;
      }
      const data = normalizeSettingsPayload(await response.json());
      if (!data) {
        setLoadError(ADMIN_SECURITY_COPY.loadUnavailableTitle);
        return;
      }
      setMfaRequired(data.mfaRequired);
      setSsoEnabled(data.ssoEnabled);
      setSessionTimeout(data.sessionTimeout);
      setIpWhitelist(data.ipWhitelist);
      setLoginMaxAttempts(data.loginMaxAttempts);
      setLockoutDuration(data.lockoutDuration);
    } catch (error) {
      console.error('Failed to fetch security settings:', error);
      setLoadError(ADMIN_SECURITY_COPY.loadUnavailableTitle);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveErrorCode(null);
    setSaving(true);
    const expectedState = {
      mfaRequired,
      ssoEnabled,
      sessionTimeout,
      ipWhitelist,
      loginMaxAttempts,
      lockoutDuration,
    };
    try {
      const response = await fetch('/api/security/admin-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          mfaRequired,
          ssoEnabled,
          sessionTimeout,
          ipWhitelist,
          loginMaxAttempts,
          lockoutDuration,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const code = parseErrorCode(payload);
        setSaveError(ADMIN_SECURITY_COPY.saveFailed);
        setSaveErrorCode(code);
        toast.error(ADMIN_SECURITY_COPY.saveFailed);
        return;
      }

      const readBackResponse = await fetch('/api/security/admin-settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!readBackResponse.ok) {
        setSaveError(ADMIN_SECURITY_COPY.saveNotConfirmed);
        toast.error(ADMIN_SECURITY_COPY.saveNotConfirmed);
        return;
      }
      const readBackSettings = normalizeSettingsPayload(await readBackResponse.json());
      const isConfirmed =
        readBackSettings &&
        readBackSettings.mfaRequired === expectedState.mfaRequired &&
        readBackSettings.ssoEnabled === expectedState.ssoEnabled &&
        readBackSettings.sessionTimeout === expectedState.sessionTimeout &&
        sameWhitespaceNormalized(readBackSettings.ipWhitelist, expectedState.ipWhitelist) &&
        readBackSettings.loginMaxAttempts === expectedState.loginMaxAttempts &&
        readBackSettings.lockoutDuration === expectedState.lockoutDuration;
      if (!isConfirmed) {
        setSaveError(ADMIN_SECURITY_COPY.saveNotConfirmed);
        toast.error(ADMIN_SECURITY_COPY.saveNotConfirmed);
        return;
      }
      toast.success(t('admin.security.saved', 'Security settings saved'));
    } catch (error) {
      console.error('Failed to save security settings:', error);
      setSaveError(ADMIN_SECURITY_COPY.saveFailed);
      toast.error(ADMIN_SECURITY_COPY.saveFailed);
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
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t('admin.security.loading', 'Loading security settings...')}
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className={`rounded-xl border border-rose-300/70 bg-rose-50/90 p-4 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100 ${className}`}
      >
        <p className="font-semibold">{ADMIN_SECURITY_COPY.loadUnavailableTitle}</p>
        <p className="mt-1 text-sm">{ADMIN_SECURITY_COPY.loadUnavailableBody}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/70 bg-rose-50/90 p-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p>{saveError}</p>
          {saveErrorCode ? <p className="mt-1 font-mono text-xs">Code: {saveErrorCode}</p> : null}
        </div>
      )}
      {oauthStatusError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/70 bg-amber-50/90 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {oauthStatusError}
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield size={24} />
          {t('admin.security.title', 'Security Settings')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('admin.security.desc', 'Configure security policies for your organization')}
        </p>
      </div>

      {/* MFA Requirement */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Key className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {t('admin.security.mfaTitle', 'Require Two-Factor Authentication')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('admin.security.mfaDesc', 'All users must enable 2FA to access the platform')}
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>

      {/* SSO */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {t('admin.security.ssoTitle', 'Single Sign-On (SSO)')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('admin.security.ssoDesc', 'Allow users to sign in with your identity provider')}
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {ssoEnabled && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-navy-700/50 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('admin.security.ssoConfig', 'Contact support to configure your SSO provider.')}
            </p>
          </div>
        )}
      </div>

      {/* Session Timeout */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Clock className="text-amber-600 dark:text-amber-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('admin.security.sessionTitle', 'Session Timeout')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('admin.security.sessionDesc', 'Automatically log out inactive users')}
            </p>
            <div className="mt-4">
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
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
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Lock className="text-green-600 dark:text-green-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('admin.security.ipTitle', 'IP Whitelist')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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
              className="mt-4 w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Login Protection */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Shield className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('admin.security.loginProtection', 'Login Protection')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('admin.security.loginProtectionDesc', 'Protect against brute force attacks')}
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.security.maxAttempts', 'Max Login Attempts')}
                </label>
                <select
                  value={loginMaxAttempts}
                  onChange={(e) => setLoginMaxAttempts(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
                >
                  <option value={3}>3 attempts</option>
                  <option value={5}>5 attempts</option>
                  <option value={10}>10 attempts</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.security.lockoutDuration', 'Lockout Duration')}
                </label>
                <select
                  value={lockoutDuration}
                  onChange={(e) => setLockoutDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
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
      {oauthStatus && (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex gap-4">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Zap className="text-violet-600 dark:text-violet-400" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-slate-900 dark:text-white">
                {t('admin.security.oauthProviders', 'OAuth Providers')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('admin.security.oauthDesc', 'Social login providers for your users')}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Google */}
                <div
                  className={`p-4 rounded-lg border ${
                    oauthStatus.google.configured
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {oauthStatus.google.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400 dark:text-slate-500" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">Google</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {oauthStatus.google.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>

                {/* Microsoft */}
                <div
                  className={`p-4 rounded-lg border ${
                    oauthStatus.microsoft?.configured
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {oauthStatus.microsoft?.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400 dark:text-slate-500" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">Microsoft</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {oauthStatus.microsoft?.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>

                {/* LinkedIn */}
                <div
                  className={`p-4 rounded-lg border ${
                    oauthStatus.linkedin.configured
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {oauthStatus.linkedin.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400 dark:text-slate-500" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">LinkedIn</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {oauthStatus.linkedin.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors font-medium"
        >
          {saving && <RefreshCw size={16} className="animate-spin" />}
          {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
        </button>
      </div>
    </div>
  );
};

export default AdminSecuritySettings;
