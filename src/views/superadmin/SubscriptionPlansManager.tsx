/**
 * Subscription Plans Manager - SuperAdmin
 * Manage subscription plans with resource limits
 */

import './SubscriptionPlansManager.css';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../components/ui/use-toast';
import api from '../../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  token_limit: number;
  storage_limit_gb: number;
  memory_limit_mb: number;
  cpu_quota_percent: number;
  max_concurrent_ai_jobs: number;
  token_overage_rate: number;
  storage_overage_rate: number;
  stripe_price_id: string | null;
  is_active: number;
  created_at: string;
}

interface PlanFormData {
  name: string;
  priceMonthly: number;
  tokenLimit: number;
  storageLimitGb: number;
  memoryLimitMb: number;
  cpuQuotaPercent: number;
  maxConcurrentAiJobs: number;
  tokenOverageRate: number;
  storageOverageRate: number;
  stripePriceId: string;
}

export const SubscriptionPlansManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    priceMonthly: 0,
    tokenLimit: 100000,
    storageLimitGb: 10,
    memoryLimitMb: 512,
    cpuQuotaPercent: 20,
    maxConcurrentAiJobs: 2,
    tokenOverageRate: 0.01,
    storageOverageRate: 0.1,
    stripePriceId: '',
  });

  // Fetch plans
  const {
    data: plans,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const response = await api.get('/api/superadmin/subscription-plans');
      return response.data.plans as SubscriptionPlan[];
    },
  });

  // Filter plans by search term
  const filteredPlans =
    plans?.filter((plan: any) => plan.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      return api.post('/api/superadmin/subscription-plans', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] });
      setShowModal(false);
      resetForm();
      toast({ description: 'Plan created successfully!' });
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.error || 'Failed to create plan',
        variant: 'destructive',
      });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PlanFormData> & { isActive?: boolean };
    }) => {
      return api.put(`/api/superadmin/subscription-plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] });
      setShowModal(false);
      setEditingPlan(null);
      resetForm();
      toast({ description: 'Plan updated successfully!' });
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.error || 'Failed to update plan',
        variant: 'destructive',
      });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/superadmin/subscription-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] });
      toast({ description: 'Plan deleted successfully!' });
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.error || 'Failed to delete plan',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      priceMonthly: 0,
      tokenLimit: 100000,
      storageLimitGb: 10,
      memoryLimitMb: 512,
      cpuQuotaPercent: 20,
      maxConcurrentAiJobs: 2,
      tokenOverageRate: 0.01,
      storageOverageRate: 0.1,
      stripePriceId: '',
    });
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    resetForm();
    setShowModal(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      priceMonthly: plan.price_monthly,
      tokenLimit: plan.token_limit,
      storageLimitGb: plan.storage_limit_gb,
      memoryLimitMb: plan.memory_limit_mb || 512,
      cpuQuotaPercent: plan.cpu_quota_percent || 20,
      maxConcurrentAiJobs: plan.max_concurrent_ai_jobs || 2,
      tokenOverageRate: plan.token_overage_rate,
      storageOverageRate: plan.storage_overage_rate,
      stripePriceId: plan.stripe_price_id || '',
    });
    setShowModal(true);
  };

  const handleDeletePlan = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete plan "${name}"?`)) {
      deletePlanMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleToggleActive = (plan: SubscriptionPlan) => {
    updatePlanMutation.mutate({
      id: plan.id,
      data: { ...formData, isActive: plan.is_active === 1 ? false : true },
    });
  };

  if (isLoading) {
    return (
      <div className="subscription-plans-manager">
        <div className="header">
          <h1>Subscription Plans Management</h1>
        </div>
        <TableSkeleton rows={5} columns={9} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-plans-manager">
        <div className="header">
          <h1>Subscription Plans Management</h1>
        </div>
        <div className="error-state">
          <p>Failed to load subscription plans. Please try again.</p>
          <button
            className="btn-primary"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-plans-manager">
      <div className="header">
        <h1>Subscription Plans Management</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search plans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn-primary" onClick={handleCreatePlan}>
            + Create New Plan
          </button>
        </div>
      </div>

      <div className="plans-table-container">
        <table
          /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="plans-table"
        >
          <thead>
            <tr>
              <th>Plan Name</th>
              <th>Price/Month</th>
              <th>Memory</th>
              <th>CPU</th>
              <th>Tokens</th>
              <th>Storage</th>
              <th>AI Jobs</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan: any) => (
              <tr key={plan.id} className={plan.is_active === 0 ? 'inactive' : ''}>
                <td className="plan-name">{plan.name}</td>
                <td>${plan.price_monthly.toFixed(2)}</td>
                <td>{plan.memory_limit_mb || 0} MB</td>
                <td>{plan.cpu_quota_percent || 0}%</td>
                <td>{(plan.token_limit / 1000).toFixed(0)}K</td>
                <td>{plan.storage_limit_gb} GB</td>
                <td>{plan.max_concurrent_ai_jobs || 0}</td>
                <td>
                  <span className={`status-badge ${plan.is_active === 1 ? 'active' : 'inactive'}`}>
                    {plan.is_active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => handleEditPlan(plan)} title="Edit">
                    ✏️
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleToggleActive(plan)}
                    title={plan.is_active === 1 ? 'Deactivate' : 'Activate'}
                  >
                    {plan.is_active === 1 ? '🔴' : '🟢'}
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDeletePlan(plan.id, plan.name)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPlans.length === 0 && searchTerm && (
          <div className="empty-state">
            <p>No plans match your search.</p>
          </div>
        )}

        {plans?.length === 0 && (
          <div className="empty-state">
            <p>No subscription plans yet. Create your first plan!</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="plan-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Plan Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Professional"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Monthly Price (USD) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.priceMonthly}
                      onChange={(e) =>
                        setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) })
                      }
                      placeholder="29.99"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Resource Limits</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Memory Limit (MB) *</label>
                    <input
                      type="number"
                      value={formData.memoryLimitMb}
                      onChange={(e) =>
                        setFormData({ ...formData, memoryLimitMb: parseInt(e.target.value) })
                      }
                      min="128"
                      step="128"
                      required
                    />
                    <small>Recommended: 512, 2048, 8192</small>
                  </div>
                  <div className="form-group">
                    <label>CPU Quota (%) *</label>
                    <input
                      type="number"
                      value={formData.cpuQuotaPercent}
                      onChange={(e) =>
                        setFormData({ ...formData, cpuQuotaPercent: parseFloat(e.target.value) })
                      }
                      min="0"
                      max="100"
                      step="5"
                      required
                    />
                    <small>0-100%</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Token Limit *</label>
                    <input
                      type="number"
                      value={formData.tokenLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, tokenLimit: parseInt(e.target.value) })
                      }
                      min="1000"
                      step="1000"
                      required
                    />
                    <small>AI tokens per month</small>
                  </div>
                  <div className="form-group">
                    <label>Storage Limit (GB) *</label>
                    <input
                      type="number"
                      value={formData.storageLimitGb}
                      onChange={(e) =>
                        setFormData({ ...formData, storageLimitGb: parseFloat(e.target.value) })
                      }
                      min="0.1"
                      step="0.1"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Concurrent AI Jobs *</label>
                    <input
                      type="number"
                      value={formData.maxConcurrentAiJobs}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxConcurrentAiJobs: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Overage Rates</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Token Overage Rate ($/token)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.tokenOverageRate}
                      onChange={(e) =>
                        setFormData({ ...formData, tokenOverageRate: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Storage Overage Rate ($/GB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.storageOverageRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          storageOverageRate: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Stripe Integration</h3>
                <div className="form-group">
                  <label>Stripe Price ID</label>
                  <input
                    type="text"
                    value={formData.stripePriceId}
                    onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                    placeholder="price_xxxxxxxxxxxxx"
                  />
                  <small>Optional: Link to Stripe price for billing automation</small>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansManager;
