/**
 * Data Loss Prevention (DLP) View
 * Manages DLP policies and violations
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Eye,
  FileText,
  Filter,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { Api } from '../../../services/api';

interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  policyType: string;
  rules: any[];
  enforcementAction: string;
  isActive: boolean;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface DLPViolation {
  id: string;
  policyId: string;
  policyName: string;
  policyType: string;
  resourceType: string;
  resourceId: string;
  violationType: string;
  severity: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByEmail: string | null;
}

interface DLPStats {
  policies: {
    total: number;
    active: number;
  };
  violations: {
    total: number;
    unresolved: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

const POLICY_TYPES = [
  { value: 'data_classification', label: 'Data Classification' },
  { value: 'pii_detection', label: 'PII Detection' },
  { value: 'sensitive_data', label: 'Sensitive Data' },
  { value: 'financial_data', label: 'Financial Data' },
  { value: 'healthcare_data', label: 'Healthcare Data' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'credentials', label: 'Credentials' },
  { value: 'custom', label: 'Custom' },
];

const ENFORCEMENT_ACTIONS = [
  { value: 'warn', label: 'Warn' },
  { value: 'block', label: 'Block' },
  { value: 'encrypt', label: 'Encrypt' },
  { value: 'mask', label: 'Mask' },
  { value: 'log_only', label: 'Log Only' },
];

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const DLPView: React.FC = () => {
  const [policies, setPolicies] = useState<DLPPolicy[]>([]);
  const [violations, setViolations] = useState<DLPViolation[]>([]);
  const [stats, setStats] = useState<DLPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'policies' | 'violations'>('policies');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    policyType: 'pii_detection',
    enforcementAction: 'warn',
    rules: [] as any[],
  });
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    keywords: '',
    severity: 'MEDIUM',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [policiesData, violationsData, statsData] = await Promise.all([
        Api.getDLPPolicies(),
        Api.getDLPViolations({ isResolved: false }),
        Api.getDLPStats(),
      ]);

      setPolicies(policiesData);
      setViolations(violationsData);
      setStats(statsData as any);
    } catch (err: any) {
      setError(err.message || 'Failed to load DLP data');
      toast.error(err.message || 'Failed to load DLP data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    if (!newRule.name) return;
    setFormData({
      ...formData,
      rules: [
        ...formData.rules,
        {
          name: newRule.name,
          pattern: newRule.pattern || undefined,
          keywords: newRule.keywords
            ? newRule.keywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
            : undefined,
          severity: newRule.severity,
        },
      ],
    });
    setNewRule({ name: '', pattern: '', keywords: '', severity: 'MEDIUM' });
  };

  const handleRemoveRule = (index: number) => {
    setFormData({
      ...formData,
      rules: formData.rules.filter((_, i) => i !== index),
    });
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      await Api.createDLPPolicy({
        name: formData.name,
        description: formData.description,
        policyType: formData.policyType,
        enforcementAction: formData.enforcementAction,
        rules: formData.rules,
      });
      toast.success('DLP policy created successfully');
      await loadData();
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        policyType: 'pii_detection',
        enforcementAction: 'warn',
        rules: [],
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create DLP policy');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePolicy = async (policyId: string, isActive: boolean) => {
    try {
      await Api.toggleDLPPolicy(policyId, !isActive);
      toast.success(`Policy ${!isActive ? 'activated' : 'deactivated'} successfully`);
      setPolicies((prev) =>
        prev.map((p) => (p.id === policyId ? { ...p, isActive: !isActive } : p))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle policy');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await Api.deleteDLPPolicy(policyId);
      toast.success('Policy deleted successfully');
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete policy');
    }
  };

  const handleResolveViolation = async (violationId: string) => {
    try {
      await Api.resolveDLPViolation(violationId);
      toast.success('Violation resolved successfully');
      setViolations((prev) => prev.filter((v) => v.id !== violationId));
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve violation');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            LOW
          </span>
        );
    }
  };

  const getPolicyTypeLabel = (type: string) => {
    return POLICY_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getEnforcementLabel = (action: string) => {
    return ENFORCEMENT_ACTIONS.find((a) => a.value === action)?.label || action;
  };

  if (loading && policies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Policies</p>
              <p className="text-xl font-semibold">{stats?.policies.total || 0}</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Power className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active Policies</p>
              <p className="text-xl font-semibold">{stats?.policies.active || 0}</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Violations</p>
              <p className="text-xl font-semibold">{stats?.violations.total || 0}</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Unresolved</p>
              <p className="text-xl font-semibold">{stats?.violations.unresolved || 0}</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Critical</p>
              <p className="text-xl font-semibold">{stats?.violations.bySeverity.critical || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{typeof error === 'string' ? error : (error as any)?.message || 'An error occurred'}</span>
            <button onClick={() => setError(null)} className="ml-auto text-sm hover:text-red-300">
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('policies')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'policies'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Policies ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab('violations')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'violations'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Violations ({violations.length})
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeTab === 'policies' ? 'DLP Policies' : 'DLP Violations'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeTab === 'policies' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Policy
            </button>
          )}
        </div>
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <CardWithHeader title="Policies" subtitle={`${policies.length} policies`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Enforcement
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Rules
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No DLP policies found
                    </td>
                  </tr>
                ) : (
                  policies.map((policy) => (
                    <tr
                      key={policy.id}
                      className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{policy.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs">
                            {policy.description}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                          {getPolicyTypeLabel(policy.policyType)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            policy.enforcementAction === 'block'
                              ? 'bg-red-500/10 text-red-400'
                              : policy.enforcementAction === 'warn'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-slate-500/10 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {getEnforcementLabel(policy.enforcementAction)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{policy.rules?.length || 0} rules</td>
                      <td className="py-3 px-4">
                        {policy.isActive ? (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-400 dark:text-slate-500 rounded text-xs">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTogglePolicy(policy.id, policy.isActive)}
                            className={`p-2 rounded-lg transition-colors ${
                              policy.isActive
                                ? 'text-amber-400 hover:bg-amber-500/10'
                                : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={policy.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {policy.isActive ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePolicy(policy.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardWithHeader>
      )}

      {/* Violations Tab */}
      {activeTab === 'violations' && (
        <CardWithHeader title="Violations" subtitle={`${violations.length} unresolved violations`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Policy
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Resource
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Violation
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Severity
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Detected
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {violations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No unresolved violations
                    </td>
                  </tr>
                ) : (
                  violations.map((violation) => (
                    <tr
                      key={violation.id}
                      className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{violation.policyName}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {getPolicyTypeLabel(violation.policyType)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm">{violation.resourceType}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                            {violation.resourceId}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                          {violation.violationType}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getSeverityBadge(violation.severity)}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">
                        {new Date(violation.detectedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleResolveViolation(violation.id)}
                          className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Resolve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardWithHeader>
      )}

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <Card variant="elevated" className="w-full max-w-2xl p-6 m-4">
            <h3 className="text-lg font-semibold mb-4">Create DLP Policy</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Policy name"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                    Policy Type
                  </label>
                  <select
                    value={formData.policyType}
                    onChange={(e) => setFormData({ ...formData, policyType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  >
                    {POLICY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Policy description"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm h-20 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                  Enforcement Action
                </label>
                <select
                  value={formData.enforcementAction}
                  onChange={(e) => setFormData({ ...formData, enforcementAction: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                >
                  {ENFORCEMENT_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rules Section */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-medium mb-3">Detection Rules</h4>

                {/* Existing Rules */}
                {formData.rules.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.rules.map((rule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {rule.pattern && `Pattern: ${rule.pattern}`}
                            {rule.keywords && ` Keywords: ${rule.keywords.join(', ')}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveRule(index)}
                          className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Rule Form */}
                <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="e.g., Credit Card Numbers"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                        Severity
                      </label>
                      <select
                        value={newRule.severity}
                        onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                      >
                        {SEVERITY_LEVELS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                      Regex Pattern (optional)
                    </label>
                    <input
                      type="text"
                      value={newRule.pattern}
                      onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                      placeholder="e.g., \d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                      Keywords (comma-separated, optional)
                    </label>
                    <input
                      type="text"
                      value={newRule.keywords}
                      onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                      placeholder="e.g., ssn, social security, password"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddRule}
                    disabled={!newRule.name}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    name: '',
                    description: '',
                    policyType: 'pii_detection',
                    enforcementAction: 'warn',
                    rules: [],
                  });
                }}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.name}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Policy
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DLPView;
