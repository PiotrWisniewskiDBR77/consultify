/**
 * Organization Resource Manager - SuperAdmin
 * Manage individual organization resources, budgets, and quotas
 */

import './OrganizationResourceManager.css';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import ResourceLimitInput from '../../components/SuperAdmin/ResourceLimitInput';
import api from '../../services/api';

interface OrgResourceData {
  organization: {
    id: string;
    name: string;
    monthly_budget_usd: number | null;
    budget_spent_current_period: number;
    budget_alert_threshold: number;
    budget_period_start: string | null;
    memory_usage_mb_current: number;
    cpu_usage_percent_avg: number;
    token_balance: number;
    billing_status: string;
    subscription_plan_id: string;
    plan_name: string;
    memory_limit_mb: number;
    cpu_quota_percent: number;
    max_concurrent_ai_jobs: number;
    token_limit: number;
    storage_limit_gb: number;
  };
  budget: {
    monthlyBudget: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
    alertThreshold: number;
    exceeded: boolean;
    approachingLimit: boolean;
  };
  recentExpenses: Array<{
    id: string;
    amount: number;
    category: string;
    description: string;
    recordedAt: string;
  }>;
}

export const OrganizationResourceManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);

  const [budgetForm, setBudgetForm] = useState({
    monthlyBudgetUsd: 0,
    alertThreshold: 0.8,
  });

  const [quotaForm, setQuotaForm] = useState({
    memoryLimitMb: 512,
    cpuQuotaPercent: 20,
    tokenBalance: 0,
  });

  const [chargeForm, setChargeForm] = useState({
    changeType: 'memory_increase',
    oldValue: 0,
    newValue: 0,
    chargeAmount: 0,
    description: '',
  });

  const safeNumber = (value: unknown, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const safePercent = (current: unknown, limit: unknown) => {
    const currentValue = safeNumber(current);
    const limitValue = safeNumber(limit);
    if (limitValue <= 0) return 0;
    return Math.min((currentValue / limitValue) * 100, 100);
  };

  const formatMoney = (value: unknown) => `$${safeNumber(value).toFixed(2)}`;

  // Fetch organizations list
  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await api.get('/superadmin/organizations');
      const payload = response.data;
      return (Array.isArray(payload) ? payload : payload?.organizations || []) as Array<{
        id: string;
        name: string;
      }>;
    },
  });

  // Fetch org resources
  const { data: resourceData, isLoading } = useQuery({
    queryKey: ['orgResources', selectedOrgId],
    queryFn: async () => {
      const response = await api.get(`/api/superadmin/organizations/${selectedOrgId}/resources`);
      return response.data as OrgResourceData;
    },
    enabled: !!selectedOrgId,
  });

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async (data: typeof budgetForm) => {
      return api.put(`/api/superadmin/organizations/${selectedOrgId}/budget`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgResources', selectedOrgId] });
      setShowBudgetModal(false);
      toast.success('Budget updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update budget');
    },
  });

  // Update quotas mutation
  const updateQuotasMutation = useMutation({
    mutationFn: async (data: typeof quotaForm) => {
      return api.put(`/api/superadmin/organizations/${selectedOrgId}/quotas`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgResources', selectedOrgId] });
      setShowQuotaModal(false);
      toast.success('Quotas updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update quotas');
    },
  });

  // Charge for change mutation
  const chargeChangeMutation = useMutation({
    mutationFn: async (data: typeof chargeForm) => {
      return api.post(
        `/api/superadmin/organizations/${selectedOrgId}/charge-resource-change`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgResources', selectedOrgId] });
      setShowChargeModal(false);
      toast.success('Resource charge recorded');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to record resource charge');
    },
  });

  const handleUpdateBudget = () => {
    if (resourceData) {
      setBudgetForm({
        monthlyBudgetUsd: resourceData.organization.monthly_budget_usd || 0,
        alertThreshold: resourceData.organization.budget_alert_threshold || 0.8,
      });
      setShowBudgetModal(true);
    }
  };

  const handleUpdateQuotas = () => {
    if (resourceData) {
      setQuotaForm({
        memoryLimitMb: resourceData.organization.memory_limit_mb || 512,
        cpuQuotaPercent: resourceData.organization.cpu_quota_percent || 20,
        tokenBalance: resourceData.organization.token_balance || 0,
      });
      setShowQuotaModal(true);
    }
  };

  return (
    <div className="org-resource-manager">
      <div className="header">
        <h1>Organization Resource Management</h1>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="org-selector"
        >
          <option value="">Select Organization...</option>
          {organizations?.map((org: any) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedOrgId && (
        <div className="empty-state">
          <p>Please select an organization to manage its resources</p>
        </div>
      )}

      {selectedOrgId && isLoading && <div className="loading">Loading resource data...</div>}

      {selectedOrgId && resourceData && (
        <div className="resource-content">
          {/* Resource Usage Dashboard */}
          <div className="dashboard-grid">
            <div className="resource-card">
              <h3>Memory Usage</h3>
              <div className="gauge">
                <div className="gauge-label">
                  <span className="current">
                    {resourceData.organization.memory_usage_mb_current} MB
                  </span>
                  <span className="limit">/ {resourceData.organization.memory_limit_mb} MB</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${safePercent(
                        resourceData.organization.memory_usage_mb_current,
                        resourceData.organization.memory_limit_mb
                      )}%`,
                    }}
                  />
                </div>
                <span className="percentage">
                  {safePercent(
                    resourceData.organization.memory_usage_mb_current,
                    resourceData.organization.memory_limit_mb
                  ).toFixed(1)}
                  % used
                </span>
              </div>
            </div>

            <div className="resource-card">
              <h3>CPU Usage</h3>
              <div className="gauge">
                <div className="gauge-label">
                  <span className="current">
                    {safeNumber(resourceData.organization.cpu_usage_percent_avg).toFixed(1)}%
                  </span>
                  <span className="limit">/ {resourceData.organization.cpu_quota_percent}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${safePercent(
                        resourceData.organization.cpu_usage_percent_avg,
                        resourceData.organization.cpu_quota_percent
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="resource-card">
              <h3>Token Balance</h3>
              <div className="token-display">
                <span className="token-value">
                  {safeNumber(resourceData.organization.token_balance).toLocaleString()}
                </span>
                <span className="token-limit">
                  Limit: {safeNumber(resourceData.organization.token_limit).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="resource-card">
              <h3>Storage</h3>
              <div className="storage-display">
                <span className="storage-value">
                  {resourceData.organization.storage_limit_gb} GB
                </span>
                <span className="storage-label">Allocated</span>
              </div>
            </div>
          </div>

          {/* Budget Section */}
          <div className="section budget-section">
            <div className="section-header">
              <h2>Budget Management</h2>
              <button className="btn-primary" onClick={handleUpdateBudget}>
                Update Budget
              </button>
            </div>

            {resourceData.budget && (
              <div className="budget-overview">
                <div className="budget-stats">
                  <div className="stat">
                    <label>Monthly Budget</label>
                    <span className="value">{formatMoney(resourceData.budget.monthlyBudget)}</span>
                  </div>
                  <div className="stat">
                    <label>Spent</label>
                    <span className="value spent">{formatMoney(resourceData.budget.spent)}</span>
                  </div>
                  <div className="stat">
                    <label>Remaining</label>
                    <span className="value remaining">
                      {formatMoney(resourceData.budget.remaining)}
                    </span>
                  </div>
                </div>

                <div className="budget-progress">
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${resourceData.budget.exceeded ? 'exceeded' : resourceData.budget.approachingLimit ? 'warning' : ''}`}
                      style={{
                        width: `${Math.min(safeNumber(resourceData.budget.percentageUsed), 100)}%`,
                      }}
                    />
                  </div>
                  <span className="percentage">
                    {safeNumber(resourceData.budget.percentageUsed).toFixed(1)}% used
                  </span>
                </div>
              </div>
            )}

            <div className="expenses-table">
              <h3>Recent Expenses</h3>
              <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */
              >
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceData.recentExpenses?.map((expense: any) => (
                    <tr key={expense.id}>
                      <td>{new Date(expense.recordedAt).toLocaleDateString()}</td>
                      <td>
                        <span className="category-badge">{expense.category}</span>
                      </td>
                      <td>{expense.description}</td>
                      <td className="amount">{formatMoney(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quota Management */}
          <div className="section">
            <div className="section-header">
              <h2>Quota Overrides</h2>
              <div className="action-buttons">
                <button className="btn-primary" onClick={handleUpdateQuotas}>
                  Update Quotas
                </button>
                <button className="btn-secondary" onClick={() => setShowChargeModal(true)}>
                  Charge for Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Budget</h2>
              <button className="close-btn" onClick={() => setShowBudgetModal(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateBudgetMutation.mutate(budgetForm);
              }}
            >
              <div className="form-group">
                <label>Monthly Budget (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={budgetForm.monthlyBudgetUsd}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, monthlyBudgetUsd: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Alert Threshold (0-1)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={budgetForm.alertThreshold}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, alertThreshold: parseFloat(e.target.value) })
                  }
                />
                <small>
                  Alert when {(budgetForm.alertThreshold * 100).toFixed(0)}% of budget is used
                </small>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowBudgetModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quota Modal */}
      {showQuotaModal && (
        <div className="modal-overlay" onClick={() => setShowQuotaModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Resource Quotas</h2>
              <button className="close-btn" onClick={() => setShowQuotaModal(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateQuotasMutation.mutate(quotaForm);
              }}
            >
              <ResourceLimitInput
                label="Memory Limit"
                value={quotaForm.memoryLimitMb}
                onChange={(val) => setQuotaForm({ ...quotaForm, memoryLimitMb: val })}
                min={128}
                max={16384}
                step={128}
                unit="MB"
              />
              <ResourceLimitInput
                label="CPU Quota"
                value={quotaForm.cpuQuotaPercent}
                onChange={(val) => setQuotaForm({ ...quotaForm, cpuQuotaPercent: val })}
                min={0}
                max={100}
                step={5}
                unit="%"
              />
              <ResourceLimitInput
                label="Token Balance"
                value={quotaForm.tokenBalance}
                onChange={(val) => setQuotaForm({ ...quotaForm, tokenBalance: val })}
                min={0}
                max={1000000}
                step={1000}
                unit="tokens"
                type="number"
              />
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowQuotaModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Quotas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Charge Modal */}
      {showChargeModal && (
        <div className="modal-overlay" onClick={() => setShowChargeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Charge for Resource Change</h2>
              <button className="close-btn" onClick={() => setShowChargeModal(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                chargeChangeMutation.mutate(chargeForm);
              }}
            >
              <div className="form-group">
                <label>Change Type</label>
                <select
                  value={chargeForm.changeType}
                  onChange={(e) => setChargeForm({ ...chargeForm, changeType: e.target.value })}
                >
                  <option value="memory_increase">Memory Increase</option>
                  <option value="cpu_increase">CPU Increase</option>
                  <option value="storage_increase">Storage Increase</option>
                  <option value="tokens_purchase">Token Purchase</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Old Value</label>
                  <input
                    type="number"
                    value={chargeForm.oldValue}
                    onChange={(e) =>
                      setChargeForm({ ...chargeForm, oldValue: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>New Value</label>
                  <input
                    type="number"
                    value={chargeForm.newValue}
                    onChange={(e) =>
                      setChargeForm({ ...chargeForm, newValue: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Charge Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={chargeForm.chargeAmount}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, chargeAmount: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowChargeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Charge ${chargeForm.chargeAmount.toFixed(2)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationResourceManager;
