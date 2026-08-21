/**
 * AccessLimitsTab - AI Access & Limits
 *
 * Tab 4 of the reorganized AI & Intelligence section
 * Includes: User Tier Management, Usage Limits, Budget Control, Rate Limiting, Cost Dashboard
 *
 * NEW FEATURES: User tiers, cost attribution per user/project
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart2,
  Clock,
  Crown,
  DollarSign,
  Percent,
  RefreshCw,
  Save,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { useAppStore } from '../../../store/useAppStore';
import { OrgAISettings } from '../../../types';
import { SettingsCard, SettingsSlider, SettingsToggle } from '../../AISettings';
import { SettingsHeaderActionPortal } from '../../settings/SettingsHeaderActions';

interface UserTierAssignment {
  userId: string;
  userName: string;
  email: string;
  currentTier: string;
  usage: number;
  cost: number;
}

interface CostAttribution {
  entityType: 'user' | 'project';
  entityId: string;
  entityName: string;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export const AccessLimitsTab: React.FC = () => {
  const { t } = useTranslation();
  // User tier definitions
  const USER_TIERS = [
    {
      id: 'BUDGET',
      name: t('admin.aiControlCenter.accessLimits.tiers.budget.name', 'Budget'),
      description: t(
        'admin.aiControlCenter.accessLimits.tiers.budget.description',
        'Access to budget-friendly models only (GPT-4o-mini, DeepSeek)'
      ),
      icon: Zap,
      color: 'text-emerald-400',
      models: ['gpt-4o-mini', 'deepseek-chat', 'qwen-turbo'],
    },
    {
      id: 'STANDARD',
      name: t('admin.aiControlCenter.accessLimits.tiers.standard.name', 'Standard'),
      description: t(
        'admin.aiControlCenter.accessLimits.tiers.standard.description',
        'Access to standard + budget models (GPT-4o, Claude 3.5 Sonnet)'
      ),
      icon: Star,
      color: 'text-blue-400',
      models: ['gpt-4o', 'claude-3.5-sonnet', 'gpt-4o-mini', 'deepseek-chat'],
    },
    {
      id: 'PREMIUM',
      name: t('admin.aiControlCenter.accessLimits.tiers.premium.name', 'Premium'),
      description: t(
        'admin.aiControlCenter.accessLimits.tiers.premium.description',
        'Full access to all models including reasoning (o1, Claude 3 Opus)'
      ),
      icon: Crown,
      color: 'text-amber-400',
      models: ['o1-mini', 'o1-preview', 'claude-3-opus', 'gpt-4o', 'claude-3.5-sonnet'],
    },
  ];

  const { currentOrganization } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgAISettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'tiers' | 'limits' | 'costs'>('limits');

  // Mock data for user tiers (would come from API)
  const [userTiers, setUserTiers] = useState<UserTierAssignment[]>([]);
  const [costAttribution, setCostAttribution] = useState<CostAttribution[]>([]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadSettings();
      loadUserTiers();
      loadCostAttribution();
    }
  }, [currentOrganization?.id]);

  const loadSettings = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const settingsRes = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  };

  const loadUserTiers = async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(`/api/admin-data/user-tiers/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserTiers(data);
      }
    } catch (error) {
      console.error('Error loading user tiers:', error);
    }
  };

  const loadCostAttribution = async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(`/api/admin-data/cost-attribution/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCostAttribution(data);
      }
    } catch (error) {
      console.error('Error loading cost attribution:', error);
    }
  };

  const saveSettings = async () => {
    if (!settings || !currentOrganization?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setHasChanges(false);
        toast.success(
          t('admin.aiControlCenter.accessLimits.toasts.saved', 'Access & Limits settings saved')
        );
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      toast.error(t('admin.aiControlCenter.accessLimits.errors.save', 'Failed to save settings'));
    }
    setSaving(false);
  };

  const updateSetting = <K extends keyof OrgAISettings>(key: K, value: OrgAISettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    setHasChanges(true);
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button - DBR77 Compatible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <DollarSign className="text-success-600 dark:text-emerald-400" size={20} />
            {t('admin.aiControlCenter.accessLimits.title', 'Access & Limits')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'admin.aiControlCenter.accessLimits.description',
              'Manage AI access tiers, usage limits, and budget controls'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-warning-700 dark:text-amber-400 bg-warning-500/10 px-3 py-1.5 rounded-full border border-warning-500/30 dark:border-transparent"
            >
              {t('admin.aiControlCenter.accessLimits.unsavedChanges', 'Unsaved changes')}
            </motion.span>
          )}
          <SettingsHeaderActionPortal>
            <button
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all ${
                hasChanges
                  ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('admin.aiControlCenter.accessLimits.saveChanges', 'Save Changes')}
            </button>
          </SettingsHeaderActionPortal>
        </div>
      </div>

      {/* Sub-tabs - DBR77 Compatible */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-1">
        <button
          onClick={() => setActiveSubTab('limits')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'limits'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle size={14} className="inline mr-2" />
          {t('admin.aiControlCenter.accessLimits.subTabs.limits', 'Usage Limits')}
        </button>
        <button
          onClick={() => setActiveSubTab('tiers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'tiers'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Users size={14} className="inline mr-2" />
          {t('admin.aiControlCenter.accessLimits.subTabs.tiers', 'User Tiers')}
        </button>
        <button
          onClick={() => setActiveSubTab('costs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'costs'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <BarChart2 size={14} className="inline mr-2" />
          {t('admin.aiControlCenter.accessLimits.subTabs.costs', 'Cost Dashboard')}
        </button>
      </div>

      {/* Usage Limits */}
      {activeSubTab === 'limits' && settings && (
        <div className="space-y-6">
          <SettingsCard
            title={t('admin.aiControlCenter.accessLimits.usageLimits.title', 'Usage Limits')}
            description={t(
              'admin.aiControlCenter.accessLimits.usageLimits.description',
              'Set daily and monthly limits for AI usage'
            )}
            icon={AlertTriangle}
            iconColor="text-amber-400"
          >
            <div className="space-y-6">
              <SettingsSlider
                label={t(
                  'admin.aiControlCenter.accessLimits.usageLimits.maxCallsPerDay',
                  'Max AI Calls per Day'
                )}
                description={t(
                  'admin.aiControlCenter.accessLimits.usageLimits.maxCallsPerDayDescription',
                  'Daily limit per user'
                )}
                value={settings.maxAICallsPerDay}
                onChange={(v) => updateSetting('maxAICallsPerDay', v)}
                min={10}
                max={1000}
                step={10}
                defaultValue={100}
              />

              <SettingsSlider
                label={t(
                  'admin.aiControlCenter.accessLimits.usageLimits.maxTokensPerMonth',
                  'Max Tokens per Month'
                )}
                description={t(
                  'admin.aiControlCenter.accessLimits.usageLimits.maxTokensPerMonthDescription',
                  'Monthly token budget for the organization'
                )}
                value={settings.maxTokensPerMonth}
                onChange={(v) => updateSetting('maxTokensPerMonth', v)}
                min={50000}
                max={10000000}
                step={50000}
                formatValue={(v) => `${(v / 1000).toFixed(0)}k`}
                defaultValue={500000}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            title={t('admin.aiControlCenter.accessLimits.budgetControl.title', 'Budget Control')}
            description={t(
              'admin.aiControlCenter.accessLimits.budgetControl.description',
              'Set spending limits and automatic actions'
            )}
            icon={DollarSign}
            iconColor="text-emerald-400"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {t(
                      'admin.aiControlCenter.accessLimits.budgetControl.monthlyBudget',
                      'Monthly Budget (USD)'
                    )}
                  </label>
                  <input
                    type="number"
                    value={settings.monthlyBudgetUSD}
                    onChange={(e) =>
                      updateSetting('monthlyBudgetUSD', parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-primary-500 outline-none"
                    placeholder={t(
                      'admin.aiControlCenter.accessLimits.budgetControl.unlimitedPlaceholder',
                      '0 = unlimited'
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {t(
                      'admin.aiControlCenter.accessLimits.budgetControl.hardLimit',
                      'Hard Limit (USD)'
                    )}
                  </label>
                  <input
                    type="number"
                    value={settings.hardLimitUSD}
                    onChange={(e) => updateSetting('hardLimitUSD', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-primary-500 outline-none"
                    placeholder={t(
                      'admin.aiControlCenter.accessLimits.budgetControl.noHardLimitPlaceholder',
                      '0 = no hard limit'
                    )}
                  />
                </div>
              </div>

              <SettingsToggle
                label={t(
                  'admin.aiControlCenter.accessLimits.budgetControl.freezeOnLimit',
                  'Freeze on Limit'
                )}
                description={t(
                  'admin.aiControlCenter.accessLimits.budgetControl.freezeOnLimitDescription',
                  'Automatically disable AI when budget is exceeded'
                )}
                checked={settings.freezeOnLimit}
                onChange={(v) => updateSetting('freezeOnLimit', v)}
                icon={AlertTriangle}
                iconColor="text-danger-400"
              />
            </div>
          </SettingsCard>

          {/* Budget Alerts Configuration */}
          <SettingsCard
            title={t('admin.aiControlCenter.accessLimits.budgetAlerts.title', 'Budget Alerts')}
            description={t(
              'admin.aiControlCenter.accessLimits.budgetAlerts.description',
              'Configure automatic alerts when spending reaches certain thresholds'
            )}
            icon={AlertTriangle}
            iconColor="text-danger-400"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    threshold: 70,
                    label: t(
                      'admin.aiControlCenter.accessLimits.budgetAlerts.warning',
                      'Warning Alert'
                    ),
                    color: 'warning',
                  },
                  {
                    threshold: 85,
                    label: t(
                      'admin.aiControlCenter.accessLimits.budgetAlerts.critical',
                      'Critical Alert'
                    ),
                    color: 'warning',
                  },
                  {
                    threshold: 95,
                    label: t(
                      'admin.aiControlCenter.accessLimits.budgetAlerts.emergency',
                      'Emergency Alert'
                    ),
                    color: 'danger',
                  },
                ].map((alert) => (
                  <div
                    key={alert.threshold}
                    className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4 shadow-sm dark:shadow-none"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-${alert.color}-600 dark:text-${alert.color}-400 font-medium`}
                      >
                        {alert.threshold}%
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-navy-900"></div>
                      </label>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{alert.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t(
                        'admin.aiControlCenter.accessLimits.budgetAlerts.notifyAt',
                        'Notify admins at {{threshold}}% budget usage',
                        {
                          threshold: alert.threshold,
                        }
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-slate-200 dark:border-navy-700">
                <input
                  type="email"
                  placeholder={t(
                    'admin.aiControlCenter.accessLimits.budgetAlerts.emailPlaceholder',
                    'Alert email (optional)'
                  )}
                  className="flex-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-navy-900 dark:text-white text-sm"
                />
                <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm rounded-lg">
                  {t('admin.aiControlCenter.accessLimits.budgetAlerts.addEmail', 'Add Email')}
                </button>
              </div>
            </div>
          </SettingsCard>

          {/* Current Usage Summary - Clean minimal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">
                  {t('admin.aiControlCenter.accessLimits.summary.thisMonth', 'This Month')}
                </span>
              </div>
              <p className="admin-metric-value">$24.50</p>
              <p className="admin-metric-subtitle">
                {t('admin.aiControlCenter.accessLimits.summary.ofBudget', 'of ${{budget}} budget', {
                  budget: settings.monthlyBudgetUSD || '∞',
                })}
              </p>
            </div>
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">
                  {t('admin.aiControlCenter.accessLimits.summary.tokenUsage', 'Token Usage')}
                </span>
              </div>
              <p className="admin-metric-value">125k</p>
              <p className="admin-metric-subtitle">
                {t('admin.aiControlCenter.accessLimits.summary.ofLimit', 'of {{limit}}k limit', {
                  limit: (settings.maxTokensPerMonth / 1000).toFixed(0),
                })}
              </p>
            </div>
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">
                  {t('admin.aiControlCenter.accessLimits.summary.avgDailyCalls', 'Avg Daily Calls')}
                </span>
              </div>
              <p className="admin-metric-value">45</p>
              <p className="admin-metric-subtitle">
                {t(
                  'admin.aiControlCenter.accessLimits.summary.perUserMax',
                  'per user (max {{max}})',
                  {
                    max: settings.maxAICallsPerDay,
                  }
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Tiers */}
      {activeSubTab === 'tiers' && (
        <div className="space-y-6">
          {/* Tier Definitions - Clean minimal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {USER_TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <div key={tier.id} className="admin-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Icon size={16} className="text-slate-600 dark:text-slate-500" />
                    <div>
                      <h4 className="text-sm font-medium text-c-text">{tier.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tier.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      {t(
                        'admin.aiControlCenter.accessLimits.tiers.availableModels',
                        'Available models:'
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {tier.models.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 bg-white/5 text-slate-600 dark:text-slate-500 text-xs rounded"
                        >
                          {m}
                        </span>
                      ))}
                      {tier.models.length > 3 && (
                        <span className="px-2 py-0.5 text-slate-600 dark:text-slate-400 text-xs">
                          {t('admin.aiControlCenter.accessLimits.tiers.more', '+{{count}} more', {
                            count: tier.models.length - 3,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto Tier Assignment Settings */}
          <div className="admin-card p-4 mb-6">
            <h3 className="font-semibold text-c-text flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-emerald-400" />
              {t('admin.aiControlCenter.accessLimits.autoTier.title', 'Automatic Tier Assignment')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
              {t(
                'admin.aiControlCenter.accessLimits.autoTier.description',
                'Automatically promote or demote users based on their monthly token usage'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.accessLimits.autoTier.enable',
                    'Enable Auto-Assignment'
                  )}
                  description={t(
                    'admin.aiControlCenter.accessLimits.autoTier.enableDescription',
                    'Automatically adjust user tiers monthly based on usage'
                  )}
                  checked={settings?.autoTierEnabled || false}
                  onChange={(v) => updateSetting('autoTierEnabled' as any, v)}
                  icon={TrendingUp}
                  iconColor="text-emerald-400"
                />

                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                    {t(
                      'admin.aiControlCenter.accessLimits.autoTier.direction',
                      'Assignment Direction'
                    )}
                  </label>
                  <select
                    value={(settings as any)?.autoTierDirection || 'both'}
                    onChange={(e) => updateSetting('autoTierDirection' as any, e.target.value)}
                    className="w-full bg-c-surface-raised/50 border border-c-border-subtle rounded-lg p-2 text-c-text"
                  >
                    <option value="up">
                      {t('admin.aiControlCenter.accessLimits.autoTier.promoteOnly', 'Promote Only')}
                    </option>
                    <option value="down">
                      {t('admin.aiControlCenter.accessLimits.autoTier.demoteOnly', 'Demote Only')}
                    </option>
                    <option value="both">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.both',
                        'Both (Promote & Demote)'
                      )}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                    {t(
                      'admin.aiControlCenter.accessLimits.autoTier.maxTier',
                      'Maximum Auto-Assign Tier'
                    )}
                  </label>
                  <select
                    value={(settings as any)?.autoTierMaxTier || 'PREMIUM'}
                    onChange={(e) => updateSetting('autoTierMaxTier' as any, e.target.value)}
                    className="w-full bg-c-surface-raised/50 border border-c-border-subtle rounded-lg p-2 text-c-text"
                  >
                    <option value="BUDGET">
                      {t('admin.aiControlCenter.accessLimits.autoTier.budgetOnly', 'Budget Only')}
                    </option>
                    <option value="STANDARD">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.upToStandard',
                        'Up to Standard'
                      )}
                    </option>
                    <option value="PREMIUM">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.upToPremium',
                        'Up to Premium'
                      )}
                    </option>
                    <option value="REASONING">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.allTiers',
                        'All Tiers (incl. Reasoning)'
                      )}
                    </option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'admin.aiControlCenter.accessLimits.autoTier.maxTierNote',
                      "Users won't be auto-promoted beyond this tier"
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-c-text mb-3">
                  {t(
                    'admin.aiControlCenter.accessLimits.autoTier.thresholdsTitle',
                    'Token Thresholds'
                  )}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-emerald-400">
                      {t('admin.aiControlCenter.accessLimits.tiers.budget.name', 'Budget')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-500">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.thresholdBudget',
                        '0 - 1,000 tokens/month'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-blue-400">
                      {t('admin.aiControlCenter.accessLimits.tiers.standard.name', 'Standard')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-500">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.thresholdStandard',
                        '1,001 - 50,000 tokens/month'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-amber-400">
                      {t('admin.aiControlCenter.accessLimits.tiers.premium.name', 'Premium')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-500">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.thresholdPremium',
                        '50,001 - 200,000 tokens/month'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-primary-400">
                      {t('admin.aiControlCenter.accessLimits.autoTier.reasoning', 'Reasoning')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-500">
                      {t(
                        'admin.aiControlCenter.accessLimits.autoTier.thresholdReasoning',
                        '200,001+ tokens/month'
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button className="w-full px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised text-slate-600 text-sm rounded-lg transition-colors">
                    {t(
                      'admin.aiControlCenter.accessLimits.autoTier.previewChanges',
                      'Preview Changes'
                    )}
                  </button>
                </div>
              </div>
            </div>

            <SettingsToggle
              label={t(
                'admin.aiControlCenter.accessLimits.autoTier.notifyUsers',
                'Notify Users on Tier Change'
              )}
              description={t(
                'admin.aiControlCenter.accessLimits.autoTier.notifyUsersDescription',
                'Send email notification when tier is automatically changed'
              )}
              checked={(settings as any)?.autoTierNotify ?? true}
              onChange={(v) => updateSetting('autoTierNotify' as any, v)}
              icon={AlertTriangle}
              iconColor="text-amber-400"
            />
          </div>

          {/* User Tier Assignments */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--admin-border)]">
              <h3 className="text-sm font-medium text-c-text flex items-center gap-2">
                <UserCheck size={14} className="text-slate-500 dark:text-slate-400" />
                {t('admin.aiControlCenter.accessLimits.userTiers.title', 'User Tier Assignments')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'admin.aiControlCenter.accessLimits.userTiers.description',
                  'Assign AI access tiers to individual users'
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table
                /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-left text-sm"
              >
                <thead className="bg-black/20 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">
                      {t('admin.aiControlCenter.accessLimits.userTiers.columns.user', 'User')}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.userTiers.columns.currentTier',
                        'Current Tier'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.userTiers.columns.usage7d',
                        'Usage (7d)'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.userTiers.columns.cost7d',
                        'Cost (7d)'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t('admin.aiControlCenter.accessLimits.userTiers.columns.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {userTiers.map((user) => (
                    <tr key={user.userId} className="hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-c-text">{user.userName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.currentTier}
                          onChange={() => {}}
                          className="bg-c-surface-raised border border-c-border-subtle rounded px-2 py-1 text-c-text text-sm"
                        >
                          {USER_TIERS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {t(
                          'admin.aiControlCenter.accessLimits.userTiers.requestsCount',
                          '{{value}} requests',
                          {
                            value: user.usage.toLocaleString(),
                          }
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">${user.cost.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button className="text-primary-400 hover:text-primary-300 text-sm">
                          {t(
                            'admin.aiControlCenter.accessLimits.userTiers.viewDetails',
                            'View Details'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cost Dashboard */}
      {activeSubTab === 'costs' && (
        <div className="space-y-6">
          {/* Cost Summary - Clean minimal cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="admin-metric">
              <p className="admin-metric-label">
                {t(
                  'admin.aiControlCenter.accessLimits.costDashboard.totalSpend7d',
                  'Total Spend (7d)'
                )}
              </p>
              <p className="text-2xl font-semibold text-c-text mt-1">$27.15</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">
                {t(
                  'admin.aiControlCenter.accessLimits.costDashboard.avgCostPerRequest',
                  'Avg Cost/Request'
                )}
              </p>
              <p className="text-2xl font-semibold text-c-text mt-1">$0.034</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">
                {t(
                  'admin.aiControlCenter.accessLimits.costDashboard.totalRequests',
                  'Total Requests'
                )}
              </p>
              <p className="text-2xl font-semibold text-c-text mt-1">821</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">
                {t('admin.aiControlCenter.accessLimits.costDashboard.totalTokens', 'Total Tokens')}
              </p>
              <p className="text-2xl font-semibold text-c-text mt-1">291k</p>
            </div>
          </div>

          {/* Cost Attribution Table */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--admin-border)]">
              <h3 className="text-sm font-medium text-c-text flex items-center gap-2">
                <Percent size={14} className="text-slate-500 dark:text-slate-400" />
                {t(
                  'admin.aiControlCenter.accessLimits.costDashboard.attributionTitle',
                  'Cost Attribution'
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'admin.aiControlCenter.accessLimits.costDashboard.attributionDescription',
                  'See which users and projects generate the most AI costs'
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/20 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.costDashboard.columns.entity',
                        'Entity'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t('admin.aiControlCenter.accessLimits.costDashboard.columns.type', 'Type')}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.costDashboard.columns.requests',
                        'Requests'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.costDashboard.columns.tokens',
                        'Tokens'
                      )}
                    </th>
                    <th className="px-6 py-3">
                      {t('admin.aiControlCenter.accessLimits.costDashboard.columns.cost', 'Cost')}
                    </th>
                    <th className="px-6 py-3">
                      {t(
                        'admin.aiControlCenter.accessLimits.costDashboard.columns.percentOfTotal',
                        '% of Total'
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {costAttribution.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="px-6 py-4 font-medium text-c-text">{item.entityName}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            item.entityType === 'user'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-primary-500/20 text-primary-300'
                          }`}
                        >
                          {item.entityType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.requests.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {(item.tokens / 1000).toFixed(1)}k
                      </td>
                      <td className="px-6 py-4 text-slate-600">${item.cost.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-c-surface-raised rounded-full overflow-hidden">
                            <div
                              className="h-full bg-c-surface rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-slate-600 dark:text-slate-500 text-xs">
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessLimitsTab;
