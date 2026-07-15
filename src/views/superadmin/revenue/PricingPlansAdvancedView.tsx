import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/BaseCard';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';

interface PlanFeature {
  id: string;
  plan_id: string;
  feature_name: string;
  feature_value: string;
  is_enabled: number;
}

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  billing_period: string;
  max_users: number;
  max_projects: number;
  max_storage_gb: number;
  features_json: string;
  is_active: number;
  is_public: number;
  trial_days: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  features?: PlanFeature[];
}

export const PricingPlansAdvancedView: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    billing_period: 'monthly',
    max_users: 10,
    max_projects: 5,
    max_storage_gb: 10,
    features_json: '{}',
    is_active: true,
    is_public: true,
    trial_days: 14,
    sort_order: 0,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await Api.getPricingPlansAdvanced();
      setPlans(response || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await Api.updatePricingPlanAdvanced(editingPlan.id, formData);
      } else {
        await Api.createPricingPlanAdvanced(formData);
      }
      fetchPlans();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save pricing plan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing plan?')) return;
    try {
      await Api.deletePricingPlanAdvanced(id);
      fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to delete pricing plan');
    }
  };

  const handleCompare = async () => {
    if (selectedPlans.length < 2) {
      setError('Please select at least 2 plans to compare');
      return;
    }
    try {
      const response = await Api.comparePricingPlans(selectedPlans);
      setComparisonData(response);
      setShowCompare(true);
    } catch (err: any) {
      setError(err.message || 'Failed to compare plans');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      currency: 'USD',
      billing_period: 'monthly',
      max_users: 10,
      max_projects: 5,
      max_storage_gb: 10,
      features_json: '{}',
      is_active: true,
      is_public: true,
      trial_days: 14,
      sort_order: 0,
    });
  };

  const openEditModal = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      currency: plan.currency,
      billing_period: plan.billing_period,
      max_users: plan.max_users,
      max_projects: plan.max_projects,
      max_storage_gb: plan.max_storage_gb,
      features_json: plan.features_json || '{}',
      is_active: !!plan.is_active,
      is_public: !!plan.is_public,
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
    });
    setShowModal(true);
  };

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Advanced Pricing Plans
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage pricing tiers and feature allocations
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCompare}
            disabled={selectedPlans.length < 2}
            className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Compare Selected ({selectedPlans.length})
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + New Plan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/20 border border-danger-500 text-danger-300 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-danger-300 hover:text-danger-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Pricing Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${selectedPlans.includes(plan.id) ? 'ring-2 ring-indigo-500' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPlans.includes(plan.id)}
                    onChange={() => togglePlanSelection(plan.id)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {plan.is_active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-slate-200/60 dark:bg-navy-800/20 text-slate-700 dark:text-slate-300 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{plan.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="text-center py-4 bg-slate-50 dark:bg-navy-950/20 border border-slate-200 dark:border-navy-700 rounded-lg">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(plan.price_monthly, plan.currency)}
                  <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                    /mo
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  or {formatCurrency(plan.price_yearly, plan.currency)}/year
                </div>
                {plan.trial_days > 0 && (
                  <div className="text-xs text-indigo-400 mt-2">
                    {plan.trial_days}-day free trial
                  </div>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Users</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Projects</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {plan.max_projects === -1 ? 'Unlimited' : plan.max_projects}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Storage</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {plan.max_storage_gb === -1 ? 'Unlimited' : `${plan.max_storage_gb} GB`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-navy-700">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-900 rounded hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="px-3 py-2 text-sm bg-danger-600/20 text-danger-400 rounded hover:bg-danger-600/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-600 dark:text-slate-400 text-lg">
            No pricing plans configured
          </div>
          <p className="text-slate-500 dark:text-gray-400 mt-2">
            Create your first pricing plan to get started
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingPlan ? 'Edit Pricing Plan' : 'Create New Pricing Plan'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Price
                  </label>
                  <input
                    type="number"
                    value={formData.price_monthly}
                    onChange={(e) =>
                      setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Yearly Price
                  </label>
                  <input
                    type="number"
                    value={formData.price_yearly}
                    onChange={(e) =>
                      setFormData({ ...formData, price_yearly: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Trial Days
                  </label>
                  <input
                    type="number"
                    value={formData.trial_days}
                    onChange={(e) =>
                      setFormData({ ...formData, trial_days: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Users (-1 = unlimited)
                  </label>
                  <input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) =>
                      setFormData({ ...formData, max_users: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    min="-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Projects (-1 = unlimited)
                  </label>
                  <input
                    type="number"
                    value={formData.max_projects}
                    onChange={(e) =>
                      setFormData({ ...formData, max_projects: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    min="-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Storage GB (-1 = unlimited)
                  </label>
                  <input
                    type="number"
                    value={formData.max_storage_gb}
                    onChange={(e) =>
                      setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    min="-1"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 dark:border-gray-600"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 dark:border-gray-600"
                  />
                  Public
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showCompare && comparisonData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Plan Comparison</h3>
              <button
                onClick={() => setShowCompare(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto">
              <table /* §27-exempt: macierz porównawcza plan×feature (wiersze=stałe cechy, kolumny=wybrane plany, pivot nie lista encji) — kanon §2 def.1 nie spełniona, formularz/matryca w modalu Compare */ className="w-full"
              >
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400">
                      Feature
                    </th>
                    {comparisonData.plans?.map((plan: any) => (
                      <th
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Monthly Price</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {formatCurrency(plan.price_monthly, plan.currency)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Yearly Price</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {formatCurrency(plan.price_yearly, plan.currency)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Max Users</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Max Projects</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {plan.max_projects === -1 ? 'Unlimited' : plan.max_projects}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Storage</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {plan.max_storage_gb === -1 ? 'Unlimited' : `${plan.max_storage_gb} GB`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Trial Days</td>
                    {comparisonData.plans?.map((plan: any) => (
                      <td
                        key={plan.id}
                        className="text-center py-3 px-4 text-slate-900 dark:text-white"
                      >
                        {plan.trial_days > 0 ? `${plan.trial_days} days` : 'No trial'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowCompare(false)}
                className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
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

export default PricingPlansAdvancedView;
