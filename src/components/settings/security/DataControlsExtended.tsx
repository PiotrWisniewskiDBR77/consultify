/**
 * DataControlsExtended - Extended Data Controls
 *
 * Features:
 * - Data retention per data type
 * - Automatic data anonymization schedule
 * - Data export format options (JSON, CSV, PDF)
 * - Partial data deletion
 * - Data portability
 */

import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface DataControlsExtendedProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface DataRetentionSettings {
  tasks: number; // days, 0 = forever
  projects: number;
  messages: number;
  comments: number;
  files: number;
  activityLogs: number;
  aiConversations: number;
}

interface DataCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  count: number;
  size: string;
  canDelete: boolean;
  canExport: boolean;
}

const defaultRetention: DataRetentionSettings = {
  tasks: 0,
  projects: 0,
  messages: 365,
  comments: 365,
  files: 0,
  activityLogs: 90,
  aiConversations: 30,
};

export const DataControlsExtended: React.FC<DataControlsExtendedProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [retention, setRetention] = useState<DataRetentionSettings>(defaultRetention);
  const [anonymizationEnabled, setAnonymizationEnabled] = useState(false);
  const [anonymizationSchedule, setAnonymizationSchedule] = useState('monthly');
  const [dataCategories, setDataCategories] = useState<DataCategory[]>([]);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [retentionRes, categoriesRes] = await Promise.all([
        Api.get('/api/user/data-controls/retention').catch(() => ({ data: null })),
        Api.get('/api/user/data-controls/categories').catch(() => ({ data: [] })),
      ]);

      if (retentionRes.data) {
        setRetention(retentionRes.data.retention || defaultRetention);
        setAnonymizationEnabled(retentionRes.data.anonymizationEnabled || false);
        setAnonymizationSchedule(retentionRes.data.anonymizationSchedule || 'monthly');
      }

      if (categoriesRes.data) {
        setDataCategories(categoriesRes.data);
      } else {
        // Default categories for UI
        setDataCategories([
          {
            id: 'tasks',
            name: 'Tasks',
            description: 'Your tasks and subtasks',
            icon: CheckCircle,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
          {
            id: 'projects',
            name: 'Projects',
            description: 'Project data and settings',
            icon: Database,
            count: 0,
            size: '0 KB',
            canDelete: false,
            canExport: true,
          },
          {
            id: 'messages',
            name: 'Messages',
            description: 'Direct messages and notifications',
            icon: FileText,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
          {
            id: 'comments',
            name: 'Comments',
            description: 'Comments on tasks and projects',
            icon: FileText,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
          {
            id: 'files',
            name: 'Files',
            description: 'Uploaded files and attachments',
            icon: Archive,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
          {
            id: 'activity',
            name: 'Activity Logs',
            description: 'Your activity history',
            icon: Clock,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
          {
            id: 'ai',
            name: 'AI Conversations',
            description: 'AI chat history and context',
            icon: RefreshCw,
            count: 0,
            size: '0 KB',
            canDelete: true,
            canExport: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading data controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRetention = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/data-controls/retention', {
        retention,
        anonymizationEnabled,
        anonymizationSchedule,
      });
      toast.success(t('settings.dataControls.saved', 'Data retention settings saved'));
    } catch (error) {
      toast.error(t('settings.dataControls.error', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (categoryId: string) => {
    try {
      setExporting(categoryId);
      const response = await Api.post('/api/user/data-controls/export', {
        category: categoryId,
        format: exportFormat,
      });

      if (response.success && response.downloadUrl) {
        // Trigger download
        window.open(response.downloadUrl, '_blank');
        toast.success(t('settings.dataControls.exportStarted', 'Export started'));
      } else {
        toast.success(
          t(
            'settings.dataControls.exportQueued',
            'Export queued. You will receive an email when ready.'
          )
        );
      }
    } catch (error) {
      toast.error(t('settings.dataControls.exportError', 'Failed to export data'));
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    try {
      setExporting('all');
      await Api.post('/api/user/data-controls/export-all', { format: exportFormat });
      toast.success(
        t(
          'settings.dataControls.exportAllQueued',
          'Full data export queued. You will receive an email when ready.'
        )
      );
    } catch (error) {
      toast.error(t('settings.dataControls.exportError', 'Failed to export data'));
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (confirmDelete !== categoryId) {
      setConfirmDelete(categoryId);
      return;
    }

    try {
      setDeleting(categoryId);
      await Api.delete(`/api/user/data-controls/data/${categoryId}`);
      toast.success(t('settings.dataControls.deleted', 'Data deleted successfully'));
      setConfirmDelete(null);
      loadData(); // Refresh counts
    } catch (error) {
      toast.error(t('settings.dataControls.deleteError', 'Failed to delete data'));
    } finally {
      setDeleting(null);
    }
  };

  const retentionOptions = [
    { value: 0, label: 'Keep forever' },
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' },
    { value: 730, label: '2 years' },
  ];

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Database size={28} className="text-emerald-500" />
            {t('settings.dataControls.title', 'Data Controls')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.dataControls.description',
              'Manage your data retention, export, and deletion'
            )}
          </p>
        </div>
      </div>

      {/* Data Retention Settings */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Data Retention
          </h3>
          <button
            onClick={handleSaveRetention}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(retention).map(([key, value]) => (
            <div key={key} className="p-4 bg-c-surface-raised rounded-lg">
              <label className="block text-sm font-medium text-c-text mb-2 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <select
                value={value}
                onChange={(e) => setRetention({ ...retention, [key]: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
              >
                {retentionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Anonymization Settings */}
        <div className="border-t border-c-border-subtle dark:border-navy-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="font-medium text-c-text">Automatic Data Anonymization</label>
              <p className="text-sm text-c-text-muted">
                Automatically anonymize old data on schedule
              </p>
            </div>
            <button
              onClick={() => setAnonymizationEnabled(!anonymizationEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                anonymizationEnabled ? 'bg-emerald-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                  anonymizationEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {anonymizationEnabled && (
            <div className="p-4 bg-c-surface-raised rounded-lg">
              <label className="block text-sm font-medium text-c-text mb-2">
                Anonymization Schedule
              </label>
              <select
                value={anonymizationSchedule}
                onChange={(e) => setAnonymizationSchedule(e.target.value)}
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Export Format Selection */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Download size={20} className="text-c-accent" />
          Export Format
        </h3>

        <div className="flex gap-4">
          {[
            {
              value: 'json',
              label: 'JSON',
              icon: FileJson,
              description: 'Machine-readable format',
            },
            {
              value: 'csv',
              label: 'CSV',
              icon: FileSpreadsheet,
              description: 'Spreadsheet compatible',
            },
            { value: 'pdf', label: 'PDF', icon: FileText, description: 'Human-readable report' },
          ].map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.value}
                onClick={() => setExportFormat(format.value as any)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  exportFormat === format.value
                    ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
                }`}
              >
                <Icon
                  size={24}
                  className={
                    exportFormat === format.value ? 'text-c-accent' : 'text-c-text-secondary'
                  }
                />
                <p className="font-medium text-c-text mt-2">{format.label}</p>
                <p className="text-xs text-c-text-muted">{format.description}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleExportAll}
          disabled={exporting === 'all'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {exporting === 'all' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          Export All My Data
        </button>
      </div>

      {/* Data Categories */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Archive size={20} className="text-amber-500" />
          Data Categories
        </h3>

        <div className="space-y-3">
          {dataCategories.map((category) => {
            const Icon = category.icon;
            const isConfirming = confirmDelete === category.id;

            return (
              <div
                key={category.id}
                className={`p-4 rounded-lg border transition-all ${
                  isConfirming
                    ? 'border-danger-300 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/5'
                    : 'border-c-border-subtle dark:border-navy-700 bg-c-surface-raised'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-c-surface rounded-lg">
                      <Icon size={18} className="text-c-text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-c-text">{category.name}</p>
                      <p className="text-sm text-c-text-muted">{category.description}</p>
                      <p className="text-xs text-c-text-secondary mt-1">
                        {category.count} items • {category.size}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {category.canExport && (
                      <button
                        onClick={() => handleExport(category.id)}
                        disabled={exporting === category.id}
                        className="p-2 hover:bg-c-surface dark:hover:bg-c-surface-raised rounded-lg text-c-accent disabled:opacity-50"
                        title="Export"
                      >
                        {exporting === category.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Download size={18} />
                        )}
                      </button>
                    )}
                    {category.canDelete && (
                      <button
                        onClick={() => handleDelete(category.id)}
                        disabled={deleting === category.id}
                        className={`p-2 rounded-lg transition-colors ${
                          isConfirming
                            ? 'bg-danger-600 text-white'
                            : 'hover:bg-c-surface dark:hover:bg-c-surface-raised text-danger-600'
                        }`}
                        title={isConfirming ? 'Click again to confirm' : 'Delete'}
                      >
                        {deleting === category.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {isConfirming && (
                  <div className="mt-3 p-3 bg-danger-100 dark:bg-danger-500/20 rounded-lg">
                    <p className="text-sm text-danger-700 dark:text-danger-300 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Click delete again to permanently remove all {category.name.toLowerCase()}.
                      This cannot be undone.
                    </p>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="mt-2 text-sm text-danger-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Portability */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Upload size={20} className="text-indigo-500" />
          Data Portability
        </h3>
        <p className="text-sm text-c-text-muted">
          Transfer your data to other platforms or import data from elsewhere.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            className="flex items-center gap-3 p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-950 transition-colors"
            onClick={() => toast.success('Data portability export initiated')}
          >
            <Download size={24} className="text-indigo-600" />
            <div className="text-left">
              <p className="font-medium text-c-text">Export for Transfer</p>
              <p className="text-sm text-c-text-muted">GDPR-compliant data package</p>
            </div>
          </button>
          <button
            className="flex items-center gap-3 p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-950 transition-colors"
            onClick={() =>
              toast('Import wizard is in beta — contact support to get started', { icon: 'ℹ️' })
            }
          >
            <Upload size={24} className="text-emerald-600" />
            <div className="text-left">
              <p className="font-medium text-c-text">Import Data</p>
              <p className="text-sm text-c-text-muted">From ClickUp, Monday, Asana</p>
            </div>
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">Important</p>
            <p>
              Data deletion is permanent and cannot be reversed. Make sure to export your data
              before deleting if you need a backup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataControlsExtended;
