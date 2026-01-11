/**
 * PartnerProgramConfig - SuperAdmin Partner Program Configuration
 *
 * Features:
 * - Commission rates per tier
 * - Client discount settings
 * - Payout settings and thresholds
 *
 * Part of SuperAdmin Partner Management
 */

import {
  AlertCircle,
  Check,
  DollarSign,
  Edit2,
  Percent,
  RefreshCw,
  Save,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

interface CommissionRate {
  tier: string;
  tierName: string;
  rate: number;
  minRevenue?: number;
  color: string;
}

interface DiscountConfig {
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  durationMonths: number;
  maxDiscountPerMonth?: number;
  isActive: boolean;
}

interface PayoutSettings {
  minimumThreshold: number;
  payoutSchedule: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  processingFeePercent: number;
  autoPayoutEnabled: boolean;
  paymentMethods: string[];
}

const DEFAULT_TIERS: CommissionRate[] = [
  { tier: 'REGISTERED', tierName: 'Registered', rate: 10, minRevenue: 0, color: 'bg-slate-500' },
  { tier: 'BRONZE', tierName: 'Bronze', rate: 12, minRevenue: 5000, color: 'bg-amber-600' },
  { tier: 'SILVER', tierName: 'Silver', rate: 15, minRevenue: 15000, color: 'bg-slate-400' },
  { tier: 'GOLD', tierName: 'Gold', rate: 18, minRevenue: 50000, color: 'bg-yellow-500' },
  { tier: 'PLATINUM', tierName: 'Platinum', rate: 20, minRevenue: 100000, color: 'bg-violet-500' },
];

const PAYMENT_METHODS = [
  { id: 'BANK_TRANSFER', name: 'Bank Transfer', icon: Wallet },
  { id: 'PAYPAL', name: 'PayPal', icon: DollarSign },
  { id: 'STRIPE', name: 'Stripe', icon: DollarSign },
  { id: 'WISE', name: 'Wise', icon: DollarSign },
];

export const PartnerProgramConfig: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>(DEFAULT_TIERS);
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({
    discountType: 'PERCENTAGE',
    discountValue: 15,
    durationMonths: 12,
    maxDiscountPerMonth: undefined,
    isActive: true,
  });
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({
    minimumThreshold: 100,
    payoutSchedule: 'MONTHLY',
    processingFeePercent: 1,
    autoPayoutEnabled: false,
    paymentMethods: ['BANK_TRANSFER'],
  });

  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch commission rates
      const ratesRes = await Api.get('/api/superadmin/partner-config/commission-rates');
      if (ratesRes?.success && ratesRes?.data) {
        setCommissionRates(ratesRes.data);
      }

      // Fetch discount config
      const discountRes = await Api.get('/api/superadmin/partner-config/discount');
      if (discountRes?.success && discountRes?.data) {
        setDiscountConfig(discountRes.data);
      }

      // Fetch payout settings
      const payoutRes = await Api.get('/api/superadmin/partner-config/payout-settings');
      if (payoutRes?.success && payoutRes?.data) {
        setPayoutSettings(payoutRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching config:', err);
      setError(err?.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save commission rate
  const handleSaveCommissionRate = async (tier: string, rate: number) => {
    try {
      setSaving(true);
      const response = await Api.put('/api/superadmin/partner-config/commission-rates', {
        tier,
        rate,
      });

      if (response?.success) {
        setCommissionRates((prev) => prev.map((t) => (t.tier === tier ? { ...t, rate } : t)));
        setEditingTier(null);
        toast.success('Commission rate updated');
      } else {
        toast.error(response?.error || 'Failed to update rate');
      }
    } catch (err: any) {
      console.error('Error saving rate:', err);
      toast.error(err?.message || 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  // Save discount config
  const handleSaveDiscountConfig = async () => {
    try {
      setSaving(true);
      const response = await Api.put('/api/superadmin/partner-config/discount', discountConfig);

      if (response?.success) {
        toast.success('Discount configuration saved');
      } else {
        toast.error(response?.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      console.error('Error saving discount config:', err);
      toast.error(err?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Save payout settings
  const handleSavePayoutSettings = async () => {
    try {
      setSaving(true);
      const response = await Api.put(
        '/api/superadmin/partner-config/payout-settings',
        payoutSettings
      );

      if (response?.success) {
        toast.success('Payout settings saved');
      } else {
        toast.error(response?.error || 'Failed to save settings');
      }
    } catch (err: any) {
      console.error('Error saving payout settings:', err);
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Toggle payment method
  const togglePaymentMethod = (methodId: string) => {
    setPayoutSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(methodId)
        ? prev.paymentMethods.filter((m) => m !== methodId)
        : [...prev.paymentMethods, methodId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {t('superadmin.partnerConfig.title', 'Partner Program Configuration')}
          </h1>
          <p className="text-slate-400 dark:text-slate-500">
            {t(
              'superadmin.partnerConfig.subtitle',
              'Configure commission rates, discounts, and payout settings'
            )}
          </p>
        </div>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Commission Rates */}
      <div className="bg-navy-800/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('superadmin.partnerConfig.commissionRates', 'Commission Rates by Tier')}
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Set commission percentages for each partner tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {commissionRates.map((tier) => (
            <div key={tier.tier} className="bg-navy-900/50 rounded-xl border border-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', tier.color)} />
                  <span className="font-medium text-white">{tier.tierName}</span>
                </div>
                {editingTier !== tier.tier && (
                  <button
                    onClick={() => {
                      setEditingTier(tier.tier);
                      setEditRate(tier.rate);
                    }}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-white rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editingTier === tier.tier ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-center"
                    />
                    <span className="text-slate-400 dark:text-slate-500">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveCommissionRate(tier.tier, editRate)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTier(null)}
                      className="px-3 py-1.5 text-slate-400 dark:text-slate-500 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{tier.rate}%</p>
                  {tier.minRevenue !== undefined && tier.minRevenue > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Min: €{tier.minRevenue.toLocaleString()} revenue
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Client Discount Settings */}
      <div className="bg-navy-800/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Percent className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('superadmin.partnerConfig.clientDiscount', 'Client Discount Settings')}
              </h2>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Configure discounts for clients referred by partners
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {discountConfig.isActive ? 'Active' : 'Disabled'}
            </span>
            <button
              onClick={() =>
                setDiscountConfig({ ...discountConfig, isActive: !discountConfig.isActive })
              }
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                discountConfig.isActive ? 'bg-emerald-600' : 'bg-slate-600'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform',
                  discountConfig.isActive ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Discount Type
            </label>
            <select
              value={discountConfig.discountType}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, discountType: e.target.value as any })
              }
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Discount Value {discountConfig.discountType === 'PERCENTAGE' ? '(%)' : '(€)'}
            </label>
            <input
              type="number"
              value={discountConfig.discountValue}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, discountValue: Number(e.target.value) })
              }
              min={0}
              max={discountConfig.discountType === 'PERCENTAGE' ? 100 : undefined}
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Duration (months)
            </label>
            <input
              type="number"
              value={discountConfig.durationMonths}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, durationMonths: Number(e.target.value) })
              }
              min={1}
              max={60}
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Max Discount/Month (€)
            </label>
            <input
              type="number"
              value={discountConfig.maxDiscountPerMonth || ''}
              onChange={(e) =>
                setDiscountConfig({
                  ...discountConfig,
                  maxDiscountPerMonth: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="No limit"
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveDiscountConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Discount Settings
          </button>
        </div>
      </div>

      {/* Payout Settings */}
      <div className="bg-navy-800/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('superadmin.partnerConfig.payoutSettings', 'Payout Settings')}
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Configure payout thresholds, schedules, and payment methods
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Minimum Threshold (€)
            </label>
            <input
              type="number"
              value={payoutSettings.minimumThreshold}
              onChange={(e) =>
                setPayoutSettings({ ...payoutSettings, minimumThreshold: Number(e.target.value) })
              }
              min={0}
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Payout Schedule
            </label>
            <select
              value={payoutSettings.payoutSchedule}
              onChange={(e) =>
                setPayoutSettings({ ...payoutSettings, payoutSchedule: e.target.value as any })
              }
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Processing Fee (%)
            </label>
            <input
              type="number"
              value={payoutSettings.processingFeePercent}
              onChange={(e) =>
                setPayoutSettings({
                  ...payoutSettings,
                  processingFeePercent: Number(e.target.value),
                })
              }
              min={0}
              max={10}
              step={0.1}
              className="w-full px-4 py-2.5 bg-navy-900 border border-white/10 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
              Auto-payout
            </label>
            <div className="flex items-center gap-3 h-[42px]">
              <button
                onClick={() =>
                  setPayoutSettings({
                    ...payoutSettings,
                    autoPayoutEnabled: !payoutSettings.autoPayoutEnabled,
                  })
                }
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  payoutSettings.autoPayoutEnabled ? 'bg-emerald-600' : 'bg-slate-600'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform',
                    payoutSettings.autoPayoutEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {payoutSettings.autoPayoutEnabled ? 'Enabled' : 'Manual approval'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-3">
            Enabled Payment Methods
          </label>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => togglePaymentMethod(method.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  payoutSettings.paymentMethods.includes(method.id)
                    ? 'bg-violet-600/20 border-violet-500 text-white'
                    : 'bg-navy-900 border-white/10 text-slate-400 dark:text-slate-500 hover:text-white'
                )}
              >
                <method.icon className="w-4 h-4" />
                {method.name}
                {payoutSettings.paymentMethods.includes(method.id) && (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSavePayoutSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Payout Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerProgramConfig;
