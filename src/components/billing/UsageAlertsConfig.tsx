/**
 * UsageAlertsConfig - Configure billing alerts and cost caps
 */

import {
  AlertTriangle,
  Bell,
  DollarSign,
  HardDrive,
  Loader2,
  Save,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface AlertSettings {
  token_threshold_80: number;
  token_threshold_90: number;
  token_threshold_100: number;
  storage_threshold_80: number;
  storage_threshold_90: number;
  storage_threshold_100: number;
  auto_upgrade_enabled: number;
  auto_upgrade_plan_id: string | null;
  cost_cap_monthly: number | null;
  email_notifications: number;
}

interface UsageAlertsConfigProps {
  onSave?: () => void;
}

export const UsageAlertsConfig: React.FC<UsageAlertsConfigProps> = ({ onSave }) => {
  const { t } = useTranslation();
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AlertSettings>({
    token_threshold_80: 1,
    token_threshold_90: 1,
    token_threshold_100: 1,
    storage_threshold_80: 1,
    storage_threshold_90: 1,
    storage_threshold_100: 1,
    auto_upgrade_enabled: 0,
    auto_upgrade_plan_id: null,
    cost_cap_monthly: null,
    email_notifications: 1,
  });
  const [plans, setPlans] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [alertsData, plansData] = await Promise.all([
        Api.getBillingAlerts(),
        Api.getSubscriptionPlans(),
      ]);
      if (alertsData.alerts) {
        setSettings(alertsData.alerts);
      }
      setPlans(plansData || []);
    } catch (error) {
      console.error('Failed to fetch billing alerts:', error);
      toast.error(t('billing.alerts.fetchError', 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.updateBillingAlerts(settings);
      toast.success(t('billing.alerts.saved', 'Alert settings saved'));
      onSave?.();
    } catch (error) {
      console.error('Failed to save billing alerts:', error);
      toast.error(t('billing.alerts.saveError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof AlertSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: prev[key] === 1 ? 0 : 1,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-500" />
          {t('billing.alerts.title', 'Usage Alerts & Limits')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'billing.alerts.description',
            'Configure notifications when you approach usage limits'
          )}
        </p>
      </div>

      {/* Email Notifications Toggle */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary-500" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {t('billing.alerts.emailNotifications', 'Email Notifications')}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('billing.alerts.emailNotificationsDesc', 'Receive alerts via email')}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting('email_notifications')}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.email_notifications ? 'bg-navy-900' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white dark:bg-navy-900 rounded-full transform transition-transform ${
                settings.email_notifications ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Token Usage Alerts */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h4 className="font-medium text-slate-900 dark:text-white">
            {t('billing.alerts.tokenUsage', 'Token Usage Alerts')}
          </h4>
        </div>

        <div className="space-y-3">
          {[80, 90, 100].map((threshold) => {
            const key = `token_threshold_${threshold}` as keyof AlertSettings;
            return (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      threshold === 100
                        ? 'bg-danger-100 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400'
                        : threshold === 90
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {threshold}%
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {t(
                      `billing.alerts.tokenThreshold${threshold}`,
                      `Alert przy wykorzystaniu ${threshold}% tokenów`
                    )}
                  </span>
                </div>
                <button
                  onClick={() => toggleSetting(key)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings[key] ? 'bg-navy-900' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white dark:bg-navy-900 rounded-full transform transition-transform ${
                      settings[key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Usage Alerts */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-emerald-500" />
          <h4 className="font-medium text-slate-900 dark:text-white">
            {t('billing.alerts.storageUsage', 'Storage Usage Alerts')}
          </h4>
        </div>

        <div className="space-y-3">
          {[80, 90, 100].map((threshold) => {
            const key = `storage_threshold_${threshold}` as keyof AlertSettings;
            return (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      threshold === 100
                        ? 'bg-danger-100 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400'
                        : threshold === 90
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {threshold}%
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {t(
                      `billing.alerts.storageThreshold${threshold}`,
                      `Alert przy wykorzystaniu ${threshold}% pamięci`
                    )}
                  </span>
                </div>
                <button
                  onClick={() => toggleSetting(key)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings[key] ? 'bg-navy-900' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white dark:bg-navy-900 rounded-full transform transition-transform ${
                      settings[key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Cap */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          <h4 className="font-medium text-slate-900 dark:text-white">
            {t('billing.alerts.costCap', 'Monthly Cost Cap')}
          </h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(
            'billing.alerts.costCapDesc',
            'Set a hard limit on monthly spending (overage charges will be blocked)'
          )}
        </p>

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={
              settings.cost_cap_monthly === null ? '' : formatCurrency(settings.cost_cap_monthly)
            }
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                cost_cap_monthly: e.target.value
                  ? Number(e.target.value.replace(/[^\d,-]/g, '').replace(',', '.'))
                  : null,
              }))
            }
            placeholder={t('billing.alerts.noCap', 'No limit')}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Auto-Upgrade */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {t('billing.alerts.autoUpgrade', 'Auto-Upgrade')}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'billing.alerts.autoUpgradeDesc',
                  'Automatically upgrade plan when limits are reached'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting('auto_upgrade_enabled')}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.auto_upgrade_enabled ? 'bg-navy-900' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white dark:bg-navy-900 rounded-full transform transition-transform ${
                settings.auto_upgrade_enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {settings.auto_upgrade_enabled === 1 && plans.length > 0 && (
          <select
            value={settings.auto_upgrade_plan_id || ''}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                auto_upgrade_plan_id: e.target.value || null,
              }))
            }
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          >
            <option value="">{t('billing.alerts.selectPlan', 'Select upgrade plan...')}</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {formatCurrency(plan.price_monthly)} /{' '}
                {t('billing.alerts.month', 'miesiąc')}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t('common.saveChanges', 'Save Changes')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UsageAlertsConfig;
