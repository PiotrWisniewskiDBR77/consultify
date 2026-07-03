/**
 * SecuritySettings - Enterprise Security Management Component
 *
 * Features:
 * - Two-Factor Authentication management
 * - Password Policy configuration
 * - Session Management
 * - Login History viewer
 */

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  Eye,
  EyeOff,
  Globe,
  History,
  Key,
  Lock,
  LogOut,
  Monitor,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface SecuritySettingsData {
  organizationId: string;
  require2fa: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  maxSessionsPerUser: number;
  ipWhitelist: string[];
  updatedAt?: string;
}

interface Session {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt?: string;
  isCurrent?: boolean;
}

interface LoginHistoryItem {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent?: string;
  location?: string;
  status: 'success' | 'failed';
  failureReason?: string;
  createdAt: string;
}

interface TwoFAOrgStatus {
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    percentage: number;
  };
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    has2fa: boolean;
    enabledAt?: string;
  }>;
}

type ActiveTab = 'overview' | '2fa' | 'password' | 'sessions' | 'history';

export const SecuritySettings: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State
  const [settings, setSettings] = useState<SecuritySettingsData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAOrgStatus | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<SecuritySettingsData>>({});

  const token = localStorage.getItem('token');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/security/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSettings(data);
      setFormData(data);
    } catch (err) {
      console.error('Failed to load security settings:', err);
    }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    try {
      const [ownRes, allRes] = await Promise.all([
        fetch('/api/security/sessions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/security/sessions/all', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (ownRes.ok) {
        const data = await ownRes.json();
        setSessions(data.sessions || []);
      }

      if (allRes.ok) {
        const data = await allRes.json();
        setAllSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, [token]);

  const fetchLoginHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/security/login-history?all=true&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLoginHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load login history:', err);
    }
  }, [token]);

  const fetch2FAStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/security/2fa/org-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTwoFAStatus(data);
      }
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchSessions(), fetchLoginHistory(), fetch2FAStatus()]);
      setLoading(false);
    };
    loadData();
  }, [fetchSettings, fetchSessions, fetchLoginHistory, fetch2FAStatus]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/security/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('Security settings updated');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;

    try {
      const res = await fetch(`/api/security/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to terminate session');
      }

      toast.success('Session terminated');
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTerminateAllUserSessions = async (userId: string) => {
    if (!confirm('Are you sure you want to terminate all sessions for this user?')) return;

    try {
      const res = await fetch(`/api/security/sessions/user/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to terminate sessions');
      }

      toast.success('All sessions terminated');
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor size={16} />;
    if (
      userAgent.includes('Mobile') ||
      userAgent.includes('Android') ||
      userAgent.includes('iPhone')
    ) {
      return <Smartphone size={16} />;
    }
    return <Monitor size={16} />;
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Shield size={16} /> },
    { id: '2fa', label: '2FA', icon: <Smartphone size={16} /> },
    { id: 'password', label: 'Password Policy', icon: <Key size={16} /> },
    { id: 'sessions', label: 'Sessions', icon: <Users size={16} /> },
    { id: 'history', label: 'Login History', icon: <History size={16} /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs - Clean underline style */}
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-tab flex items-center gap-2 ${
              activeTab === tab.id ? 'admin-tab-active' : ''
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab - Clean minimal */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 2FA Status Card */}
          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Smartphone size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">2FA Adoption</span>
            </div>
            <p className="admin-metric-value">{twoFAStatus?.summary.percentage || 0}%</p>
            <p className="admin-metric-subtitle">
              {twoFAStatus?.summary.enabled || 0} of {twoFAStatus?.summary.total || 0} users enabled
            </p>
          </div>

          {/* Active Sessions Card */}
          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">Active Sessions</span>
            </div>
            <p className="admin-metric-value">{allSessions.length}</p>
            <p className="admin-metric-subtitle">Across all users</p>
          </div>

          {/* Password Policy Card */}
          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">Password Strength</span>
            </div>
            <p className="admin-metric-value">{settings?.passwordMinLength || 8}+</p>
            <p className="admin-metric-subtitle">Minimum characters</p>
          </div>

          {/* Session Timeout Card */}
          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">Session Timeout</span>
            </div>
            <p className="admin-metric-value">{settings?.sessionTimeoutMinutes || 480}m</p>
            <p className="admin-metric-subtitle">Auto-logout after inactivity</p>
          </div>
        </div>
      )}

      {/* 2FA Tab */}
      {activeTab === '2fa' && (
        <div className="space-y-6">
          {/* 2FA Requirement Toggle */}
          <div className="p-6 bg-c-surface-raised/50 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-c-text">Require 2FA for All Users</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  When enabled, all users must set up two-factor authentication to access the
                  system.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.require2fa || false}
                  onChange={(e) => setFormData({ ...formData, require2fa: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-c-surface-raised rounded-full peer peer-checked:bg-navy-900 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full peer-checked:translate-x-5 transition-transform"></div>
              </label>
            </div>
          </div>

          {/* 2FA Users List */}
          <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-c-text">User 2FA Status</h3>
            </div>
            <div className="divide-y divide-white/5">
              {twoFAStatus?.users.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-c-surface-raised flex items-center justify-center text-c-text font-medium">
                      {user.firstName?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-c-text font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.has2fa ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                        <Check size={14} /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-danger-500/20 text-danger-400 rounded-full text-sm">
                        <X size={14} /> Not Enabled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Password Policy Tab */}
      {activeTab === 'password' && (
        <div className="space-y-6">
          <div className="p-6 bg-c-surface-raised/50 rounded-xl border border-white/5 space-y-6">
            <h3 className="text-lg font-semibold text-c-text">Password Requirements</h3>

            {/* Minimum Length */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Minimum Password Length: {formData.passwordMinLength || 8} characters
              </label>
              <input
                type="range"
                min="6"
                max="32"
                value={formData.passwordMinLength || 8}
                onChange={(e) =>
                  setFormData({ ...formData, passwordMinLength: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>6</span>
                <span>32</span>
              </div>
            </div>

            {/* Character Requirements */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.passwordRequireUppercase || false}
                  onChange={(e) =>
                    setFormData({ ...formData, passwordRequireUppercase: e.target.checked })
                  }
                  className="w-5 h-5 rounded bg-c-surface-raised border-slate-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-slate-300">Require uppercase letter (A-Z)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.passwordRequireNumber || false}
                  onChange={(e) =>
                    setFormData({ ...formData, passwordRequireNumber: e.target.checked })
                  }
                  className="w-5 h-5 rounded bg-c-surface-raised border-slate-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-slate-300">Require number (0-9)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.passwordRequireSpecial || false}
                  onChange={(e) =>
                    setFormData({ ...formData, passwordRequireSpecial: e.target.checked })
                  }
                  className="w-5 h-5 rounded bg-c-surface-raised border-slate-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-slate-300">Require special character (!@#$%^&*)</span>
              </label>
            </div>

            {/* Password Expiry */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password Expiry (days, 0 = never)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={formData.passwordExpiryDays || 0}
                onChange={(e) =>
                  setFormData({ ...formData, passwordExpiryDays: parseInt(e.target.value) })
                }
                className="w-full bg-c-text text-c-bg border border-white/10 rounded-lg p-3"
              />
            </div>
          </div>

          {/* Session Settings */}
          <div className="p-6 bg-c-surface-raised/50 rounded-xl border border-white/5 space-y-6">
            <h3 className="text-lg font-semibold text-c-text">Session Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={formData.sessionTimeoutMinutes || 480}
                  onChange={(e) =>
                    setFormData({ ...formData, sessionTimeoutMinutes: parseInt(e.target.value) })
                  }
                  className="w-full bg-c-text text-c-bg border border-white/10 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Max Sessions Per User
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.maxSessionsPerUser || 5}
                  onChange={(e) =>
                    setFormData({ ...formData, maxSessionsPerUser: parseInt(e.target.value) })
                  }
                  className="w-full bg-c-text text-c-bg border border-white/10 rounded-lg p-3"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* All Organization Sessions */}
          <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-c-text">Active Sessions</h3>
              <button
                onClick={fetchSessions}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-400 dark:text-slate-500 hover:text-white"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full text-sm">
                <thead className="bg-c-bg text-slate-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Device</th>
                    <th className="px-4 py-3 text-left">IP Address</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No active sessions
                      </td>
                    </tr>
                  ) : (
                    allSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-c-text font-medium">{session.userName}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {session.userEmail}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-300">
                            {getDeviceIcon(session.userAgent)}
                            <span className="text-xs">{session.deviceInfo || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{session.ipAddress || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                          {session.lastActiveAt ? formatDate(session.lastActiveAt) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleTerminateSession(session.id)}
                            className="p-2 hover:bg-danger-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-danger-400"
                            title="Terminate session"
                          >
                            <LogOut size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Login History Tab */}
      {activeTab === 'history' && (
        <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text">Login History</h3>
            <button
              onClick={fetchLoginHistory}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-400 dark:text-slate-500 hover:text-white"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-c-bg text-slate-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">IP Address</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loginHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      No login history
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-c-text font-medium">{item.userName || 'Unknown'}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {item.userEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'success' ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs">
                            <Check size={14} /> Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-danger-400 text-xs">
                            <X size={14} /> Failed
                            {item.failureReason && (
                              <span className="text-slate-500 dark:text-slate-400">
                                ({item.failureReason})
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{item.ipAddress || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500">
                        {item.location || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySettings;
