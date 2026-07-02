/**
 * AdminBillingManagement - Organization billing and subscription management
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  DollarSign,
  Download,
  FileText,
  Mail,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
  User as UserIcon,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import { DegradedState } from '../../components/Admin/AdminState';
import { EntityStatusChip } from '../../components/ui/primitives/chips/EntityStatusChip';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { BillingAddress, Invoice, OrganizationOwnership } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  token_limit: number;
  storage_limit_gb: number;
  features: Record<string, boolean>;
}

interface AddOn {
  id: string;
  type: 'tokens' | 'storage' | 'seats';
  name: string;
  description: string;
  amount: number;
  price: number;
  currency: string;
  recurring: boolean;
}

interface PlanComparison {
  currentPlan: SubscriptionPlan | null;
  targetPlan: SubscriptionPlan;
  comparison: {
    isUpgrade: boolean;
    isDowngrade: boolean;
    priceDifference: number;
    proratedAmount: number;
    creditAmount: number;
    effectiveDate: string;
    daysRemaining: number;
  };
}

interface BillingData {
  plan: string;
  status: string;
  nextBilling: string;
  amount: number;
  users: number;
  maxUsers: number;
}

interface UsageData {
  tokens?: {
    used?: number;
    limit?: number;
  };
  storage?: {
    used_gb?: number;
    limit_gb?: number;
  };
}

const formatUsagePair = (used?: number, limit?: number) =>
  typeof used === 'number' && typeof limit === 'number'
    ? `${used.toLocaleString()} / ${limit.toLocaleString()}`
    : '--';

const usagePercent = (used?: number, limit?: number) =>
  typeof used === 'number' && typeof limit === 'number' && limit > 0
    ? `${Math.min(100, (used / limit) * 100)}%`
    : '0%';

const billingInfoMatches = (
  actual: OrganizationOwnership | null,
  expected: Partial<OrganizationOwnership>
) =>
  Boolean(actual) &&
  actual?.billingName === expected.billingName &&
  actual?.billingEmail === expected.billingEmail &&
  actual?.taxId === expected.taxId &&
  actual?.vatNumber === expected.vatNumber &&
  actual?.billingAddress?.line1 === expected.billingAddress?.line1 &&
  actual?.billingAddress?.city === expected.billingAddress?.city &&
  actual?.billingAddress?.postalCode === expected.billingAddress?.postalCode &&
  actual?.billingAddress?.country === expected.billingAddress?.country;

interface AdminBillingManagementProps {
  className?: string;
}

export const AdminBillingManagement: React.FC<AdminBillingManagementProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { currentOrganization, currentUser } = useAppStore();

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ownership, setOwnership] = useState<OrganizationOwnership | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billingLoadError, setBillingLoadError] = useState<string | null>(null);
  const [usageLoadError, setUsageLoadError] = useState<string | null>(null);
  const [invoicesLoadError, setInvoicesLoadError] = useState<string | null>(null);
  const [plansLoadError, setPlansLoadError] = useState<string | null>(null);
  const [addonsLoadError, setAddonsLoadError] = useState<string | null>(null);

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingForm, setBillingForm] = useState<Partial<OrganizationOwnership>>({});
  const [billingActionError, setBillingActionError] = useState<string | null>(null);

  // Plan comparison states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planComparison, setPlanComparison] = useState<PlanComparison | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  // Add-ons states
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [selectedAddon, setSelectedAddon] = useState<AddOn | null>(null);
  const [addonQuantity, setAddonQuantity] = useState(1);
  const [purchasingAddon, setPurchasingAddon] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetchBillingData();
    fetchInvoices();
    fetchOwnershipData();
    loadUsageData();
    // These loaders are stable enough for the initial mount path; later refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsageData = async () => {
    try {
      setUsageLoadError(null);
      const data = await Api.getUsage();
      setUsageData((data.structuredUsage || null) as UsageData | null);
    } catch (error: unknown) {
      setUsageData(null);
      setUsageLoadError(normalizeApiErrorMessage(error, 'Failed to load usage data'));
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      setInvoicesLoadError(null);
      const data = await Api.getInvoices();
      setInvoices(data);
    } catch (error: unknown) {
      setInvoices([]);
      setInvoicesLoadError(normalizeApiErrorMessage(error, 'Failed to load invoices'));
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchOwnershipData = async () => {
    try {
      const res = await fetch(`/api/organizations/${currentOrganization?.id}/ownership`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const nextOwnership = (data.ownership || null) as OrganizationOwnership | null;
      setOwnership(nextOwnership);
      setBillingForm(nextOwnership || {});
      return nextOwnership;
    } catch {
      return null;
    }
  };

  const loadAvailablePlans = async () => {
    setLoadingPlans(true);
    try {
      setPlansLoadError(null);
      const res = await fetch('/api/billing/plans', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAvailablePlans(data.plans || []);
    } catch (error: unknown) {
      setAvailablePlans([]);
      setPlansLoadError(normalizeApiErrorMessage(error, 'Failed to load plans'));
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadAddons = async () => {
    try {
      setAddonsLoadError(null);
      const res = await fetch('/api/billing/addons', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAddons(data.addons || []);
    } catch (error: unknown) {
      setAddons([]);
      setAddonsLoadError(normalizeApiErrorMessage(error, 'Failed to load add-ons'));
    }
  };

  const handlePlanSelect = async (planId: string) => {
    setSelectedPlanId(planId);
    try {
      const res = await fetch(`/api/billing/plan-comparison/${planId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlanComparison(data);
      }
    } catch {
      setPlanComparison(null);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedPlanId) return;
    setChangingPlan(true);
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ planId: selectedPlanId, confirmProration: true }),
      });
      if (res.ok) {
        toast.success('Plan changed successfully!');
        setShowPlanModal(false);
        fetchBillingData();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to change plan');
      }
    } catch (error: unknown) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to change plan'));
    } finally {
      setChangingPlan(false);
    }
  };

  const handlePurchaseAddon = async () => {
    if (!selectedAddon) return;
    setPurchasingAddon(true);
    try {
      const res = await fetch('/api/billing/purchase-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ addonId: selectedAddon.id, quantity: addonQuantity }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(result.message || 'Add-on purchased successfully!');
        setShowAddonsModal(false);
        setSelectedAddon(null);
        setAddonQuantity(1);
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to purchase add-on');
      }
    } catch (error: unknown) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to purchase add-on'));
    } finally {
      setPurchasingAddon(false);
    }
  };

  const openPlanModal = () => {
    loadAvailablePlans();
    setShowPlanModal(true);
  };

  const openAddonsModal = () => {
    loadAddons();
    setShowAddonsModal(true);
  };

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      setBillingLoadError(null);
      const [billingResult, seatResult] = await Promise.allSettled([
        Api.getCurrentBilling(),
        Api.getSeatConfiguration(),
      ]);

      const billingData = billingResult.status === 'fulfilled' ? billingResult.value : null;
      const seatConfig = seatResult.status === 'fulfilled' ? seatResult.value : null;

      if (billingData || seatConfig) {
        setBilling({
          plan: billingData?.plan?.name || 'Professional',
          status: billingData?.status || 'active',
          nextBilling: billingData?.current_period_end || new Date().toISOString(),
          amount: billingData?.plan?.price_monthly || 0,
          users: seatConfig?.seats_used || 0,
          maxUsers: seatConfig?.total_seats_available || 0,
        });
      } else {
        throw new Error('Failed to load billing summary');
      }
    } catch (error: unknown) {
      toast.error('Failed to load billing information');
      setBilling(null);
      setBillingLoadError(normalizeApiErrorMessage(error, 'Failed to load billing summary'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBillingInfo = async () => {
    setSaving(true);
    setBillingActionError(null);
    try {
      const expectedBilling = billingForm;
      const res = await fetch(`/api/organizations/${currentOrganization?.id}/billing-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(billingForm),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const persistedOwnership = await fetchOwnershipData();
      if (!billingInfoMatches(persistedOwnership, expectedBilling)) {
        throw new Error('Billing information update was not confirmed by the server');
      }
      toast.success(t('admin.billing.infoUpdated', 'Billing information updated'));
      setShowBillingModal(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('admin.billing.updateError', 'Failed to update billing information')
      );
      setBillingActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <SharedLoadingState template="card" count={4} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-navy-900 dark:text-white flex items-center gap-2">
            <CreditCard size={16} className="text-slate-500 dark:text-slate-400" />
            {t('admin.billing.title', 'Billing & Subscription')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.billing.desc', "Manage your organization's subscription and billing")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openAddonsModal}
            disabled={!!billingLoadError}
            className="admin-btn admin-btn-subtle flex items-center gap-2"
          >
            <Package size={14} />
            {t('admin.billing.addons', 'Add-ons')}
          </button>
          <button
            onClick={openPlanModal}
            disabled={!!billingLoadError}
            className="admin-btn admin-btn-accent flex items-center gap-2"
          >
            <Crown size={14} />
            {t('admin.billing.upgrade', 'Change Plan')}
          </button>
        </div>
      </div>

      {billingLoadError && (
        <DegradedState title="Billing summary unavailable" description={billingLoadError} />
      )}

      {/* Current Plan - Clean minimal */}
      {!billingLoadError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">
                {t('admin.billing.currentPlan', 'Current Plan')}
              </span>
            </div>
            <p className="admin-metric-value">{billing?.plan}</p>
            <p className="admin-metric-subtitle">${billing?.amount}/month</p>
          </div>

          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">
                {t('admin.billing.nextBilling', 'Next Billing')}
              </span>
            </div>
            <p className="admin-metric-value">{billing?.nextBilling}</p>
          </div>

          <div className="admin-metric">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="admin-metric-label">{t('admin.billing.seats', 'Seats Used')}</span>
            </div>
            <p className="admin-metric-value">
              {billing?.users} / {billing?.maxUsers}
            </p>
            <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
              <div
                className="bg-[var(--admin-accent)] rounded-full h-1.5"
                style={{ width: `${((billing?.users || 0) / (billing?.maxUsers || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Usage & Invoices - Clean minimal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Usage */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-500 dark:text-slate-400" />
            {t('admin.billing.usage', 'Current Usage')}
          </h3>
          {usageLoadError ? (
            <DegradedState title="Usage unavailable" description={usageLoadError} />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">AI Tokens</span>
                  <span className="text-slate-300">
                    {formatUsagePair(usageData?.tokens?.used, usageData?.tokens?.limit)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-slate-400 rounded-full h-1.5 transition-all duration-500"
                    style={{
                      width: usagePercent(usageData?.tokens?.used, usageData?.tokens?.limit),
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Storage</span>
                  <span className="text-slate-300">
                    {typeof usageData?.storage?.used_gb === 'number' &&
                    typeof usageData?.storage?.limit_gb === 'number'
                      ? `${usageData.storage.used_gb} GB / ${usageData.storage.limit_gb} GB`
                      : '--'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-slate-50 dark:bg-navy-800/300 rounded-full h-1.5 transition-all duration-500"
                    style={{
                      width: usagePercent(
                        usageData?.storage?.used_gb,
                        usageData?.storage?.limit_gb
                      ),
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign size={14} className="text-slate-500 dark:text-slate-400" />
            {t('admin.billing.invoices', 'Recent Invoices')}
          </h3>
          <div className="space-y-2">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-slate-500 dark:text-slate-400 animate-spin" />
              </div>
            ) : invoicesLoadError ? (
              <DegradedState title="Invoices unavailable" description={invoicesLoadError} />
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400 text-sm">
                {t('admin.billing.noInvoices', 'No invoices found')}
              </div>
            ) : (
              invoices.map((invoice: Invoice, i: number) => (
                <div
                  key={invoice.id || i}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm text-navy-900 dark:text-white">
                      {invoice.currency === 'USD' ? '$' : ''}
                      {((invoice.amount_paid || invoice.amountPaid || 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(
                        invoice.created_at || invoice.createdAt || Date.now()
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <EntityStatusChip status={invoice.status} />
                    {invoice.downloadUrl && (
                      <a
                        href={invoice.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-white transition-colors"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Billing Information Section (Moved from Ownership) */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-navy-900 dark:text-white flex items-center gap-2">
            <FileText size={20} className="text-slate-400 dark:text-slate-500" />
            {t('admin.billing.contactInfo', 'Billing Information')}
          </h3>
          <button
            onClick={() => setShowBillingModal(true)}
            className="text-sm text-[var(--admin-accent)] hover:underline"
          >
            {t('common.edit', 'Edit')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <Mail className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                Billing Email
              </p>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {ownership?.billingEmail || currentUser?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                Billing Name
              </p>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {ownership?.billingName || `${currentUser?.firstName} ${currentUser?.lastName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                Tax ID / VAT
              </p>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {ownership?.taxId || t('admin.billing.notSet', 'Not set')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                Billing Address
              </p>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {ownership?.billingAddress
                  ? `${ownership.billingAddress.city}, ${ownership.billingAddress.country}`
                  : t('admin.billing.notSet', 'Not set')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method - Moved/Updated */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} className="text-slate-400 dark:text-slate-500" />
          {t('admin.billing.paymentMethod', 'Payment Method')}
        </h3>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-navy-700 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="font-medium text-navy-900 dark:text-white">•••• •••• •••• 4242</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Expires 12/2026</p>
            </div>
          </div>
          <button className="admin-btn admin-btn-subtle">
            {t('admin.billing.manage', 'Manage')}
          </button>
        </div>
      </div>

      {/* Plan Comparison Modal */}
      <AnimatePresence>
        {showPlanModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <Crown size={20} className="text-[var(--admin-accent)]" />
                  {t('admin.billing.changePlan', 'Change Subscription Plan')}
                </h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-slate-500 dark:text-slate-400 animate-spin" />
                  </div>
                ) : plansLoadError ? (
                  <DegradedState title="Plans unavailable" description={plansLoadError} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availablePlans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => handlePlanSelect(plan.id)}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedPlanId === plan.id
                            ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/5'
                            : billing?.plan === plan.name
                              ? 'border-slate-400 bg-slate-50 dark:bg-white/5'
                              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        {billing?.plan === plan.name && (
                          <span className="absolute top-3 right-3 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                        <h4 className="font-semibold text-navy-900 dark:text-white">{plan.name}</h4>
                        <p className="text-2xl font-bold text-navy-900 dark:text-white mt-2">
                          ${plan.price_monthly}
                          <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                            /mo
                          </span>
                        </p>
                        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <p className="flex items-center gap-2">
                            <Zap size={14} className="text-slate-400 dark:text-slate-500" />
                            {(plan.token_limit / 1000).toFixed(0)}K tokens/month
                          </p>
                          <p className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                            {plan.storage_limit_gb} GB storage
                          </p>
                        </div>
                        {selectedPlanId === plan.id && (
                          <div className="absolute top-3 left-3">
                            <Check size={20} className="text-[var(--admin-accent)]" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Comparison Summary */}
                {planComparison && selectedPlanId && selectedPlanId !== billing?.plan && (
                  <div className="mt-6 p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-navy-700 rounded-xl">
                    <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-3">
                      {planComparison.comparison.isUpgrade
                        ? 'Upgrade Summary'
                        : 'Downgrade Summary'}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Price difference</p>
                        <p
                          className={`font-medium ${
                            planComparison.comparison.priceDifference > 0
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {planComparison.comparison.priceDifference > 0 ? '+' : ''}$
                          {planComparison.comparison.priceDifference}/mo
                        </p>
                      </div>
                      {planComparison.comparison.isUpgrade ? (
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">
                            Prorated charge today
                          </p>
                          <p className="font-medium text-navy-900 dark:text-white">
                            ${planComparison.comparison.proratedAmount.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Credit to account</p>
                          <p className="font-medium text-emerald-500">
                            ${planComparison.comparison.creditAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-slate-500 dark:text-slate-400">
                          {planComparison.comparison.isUpgrade
                            ? 'Changes take effect immediately'
                            : `Changes take effect at end of billing period (${planComparison.comparison.daysRemaining} days)`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="admin-btn admin-btn-subtle"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePlan}
                  disabled={changingPlan || !selectedPlanId || selectedPlanId === billing?.plan}
                  className="admin-btn admin-btn-accent flex items-center gap-2"
                >
                  {changingPlan && <RefreshCw size={14} className="animate-spin" />}
                  {planComparison?.comparison.isUpgrade ? 'Upgrade Now' : 'Confirm Change'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add-ons Modal */}
      <AnimatePresence>
        {showAddonsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <Package size={20} className="text-[var(--admin-accent)]" />
                  {t('admin.billing.purchaseAddons', 'Purchase Add-ons')}
                </h3>
                <button
                  onClick={() => {
                    setShowAddonsModal(false);
                    setSelectedAddon(null);
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {!selectedAddon ? (
                  <div className="space-y-3">
                    {addonsLoadError && (
                      <DegradedState title="Add-ons unavailable" description={addonsLoadError} />
                    )}
                    {!addonsLoadError &&
                      addons.map((addon) => (
                        <div
                          key={addon.id}
                          onClick={() => setSelectedAddon(addon)}
                          className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-[var(--admin-accent)] cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                addon.type === 'tokens'
                                  ? 'bg-primary-100 dark:bg-primary-900/30'
                                  : addon.type === 'storage'
                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : 'bg-green-100 dark:bg-green-900/30'
                              }`}
                            >
                              {addon.type === 'tokens' ? (
                                <Zap size={18} className="text-primary-600 dark:text-primary-400" />
                              ) : addon.type === 'storage' ? (
                                <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                              ) : (
                                <Users size={18} className="text-green-600 dark:text-green-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-navy-900 dark:text-white">
                                {addon.name}
                              </h4>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {addon.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-navy-900 dark:text-white">
                              ${addon.price}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {addon.recurring ? '/month' : 'one-time'}
                            </p>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-slate-400 dark:text-slate-500 group-hover:text-[var(--admin-accent)] transition-colors"
                          />
                        </div>
                      ))}
                    {!addonsLoadError && addons.length === 0 && (
                      <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No add-ons available
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button
                      onClick={() => setSelectedAddon(null)}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      ← Back to add-ons
                    </button>

                    <div className="p-4 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-navy-700">
                      <h4 className="font-semibold text-navy-900 dark:text-white">
                        {selectedAddon.name}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {selectedAddon.description}
                      </p>

                      <div className="mt-4 flex items-center gap-4">
                        <label className="text-sm text-slate-500 dark:text-slate-400">
                          Quantity:
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAddonQuantity(Math.max(1, addonQuantity - 1))}
                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white hover:border-white/30"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-medium text-white">
                            {addonQuantity}
                          </span>
                          <button
                            onClick={() => setAddonQuantity(Math.min(10, addonQuantity + 1))}
                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white hover:border-white/30"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Total:</span>
                        <span className="text-xl font-bold text-navy-900 dark:text-white">
                          ${(selectedAddon.price * addonQuantity).toFixed(2)}
                          {selectedAddon.recurring && (
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                              /month
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {selectedAddon.type === 'tokens' && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                        <AlertCircle size={16} className="text-amber-500 mt-0.5" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Token packages are added to your monthly limit immediately and do not roll
                          over.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  onClick={() => {
                    setShowAddonsModal(false);
                    setSelectedAddon(null);
                  }}
                  className="admin-btn admin-btn-subtle"
                >
                  Cancel
                </button>
                {selectedAddon && (
                  <button
                    onClick={handlePurchaseAddon}
                    disabled={purchasingAddon}
                    className="admin-btn admin-btn-accent flex items-center gap-2"
                  >
                    {purchasingAddon && <RefreshCw size={14} className="animate-spin" />}
                    Purchase ${(selectedAddon.price * addonQuantity).toFixed(2)}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Billing Info Modal (Moved from Ownership) */}
      <AnimatePresence>
        {showBillingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <FileText size={20} className="text-[var(--admin-accent)]" />
                  {t('admin.billing.editTitle', 'Edit Billing Information')}
                </h3>
                <button
                  onClick={() => setShowBillingModal(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                {billingActionError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm"
                  >
                    {billingActionError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                      Billing Name
                    </label>
                    <input
                      type="text"
                      value={billingForm.billingName || ''}
                      onChange={(e) =>
                        setBillingForm({ ...billingForm, billingName: e.target.value })
                      }
                      className="admin-input w-full"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                      Billing Email
                    </label>
                    <input
                      type="email"
                      value={billingForm.billingEmail || ''}
                      onChange={(e) =>
                        setBillingForm({ ...billingForm, billingEmail: e.target.value })
                      }
                      className="admin-input w-full"
                      placeholder="billing@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={billingForm.taxId || ''}
                      onChange={(e) => setBillingForm({ ...billingForm, taxId: e.target.value })}
                      className="admin-input w-full"
                      placeholder="VAT ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                      VAT Number
                    </label>
                    <input
                      type="text"
                      value={billingForm.vatNumber || ''}
                      onChange={(e) =>
                        setBillingForm({ ...billingForm, vatNumber: e.target.value })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
                  <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-4">
                    Billing Address
                  </h4>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Address Line 1"
                      value={billingForm.billingAddress?.line1 || ''}
                      onChange={(e) =>
                        setBillingForm({
                          ...billingForm,
                          billingAddress: {
                            ...billingForm.billingAddress,
                            line1: e.target.value,
                          } as BillingAddress,
                        })
                      }
                      className="admin-input w-full"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="City"
                        value={billingForm.billingAddress?.city || ''}
                        onChange={(e) =>
                          setBillingForm({
                            ...billingForm,
                            billingAddress: {
                              ...billingForm.billingAddress,
                              city: e.target.value,
                            } as BillingAddress,
                          })
                        }
                        className="admin-input w-full"
                      />
                      <input
                        type="text"
                        placeholder="Postal Code"
                        value={billingForm.billingAddress?.postalCode || ''}
                        onChange={(e) =>
                          setBillingForm({
                            ...billingForm,
                            billingAddress: {
                              ...billingForm.billingAddress,
                              postalCode: e.target.value,
                            } as BillingAddress,
                          })
                        }
                        className="admin-input w-full"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Country"
                      value={billingForm.billingAddress?.country || ''}
                      onChange={(e) =>
                        setBillingForm({
                          ...billingForm,
                          billingAddress: {
                            ...billingForm.billingAddress,
                            country: e.target.value,
                          } as BillingAddress,
                        })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  onClick={() => setShowBillingModal(false)}
                  className="admin-btn admin-btn-subtle"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBillingInfo}
                  disabled={saving}
                  className="admin-btn admin-btn-accent flex items-center gap-2"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBillingManagement;
