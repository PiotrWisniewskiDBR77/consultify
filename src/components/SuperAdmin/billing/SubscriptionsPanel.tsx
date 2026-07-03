/**
 * SubscriptionsPanel - Subscription Management
 *
 * Features:
 * - Active subscriptions list
 * - Plan changes history
 * - Cancel/pause functionality
 */

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface Subscription {
  id: string;
  organization_id: string;
  organization_name?: string;
  plan_id: string;
  plan_name: string;
  price_monthly: number;
  price_yearly?: number;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  billing_cycle: 'monthly' | 'yearly';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: number;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  features: string[];
  is_active: number;
}

interface Organization {
  id: string;
  name: string;
}

export const SubscriptionsPanel: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [createForm, setCreateForm] = useState<{
    organizationId: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    trialDays: number;
  }>({
    organizationId: '',
    planId: '',
    billingCycle: 'monthly',
    trialDays: 0,
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsResult, plansResult, orgsResult] = await Promise.all([
        Api.get(`/billing/subscriptions${filterStatus !== 'all' ? `?status=${filterStatus}` : ''}`),
        Api.get('/billing/plans'),
        Api.getOrganizations(),
      ]);
      setSubscriptions(subsResult.subscriptions || []);
      setPlans(plansResult.plans || []);
      setOrganizations(orgsResult || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSubscription = async () => {
    if (!createForm.organizationId || !createForm.planId) {
      toast.error('Please select organization and plan');
      return;
    }

    setSaving(true);
    try {
      await Api.post('/billing/subscriptions', createForm);
      toast.success('Subscription created');
      setShowCreateModal(false);
      setCreateForm({ organizationId: '', planId: '', billingCycle: 'monthly', trialDays: 0 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, immediately: boolean) => {
    try {
      await Api.post(`/billing/subscriptions/${subscriptionId}/cancel`, { immediately });
      toast.success(
        immediately ? 'Subscription canceled' : 'Subscription will be canceled at period end'
      );
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription');
    }
  };

  const handleChangePlan = async (subscriptionId: string, newPlanId: string) => {
    try {
      await Api.put(`/billing/subscriptions/${subscriptionId}`, { planId: newPlanId });
      toast.success('Plan changed successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to change plan');
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: number) => {
    if (cancelAtPeriodEnd) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
          <Clock size={14} />
          Canceling
        </span>
      );
    }

    const configs: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
      active: {
        icon: <CheckCircle2 size={14} />,
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
      },
      trialing: { icon: <Zap size={14} />, bg: 'bg-primary-500/20', text: 'text-primary-400' },
      past_due: {
        icon: <AlertTriangle size={14} />,
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
      },
      canceled: { icon: <XCircle size={14} />, bg: 'bg-danger-500/20', text: 'text-danger-400' },
      unpaid: { icon: <AlertTriangle size={14} />, bg: 'bg-danger-500/20', text: 'text-danger-400' },
      paused: {
        icon: <Pause size={14} />,
        bg: 'bg-slate-500/20',
        text: 'text-slate-600 dark:text-slate-500',
      },
    };
    const config = configs[status] || configs.active;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sub.organization_name?.toLowerCase().includes(query) ||
      sub.plan_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="canceled">Canceled</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-white font-medium transition-colors"
          >
            <Plus size={18} />
            New Subscription
          </button>
        </div>
      </div>

      {/* Subscriptions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <CreditCard size={48} className="mb-4 opacity-50" />
          <p>No subscriptions found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSubscriptions.map((sub) => (
            <div key={sub.id} className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-crimson-700 flex items-center justify-center">
                    <CreditCard size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{sub.organization_name}</h3>
                      {getStatusBadge(sub.status, sub.cancel_at_period_end)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Zap size={14} className="text-primary-400" />
                        {sub.plan_name}
                      </span>
                      <span>{formatCurrency(sub.price_monthly)}/mo</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        ({sub.billing_cycle})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {sub.current_period_end && (
                      <p className="text-sm text-slate-600 dark:text-slate-500">
                        {sub.cancel_at_period_end ? 'Cancels' : 'Renews'}{' '}
                        {new Date(sub.current_period_end).toLocaleDateString()}
                      </p>
                    )}
                    {sub.trial_end && sub.status === 'trialing' && (
                      <p className="text-sm text-primary-400">
                        Trial ends {new Date(sub.trial_end).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSubscription(sub)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Manage"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-500" />
                    </button>
                    {sub.status === 'active' && !sub.cancel_at_period_end && (
                      <button
                        onClick={() => handleCancelSubscription(sub.id, false)}
                        className="p-2 hover:bg-danger-500/10 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-6">Create Subscription</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Organization
                </label>
                <select
                  value={createForm.organizationId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, organizationId: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Plan</label>
                <select
                  value={createForm.planId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, planId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                >
                  <option value="">Select plan</option>
                  {plans
                    .filter((p) => p.is_active)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - {formatCurrency(plan.price_monthly)}/mo
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Billing Cycle
                </label>
                <div className="flex gap-3">
                  {(['monthly', 'yearly'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setCreateForm((prev) => ({ ...prev, billingCycle: cycle }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                        createForm.billingCycle === cycle
                          ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                          : 'bg-slate-800 border-white/10 text-slate-600 dark:text-slate-500 hover:border-white/20'
                      }`}
                    >
                      {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Trial Period (days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={createForm.trialDays}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, trialDays: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubscription}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Subscription Modal */}
      {selectedSubscription && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Manage Subscription</h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-6">
              {selectedSubscription.organization_name}
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-500">Current Plan</p>
                  <p className="font-medium text-white">{selectedSubscription.plan_name}</p>
                </div>
                <p className="text-lg font-semibold text-primary-400">
                  {formatCurrency(selectedSubscription.price_monthly)}/mo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Change Plan</label>
                <select
                  defaultValue={selectedSubscription.plan_id}
                  onChange={(e) => {
                    if (e.target.value !== selectedSubscription.plan_id) {
                      handleChangePlan(selectedSubscription.id, e.target.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                >
                  {plans
                    .filter((p) => p.is_active)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - {formatCurrency(plan.price_monthly)}/mo
                      </option>
                    ))}
                </select>
              </div>

              {selectedSubscription.status === 'active' &&
                !selectedSubscription.cancel_at_period_end && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-600 mb-3">Cancel Subscription</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          handleCancelSubscription(selectedSubscription.id, false);
                          setSelectedSubscription(null);
                        }}
                        className="flex-1 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors"
                      >
                        Cancel at Period End
                      </button>
                      <button
                        onClick={() => {
                          handleCancelSubscription(selectedSubscription.id, true);
                          setSelectedSubscription(null);
                        }}
                        className="flex-1 px-4 py-2.5 bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded-lg transition-colors"
                      >
                        Cancel Immediately
                      </button>
                    </div>
                  </div>
                )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedSubscription(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPanel;
