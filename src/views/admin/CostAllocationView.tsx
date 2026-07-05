/**
 * CostAllocationView - Enterprise cost center tracking and allocation
 * Allows organizations to track AI usage costs by department/team/project
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  DollarSign,
  Download,
  Edit2,
  PieChart,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAppStore } from '../../store/useAppStore';

interface CostCenter {
  id: string;
  name: string;
  code: string;
  budget_monthly: number;
  current_spend: number;
  percentage_used: number;
  is_active: boolean;
  owner_email?: string;
  type: 'department' | 'team' | 'project' | 'custom';
}

interface CostAllocation {
  id: string;
  cost_center_id: string;
  cost_center_name: string;
  amount: number;
  resource_type: string;
  date: string;
}

interface CostAllocationViewProps {
  className?: string;
}

const COLORS = [
  '#64748b',
  '#94a3b8',
  '#475569',
  '#334155',
  '#1e293b',
  '#0f172a',
  '#3b82f6',
  '#10b981',
];

export const CostAllocationView: React.FC<CostAllocationViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [allocations, setAllocations] = useState<CostAllocation[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    budget_monthly: 0,
    type: 'department' as CostCenter['type'],
    owner_email: '',
  });

  useEffect(() => {
    loadCostCenters();
  }, [currentOrganization?.id]);

  const loadCostCenters = async () => {
    setLoading(true);

    // For now, simulate data since this is an enterprise feature
    // In production, this would call /api/billing/cost-centers
    setTimeout(() => {
      setCostCenters([
        {
          id: 'cc-1',
          name: 'Engineering',
          code: 'ENG-001',
          budget_monthly: 500,
          current_spend: 287.5,
          percentage_used: 57.5,
          is_active: true,
          owner_email: 'eng-lead@company.com',
          type: 'department',
        },
        {
          id: 'cc-2',
          name: 'Product',
          code: 'PROD-001',
          budget_monthly: 300,
          current_spend: 198.25,
          percentage_used: 66.08,
          is_active: true,
          owner_email: 'product-lead@company.com',
          type: 'department',
        },
        {
          id: 'cc-3',
          name: 'Marketing',
          code: 'MKT-001',
          budget_monthly: 200,
          current_spend: 45.0,
          percentage_used: 22.5,
          is_active: true,
          owner_email: 'marketing@company.com',
          type: 'department',
        },
        {
          id: 'cc-4',
          name: 'DBR77 Project',
          code: 'PRJ-DBR77',
          budget_monthly: 1000,
          current_spend: 456.75,
          percentage_used: 45.68,
          is_active: true,
          type: 'project',
        },
      ]);

      setAllocations([
        {
          id: 'a-1',
          cost_center_id: 'cc-1',
          cost_center_name: 'Engineering',
          amount: 150.0,
          resource_type: 'AI Tokens',
          date: '2026-01-02',
        },
        {
          id: 'a-2',
          cost_center_id: 'cc-2',
          cost_center_name: 'Product',
          amount: 98.25,
          resource_type: 'AI Tokens',
          date: '2026-01-02',
        },
        {
          id: 'a-3',
          cost_center_id: 'cc-1',
          cost_center_name: 'Engineering',
          amount: 137.5,
          resource_type: 'AI Tokens',
          date: '2026-01-01',
        },
        {
          id: 'a-4',
          cost_center_id: 'cc-4',
          cost_center_name: 'DBR77 Project',
          amount: 256.75,
          resource_type: 'AI Tokens',
          date: '2026-01-01',
        },
        {
          id: 'a-5',
          cost_center_id: 'cc-3',
          cost_center_name: 'Marketing',
          amount: 45.0,
          resource_type: 'AI Tokens',
          date: '2026-01-01',
        },
        {
          id: 'a-6',
          cost_center_id: 'cc-4',
          cost_center_name: 'DBR77 Project',
          amount: 200.0,
          resource_type: 'AI Tokens',
          date: '2025-12-31',
        },
      ]);

      setLoading(false);
    }, 500);
  };

  const totalBudget = useMemo(
    () => costCenters.reduce((sum, cc) => sum + cc.budget_monthly, 0),
    [costCenters]
  );

  const totalSpend = useMemo(
    () => costCenters.reduce((sum, cc) => sum + cc.current_spend, 0),
    [costCenters]
  );

  const pieData = useMemo(
    () =>
      costCenters.map((cc, index) => ({
        name: cc.name,
        value: cc.current_spend,
        color: COLORS[index % COLORS.length],
      })),
    [costCenters]
  );

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required');
      return;
    }

    setSaving(true);

    // Simulate API call
    setTimeout(() => {
      if (editingCenter) {
        setCostCenters((prev) =>
          prev.map((cc) =>
            cc.id === editingCenter.id
              ? {
                  ...cc,
                  ...formData,
                  percentage_used: (cc.current_spend / formData.budget_monthly) * 100,
                }
              : cc
          )
        );
        toast.success('Cost center updated');
      } else {
        const newCenter: CostCenter = {
          id: `cc-${Date.now()}`,
          ...formData,
          current_spend: 0,
          percentage_used: 0,
          is_active: true,
        };
        setCostCenters((prev) => [...prev, newCenter]);
        toast.success('Cost center created');
      }

      setShowAddModal(false);
      setEditingCenter(null);
      setFormData({ name: '', code: '', budget_monthly: 0, type: 'department', owner_email: '' });
      setSaving(false);
    }, 500);
  };

  const handleDelete = (centerId: string) => {
    if (confirm('Are you sure you want to delete this cost center?')) {
      setCostCenters((prev) => prev.filter((cc) => cc.id !== centerId));
      toast.success('Cost center deleted');
    }
  };

  const handleEdit = (center: CostCenter) => {
    setFormData({
      name: center.name,
      code: center.code,
      budget_monthly: center.budget_monthly,
      type: center.type,
      owner_email: center.owner_email || '',
    });
    setEditingCenter(center);
    setShowAddModal(true);
  };

  const handleExport = () => {
    const csv = [
      ['Cost Center', 'Code', 'Type', 'Budget', 'Spent', 'Percentage', 'Owner'].join(','),
      ...costCenters.map((cc) =>
        [
          cc.name,
          cc.code,
          cc.type,
          cc.budget_monthly,
          cc.current_spend.toFixed(2),
          cc.percentage_used.toFixed(1) + '%',
          cc.owner_email || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-centers-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  const getBudgetStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-danger-400';
    if (percentage >= 75) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-danger-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-c-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Building2 size={18} className="text-c-text-muted" />
            {t('admin.billing.costAllocation', 'Cost Allocation')}
          </h2>
          <p className="text-sm text-c-text-muted mt-0.5">
            Track and allocate AI costs across departments, teams, and projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="admin-btn admin-btn-subtle flex items-center gap-2"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={() => {
              setEditingCenter(null);
              setShowAddModal(true);
            }}
            className="admin-btn admin-btn-accent flex items-center gap-2"
          >
            <Plus size={14} />
            Add Cost Center
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-c-text-muted" />
            <span className="text-xs text-c-text-muted uppercase tracking-wider">
              Total Budget
            </span>
          </div>
          <p className="text-2xl font-semibold text-c-text">${totalBudget.toFixed(2)}</p>
          <p className="text-xs text-c-text-muted">per month</p>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-c-text-muted" />
            <span className="text-xs text-c-text-muted uppercase tracking-wider">
              Current Spend
            </span>
          </div>
          <p className="text-2xl font-semibold text-c-text">${totalSpend.toFixed(2)}</p>
          <p className="text-xs text-c-text-muted">
            {((totalSpend / totalBudget) * 100).toFixed(1)}% of budget
          </p>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={14} className="text-c-text-muted" />
            <span className="text-xs text-c-text-muted uppercase tracking-wider">
              Cost Centers
            </span>
          </div>
          <p className="text-2xl font-semibold text-c-text">{costCenters.length}</p>
          <p className="text-xs text-c-text-muted">
            {costCenters.filter((cc) => cc.is_active).length} active
          </p>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-c-text-muted" />
            <span className="text-xs text-c-text-muted uppercase tracking-wider">
              Over Budget
            </span>
          </div>
          <p className="text-2xl font-semibold text-c-text">
            {costCenters.filter((cc) => cc.percentage_used >= 90).length}
          </p>
          <p className="text-xs text-c-text-muted">cost centers</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
            <PieChart size={14} className="text-c-text-muted" />
            Spend Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }: any) =>
                    `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: any) =>
                    [`$${Number(value).toFixed(2)}`, 'Spend'] as [string, string]
                  }
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-c-text-muted" />
            Budget vs Spend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costCenters}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="budget_monthly" fill="#334155" name="Budget" />
                <Bar dataKey="current_spend" fill="#64748b" name="Spend" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cost Centers Table */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
          <Building2 size={14} className="text-c-text-muted" />
          Cost Centers
        </h3>
        <div className="overflow-x-auto">
          <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Code
                </th>
                <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Type
                </th>
                <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Budget
                </th>
                <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Spent
                </th>
                <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4 w-40">
                  Usage
                </th>
                <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {costCenters.map((center) => (
                <tr key={center.id} className="border-b border-white/[0.03] hover:bg-c-surface/[0.02]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {center.type === 'department' && (
                        <Users size={14} className="text-c-text-muted" />
                      )}
                      {center.type === 'project' && (
                        <Briefcase size={14} className="text-c-text-muted" />
                      )}
                      <span className="text-sm text-c-text">{center.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-c-text-muted font-mono">
                      {center.code}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-slate-200 dark:bg-slate-700 text-c-text-secondary px-2 py-0.5 rounded capitalize">
                      {center.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-c-text">${center.budget_monthly.toFixed(2)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-c-text">${center.current_spend.toFixed(2)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5">
                        <div
                          className={`${getProgressBarColor(center.percentage_used)} rounded-full h-1.5 transition-all`}
                          style={{ width: `${Math.min(center.percentage_used, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs ${getBudgetStatusColor(center.percentage_used)}`}>
                        {center.percentage_used.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(center)}
                        className="p-1.5 text-c-text-muted hover:text-white transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(center.id)}
                        className="p-1.5 text-c-text-muted hover:text-danger-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Allocations */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
          <DollarSign size={14} className="text-c-text-muted" />
          Recent Allocations
        </h3>
        <div className="space-y-2">
          {allocations.slice(0, 5).map((allocation) => (
            <div
              key={allocation.id}
              className="flex items-center justify-between p-3 bg-c-surface/[0.02] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-c-surface-raised flex items-center justify-center">
                  <DollarSign size={14} className="text-c-text-muted" />
                </div>
                <div>
                  <p className="text-sm text-c-text">{allocation.cost_center_name}</p>
                  <p className="text-xs text-c-text-muted">
                    {allocation.resource_type} • {allocation.date}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-c-text">
                ${allocation.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="admin-card w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  {editingCenter ? 'Edit Cost Center' : 'Add Cost Center'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCenter(null);
                  }}
                  className="text-c-text-muted hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="admin-input w-full"
                    placeholder="e.g. Engineering"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      Code
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="admin-input w-full"
                      placeholder="ENG-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as CostCenter['type'] })
                      }
                      className="admin-input w-full"
                    >
                      <option value="department">Department</option>
                      <option value="team">Team</option>
                      <option value="project">Project</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Monthly Budget ($)
                  </label>
                  <input
                    type="number"
                    value={formData.budget_monthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budget_monthly: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="admin-input w-full"
                    placeholder="500"
                    min="0"
                    step="10"
                  />
                </div>

                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Owner Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                    className="admin-input w-full"
                    placeholder="owner@company.com"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-white/[0.05] flex justify-end gap-3 bg-c-surface/[0.02]">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCenter(null);
                  }}
                  className="admin-btn admin-btn-subtle"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="admin-btn admin-btn-accent flex items-center gap-2"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  {editingCenter ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CostAllocationView;
