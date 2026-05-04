/**
 * DataManagementView - Data Management & GDPR Compliance
 *
 * Features:
 * - Export organization data
 * - Data retention settings
 * - Delete account/organization
 * - GDPR compliance tools
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Clock,
  Database,
  Download,
  FileText,
  FolderOpen,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';

interface DataCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  recordCount: number;
  lastExport?: string;
}

interface DataManagementViewProps {
  className?: string;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null);

  // Data categories
  const [dataCategories, setDataCategories] = useState<DataCategory[]>([
    {
      id: 'users',
      name: 'Users & Team',
      description: 'User accounts, profiles, and team structure',
      icon: <Users size={20} />,
      recordCount: 0,
    },
    {
      id: 'projects',
      name: 'Projects',
      description: 'All projects and associated data',
      icon: <FolderOpen size={20} />,
      recordCount: 0,
    },
    {
      id: 'tasks',
      name: 'Tasks & Activities',
      description: 'Tasks, comments, and activity logs',
      icon: <FileText size={20} />,
      recordCount: 0,
    },
    {
      id: 'decisions',
      name: 'Decisions',
      description: 'Decisions and voting records',
      icon: <Shield size={20} />,
      recordCount: 0,
    },
    {
      id: 'documents',
      name: 'Documents',
      description: 'Uploaded files and documents',
      icon: <Archive size={20} />,
      recordCount: 0,
    },
    {
      id: 'audit',
      name: 'Audit Logs',
      description: 'Activity and security logs',
      icon: <Clock size={20} />,
      recordCount: 0,
    },
  ]);

  // Retention settings
  const [retentionPeriod, setRetentionPeriod] = useState('forever');
  const [autoDeleteInactive, setAutoDeleteInactive] = useState(false);
  const [inactivePeriod, setInactivePeriod] = useState('365');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setStatsLoadError(null);
      const res = await fetch('/api/organization-data/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !data.stats) {
        throw new Error('Organization data statistics are unavailable');
      }
      setDataCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          recordCount: data.stats[cat.id] ?? 0,
        }))
      );
    } catch (error) {
      console.error('Failed to load data stats:', error);
      setStatsLoadError(error instanceof Error ? error.message : 'Failed to load data statistics');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id, loadData]);

  const handleExportCategory = async (categoryId: string) => {
    setExporting(categoryId);
    try {
      const res = await fetch(`/api/organization-data/export/${categoryId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentOrganization?.name || 'org'}-${categoryId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(`${categoryId} data exported`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Export failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    }
    setExporting(null);
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const res = await fetch('/api/organization-data/export/all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentOrganization?.name || 'organization'}-full-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Full data export complete');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Export failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    }
    setExportingAll(false);
  };

  const handleSaveRetention = async () => {
    try {
      const res = await fetch('/api/organization-data/retention', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          auditLogRetentionDays: retentionPeriod === 'forever' ? 0 : parseInt(retentionPeriod),
          autoDeleteEnabled: autoDeleteInactive,
          activityRetentionDays: autoDeleteInactive ? parseInt(inactivePeriod) : 365,
        }),
      });

      if (res.ok) {
        toast.success('Retention settings saved');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    }
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirmation !== currentOrganization?.name) {
      toast.error('Please type the organization name correctly');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${currentOrganization?.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      toast.success('Organization deletion initiated');
      // Redirect or logout
    } catch (error) {
      toast.error('Failed to delete organization');
    }
    setDeleting(false);
  };

  const totalRecords = dataCategories.reduce((sum, cat) => sum + cat.recordCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-data-management" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={24} />
            {t('admin.security.dataManagement', 'Data Management')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'admin.security.dataManagementDesc',
              'Export data, manage retention, and compliance tools'
            )}
          </p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exportingAll || !!statsLoadError}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {exportingAll ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
          Export All Data
        </button>
      </div>

      {statsLoadError && (
        <DegradedState title="Data inventory unavailable" description={statsLoadError} />
      )}

      {/* GDPR Notice */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">GDPR Compliance</p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            You can export all your organization data at any time. Data exports include all user
            information, project data, and associated records in a machine-readable format
            (JSON/CSV).
          </p>
        </div>
      </div>

      {/* Data Summary */}
      {!statsLoadError && (
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900 dark:text-white">Data Summary</h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Total: <span className="font-semibold">{totalRecords.toLocaleString()}</span> records
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {dataCategories.map((category) => (
              <div key={category.id} className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-slate-600 dark:text-slate-400">
                  {category.icon}
                  <span className="text-xs font-medium">{category.name}</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {category.recordCount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export by Category */}
      {statsLoadError ? (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <DegradedState title="Data export unavailable" description={statsLoadError} />
        </div>
      ) : (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-4">Export by Category</h3>
          <div className="space-y-3">
            {dataCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                    {category.icon}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{category.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {category.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {category.recordCount.toLocaleString()} records
                  </span>
                  <button
                    onClick={() => handleExportCategory(category.id)}
                    disabled={exporting === category.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {exporting === category.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Retention */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock size={18} />
          Data Retention Policy
        </h3>
        <ReadOnlyState
          title="Retention policy editing is read-only"
          description="Current retention settings are not loaded from the backend yet, so the defaults below are not saved state."
          className="mb-4"
        />
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Audit Log Retention
            </label>
            <select
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
              disabled
              className="w-full max-w-xs px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="forever">Forever</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              How long to keep audit logs before automatic deletion
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
            <input
              type="checkbox"
              id="autoDelete"
              checked={autoDeleteInactive}
              onChange={(e) => setAutoDeleteInactive(e.target.checked)}
              disabled
              className="mt-0.5"
            />
            <div>
              <label
                htmlFor="autoDelete"
                className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                Auto-delete inactive user data
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Automatically remove data from users who haven't logged in
              </p>
              {autoDeleteInactive && (
                <select
                  value={inactivePeriod}
                  onChange={(e) => setInactivePeriod(e.target.value)}
                  disabled
                  className="mt-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                >
                  <option value="180">After 180 days</option>
                  <option value="365">After 1 year</option>
                  <option value="730">After 2 years</option>
                </select>
              )}
            </div>
          </div>

          <button
            onClick={handleSaveRetention}
            disabled
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium"
          >
            Save Retention Settings
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
        <h3 className="font-medium text-rose-800 dark:text-rose-200 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} />
          Danger Zone
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-navy-800 rounded-lg border border-rose-200 dark:border-rose-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Delete Organization</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Permanently delete this organization and all its data. This action cannot be
                  undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
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
              className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                <h3 className="text-lg font-semibold text-rose-600 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Delete Organization
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                  <p className="text-sm text-rose-800 dark:text-rose-200 font-medium">
                    This action is irreversible!
                  </p>
                  <ul className="mt-2 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                    <li>• All users will lose access</li>
                    <li>• All projects and data will be deleted</li>
                    <li>• Active subscriptions will be cancelled</li>
                    <li>• This cannot be recovered</li>
                  </ul>
                </div>

                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    To confirm, type{' '}
                    <span className="font-mono font-bold">{currentOrganization?.name}</span>:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type organization name..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteOrganization}
                  disabled={deleting || deleteConfirmation !== currentOrganization?.name}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {deleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Delete Organization
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataManagementView;
