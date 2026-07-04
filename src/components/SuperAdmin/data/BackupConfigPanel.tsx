/**
 * BackupConfigPanel - Backup Configuration Management
 *
 * Features:
 * - Backup schedule configuration
 * - Retention settings
 * - Backup history
 */

import {
  Building2,
  CheckCircle2,
  Clock,
  Database,
  History,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Settings,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { ReadOnlyState } from '../../Admin/AdminState';

interface BackupConfig {
  id?: string;
  organization_id: string;
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  include_attachments: boolean;
  include_audit_logs: boolean;
  last_backup_at?: string;
  last_backup_status?: string;
  last_backup_size?: number;
  next_backup_at?: string;
}

interface BackupHistoryItem {
  id: string;
  timestamp: string;
  status: string;
  size: number;
  type: string;
}

interface Organization {
  id: string;
  name: string;
}

const backupConfigWorkflowUnavailableReason =
  'Backup configuration is disabled here until this legacy data-export backup panel is reconciled with the audited SuperAdmin backup schedule workflow.';

export const BackupConfigPanel: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const saving = false;
  const triggering = false;
  const [, setHasChanges] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, [selectedOrgId]);

  const fetchConfig = useCallback(async () => {
    if (!selectedOrgId) return;

    setLoading(true);
    try {
      setConfig(null);
      setHistory([]);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch backup config:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchConfig();
    }
  }, [selectedOrgId, fetchConfig]);

  const handleSave = async () => {
    toast.error(backupConfigWorkflowUnavailableReason);
  };

  const handleTriggerBackup = async () => {
    toast.error(backupConfigWorkflowUnavailableReason);
  };

  const updateConfig = (field: keyof BackupConfig, value: any) => {
    if (!config) return;
    setConfig((prev) => (prev ? { ...prev, [field]: value } : null));
    setHasChanges(true);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  };

  const getNextBackupTime = () => {
    if (!config?.enabled) return 'Disabled';

    const nextBackup = new Date();

    switch (config.frequency) {
      case 'hourly':
        nextBackup.setHours(nextBackup.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        nextBackup.setDate(nextBackup.getDate() + 1);
        nextBackup.setHours(2, 0, 0, 0);
        break;
      case 'weekly':
        nextBackup.setDate(nextBackup.getDate() + (7 - nextBackup.getDay()));
        nextBackup.setHours(2, 0, 0, 0);
        break;
      case 'monthly':
        nextBackup.setMonth(nextBackup.getMonth() + 1, 1);
        nextBackup.setHours(2, 0, 0, 0);
        break;
    }

    return nextBackup.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none min-w-[200px]"
        >
          <option value="" disabled>
            Select Organization
          </option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handleTriggerBackup}
            disabled
            title={backupConfigWorkflowUnavailableReason}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {triggering ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Run Backup Now
          </button>
          <button
            onClick={handleSave}
            disabled
            title={backupConfigWorkflowUnavailableReason}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:cursor-not-allowed disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {!selectedOrgId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Building2 size={48} className="mb-4 opacity-50" />
          <p>Select an organization to configure backups</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : !config ? (
        <div className="py-6">
          <ReadOnlyState
            title="Backup configuration workflow unavailable"
            description={backupConfigWorkflowUnavailableReason}
          />
        </div>
      ) : (
        config && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuration */}
            <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Settings size={20} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-c-text">Backup Configuration</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-500">
                    Configure automatic backups
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-c-text font-medium">Enable Automatic Backups</span>
                    <p className="text-sm text-slate-600 dark:text-slate-500">
                      Automatically backup organization data
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateConfig('enabled', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-c-surface' : 'bg-c-surface-raised'}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white dark:bg-navy-900 shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`}
                      />
                    </div>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Backup Frequency
                  </label>
                  <select
                    value={config.frequency}
                    onChange={(e) => updateConfig('frequency', e.target.value)}
                    disabled={!config.enabled}
                    className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none disabled:opacity-50"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Retention Period (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={config.retention_days}
                    onChange={(e) => updateConfig('retention_days', parseInt(e.target.value))}
                    disabled={!config.enabled}
                    className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none disabled:opacity-50"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Backups older than this will be deleted
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={config.include_attachments}
                      onChange={(e) => updateConfig('include_attachments', e.target.checked)}
                      disabled={!config.enabled}
                      className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-slate-600 group-hover:text-white">
                        Include Attachments
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Backup uploaded files and documents
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={config.include_audit_logs}
                      onChange={(e) => updateConfig('include_audit_logs', e.target.checked)}
                      disabled={!config.enabled}
                      className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-slate-600 group-hover:text-white">
                        Include Audit Logs
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Backup activity and audit logs
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Status & History */}
            <div className="space-y-6">
              {/* Current Status */}
              <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Database size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-c-text">Backup Status</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-500">
                      Current backup information
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-c-surface/50 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last Backup</p>
                    <p className="text-c-text font-medium">
                      {config.last_backup_at
                        ? new Date(config.last_backup_at).toLocaleString()
                        : 'Never'}
                    </p>
                    {config.last_backup_status && (
                      <span
                        className={`inline-flex items-center gap-1 mt-1 text-xs ${
                          config.last_backup_status === 'success'
                            ? 'text-emerald-400'
                            : 'text-danger-400'
                        }`}
                      >
                        {config.last_backup_status === 'success' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        {config.last_backup_status}
                      </span>
                    )}
                  </div>

                  <div className="p-4 bg-c-surface/50 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Last Backup Size
                    </p>
                    <p className="text-c-text font-medium">
                      {formatFileSize(config.last_backup_size)}
                    </p>
                  </div>

                  <div className="p-4 bg-c-surface/50 rounded-lg col-span-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Next Scheduled Backup
                    </p>
                    <p className="text-c-text font-medium flex items-center gap-2">
                      <Clock size={14} className="text-primary-400" />
                      {getNextBackupTime()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Backup History */}
              <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <History size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-c-text">Recent Backups</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-500">Backup history</p>
                  </div>
                </div>

                {history.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No backup history available
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-c-surface/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {item.status === 'success' ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-danger-400" />
                          )}
                          <div>
                            <p className="text-sm text-c-text">
                              {new Date(item.timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {item.type}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-500">
                          {formatFileSize(item.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default BackupConfigPanel;
