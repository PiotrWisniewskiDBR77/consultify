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

import { LoadingState } from '@/components/ui/primitives';

import { useAppStore } from '../../../store/useAppStore';
import { OrgAISettings } from '../../../types';
import { SettingsCard, SettingsSlider, SettingsToggle } from '../../AISettings';

// User tier definitions
const USER_TIERS = [
  {
    id: 'BUDGET',
    name: 'Budget',
    description: 'Access to budget-friendly models only (GPT-4o-mini, DeepSeek)',
    icon: Zap,
    color: 'text-emerald-400',
    models: ['gpt-4o-mini', 'deepseek-chat', 'qwen-turbo'],
  },
  {
    id: 'STANDARD',
    name: 'Standard',
    description: 'Access to standard + budget models (GPT-4o, Claude 3.5 Sonnet)',
    icon: Star,
    color: 'text-blue-400',
    models: ['gpt-4o', 'claude-3.5-sonnet', 'gpt-4o-mini', 'deepseek-chat'],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    description: 'Full access to all models including reasoning (o1, Claude 3 Opus)',
    icon: Crown,
    color: 'text-amber-400',
    models: ['o1-mini', 'o1-preview', 'claude-3-opus', 'gpt-4o', 'claude-3.5-sonnet'],
  },
];

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
        toast.success('Access & Limits settings saved');
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      toast.error('Failed to save settings');
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
            Access & Limits
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage AI access tiers, usage limits, and budget controls
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-warning-700 dark:text-amber-400 bg-warning-500/10 px-3 py-1.5 rounded-full border border-warning-500/30 dark:border-transparent"
            >
              Unsaved changes
            </motion.span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all ${
              hasChanges
                ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
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
          Usage Limits
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
          User Tiers
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
          Cost Dashboard
        </button>
      </div>

      {/* Usage Limits */}
      {activeSubTab === 'limits' && settings && (
        <div className="space-y-6">
          <SettingsCard
            title="Usage Limits"
            description="Set daily and monthly limits for AI usage"
            icon={AlertTriangle}
            iconColor="text-amber-400"
          >
            <div className="space-y-6">
              <SettingsSlider
                label="Max AI Calls per Day"
                description="Daily limit per user"
                value={settings.maxAICallsPerDay}
                onChange={(v) => updateSetting('maxAICallsPerDay', v)}
                min={10}
                max={1000}
                step={10}
                defaultValue={100}
              />

              <SettingsSlider
                label="Max Tokens per Month"
                description="Monthly token budget for the organization"
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
            title="Budget Control"
            description="Set spending limits and automatic actions"
            icon={DollarSign}
            iconColor="text-emerald-400"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Monthly Budget (USD)
                  </label>
                  <input
                    type="number"
                    value={settings.monthlyBudgetUSD}
                    onChange={(e) =>
                      updateSetting('monthlyBudgetUSD', parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-primary-500 outline-none"
                    placeholder="0 = unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Hard Limit (USD)
                  </label>
                  <input
                    type="number"
                    value={settings.hardLimitUSD}
                    onChange={(e) => updateSetting('hardLimitUSD', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-primary-500 outline-none"
                    placeholder="0 = no hard limit"
                  />
                </div>
              </div>

              <SettingsToggle
                label="Freeze on Limit"
                description="Automatically disable AI when budget is exceeded"
                checked={settings.freezeOnLimit}
                onChange={(v) => updateSetting('freezeOnLimit', v)}
                icon={AlertTriangle}
                iconColor="text-danger-400"
              />
            </div>
          </SettingsCard>

          {/* Budget Alerts Configuration */}
          <SettingsCard
            title="Budget Alerts"
            description="Configure automatic alerts when spending reaches certain thresholds"
            icon={AlertTriangle}
            iconColor="text-danger-400"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { threshold: 70, label: 'Warning Alert', color: 'warning' },
                  { threshold: 85, label: 'Critical Alert', color: 'warning' },
                  { threshold: 95, label: 'Emergency Alert', color: 'danger' },
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
                      Notify admins at {alert.threshold}% budget usage
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-slate-200 dark:border-navy-700">
                <input
                  type="email"
                  placeholder="Alert email (optional)"
                  className="flex-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-navy-900 dark:text-white text-sm"
                />
                <button className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm rounded-lg">
                  Add Email
                </button>
              </div>
            </div>
          </SettingsCard>

          {/* Current Usage Summary - Clean minimal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">This Month</span>
              </div>
              <p className="admin-metric-value">$24.50</p>
              <p className="admin-metric-subtitle">of ${settings.monthlyBudgetUSD || '∞'} budget</p>
            </div>
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">Token Usage</span>
              </div>
              <p className="admin-metric-value">125k</p>
              <p className="admin-metric-subtitle">
                of {(settings.maxTokensPerMonth / 1000).toFixed(0)}k limit
              </p>
            </div>
            <div className="admin-metric">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="admin-metric-label">Avg Daily Calls</span>
              </div>
              <p className="admin-metric-value">45</p>
              <p className="admin-metric-subtitle">per user (max {settings.maxAICallsPerDay})</p>
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
                      Available models:
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
                          +{tier.models.length - 3} more
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
              Automatic Tier Assignment
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
              Automatically promote or demote users based on their monthly token usage
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <SettingsToggle
                  label="Enable Auto-Assignment"
                  description="Automatically adjust user tiers monthly based on usage"
                  checked={settings?.autoTierEnabled || false}
                  onChange={(v) => updateSetting('autoTierEnabled' as any, v)}
                  icon={TrendingUp}
                  iconColor="text-emerald-400"
                />

                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                    Assignment Direction
                  </label>
                  <select
                    value={(settings as any)?.autoTierDirection || 'both'}
                    onChange={(e) => updateSetting('autoTierDirection' as any, e.target.value)}
                    className="w-full bg-c-surface-raised/50 border border-c-border-subtle rounded-lg p-2 text-c-text"
                  >
                    <option value="up">Promote Only</option>
                    <option value="down">Demote Only</option>
                    <option value="both">Both (Promote & Demote)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                    Maximum Auto-Assign Tier
                  </label>
                  <select
                    value={(settings as any)?.autoTierMaxTier || 'PREMIUM'}
                    onChange={(e) => updateSetting('autoTierMaxTier' as any, e.target.value)}
                    className="w-full bg-c-surface-raised/50 border border-c-border-subtle rounded-lg p-2 text-c-text"
                  >
                    <option value="BUDGET">Budget Only</option>
                    <option value="STANDARD">Up to Standard</option>
                    <option value="PREMIUM">Up to Premium</option>
                    <option value="REASONING">All Tiers (incl. Reasoning)</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Users won't be auto-promoted beyond this tier
                  </p>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-c-text mb-3">Token Thresholds</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-emerald-400">Budget</span>
                    <span className="text-slate-600 dark:text-slate-500">
                      0 - 1,000 tokens/month
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-blue-400">Standard</span>
                    <span className="text-slate-600 dark:text-slate-500">
                      1,001 - 50,000 tokens/month
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-amber-400">Premium</span>
                    <span className="text-slate-600 dark:text-slate-500">
                      50,001 - 200,000 tokens/month
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-primary-400">Reasoning</span>
                    <span className="text-slate-600 dark:text-slate-500">
                      200,001+ tokens/month
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button className="w-full px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised text-slate-600 text-sm rounded-lg transition-colors">
                    Preview Changes
                  </button>
                </div>
              </div>
            </div>

            <SettingsToggle
              label="Notify Users on Tier Change"
              description="Send email notification when tier is automatically changed"
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
                User Tier Assignments
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign AI access tiers to individual users
              </p>
            </div>
            <div className="overflow-x-auto">
              <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */  className="w-full text-left text-sm">
                <thead className="bg-black/20 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Current Tier</th>
                    <th className="px-6 py-3">Usage (7d)</th>
                    <th className="px-6 py-3">Cost (7d)</th>
                    <th className="px-6 py-3">Actions</th>
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
                        {user.usage.toLocaleString()} requests
                      </td>
                      <td className="px-6 py-4 text-slate-600">${user.cost.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button className="text-primary-400 hover:text-primary-300 text-sm">
                          View Details
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
              <p className="admin-metric-label">Total Spend (7d)</p>
              <p className="text-2xl font-semibold text-c-text mt-1">$27.15</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">Avg Cost/Request</p>
              <p className="text-2xl font-semibold text-c-text mt-1">$0.034</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">Total Requests</p>
              <p className="text-2xl font-semibold text-c-text mt-1">821</p>
            </div>
            <div className="admin-metric">
              <p className="admin-metric-label">Total Tokens</p>
              <p className="text-2xl font-semibold text-c-text mt-1">291k</p>
            </div>
          </div>

          {/* Cost Attribution Table */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--admin-border)]">
              <h3 className="text-sm font-medium text-c-text flex items-center gap-2">
                <Percent size={14} className="text-slate-500 dark:text-slate-400" />
                Cost Attribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                See which users and projects generate the most AI costs
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/20 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Requests</th>
                    <th className="px-6 py-3">Tokens</th>
                    <th className="px-6 py-3">Cost</th>
                    <th className="px-6 py-3">% of Total</th>
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
