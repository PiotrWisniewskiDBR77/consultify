/**
 * SpendingAlertsView - Spending Alerts Configuration
 *
 * Features:
 * - Configure spending thresholds
 * - Set alert recipients
 * - Auto-pause options
 * - View alert history
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  DollarSign,
  Edit,
  HardDrive,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { SpendingAlert } from '../../types';

// Alert types
const ALERT_TYPES = [
  {
    id: 'AI_TOKENS',
    label: 'AI Tokens',
    icon: Zap,
    description: 'Alert when token usage reaches threshold',
  },
  {
    id: 'STORAGE',
    label: 'Storage',
    icon: HardDrive,
    description: 'Alert when storage usage reaches threshold',
  },
  {
    id: 'USERS',
    label: 'User Seats',
    icon: Users,
    description: 'Alert when seat usage reaches threshold',
  },
  {
    id: 'TOTAL_SPEND',
    label: 'Total Spend',
    icon: DollarSign,
    description: 'Alert when monthly spend reaches threshold',
  },
];

interface SpendingAlertsViewProps {
  className?: string;
}

export const SpendingAlertsView: React.FC<SpendingAlertsViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SpendingAlert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SpendingAlert | null>(null);
  const [saving, setSaving] = useState(false);
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoadError, setUsageLoadError] = useState<string | null>(null);
  const [alertsLoadError, setAlertsLoadError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    type: 'TOTAL_SPEND' as SpendingAlert['type'],
    threshold: 80,
    thresholdType: 'PERCENTAGE' as SpendingAlert['thresholdType'],
    action: 'NOTIFY' as SpendingAlert['action'],
    notifyEmails: [currentUser?.email || ''],
    isActive: true,
  });

  // Load alerts and usage data on mount
  useEffect(() => {
    loadAlerts();
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      setUsageLoadError(null);
      const usage = await Api.getUsage();
      setUsageData(usage.structuredUsage || null);
    } catch (error) {
      console.error('Failed to load usage data:', error);
      setUsageData(null);
      setUsageLoadError(error instanceof Error ? error.message : 'Failed to load usage data');
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      setAlertsLoadError(null);
      const res = await fetch(`/api/billing/spending-alerts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAlerts(data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setAlerts([]);
      setAlertsLoadError(error instanceof Error ? error.message : 'Failed to load spending alerts');
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingAlert(null);
    setFormData({
      type: 'TOTAL_SPEND',
      threshold: 80,
      thresholdType: 'PERCENTAGE',
      action: 'NOTIFY',
      notifyEmails: [currentUser?.email || ''],
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const openEditModal = (alert: SpendingAlert) => {
    setEditingAlert(alert);
    setFormData({
      type: alert.type,
      threshold: alert.threshold,
      thresholdType: alert.thresholdType,
      action: alert.action,
      notifyEmails: alert.notifyEmails,
      isActive: alert.isActive,
    });
    setShowCreateModal(true);
  };

  const handleSaveAlert = async () => {
    if (formData.notifyEmails.filter((e) => e.trim()).length === 0) {
      toast.error('Please add at least one notification email');
      return;
    }

    setSaving(true);
    try {
      const url = editingAlert
        ? `/api/billing/spending-alerts/${editingAlert.id}`
        : `/api/billing/spending-alerts`;

      const res = await fetch(url, {
        method: editingAlert ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...formData,
          notifyEmails: formData.notifyEmails.filter((e) => e.trim()),
        }),
      });

      if (res.ok) {
        toast.success(editingAlert ? 'Alert updated' : 'Alert created');
        setShowCreateModal(false);
        loadAlerts();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to save alert:', error);
      toast.error('Failed to save alert');
    }
    setSaving(false);
  };

  const handleToggleActive = async (alertId: string) => {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return;

    try {
      const res = await fetch(`/api/billing/spending-alerts/${alertId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isActive: !a.isActive } : a))
        );
        toast.success(alert.isActive ? 'Alert paused' : 'Alert activated');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to toggle alert:', error);
      toast.error('Failed to toggle alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const res = await fetch(`/api/billing/spending-alerts/${alertId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        toast.success('Alert deleted');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const addEmailField = () => {
    setFormData((prev) => ({
      ...prev,
      notifyEmails: [...prev.notifyEmails, ''],
    }));
  };

  const removeEmailField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      notifyEmails: prev.notifyEmails.filter((_, i) => i !== index),
    }));
  };

  const updateEmail = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      notifyEmails: prev.notifyEmails.map((e, i) => (i === index ? value : e)),
    }));
  };

  const getAlertTypeInfo = (type: SpendingAlert['type']) => {
    return ALERT_TYPES.find((t) => t.id === type) || ALERT_TYPES[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-spending-alerts" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
            <Bell size={24} />
            {t('admin.billing.alerts', 'Spending Alerts')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t('admin.billing.alertsDesc', 'Get notified when spending reaches thresholds')}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={!!alertsLoadError}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
        >
          <Plus size={18} />
          Create Alert
        </button>
      </div>

      {/* Current Usage Overview */}
      {usageLoadError ? (
        <DegradedState title="Usage data unavailable" description={usageLoadError} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {ALERT_TYPES.map((type) => {
            const Icon = type.icon;
            const hasAlert = alerts.some((a) => a.type === type.id && a.isActive);

            // Calculate real usage percentage from usageData
            let usagePercent = 0;
            if (usageData) {
              if (type.id === 'AI_TOKENS') {
                const used = usageData.tokens?.used || 0;
                const limit = usageData.tokens?.limit || 1;
                usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;
              } else if (type.id === 'STORAGE') {
                const used = usageData.storage?.used_gb || 0;
                const limit = usageData.storage?.limit_gb || 1;
                usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;
              } else if (type.id === 'USERS') {
                const used = usageData.seats?.used || 0;
                const limit = usageData.seats?.total || 1;
                usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;
              } else if (type.id === 'TOTAL_SPEND') {
                const spent = usageData.spend?.current_period || 0;
                const budget = usageData.spend?.budget || 1;
                usagePercent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
              }
            }

            return (
              <div
                key={type.id}
                className="p-4 bg-c-surface rounded-xl border border-c-border-subtle"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-c-text-muted" />
                    <span className="text-sm font-medium text-c-text-secondary">{type.label}</span>
                  </div>
                  {hasAlert && <Bell size={14} className="text-primary-500" />}
                </div>
                <div className="text-2xl font-bold text-c-text mb-2">
                  {usageData ? `${usagePercent}%` : '--'}
                </div>
                <div className="w-full bg-slate-200 dark:bg-navy-700 rounded-full h-2">
                  {usageData && (
                    <div
                      className={`h-2 rounded-full ${
                        usagePercent > 80
                          ? 'bg-danger-500'
                          : usagePercent > 60
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alerts List */}
      {alertsLoadError ? (
        <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
          <DegradedState title="Spending alerts unavailable" description={alertsLoadError} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center bg-c-surface rounded-xl border border-c-border-subtle">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-c-text">No Alerts Configured</h3>
          <p className="text-c-text-muted mt-1 mb-4">
            Create alerts to get notified about spending
          </p>
          <button
            onClick={openCreateModal}
            disabled={!!alertsLoadError}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
          >
            Create Alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const typeInfo = getAlertTypeInfo(alert.type);
            const Icon = typeInfo.icon;

            return (
              <div
                key={alert.id}
                className={`p-4 bg-c-surface rounded-xl border ${
                  alert.isActive ? 'border-c-border-subtle' : 'border-c-border-subtle opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        alert.isActive
                          ? 'bg-primary-100 dark:bg-primary-900/30'
                          : 'bg-c-surface-raised'
                      }`}
                    >
                      <Icon
                        className={alert.isActive ? 'text-primary-600' : 'text-c-text-muted'}
                        size={20}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-c-text">{typeInfo.label} Alert</h3>
                        {!alert.isActive && (
                          <span className="px-2 py-0.5 bg-c-surface-raised text-c-text-muted text-xs rounded-full">
                            Paused
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-c-text-muted mt-0.5">
                        Alert at {alert.threshold}
                        {alert.thresholdType === 'PERCENTAGE' ? '%' : ' USD'} •
                        {alert.action === 'NOTIFY' && ' Notify only'}
                        {alert.action === 'NOTIFY_AND_PAUSE' && ' Notify & Pause'}
                        {alert.action === 'HARD_LIMIT' && ' Hard limit'}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail size={12} className="text-c-text-muted" />
                        <span className="text-xs text-c-text-muted">
                          {alert.notifyEmails.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(alert.id)}
                      className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted"
                      title={alert.isActive ? 'Pause' : 'Activate'}
                    >
                      {alert.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => openEditModal(alert)}
                      className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="p-2 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg text-c-text-muted hover:text-danger-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-c-surface rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-c-border-subtle">
                <h3 className="text-lg font-semibold text-c-text">
                  {editingAlert ? 'Edit Alert' : 'Create Spending Alert'}
                </h3>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Alert Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                  >
                    {ALERT_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Threshold
                    </label>
                    <input
                      type="number"
                      value={formData.threshold}
                      onChange={(e) =>
                        setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Type
                    </label>
                    <select
                      value={formData.thresholdType}
                      onChange={(e) =>
                        setFormData({ ...formData, thresholdType: e.target.value as any })
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="ABSOLUTE">Absolute (USD)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Action
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                  >
                    <option value="NOTIFY">Notify Only</option>
                    <option value="NOTIFY_AND_PAUSE">Notify & Pause Usage</option>
                    <option value="HARD_LIMIT">Hard Limit (Block)</option>
                  </select>
                  {formData.action !== 'NOTIFY' && (
                    <p className="text-xs text-amber-600 mt-1">
                      <AlertTriangle size={12} className="inline mr-1" />
                      This will affect service availability when threshold is reached
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Notify Emails
                  </label>
                  {formData.notifyEmails.map((email, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(idx, e.target.value)}
                        placeholder="email@company.com"
                        className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                      />
                      {formData.notifyEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailField(idx)}
                          className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEmailField}
                    className="text-sm text-primary-600 hover:text-primary-500"
                  >
                    + Add another email
                  </button>
                </div>
              </div>
              <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-c-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAlert}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingAlert ? 'Save Changes' : 'Create Alert'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpendingAlertsView;
