// @ts-nocheck
/**
 * BudgetTrackingView Component
 *
 * PMO Budget Management and Tracking
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Cost Management (Clause 4.4.4)
 * - PMI PMBOK 7th Edition - Cost Performance Domain
 * - PRINCE2 - Business Case / Cost Management
 *
 * PMO Domain: RESOURCE_RESPONSIBILITY, PERFORMANCE_MONITORING
 */

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface BudgetLineItem {
  id: string;
  category: string;
  subcategory?: string;
  description?: string;
  budgetType: 'CAPEX' | 'OPEX';
  plannedAmount: number;
  actualAmount: number;
  committedAmount: number;
  varianceAmount: number;
  forecastAmount?: number;
}

interface BudgetTransaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  vendor?: string;
  date: string;
  status: string;
  createdBy?: string;
}

interface BudgetTotals {
  totalPlanned: number;
  totalApproved: number;
  totalActual: number;
  totalCommitted: number;
  totalForecast: number;
  remaining: number;
  consumedPercent: number;
  varianceAmount: number;
  variancePercent: number;
  contingencyAmount: number;
  isOverBudget: boolean;
  status: 'ON_TRACK' | 'WARNING' | 'CRITICAL' | 'OVERRUN';
}

interface BudgetData {
  id: string;
  initiativeId: string;
  initiativeName: string;
  budgetType: string;
  plannedAmount: number;
  currency: string;
  lineItems: BudgetLineItem[];
  transactions: BudgetTransaction[];
  totals: BudgetTotals;
}

interface BurnRate {
  monthlyBurnRate: number;
  averageMonthly: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

interface Forecast {
  estimateToComplete: number;
  estimateAtCompletion: number;
  varianceAtCompletion: number;
  costPerformanceIndex: number;
  isProjectedOverrun: boolean;
  projectedOverrunPercent: number;
  recommendation: string;
}

interface BudgetTrackingViewProps {
  initiativeId?: string;
  initiativeName?: string;
}

const BUDGET_CATEGORIES = [
  { value: 'PERSONNEL', label: 'Personnel' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'OTHER', label: 'Other' },
];

export const BudgetTrackingView: React.FC<BudgetTrackingViewProps> = ({
  initiativeId,
  initiativeName,
}) => {
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRate | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showCreateBudgetModal, setShowCreateBudgetModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    vendor: '',
    category: 'OTHER',
    transactionDate: new Date().toISOString().split('T')[0],
  });
  const [newBudget, setNewBudget] = useState({
    plannedAmount: '',
    budgetType: 'COMBINED',
    contingencyPercent: '10',
  });

  const fetchBudget = useCallback(async () => {
    if (!initiativeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await Api.get(`/budget/initiative/${initiativeId}`);
      setBudget(response.budget);

      if (response.budget) {
        // Fetch burn rate and forecast
        const [burnRateRes, forecastRes] = await Promise.all([
          Api.get(`/budget/${response.budget.id}/burn-rate`).catch(() => ({ burnRate: null })),
          Api.get(`/budget/${response.budget.id}/forecast`).catch(() => ({ forecast: null })),
        ]);
        setBurnRate(burnRateRes.burnRate);
        setForecast(forecastRes.forecast);
      }
    } catch (error) {
      console.error('[BudgetTracking] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleCreateBudget = async () => {
    if (!initiativeId || !newBudget.plannedAmount) {
      toast.error('Please enter planned amount');
      return;
    }

    try {
      await Api.post(`/budget/initiative/${initiativeId}`, {
        plannedAmount: parseFloat(newBudget.plannedAmount),
        budgetType: newBudget.budgetType,
        contingencyPercent: parseFloat(newBudget.contingencyPercent),
      });
      toast.success('Budget created');
      setShowCreateBudgetModal(false);
      fetchBudget();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create budget');
    }
  };

  const handleAddExpense = async () => {
    if (!budget || !newExpense.amount) {
      toast.error('Please enter amount');
      return;
    }

    try {
      await Api.post(`/budget/${budget.id}/transactions`, {
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
        vendor: newExpense.vendor,
        transactionType: 'EXPENSE',
        transactionDate: newExpense.transactionDate,
      });
      toast.success('Expense recorded');
      setShowAddExpenseModal(false);
      setNewExpense({
        amount: '',
        description: '',
        vendor: '',
        category: 'OTHER',
        transactionDate: new Date().toISOString().split('T')[0],
      });
      fetchBudget();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add expense');
    }
  };

  const formatCurrency = (amount: number, currency = 'PLN') => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'text-green-600 dark:text-green-400';
      case 'WARNING':
        return 'text-amber-600 dark:text-amber-400';
      case 'CRITICAL':
        return 'text-orange-600 dark:text-orange-400';
      case 'OVERRUN':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'WARNING':
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 'CRITICAL':
        return 'bg-orange-100 dark:bg-orange-900/30';
      case 'OVERRUN':
        return 'bg-red-100 dark:bg-red-900/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800';
    }
  };

  // No initiative selected
  if (!initiativeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <DollarSign size={48} className="mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">Budget Tracking</h3>
        <p className="text-sm">Select an initiative to view budget</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // No budget configured
  if (!budget) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <DollarSign size={48} className="mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
          No Budget Configured
        </h3>
        <p className="text-sm mb-4">Set up budget tracking for this initiative</p>
        <button
          onClick={() => setShowCreateBudgetModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create Budget
        </button>

        {/* Create Budget Modal */}
        {showCreateBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md p-6 m-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">Create Budget</h3>
                <button
                  onClick={() => setShowCreateBudgetModal(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Planned Amount (PLN) *
                  </label>
                  <input
                    type="number"
                    value={newBudget.plannedAmount}
                    onChange={(e) => setNewBudget({ ...newBudget, plannedAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    placeholder="100000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Budget Type
                  </label>
                  <select
                    value={newBudget.budgetType}
                    onChange={(e) => setNewBudget({ ...newBudget, budgetType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                  >
                    <option value="COMBINED">Combined (CAPEX + OPEX)</option>
                    <option value="CAPEX">CAPEX Only</option>
                    <option value="OPEX">OPEX Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contingency (%)
                  </label>
                  <input
                    type="number"
                    value={newBudget.contingencyPercent}
                    onChange={(e) =>
                      setNewBudget({ ...newBudget, contingencyPercent: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowCreateBudgetModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBudget}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                >
                  Create Budget
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const totals = budget.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <DollarSign className="text-green-500" size={24} />
            Budget Tracking
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {initiativeName || budget.initiativeName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBudget}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Budget */}
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Total Budget
            </span>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Target size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">
            {formatCurrency(totals.totalPlanned, budget.currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            + {formatCurrency(totals.contingencyAmount)} contingency
          </p>
        </div>

        {/* Spent */}
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Spent
            </span>
            <div className={`p-2 rounded-lg ${getStatusBgColor(totals.status)}`}>
              <Receipt size={16} className={getStatusColor(totals.status)} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${getStatusColor(totals.status)}`}>
            {formatCurrency(totals.totalActual, budget.currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {totals.consumedPercent}% consumed
          </p>
        </div>

        {/* Remaining */}
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Remaining
            </span>
            <div
              className={`p-2 rounded-lg ${totals.remaining > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
            >
              <DollarSign
                size={16}
                className={totals.remaining > 0 ? 'text-green-600' : 'text-red-600'}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${totals.remaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {formatCurrency(totals.remaining, budget.currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {totals.isOverBudget ? 'Over budget!' : 'Available'}
          </p>
        </div>

        {/* Burn Rate */}
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Burn Rate
            </span>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              {burnRate?.trend === 'INCREASING' ? (
                <TrendingUp size={16} className="text-red-500" />
              ) : burnRate?.trend === 'DECREASING' ? (
                <TrendingDown size={16} className="text-green-500" />
              ) : (
                <BarChart3 size={16} className="text-blue-600" />
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">
            {formatCurrency(burnRate?.monthlyBurnRate || 0, budget.currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            per month ({burnRate?.trend?.toLowerCase() || 'n/a'})
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Budget Consumption
          </span>
          <span className={`text-sm font-bold ${getStatusColor(totals.status)}`}>
            {totals.consumedPercent}%
          </span>
        </div>
        <div className="h-4 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              totals.status === 'OVERRUN'
                ? 'bg-red-500'
                : totals.status === 'CRITICAL'
                  ? 'bg-orange-500'
                  : totals.status === 'WARNING'
                    ? 'bg-amber-500'
                    : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(totals.consumedPercent, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>0%</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              80% Warning
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              100% Budget
            </span>
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Forecast Section */}
      {forecast && (
        <div
          className={`rounded-xl p-4 border ${
            forecast.isProjectedOverrun
              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'
              : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-500/20'
          }`}
        >
          <div className="flex items-start gap-3">
            {forecast.isProjectedOverrun ? (
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4
                className={`font-medium ${forecast.isProjectedOverrun ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}
              >
                Forecast at Completion
              </h4>
              <div className="grid grid-cols-4 gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">EAC</p>
                  <p className="font-bold text-navy-900 dark:text-white">
                    {formatCurrency(forecast.estimateAtCompletion)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ETC</p>
                  <p className="font-bold text-navy-900 dark:text-white">
                    {formatCurrency(forecast.estimateToComplete)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Variance</p>
                  <p
                    className={`font-bold ${forecast.varianceAtCompletion > 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {forecast.varianceAtCompletion > 0 ? '+' : ''}
                    {formatCurrency(forecast.varianceAtCompletion)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">CPI</p>
                  <p
                    className={`font-bold ${forecast.costPerformanceIndex >= 1 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {forecast.costPerformanceIndex.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-sm mt-3 text-slate-600 dark:text-slate-400">
                {forecast.recommendation === 'REVIEW_SPENDING' &&
                  '⚠️ Review spending - cost performance below target'}
                {forecast.recommendation === 'MONITOR_CLOSELY' &&
                  '👀 Monitor closely - slight cost variance detected'}
                {forecast.recommendation === 'ON_TRACK' &&
                  '✅ Budget on track - continue current trajectory'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <h4 className="font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Receipt size={18} className="text-slate-400 dark:text-slate-500" />
            Recent Transactions
          </h4>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
          {budget.transactions.length === 0 ? (
            <div className="p-6 text-center text-slate-400 dark:text-slate-500">
              No transactions recorded yet
            </div>
          ) : (
            budget.transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-navy-900 dark:text-white">
                      {tx.description || 'Expense'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tx.vendor && `${tx.vendor} • `}
                      {new Date(tx.date).toLocaleDateString('pl-PL')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold text-sm ${tx.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {tx.type === 'EXPENSE' ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tx.createdBy}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy-900 dark:text-white">Record Expense</h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount (PLN) *
                </label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                  placeholder="Software license"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vendor
                </label>
                <input
                  type="text"
                  value={newExpense.vendor}
                  onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                  placeholder="Microsoft"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newExpense.transactionDate}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, transactionDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTrackingView;
