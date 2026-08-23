/**
 * AdvancedSecuritySettings - Extended Security Features
 *
 * Features:
 * - Password history (prevent reuse)
 * - Password expiration policy
 * - IP whitelist/blacklist
 * - Geolocation-based security alerts
 * - Suspicious activity detection
 * - Security questions backup
 * - Recovery email/phone
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  Key,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface AdvancedSecuritySettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface IPRule {
  id: string;
  ip_address: string;
  rule_type: 'allow' | 'block';
  description: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}

interface SecurityQuestion {
  id: string;
  question_id: number;
  question_text: string;
  custom_question?: string;
  created_at: string;
}

interface RecoveryContact {
  id: string;
  contact_type: 'email' | 'phone' | 'trusted_person';
  contact_value: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
}

interface LoginLocation {
  id: string;
  ip_address: string;
  country: string;
  region: string;
  city: string;
  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;
  risk_score: number;
  is_trusted: boolean;
  created_at: string;
}

interface SuspiciousActivity {
  id: string;
  activity_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: any;
  ip_address: string;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

interface PredefinedQuestion {
  id: number;
  question_text: string;
  category: string;
}

interface SecuritySettings {
  enable_geolocation_alerts: boolean;
  trusted_countries: string[];
  require_reauth_minutes: number;
  single_session_only: boolean;
  notify_new_login: boolean;
  notify_password_change: boolean;
  notify_suspicious_activity: boolean;
  notify_recovery_change: boolean;
}

export const AdvancedSecuritySettings: React.FC<AdvancedSecuritySettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'password' | 'ip' | 'questions' | 'recovery' | 'locations' | 'activity' | 'settings'
  >('password');

  // State
  const [passwordPolicy, setPasswordPolicy] = useState<any>(null);
  const [ipRules, setIPRules] = useState<IPRule[]>([]);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [predefinedQuestions, setPredefinedQuestions] = useState<PredefinedQuestion[]>([]);
  const [recoveryContacts, setRecoveryContacts] = useState<RecoveryContact[]>([]);
  const [loginLocations, setLoginLocations] = useState<LoginLocation[]>([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    enable_geolocation_alerts: true,
    trusted_countries: [],
    require_reauth_minutes: 60,
    single_session_only: false,
    notify_new_login: true,
    notify_password_change: true,
    notify_suspicious_activity: true,
    notify_recovery_change: true,
  });

  // Edit states
  const [newIPRule, setNewIPRule] = useState({
    ipAddress: '',
    ruleType: 'allow' as const,
    description: '',
  });
  const [newQuestion, setNewQuestion] = useState({ questionId: 0, customQuestion: '', answer: '' });
  const [newRecovery, setNewRecovery] = useState({
    contactType: 'email' as const,
    contactValue: '',
    isPrimary: false,
  });
  const [showAddIP, setShowAddIP] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showAddRecovery, setShowAddRecovery] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        policyRes,
        ipRes,
        questionsRes,
        predefinedRes,
        recoveryRes,
        locationsRes,
        activityRes,
        settingsRes,
      ] = await Promise.all([
        (Api as any).get('/api/user/security/password-policy').catch(() => ({ data: null })),
        (Api as any).get('/api/user/security/ip-rules').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/questions').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/questions/predefined').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/recovery').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/login-locations').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/suspicious-activities').catch(() => ({ data: [] })),
        (Api as any).get('/api/user/security/settings').catch(() => ({ data: null })),
      ]);

      if (policyRes.data) setPasswordPolicy(policyRes.data);
      if (ipRes.data) setIPRules(ipRes.data);
      if (questionsRes.data) setSecurityQuestions(questionsRes.data);
      if (predefinedRes.data) setPredefinedQuestions(predefinedRes.data);
      if (recoveryRes.data) setRecoveryContacts(recoveryRes.data);
      if (locationsRes.data) setLoginLocations(locationsRes.data);
      if (activityRes.data) setSuspiciousActivities(activityRes.data);
      if (settingsRes.data) setSecuritySettings(settingsRes.data);
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  };

  // IP Rules handlers
  const handleAddIPRule = async () => {
    if (!newIPRule.ipAddress) {
      toast.error(t('settings.security.ipRequired', 'IP address is required'));
      return;
    }
    try {
      setSaving(true);
      await (Api as any).post('/api/user/security/ip-rules', newIPRule);
      toast.success(t('settings.security.ipAdded', 'IP rule added'));
      setShowAddIP(false);
      setNewIPRule({ ipAddress: '', ruleType: 'allow', description: '' });
      loadData();
    } catch (error) {
      toast.error(t('settings.security.ipError', 'Failed to add IP rule'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIPRule = async (id: string) => {
    try {
      await (Api as any).delete(`/api/user/security/ip-rules/${id}`);
      toast.success(t('settings.security.ipDeleted', 'IP rule deleted'));
      loadData();
    } catch (error) {
      toast.error(t('settings.security.deleteError', 'Failed to delete'));
    }
  };

  // Security Questions handlers
  const handleAddQuestion = async () => {
    if (!newQuestion.answer) {
      toast.error(t('settings.security.answerRequired', 'Answer is required'));
      return;
    }
    try {
      setSaving(true);
      await (Api as any).post('/api/user/security/questions', newQuestion);
      toast.success(t('settings.security.questionAdded', 'Security question added'));
      setShowAddQuestion(false);
      setNewQuestion({ questionId: 0, customQuestion: '', answer: '' });
      loadData();
    } catch (error) {
      toast.error(t('settings.security.questionError', 'Failed to add security question'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await (Api as any).delete(`/api/user/security/questions/${id}`);
      toast.success(t('settings.security.questionDeleted', 'Security question deleted'));
      loadData();
    } catch (error) {
      toast.error(t('settings.security.deleteError', 'Failed to delete'));
    }
  };

  // Recovery Contacts handlers
  const handleAddRecovery = async () => {
    if (!newRecovery.contactValue) {
      toast.error(t('settings.security.contactRequired', 'Contact value is required'));
      return;
    }
    try {
      setSaving(true);
      await (Api as any).post('/api/user/security/recovery', newRecovery);
      toast.success(t('settings.security.recoveryAdded', 'Recovery contact added'));
      setShowAddRecovery(false);
      setNewRecovery({ contactType: 'email', contactValue: '', isPrimary: false });
      loadData();
    } catch (error) {
      toast.error(t('settings.security.recoveryError', 'Failed to add recovery contact'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecovery = async (id: string) => {
    try {
      await (Api as any).delete(`/api/user/security/recovery/${id}`);
      toast.success(t('settings.security.recoveryDeleted', 'Recovery contact deleted'));
      loadData();
    } catch (error) {
      toast.error(t('settings.security.deleteError', 'Failed to delete'));
    }
  };

  // Location handlers
  const handleTrustLocation = async (id: string, trusted: boolean) => {
    try {
      await (Api as any).put(`/api/user/security/login-locations/${id}/trust`, { trusted });
      toast.success(trusted ? 'Location marked as trusted' : 'Location unmarked');
      loadData();
    } catch (error) {
      toast.error('Failed to update location');
    }
  };

  // Activity handlers
  const handleAcknowledgeActivity = async (id: string) => {
    try {
      await (Api as any).put(`/api/user/security/suspicious-activities/${id}/acknowledge`);
      toast.success('Activity acknowledged');
      loadData();
    } catch (error) {
      toast.error('Failed to acknowledge activity');
    }
  };

  // Settings handlers
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await (Api as any).put('/api/user/security/settings', {
        enableGeolocationAlerts: securitySettings.enable_geolocation_alerts,
        trustedCountries: securitySettings.trusted_countries,
        requireReauthMinutes: securitySettings.require_reauth_minutes,
        singleSessionOnly: securitySettings.single_session_only,
        notifyNewLogin: securitySettings.notify_new_login,
        notifyPasswordChange: securitySettings.notify_password_change,
        notifySuspiciousActivity: securitySettings.notify_suspicious_activity,
        notifyRecoveryChange: securitySettings.notify_recovery_change,
      });
      toast.success(t('settings.security.settingsSaved', 'Security settings saved'));
    } catch (error) {
      toast.error(t('settings.security.settingsError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  const tabs = [
    { id: 'password', label: 'Password Policy', icon: Key },
    { id: 'ip', label: 'IP Rules', icon: Globe },
    { id: 'questions', label: 'Security Questions', icon: HelpCircle },
    { id: 'recovery', label: 'Recovery', icon: UserPlus },
    { id: 'locations', label: 'Login Locations', icon: MapPin },
    { id: 'activity', label: 'Suspicious Activity', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Shield size={28} className="text-danger-500" />
            {t('settings.security.advanced.title', 'Advanced Security')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.security.advanced.description', 'Enhanced security features and controls')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-c-border-subtle dark:border-navy-700 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-danger-600 text-white'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Password Policy Tab */}
      {activeTab === 'password' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Key size={20} className="text-amber-500" />
            {t('settings.security.passwordPolicy', 'Password Policy')}
          </h3>

          {passwordPolicy && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">Minimum Length</span>
                  <span className="font-medium text-c-text">
                    {passwordPolicy.policy?.min_length || 8} characters
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">Password Expires</span>
                  <span className="font-medium text-c-text">
                    {passwordPolicy.policy?.max_age_days > 0
                      ? `${passwordPolicy.policy.max_age_days} days`
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">History Count</span>
                  <span className="font-medium text-c-text">
                    {passwordPolicy.policy?.history_count || 5} passwords
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">Require Uppercase</span>
                  {passwordPolicy.policy?.require_uppercase ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <X size={18} className="text-c-text-secondary" />
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">Require Numbers</span>
                  {passwordPolicy.policy?.require_numbers ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <X size={18} className="text-c-text-secondary" />
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
                  <span className="text-sm text-c-text-secondary">Require Special Chars</span>
                  {passwordPolicy.policy?.require_special_chars ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <X size={18} className="text-c-text-secondary" />
                  )}
                </div>
              </div>
            </div>
          )}

          {passwordPolicy?.passwordLastChanged && (
            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Password last changed:{' '}
                {new Date(passwordPolicy.passwordLastChanged).toLocaleDateString()}
                {passwordPolicy.passwordExpiresAt && (
                  <> • Expires: {new Date(passwordPolicy.passwordExpiresAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* IP Rules Tab */}
      {activeTab === 'ip' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Globe size={20} className="text-blue-500" />
              {t('settings.security.ipRules', 'IP Allowlist / Blocklist')}
            </h3>
            <button
              onClick={() => setShowAddIP(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Rule
            </button>
          </div>

          {showAddIP && (
            <div className="p-4 border border-danger-200 dark:border-danger-500/30 rounded-lg bg-danger-50 dark:bg-danger-500/5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  value={newIPRule.ipAddress}
                  onChange={(e) => setNewIPRule({ ...newIPRule, ipAddress: e.target.value })}
                  placeholder="IP Address or CIDR"
                  className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                />
                <select
                  value={newIPRule.ruleType}
                  onChange={(e) => setNewIPRule({ ...newIPRule, ruleType: e.target.value as any })}
                  className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                >
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
                <input
                  type="text"
                  value={newIPRule.description}
                  onChange={(e) => setNewIPRule({ ...newIPRule, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddIPRule}
                  disabled={saving}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Add Rule'}
                </button>
                <button
                  onClick={() => setShowAddIP(false)}
                  className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {ipRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  rule.rule_type === 'allow'
                    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
                    : 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {rule.rule_type === 'allow' ? (
                    <Unlock size={18} className="text-green-600" />
                  ) : (
                    <Lock size={18} className="text-danger-600" />
                  )}
                  <div>
                    <p className="font-medium text-c-text">{rule.ip_address}</p>
                    {rule.description && (
                      <p className="text-sm text-c-text-muted">{rule.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteIPRule(rule.id)}
                  className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg text-danger-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {ipRules.length === 0 && (
              <p className="text-center text-c-text-muted py-8">No IP rules configured</p>
            )}
          </div>
        </div>
      )}

      {/* Security Questions Tab */}
      {activeTab === 'questions' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <HelpCircle size={20} className="text-c-accent" />
              {t('settings.security.securityQuestions', 'Security Questions')}
            </h3>
            <button
              onClick={() => setShowAddQuestion(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Question
            </button>
          </div>

          {showAddQuestion && (
            <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft space-y-4">
              <select
                value={newQuestion.questionId}
                onChange={(e) =>
                  setNewQuestion({
                    ...newQuestion,
                    questionId: parseInt(e.target.value),
                    customQuestion: '',
                  })
                }
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
              >
                <option value={0}>-- Select a question or create custom --</option>
                {predefinedQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question_text}
                  </option>
                ))}
              </select>
              {newQuestion.questionId === 0 && (
                <input
                  type="text"
                  value={newQuestion.customQuestion}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, customQuestion: e.target.value })
                  }
                  placeholder="Or enter custom question..."
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                />
              )}
              <input
                type="text"
                value={newQuestion.answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                placeholder="Your answer"
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddQuestion}
                  disabled={saving}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Question'}
                </button>
                <button
                  onClick={() => setShowAddQuestion(false)}
                  className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {securityQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between p-4 rounded-lg bg-c-surface-raised"
              >
                <div>
                  <p className="font-medium text-c-text">{q.question_text}</p>
                  <p className="text-sm text-c-text-muted">Answer: ••••••••</p>
                </div>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-2 hover:bg-c-surface dark:hover:bg-c-surface-raised rounded-lg text-danger-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {securityQuestions.length === 0 && (
              <p className="text-center text-c-text-muted py-8">No security questions set up</p>
            )}
          </div>
        </div>
      )}

      {/* Recovery Tab */}
      {activeTab === 'recovery' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <UserPlus size={20} className="text-green-500" />
              {t('settings.security.recovery', 'Recovery Options')}
            </h3>
            <button
              onClick={() => setShowAddRecovery(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Recovery Contact
            </button>
          </div>

          {showAddRecovery && (
            <div className="p-4 border border-green-200 dark:border-green-500/30 rounded-lg bg-green-50 dark:bg-green-500/5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={newRecovery.contactType}
                  onChange={(e) =>
                    setNewRecovery({ ...newRecovery, contactType: e.target.value as any })
                  }
                  className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="trusted_person">Trusted Person</option>
                </select>
                <input
                  type="text"
                  value={newRecovery.contactValue}
                  onChange={(e) => setNewRecovery({ ...newRecovery, contactValue: e.target.value })}
                  placeholder={
                    newRecovery.contactType === 'email'
                      ? 'email@example.com'
                      : newRecovery.contactType === 'phone'
                        ? '+1234567890'
                        : 'Name'
                  }
                  className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecovery.isPrimary}
                  onChange={(e) => setNewRecovery({ ...newRecovery, isPrimary: e.target.checked })}
                  className="rounded"
                />
                Set as primary recovery contact
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAddRecovery}
                  disabled={saving}
                  className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Add Contact'}
                </button>
                <button
                  onClick={() => setShowAddRecovery(false)}
                  className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {recoveryContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 rounded-lg bg-c-surface-raised"
              >
                <div className="flex items-center gap-3">
                  {contact.contact_type === 'email' && <Mail size={18} className="text-blue-500" />}
                  {contact.contact_type === 'phone' && (
                    <Phone size={18} className="text-green-500" />
                  )}
                  {contact.contact_type === 'trusted_person' && (
                    <UserPlus size={18} className="text-c-accent" />
                  )}
                  <div>
                    <p className="font-medium text-c-text flex items-center gap-2">
                      {contact.contact_value}
                      {contact.is_primary && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-c-text-muted flex items-center gap-1">
                      {contact.is_verified ? (
                        <>
                          <CheckCircle size={12} className="text-green-500" /> Verified
                        </>
                      ) : (
                        <>
                          <AlertCircle size={12} className="text-amber-500" /> Pending verification
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRecovery(contact.id)}
                  className="p-2 hover:bg-c-surface dark:hover:bg-c-surface-raised rounded-lg text-danger-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {recoveryContacts.length === 0 && (
              <p className="text-center text-c-text-muted py-8">No recovery contacts configured</p>
            )}
          </div>
        </div>
      )}

      {/* Login Locations Tab */}
      {activeTab === 'locations' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <MapPin size={20} className="text-indigo-500" />
            {t('settings.security.loginLocations', 'Recent Login Locations')}
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loginLocations.map((location) => (
              <div
                key={location.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  location.is_trusted
                    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
                    : location.risk_score > 50
                      ? 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30'
                      : 'bg-c-surface-raised border-c-border-subtle dark:border-navy-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin
                    size={18}
                    className={
                      location.is_trusted
                        ? 'text-green-600'
                        : location.risk_score > 50
                          ? 'text-danger-600'
                          : 'text-c-text-secondary'
                    }
                  />
                  <div>
                    <p className="font-medium text-c-text">
                      {location.city}, {location.region}, {location.country}
                    </p>
                    <p className="text-sm text-c-text-muted">
                      {location.ip_address} • {new Date(location.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {location.is_vpn && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          VPN
                        </span>
                      )}
                      {location.is_proxy && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          Proxy
                        </span>
                      )}
                      {location.is_tor && (
                        <span className="text-xs bg-danger-100 text-danger-700 px-2 py-0.5 rounded">
                          Tor
                        </span>
                      )}
                      {location.is_trusted && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Trusted
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleTrustLocation(location.id, !location.is_trusted)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    location.is_trusted
                      ? 'bg-c-surface-raised text-c-text-secondary'
                      : 'bg-green-600 text-white'
                  }`}
                >
                  {location.is_trusted ? 'Untrust' : 'Trust'}
                </button>
              </div>
            ))}
            {loginLocations.length === 0 && (
              <p className="text-center text-c-text-muted py-8">No login locations recorded</p>
            )}
          </div>
        </div>
      )}

      {/* Suspicious Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            {t('settings.security.suspiciousActivity', 'Suspicious Activity')}
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {suspiciousActivities.map((activity) => (
              <div
                key={activity.id}
                className={`p-4 rounded-lg border ${
                  activity.is_acknowledged
                    ? 'bg-c-surface-raised border-c-border-subtle dark:border-navy-700 opacity-60'
                    : activity.severity === 'critical'
                      ? 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30'
                      : activity.severity === 'high'
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                        : 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={18}
                      className={
                        activity.severity === 'critical'
                          ? 'text-danger-600'
                          : activity.severity === 'high'
                            ? 'text-amber-600'
                            : 'text-yellow-600'
                      }
                    />
                    <div>
                      <p className="font-medium text-c-text capitalize">
                        {activity.activity_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-c-text-secondary">{activity.description}</p>
                      <p className="text-xs text-c-text-muted mt-1">
                        {activity.ip_address} • {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!activity.is_acknowledged && (
                    <button
                      onClick={() => handleAcknowledgeActivity(activity.id)}
                      className="px-3 py-1.5 text-sm bg-c-surface-raised text-c-text-secondary rounded-lg"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
            {suspiciousActivities.length === 0 && (
              <p className="text-center text-c-text-muted py-8">
                No suspicious activities detected
              </p>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Settings size={20} className="text-c-text-muted" />
              {t('settings.security.settings', 'Security Settings')}
            </h3>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
              <div>
                <label className="font-medium text-c-text">Geolocation Alerts</label>
                <p className="text-sm text-c-text-muted">Alert on login from new locations</p>
              </div>
              <button
                onClick={() =>
                  setSecuritySettings({
                    ...securitySettings,
                    enable_geolocation_alerts: !securitySettings.enable_geolocation_alerts,
                  })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  securitySettings.enable_geolocation_alerts
                    ? 'bg-danger-500'
                    : 'bg-c-surface-raised'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                    securitySettings.enable_geolocation_alerts ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
              <div>
                <label className="font-medium text-c-text">Single Session Only</label>
                <p className="text-sm text-c-text-muted">Only allow one active session at a time</p>
              </div>
              <button
                onClick={() =>
                  setSecuritySettings({
                    ...securitySettings,
                    single_session_only: !securitySettings.single_session_only,
                  })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  securitySettings.single_session_only ? 'bg-danger-500' : 'bg-c-surface-raised'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                    securitySettings.single_session_only ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 bg-c-surface-raised rounded-lg">
              <label className="block font-medium text-c-text mb-2">
                Re-authentication Timeout
              </label>
              <select
                value={securitySettings.require_reauth_minutes}
                onChange={(e) =>
                  setSecuritySettings({
                    ...securitySettings,
                    require_reauth_minutes: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>

            <div className="border-t border-c-border-subtle dark:border-navy-700 pt-4">
              <h4 className="font-medium text-c-text mb-4">Notification Preferences</h4>
              <div className="space-y-3">
                {[
                  { key: 'notify_new_login', label: 'New login alerts' },
                  { key: 'notify_password_change', label: 'Password change alerts' },
                  { key: 'notify_suspicious_activity', label: 'Suspicious activity alerts' },
                  { key: 'notify_recovery_change', label: 'Recovery contact change alerts' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(securitySettings as any)[item.key]}
                      onChange={(e) =>
                        setSecuritySettings({
                          ...securitySettings,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-c-text-secondary">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSecuritySettings;
