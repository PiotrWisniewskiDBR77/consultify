/**
 * BillingSubscriptionModule - Billing & Subscription Management
 *
 * Features:
 * - Subscription details with lifecycle status (trialing/active/past_due/cancelled)
 * - Usage statistics with approaching-limit warnings
 * - Billing history
 * - Payment methods management
 * - Plan comparison with upgrade/downgrade
 * - Checkout flow integration
 * - Upgrade triggers from policy context
 */

import {
  AlertCircle,
  ArrowUpCircle,
  BarChart3,
  Check,
  CreditCard,
  Crown,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { usePolicySnapshot, useSubscriptionStatus } from '../../../contexts/AccessPolicyContext';
import { Api } from '../../../services/api';
import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { InfoButton } from '../../shared/InfoButton';

interface BillingSubscriptionModuleProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface Subscription {
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingRail?: 'stripe_subscription' | 'manual_invoice' | 'hybrid_usage_invoice';
  contractStatus?:
    | 'draft'
    | 'active'
    | 'renewal_due'
    | 'grace'
    | 'suspended'
    | 'expired'
    | 'canceled'
    | null;
  renewalAt?: string | null;
  graceUntil?: string | null;
  accessExpiresAt?: string | null;
  managedByUserId?: string | null;
  isManualBilling?: boolean;
}

interface UsageStats {
  users: { used: number; limit: number };
  projects: { used: number; limit: number };
  storage: { used: number; limit: number; unit: string };
  aiTokens: { used: number; limit: number };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  downloadUrl?: string | null;
  source?: string | null;
  currency?: string | null;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface BillingPlanOption {
  id: string;
  name: string;
  price: number | null;
  features: string[];
  popular: boolean;
}

interface BillingPlanRow {
  id?: string | number;
  name?: string;
  price_monthly?: number | string | null;
  features?: unknown;
  is_popular?: boolean;
}

interface InvoiceRow {
  id?: string | number;
  stripe_invoice_id?: string | number;
  paid_at?: string;
  due_date?: string;
  created_at?: string;
  amount_paid?: number | string;
  amount_due?: number | string;
  amount?: number | string;
  status?: string;
  pdf_url?: string | null;
  downloadUrl?: string | null;
  source?: string | null;
  currency?: string | null;
}

const parsePlanFeatures = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      if (raw.trim()) return [raw.trim()];
    }
  }
  return [];
};

const normalizePlan = (plan: BillingPlanRow): BillingPlanOption => ({
  id: String(plan?.id || ''),
  name: String(plan?.name || 'Plan'),
  price: plan?.price_monthly == null ? null : Number(plan.price_monthly),
  features: parsePlanFeatures(plan?.features),
  popular: Boolean(plan?.is_popular),
});

const normalizeInvoice = (invoice: InvoiceRow): Invoice => ({
  id: String(invoice?.id || invoice?.stripe_invoice_id || ''),
  date: String(
    invoice?.paid_at || invoice?.due_date || invoice?.created_at || new Date().toISOString()
  ),
  amount: Number(invoice?.amount_paid ?? invoice?.amount_due ?? invoice?.amount ?? 0),
  status: String(invoice?.status || 'open'),
  downloadUrl: invoice?.pdf_url || invoice?.downloadUrl || null,
  source: invoice?.source || (invoice?.stripe_invoice_id ? 'stripe' : null),
  currency: invoice?.currency || 'USD',
});

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  past_due: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
  canceling: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
  renewal_due: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
};

export const BillingSubscriptionModule: React.FC<BillingSubscriptionModuleProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const { snapshot, refresh: refreshPolicy } = usePolicySnapshot();
  const subscriptionStatus = useSubscriptionStatus();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [availablePlans, setAvailablePlans] = useState<BillingPlanOption[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payment' | 'usage'>(
    'overview'
  );
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    try {
      trackFunnelEvent('upgrade_viewed', { location: 'settings_billing' });
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async (): Promise<Subscription | null> => {
    try {
      setLoading(true);
      setLoadError(null);
      const [subRes, usageRes, invoicesRes, paymentRes, plansRes] = await Promise.all([
        Api.get('/api/billing/subscription'),
        Api.get('/api/billing/usage').catch(() => ({ data: null })),
        Api.get('/api/billing/invoices').catch(() => ({ data: [] })),
        Api.get('/api/billing/payment-methods').catch(() => ({ data: [] })),
        Api.getSubscriptionPlans().catch(() => []),
      ]);

      const nextSubscription = subRes.data ?? null;
      setSubscription(nextSubscription);

      if (usageRes.data) setUsage(usageRes.data);
      else setUsage(null);

      const invoiceRows = Array.isArray(invoicesRes?.data?.invoices)
        ? invoicesRes.data.invoices
        : Array.isArray(invoicesRes?.invoices)
          ? invoicesRes.invoices
          : Array.isArray(invoicesRes?.data)
            ? invoicesRes.data
            : [];
      setInvoices(invoiceRows.map(normalizeInvoice));

      if (paymentRes.data) setPaymentMethods(paymentRes.data);
      else setPaymentMethods([]);

      setAvailablePlans(
        Array.isArray(plansRes) ? plansRes.map(normalizePlan).filter((plan) => plan.id) : []
      );
      return nextSubscription;
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load billing data'));
      setSubscription(null);
      setUsage(null);
      setInvoices([]);
      setPaymentMethods([]);
      setAvailablePlans([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [currentUser.id, loadData]);

  const handleSelectPlan = (planId: string) => {
    try {
      trackFunnelEvent('plan_selected', { planId });
    } catch {
      // ignore
    }
    setCheckoutPlanId(planId);
  };

  const handleCheckoutConfirm = async () => {
    if (!checkoutPlanId) return;
    setCheckoutLoading(true);
    try {
      trackFunnelEvent('checkout_started', { planId: checkoutPlanId });
    } catch {
      // ignore
    }
    try {
      setActionError(null);
      if (subscription?.plan) {
        await Api.changePlan(checkoutPlanId);
      } else {
        await Api.subscribeToPlan(checkoutPlanId);
      }
      const refreshedSubscription = await loadData();
      if (refreshedSubscription?.plan !== checkoutPlanId) {
        throw new Error('Billing plan change was not confirmed by the server');
      }
      await refreshPolicy();
      try {
        trackFunnelEvent('checkout_completed', { planId: checkoutPlanId });
      } catch {
        // ignore
      }
      toast.success(t('access.upgrade.checkout.success'));
      setCheckoutPlanId(null);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, t('access.upgrade.checkout.failed'));
      try {
        trackFunnelEvent('checkout_failed', { planId: checkoutPlanId, error: message });
      } catch {
        // ignore
      }
      setActionError(message);
      toast.error(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel your subscription? You will lose access at the end of the billing period.'
      )
    )
      return;
    try {
      setActionError(null);
      await Api.cancelSubscription();
      const refreshedSubscription = await loadData();
      if (
        !refreshedSubscription ||
        (refreshedSubscription.status !== 'cancelled' && !refreshedSubscription.cancelAtPeriodEnd)
      ) {
        throw new Error('Subscription cancellation was not confirmed by the server');
      }
      await refreshPolicy();
      try {
        trackFunnelEvent('subscription_cancelled', {});
      } catch {
        // ignore
      }
      toast.success('Subscription cancelled.');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to cancel subscription');
      setActionError(message);
      toast.error(message);
    }
  };

  const UsageBar: React.FC<{
    used: number;
    limit: number;
    label: string;
    unit?: string;
    policyPercent?: number;
  }> = ({ used, limit, label, unit = '', policyPercent }) => {
    const percentage = policyPercent ?? (limit > 0 ? Math.min((used / limit) * 100, 100) : 0);
    const isUnlimited = limit < 0;
    const isApproaching = percentage >= 70 && percentage < 90;
    const isHigh = percentage >= 90 && percentage < 100;
    const isExceeded = percentage >= 100;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">{label}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {used.toLocaleString()}
              {unit}{' '}
              {isUnlimited
                ? `(${t('access.upgrade.unlimited')})`
                : `/ ${limit.toLocaleString()}${unit}`}
            </span>
            {isApproaching && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {Math.round(percentage)}%
              </span>
            )}
            {(isHigh || isExceeded) && <AlertCircle size={14} className="text-rose-500" />}
          </div>
        </div>
        {!isUnlimited && (
          <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isExceeded
                  ? 'bg-rose-500'
                  : isHigh
                    ? 'bg-amber-500'
                    : isApproaching
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        )}
        {isApproaching && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('access.banner.approachingLimits')}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        <InfoButton cardId="settings-billing" position="top-right" />
        <DegradedState title="Billing data unavailable" description={loadError} />
      </div>
    );
  }

  const currentPlan = availablePlans.find((p) => p.id === subscription?.plan);
  const effectiveStatus = subscriptionStatus || subscription?.status || 'trialing';
  const isManualBilling = Boolean(snapshot?.isManualBilling || subscription?.isManualBilling);
  const manualStatus = snapshot?.contractStatus || subscription?.contractStatus || null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-billing" position="top-right" />

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {actionError}
        </div>
      )}

      {/* Past Due Banner */}
      {effectiveStatus === 'past_due' && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-rose-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
              {t('access.banner.pastDue')}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('payment')}
            className="px-3 py-1.5 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
          >
            {t('access.cta.fixPayment')}
          </button>
        </div>
      )}

      {/* Trial Warning Banner */}
      {snapshot?.isTrial && !snapshot.isTrialExpired && snapshot.warningLevel !== 'none' && (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 ${
            snapshot.warningLevel === 'critical'
              ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'
              : 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30'
          }`}
        >
          <Zap
            size={20}
            className={
              snapshot.warningLevel === 'critical'
                ? 'text-amber-500 flex-shrink-0'
                : 'text-blue-500 flex-shrink-0'
            }
          />
          <p
            className={`text-sm flex-1 ${
              snapshot.warningLevel === 'critical'
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-blue-800 dark:text-blue-300'
            }`}
          >
            {t(
              snapshot.warningLevel === 'critical'
                ? 'access.banner.trialCritical'
                : 'access.banner.trialWarning',
              { days: snapshot.trialDaysLeft }
            )}
          </p>
          <button
            onClick={() => setActiveTab('overview')}
            className="px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            {t('access.cta.upgradePlan')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard size={28} className="text-emerald-500" />
            {t('settings.billing', 'Billing & Subscription')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t('access.upgrade.subtitle')}
          </p>
        </div>
        {(isManualBilling ? manualStatus || effectiveStatus : effectiveStatus) && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              STATUS_COLORS[
                (isManualBilling ? manualStatus || effectiveStatus : effectiveStatus) as string
              ] || STATUS_COLORS.trialing
            }`}
          >
            {t(
              `access.upgrade.subscription.${isManualBilling ? manualStatus || effectiveStatus : effectiveStatus}`,
              isManualBilling ? manualStatus || effectiveStatus : effectiveStatus
            )}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-4">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Crown },
            { id: 'usage', label: 'Usage', icon: BarChart3 },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            ...(!isManualBilling ? [{ id: 'payment', label: 'Payment', icon: CreditCard }] : []),
          ] as Array<{ id: typeof activeTab; label: string; icon: React.ElementType }>
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Checkout Overlay */}
      {checkoutPlanId && (
        <div className="bg-white dark:bg-navy-900 border-2 border-primary-500 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowUpCircle size={20} className="text-primary-500" />
            {t('access.upgrade.checkout.title')}
          </h3>
          <div className="p-4 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
            <p className="text-sm text-primary-700 dark:text-primary-300">
              {t('access.upgrade.whatChanges')}:{' '}
              {availablePlans.find((p) => p.id === checkoutPlanId)?.name || checkoutPlanId}
            </p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
              {t('access.upgrade.instantUnlock')}
            </p>
          </div>
          {paymentMethods.length === 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('access.upgrade.checkout.selectPayment')}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setCheckoutPlanId(null)}
              className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              {t('access.upgrade.checkout.cancel')}
            </button>
            <button
              onClick={handleCheckoutConfirm}
              disabled={checkoutLoading}
              className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {checkoutLoading
                ? t('access.upgrade.checkout.processing')
                : t('access.upgrade.checkout.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Current Plan */}
          <div className="bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">{t('access.upgrade.currentPlan')}</p>
                <h3 className="text-3xl font-bold mt-1">
                  {currentPlan?.name || (snapshot?.isTrial ? 'Trial' : 'Free')}
                </h3>
                {isManualBilling && (
                  <p className="text-emerald-100 mt-2">
                    Managed by account team
                    {manualStatus ? ` • ${manualStatus.replace('_', ' ')}` : ''}
                  </p>
                )}
                {subscription?.currentPeriodEnd && (
                  <p className="text-emerald-100 mt-2">
                    Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {subscription?.renewalAt && (
                  <p className="text-emerald-100 mt-2">
                    Contract renewal {new Date(subscription.renewalAt).toLocaleDateString()}
                  </p>
                )}
                {snapshot?.isTrial && snapshot.trialExpiresAt && (
                  <p className="text-emerald-100 mt-2">
                    Trial expires {new Date(snapshot.trialExpiresAt).toLocaleDateString()}
                    {snapshot.trialDaysLeft > 0 && ` (${snapshot.trialDaysLeft} days left)`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold">${currentPlan?.price || 0}</p>
                <p className="text-emerald-100">{t('access.upgrade.perMonth')}</p>
              </div>
            </div>
          </div>

          {/* Plan Comparison */}
          {availablePlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {availablePlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border-2 relative ${
                    plan.id === subscription?.plan
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary-600 text-white text-xs font-bold rounded-full">
                      {t('access.upgrade.popular')}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h4>
                    {plan.id === subscription?.plan && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        {t('access.upgrade.currentPlan')}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                    {plan.price !== null
                      ? `$${plan.price}${t('access.upgrade.perMonth')}`
                      : 'Custom'}
                  </p>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check size={14} className="text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.id !== subscription?.plan && plan.price !== null && !isManualBilling && (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      className="w-full mt-4 py-2 px-4 border border-emerald-500 text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-sm font-medium transition-colors"
                    >
                      {availablePlans.indexOf(plan) >
                      availablePlans.findIndex((p) => p.id === subscription?.plan)
                        ? 'Upgrade'
                        : 'Downgrade'}
                    </button>
                  )}
                  {plan.price === null && (
                    <button className="w-full mt-4 py-2 px-4 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-medium transition-colors">
                      {t('access.cta.contactSales')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
              Live pricing plans are currently unavailable. Refresh the page or retry after billing
              services recover.
            </div>
          )}

          {/* Cancel */}
          {subscription?.status === 'active' && !isManualBilling && (
            <div className="text-center">
              <button
                onClick={handleCancelSubscription}
                className="text-sm text-slate-400 dark:text-slate-500 hover:text-rose-400 transition-colors"
              >
                Cancel Subscription
              </button>
            </div>
          )}
          {isManualBilling && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300">
              This subscription is managed manually outside Stripe. Contract renewals, invoice
              status, and access changes are handled by your account team.
            </div>
          )}
        </>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Current Usage</h3>

          <div className="space-y-6">
            {usage ? (
              <>
                <UsageBar
                  used={usage.users.used}
                  limit={usage.users.limit}
                  label="Team Members"
                  policyPercent={snapshot?.usagePercent?.users}
                />
                <UsageBar
                  used={usage.projects.used}
                  limit={usage.projects.limit}
                  label="Projects"
                  policyPercent={snapshot?.usagePercent?.projects}
                />
                <UsageBar
                  used={usage.storage.used}
                  limit={usage.storage.limit}
                  label="Storage"
                  unit={` ${usage.storage.unit}`}
                  policyPercent={snapshot?.usagePercent?.storage}
                />
                <UsageBar
                  used={usage.aiTokens.used}
                  limit={usage.aiTokens.limit}
                  label="AI Tokens"
                  policyPercent={snapshot?.usagePercent?.tokens}
                />
              </>
            ) : snapshot?.usageToday ? (
              <>
                <UsageBar
                  used={snapshot.usageToday.users}
                  limit={snapshot.limits?.maxUsers ?? -1}
                  label="Team Members"
                  policyPercent={snapshot.usagePercent?.users}
                />
                <UsageBar
                  used={snapshot.usageToday.projects}
                  limit={snapshot.limits?.maxProjects ?? -1}
                  label="Projects"
                  policyPercent={snapshot.usagePercent?.projects}
                />
                <UsageBar
                  used={snapshot.usageToday.storageMb}
                  limit={snapshot.limits?.maxStorageMb ?? -1}
                  label="Storage"
                  unit=" MB"
                  policyPercent={snapshot.usagePercent?.storage}
                />
                <UsageBar
                  used={snapshot.usageToday.tokensUsed}
                  limit={snapshot.limits?.maxTotalTokens ?? -1}
                  label="AI Tokens"
                  policyPercent={snapshot.usagePercent?.tokens}
                />
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No usage data available.</p>
            )}
          </div>

          {snapshot?.isTrial && (
            <div className="p-4 bg-primary-50 dark:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/20">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                {t('access.upgrade.instantUnlock')}{' '}
                <button onClick={() => setActiveTab('overview')} className="underline font-medium">
                  {t('access.cta.upgradePlan')}
                </button>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Billing History</h3>
          </div>
          {invoices.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
              No invoices yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileText size={20} className="text-slate-400 dark:text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Invoice {invoice.id}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                      {invoice.source && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">
                          {invoice.source === 'manual' || invoice.source === 'manual_invoice'
                            ? 'Manual invoice'
                            : 'Stripe invoice'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-900 dark:text-white font-medium">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: invoice.currency || 'USD',
                      }).format(invoice.amount)}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}
                    >
                      {invoice.status}
                    </span>
                    <button
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg disabled:opacity-40"
                      disabled={!invoice.downloadUrl}
                      onClick={() =>
                        invoice.downloadUrl && window.open(invoice.downloadUrl, '_blank')
                      }
                    >
                      <Download size={16} className="text-slate-500 dark:text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-4">
          {effectiveStatus === 'past_due' && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-rose-500" />
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
                  {t('access.upgrade.subscription.past_due')}
                </p>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400">{t('access.banner.pastDue')}</p>
            </div>
          )}

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
                <Plus size={16} />
                Add Method
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payment methods on file.</p>
                <p className="text-xs mt-1">
                  {snapshot?.isTrial
                    ? 'Add a payment method to unlock AI beyond your free budget.'
                    : 'Add a payment method to subscribe to a plan.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 rounded-lg border-2 ${
                      method.isDefault
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard size={24} className="text-slate-400 dark:text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {method.brand} &bull;&bull;&bull;&bull; {method.last4}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Expires {method.expiryMonth}/{method.expiryYear}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {method.isDefault && (
                          <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                        <button className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingSubscriptionModule;
