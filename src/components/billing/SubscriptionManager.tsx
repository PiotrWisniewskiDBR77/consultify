/**
 * SubscriptionManager - Full subscription management with plan comparison
 *
 * Features:
 * - Current plan display
 * - Plan comparison table
 * - Upgrade/downgrade flow with confirmation
 * - Trial countdown
 * - Discount code input
 */

import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  HardDrive,
  Loader2,
  Shield,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  token_limit: number;
  storage_limit_gb: number;
  token_overage_rate: number;
  storage_overage_rate: number;
  features?: string;
  is_active: number;
  stripe_price_id?: string;
}

interface CurrentBilling {
  billing?: {
    subscription_plan_id?: string;
    status?: string;
    current_period_end?: string;
    trial_ends_at?: string;
  };
  usage?: {
    tokensUsed?: number;
    tokenLimit?: number;
    storageUsed?: number;
    storageLimit?: number;
  };
}

interface SubscriptionManagerProps {
  onPlanChanged?: () => void;
}

const formatTokens = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

const parseFeatures = (features?: string): Record<string, any> => {
  if (!features) return {};
  try {
    return JSON.parse(features);
  } catch {
    return {};
  }
};

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onPlanChanged }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentBilling, setCurrentBilling] = useState<CurrentBilling | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discount, setDiscount] = useState<{
    valid: boolean;
    discount?: any;
    error?: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, billingData] = await Promise.all([
        Api.getSubscriptionPlans(),
        Api.getCurrentBilling(),
      ]);
      setPlans(plansData.filter((p: SubscriptionPlan) => p.is_active));
      setCurrentBilling(billingData);
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      toast.error(t('billing.subscription.fetchError', 'Failed to load subscription data'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentPlanId = currentBilling?.billing?.subscription_plan_id;
  const currentPlan = plans.find((p) => p.id === currentPlanId);
  const trialEndsAt = currentBilling?.billing?.trial_ends_at;
  const isTrialing = trialEndsAt && new Date(trialEndsAt) > new Date();

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.id === currentPlanId) return;
    setSelectedPlan(plan);
    setShowConfirmModal(true);
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) return;

    try {
      setValidatingDiscount(true);
      const result = await Api.validateDiscountCode(discountCode, selectedPlan?.id);
      setDiscount(result);
      if (!result.valid) {
        toast.error(
          result.error || t('billing.subscription.invalidDiscount', 'Invalid discount code')
        );
      }
    } catch (error) {
      console.error('Failed to validate discount:', error);
      setDiscount({ valid: false, error: 'Failed to validate code' });
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleConfirmChange = async () => {
    if (!selectedPlan) return;

    try {
      setProcessing(true);

      if (currentPlanId) {
        await Api.changePlan(selectedPlan.id);
      } else {
        await Api.subscribeToPlan(selectedPlan.id);
      }

      toast.success(t('billing.subscription.changed', 'Subscription updated successfully'));
      setShowConfirmModal(false);
      setSelectedPlan(null);
      setDiscountCode('');
      setDiscount(null);
      await fetchData();
      onPlanChanged?.();
    } catch (error: any) {
      console.error('Failed to change plan:', error);
      toast.error(
        error.message || t('billing.subscription.changeError', 'Failed to update subscription')
      );
    } finally {
      setProcessing(false);
    }
  };

  const getChangeType = (newPlan: SubscriptionPlan): 'upgrade' | 'downgrade' | 'same' => {
    if (!currentPlan) return 'upgrade';
    if (newPlan.price_monthly > currentPlan.price_monthly) return 'upgrade';
    if (newPlan.price_monthly < currentPlan.price_monthly) return 'downgrade';
    return 'same';
  };

  const calculateDiscount = (price: number): number => {
    if (!discount?.valid || !discount.discount) return price;
    const d = discount.discount;
    if (d.type === 'percent') {
      return price * (1 - d.value / 100);
    } else if (d.type === 'fixed_amount') {
      return Math.max(0, price - d.value);
    }
    return price;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      {currentPlan && (
        <div className="bg-gradient-to-br from-primary-600 to-crimson-600 rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Crown className="w-32 h-32" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">
                {t('billing.subscription.currentPlan', 'CURRENT PLAN')}
              </span>
              {isTrialing && (
                <span className="px-3 py-1 bg-amber-500/80 rounded-full text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('billing.subscription.trial', 'TRIAL')}
                </span>
              )}
            </div>
            <h2 className="text-3xl font-bold mb-2">{currentPlan.name}</h2>
            <p className="text-white/80 text-lg">${currentPlan.price_monthly}/month</p>
            <div className="flex gap-6 mt-4 text-sm text-white/70">
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                {formatTokens(currentPlan.token_limit)} tokens
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-4 h-4" />
                {currentPlan.storage_limit_gb} GB
              </span>
            </div>
            {isTrialing && trialEndsAt && (
              <div className="mt-4 pt-4 border-t border-c-border">
                <p className="text-sm text-white/80">
                  {t('billing.subscription.trialEnds', 'Trial ends')}:{' '}
                  {new Date(trialEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plans Comparison */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          {t('billing.subscription.availablePlans', 'Available Plans')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, index) => {
            const isCurrent = plan.id === currentPlanId;
            const isPopular = index === 1; // Middle plan is popular
            const features = parseFeatures(plan.features);

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl p-6 transition-all duration-300 ${
                  isCurrent
                    ? 'bg-primary-50 dark:bg-primary-500/10 border-2 border-primary-500 shadow-lg shadow-primary-500/20'
                    : isPopular
                      ? 'bg-white dark:bg-white/5 border-2 border-amber-400 shadow-lg'
                      : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/30'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                      <Sparkles className="w-3 h-3" />
                      {t('billing.subscription.popular', 'Most Popular')}
                    </span>
                  </div>
                )}

                {/* Current Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-navy-900 text-white text-xs font-bold rounded-full">
                      <Check className="w-3 h-3" />
                      {t('billing.subscription.current', 'Current')}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6 pt-2">
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {plan.name}
                  </h4>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      ${plan.price_monthly}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">/mo</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Zap className="w-4 h-4 text-amber-500" />
                    {formatTokens(plan.token_limit)} tokens/month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <HardDrive className="w-4 h-4 text-emerald-500" />
                    {plan.storage_limit_gb} GB storage
                  </li>
                  {Object.entries(features)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <li
                        key={key}
                        className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {value === true || value === 'true' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : value === false || value === 'false' ? (
                          <X className="w-4 h-4 text-slate-600" />
                        ) : (
                          <Shield className="w-4 h-4 text-blue-500" />
                        )}
                        <span
                          className={
                            value === false || value === 'false'
                              ? 'text-slate-600 dark:text-slate-500 line-through'
                              : ''
                          }
                        >
                          {key.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                </ul>

                {/* Overage Info */}
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-4">
                  Overage: ${plan.token_overage_rate}/1K • ${plan.storage_overage_rate}/GB
                </p>

                {/* Action Button */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-center text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10">
                    {t('billing.subscription.yourPlan', 'Your Current Plan')}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      isPopular
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                    }`}
                  >
                    {currentPlan && plan.price_monthly > currentPlan.price_monthly
                      ? t('billing.subscription.upgrade', 'Upgrade')
                      : currentPlan
                        ? t('billing.subscription.switch', 'Switch')
                        : t('billing.subscription.select', 'Select')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Change Confirmation Modal */}
      {showConfirmModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                {getChangeType(selectedPlan) === 'upgrade' ? (
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {getChangeType(selectedPlan) === 'upgrade'
                      ? t('billing.subscription.confirmUpgrade', 'Confirm Upgrade')
                      : t('billing.subscription.confirmChange', 'Confirm Plan Change')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {currentPlan?.name} → {selectedPlan.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Price Change */}
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('billing.subscription.newPrice', 'New Monthly Price')}
                  </span>
                  <div className="text-right">
                    {discount?.valid && (
                      <span className="text-sm text-slate-600 dark:text-slate-500 line-through mr-2">
                        ${selectedPlan.price_monthly}
                      </span>
                    )}
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      ${calculateDiscount(selectedPlan.price_monthly).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discount Code Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('billing.subscription.discountCode', 'Discount Code')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
                    <input
                      type="text"
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value.toUpperCase());
                        setDiscount(null);
                      }}
                      placeholder="PROMO2024"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-c-focus"
                    />
                  </div>
                  <button
                    onClick={handleValidateDiscount}
                    disabled={!discountCode.trim() || validatingDiscount}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 disabled:opacity-50"
                  >
                    {validatingDiscount ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('billing.subscription.apply', 'Apply')
                    )}
                  </button>
                </div>
                {discount && (
                  <p
                    className={`text-sm mt-1 ${discount.valid ? 'text-green-600' : 'text-danger-500'}`}
                  >
                    {discount.valid
                      ? `${discount.discount?.type === 'percent' ? `${discount.discount.value}% off` : `$${discount.discount?.value} off`}`
                      : discount.error}
                  </p>
                )}
              </div>

              {/* Proration Note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {getChangeType(selectedPlan) === 'upgrade'
                    ? t(
                        'billing.subscription.proratedNote',
                        'You will be charged the prorated difference immediately.'
                      )
                    : t(
                        'billing.subscription.downgradeNote',
                        'Changes will take effect at the end of your current billing period.'
                      )}
                </p>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedPlan(null);
                  setDiscountCode('');
                  setDiscount(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/5"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleConfirmChange}
                disabled={processing}
                className="flex-1 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.processing', 'Processing...')}
                  </>
                ) : (
                  t('billing.subscription.confirm', 'Confirm Change')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
