/**
 * AdminSecuritySettings - Organization security settings
 * 
 * HubSpot/ClickUp style enterprise security configuration
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Shield, Key, Lock, Users, Clock, AlertTriangle, 
  CheckCircle, XCircle, ExternalLink, RefreshCw, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OAuthStatus {
  google: { configured: boolean; loginUrl: string };
  microsoft: { configured: boolean; loginUrl: string };
  linkedin: { configured: boolean; loginUrl: string };
}

interface AdminSecuritySettingsProps {
  className?: string;
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

  useEffect(() => {
    fetchSettings();
    fetchOAuthStatus();
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/oauth/status');
      if (response.ok) {
        const data = await response.json();
        setOAuthStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/security/admin-settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMfaRequired(data.mfaRequired ?? false);
        setSsoEnabled(data.ssoEnabled ?? false);
        setSessionTimeout(data.sessionTimeout ?? 30);
        setIpWhitelist(data.ipWhitelist ?? '');
        setLoginMaxAttempts(data.loginMaxAttempts ?? 5);
        setLockoutDuration(data.lockoutDuration ?? 30);
      }
    } catch (error) {
      console.error('Failed to fetch security settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/security/admin-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          mfaRequired, 
          ssoEnabled, 
          sessionTimeout, 
          ipWhitelist,
          loginMaxAttempts,
          lockoutDuration
        })
      });
      if (response.ok) {
        toast.success(t('admin.security.saved', 'Security settings saved'));
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (error: any) {
      toast.error(error.message || t('admin.security.saveError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Clock className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
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
              {t('admin.security.ipDesc', 'Restrict access to specific IP addresses (one per line)')}
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
                <div className={`p-4 rounded-lg border ${
                  oauthStatus.google.configured 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {oauthStatus.google.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">Google</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {oauthStatus.google.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>

                {/* Microsoft */}
                <div className={`p-4 rounded-lg border ${
                  oauthStatus.microsoft?.configured 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {oauthStatus.microsoft?.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">Microsoft</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {oauthStatus.microsoft?.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>

                {/* LinkedIn */}
                <div className={`p-4 rounded-lg border ${
                  oauthStatus.linkedin.configured 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-slate-50 dark:bg-navy-700/50 border-slate-200 dark:border-navy-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {oauthStatus.linkedin.configured ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-slate-400" size={18} />
                    )}
                    <span className="font-medium text-slate-900 dark:text-white">LinkedIn</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
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
          {t('admin.security.warning', 'Changes to security settings may affect all users immediately. Make sure to communicate changes to your team.')}
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

