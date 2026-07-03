/**
 * EnterpriseBackupPanel - Backup & Disaster Recovery Management
 *
 * Features:
 * - Automated backup schedules
 * - Manual backup creation
 * - Point-in-time recovery
 * - Backup encryption & verification
 * - Cloud storage integration (S3/GCS)
 * - DR testing & validation
 */

import {
  Calendar,
  CheckCircle,
  Clock,
  Cloud,
  Download,
  HardDrive,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { ADMIN_UI_COPY } from '../../../utils/adminUiCopy';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState, ReadOnlyState } from '../../Admin/AdminState';

interface Backup {
  id: string;
  type: 'full' | 'incremental' | 'differential';
  reason: string;
  filename: string;
  path: string;
  sizeBytes: number;
  sizeMB: string;
  encrypted: boolean;
  hasS3: boolean;
  checksum?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  error?: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  retention_days: number;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

interface BackupConfig {
  retention_days: number;
  max_local_backups: number;
  encryption_enabled: boolean;
  cloud_storage_enabled: boolean;
  cloud_provider?: string;
  auto_verify: boolean;
}

const getCreatedBackupId = (result: unknown) => {
  if (!result || typeof result !== 'object') return '';
  const payload = result as { id?: unknown; backup?: { id?: unknown }; data?: unknown };
  const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
  return String(
    payload.id ||
      payload.backup?.id ||
      (data as { id?: unknown; backup?: { id?: unknown } } | null)?.id ||
      (data as { backup?: { id?: unknown } } | null)?.backup?.id ||
      ''
  );
};

const normalizeBackups = (payload: unknown): Backup[] => {
  if (Array.isArray(payload)) return payload as Backup[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { backups?: unknown; data?: unknown; items?: unknown };
    if (Array.isArray(candidate.backups)) return candidate.backups as Backup[];
    if (Array.isArray(candidate.data)) return candidate.data as Backup[];
    if (Array.isArray(candidate.items)) return candidate.items as Backup[];
  }
  throw new Error('Backups response was not a list');
};

const normalizeSchedules = (payload: unknown): BackupSchedule[] => {
  if (Array.isArray(payload)) return payload as BackupSchedule[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { schedules?: unknown; data?: unknown; items?: unknown };
    if (Array.isArray(candidate.schedules)) return candidate.schedules as BackupSchedule[];
    if (Array.isArray(candidate.data)) return candidate.data as BackupSchedule[];
    if (Array.isArray(candidate.items)) return candidate.items as BackupSchedule[];
  }
  throw new Error('Backup schedules response was not a list');
};

const BACKUP_TYPE_CONFIG = {
  full: { color: 'bg-primary-500/20 text-primary-400', label: 'Full' },
  incremental: { color: 'bg-blue-500/20 text-blue-400', label: 'Incremental' },
  differential: { color: 'bg-blue-500/20 text-blue-400', label: 'Differential' },
};

const STATUS_CONFIG = {
  pending: { color: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-500', icon: Clock },
  in_progress: { color: 'bg-amber-500', text: 'text-amber-400', icon: RefreshCw },
  completed: { color: 'bg-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  failed: { color: 'bg-danger-500', text: 'text-danger-400', icon: XCircle },
};

const fallbackBackupTypeConfig = { color: 'bg-slate-500/20 text-slate-600', label: 'Unknown' };
const fallbackStatusConfig = {
  color: 'bg-slate-500',
  text: 'text-slate-600 dark:text-slate-500',
  icon: Clock,
};

const destructiveBackupActionReason = ADMIN_UI_COPY.destructiveDisabled.description;

export const EnterpriseBackupPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'backups' | 'schedules' | 'settings' | 'dr-test'>(
    'backups'
  );
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    retention_days: 30,
    max_local_backups: 10,
    encryption_enabled: true,
    cloud_storage_enabled: false,
    auto_verify: true,
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupLoadError, setBackupLoadError] = useState<string | null>(null);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  const fetchBackups = useCallback(async () => {
    try {
      const data = await Api.getBackups();
      const backupsData = normalizeBackups(data);
      setBackups(backupsData);
      setBackupLoadError(null);
      return backupsData;
    } catch (error) {
      setBackupLoadError(
        normalizeApiErrorMessage(
          error,
          'Backup service is unavailable. Backup actions are disabled until the backend workflow is connected.'
        )
      );
      setBackups([]);
      return null;
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const data = await Api.getBackupSchedules();
      const schedulesData = normalizeSchedules(data);
      setSchedules(schedulesData);
      setScheduleLoadError(null);
      return schedulesData;
    } catch (error) {
      setScheduleLoadError(normalizeApiErrorMessage(error, 'Backup schedules are unavailable.'));
      setSchedules([]);
      return null;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBackups(), fetchSchedules()]);
      setLoading(false);
    };
    loadData();
  }, [fetchBackups, fetchSchedules]);

  const handleCreateBackup = async (type: 'full' | 'incremental', reason: string = 'manual') => {
    if (backupLoadError) {
      toast.error(backupLoadError);
      return;
    }

    setCreating(true);
    setActionError(null);
    try {
      const result = await Api.createBackup(type, reason);
      const createdId = getCreatedBackupId(result);
      if (!createdId) {
        throw new Error('Backup creation response was incomplete');
      }
      const refreshed = await fetchBackups();
      if (!refreshed?.some((backup) => backup.id === createdId)) {
        throw new Error('Backup creation was not confirmed by the server');
      }
      toast.success('Backup started');
      setShowCreateModal(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        'Failed to create backup - production configuration required'
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    setActionError(null);
    try {
      await Api.updateBackupSchedule(id, { enabled });
      const refreshed = await fetchSchedules();
      if (!refreshed?.some((schedule) => schedule.id === id && schedule.enabled === enabled)) {
        throw new Error('Backup schedule update was not confirmed by the server');
      }
      toast.success(`Schedule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to update schedule');
      setActionError(message);
      toast.error(message);
    }
  };

  const safeNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatBytes = (value: unknown) => {
    const bytes = safeNumber(value);
    if (bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalBackupSize = () => {
    return backups.reduce((acc, b) => acc + safeNumber(b.sizeBytes), 0);
  };

  const hasBackupDataError = Boolean(backupLoadError || scheduleLoadError);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Backup & Recovery
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Manage database backups and disaster recovery procedures
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={creating || Boolean(backupLoadError)}
          title={backupLoadError || undefined}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Backup
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-danger-600 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {/* Stats */}
      {hasBackupDataError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-navy-950/20">
          <DegradedState
            title="Backup overview unavailable"
            description={backupLoadError || scheduleLoadError || 'Backup data is unavailable.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Backups</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {backups.length}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="text-sm text-slate-600 dark:text-slate-400">Storage Used</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatBytes(getTotalBackupSize())}
            </div>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <div className="text-sm text-slate-600 dark:text-slate-400">Last Backup</div>
            <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              {formatDate(backups[0]?.createdAt)}
            </div>
          </div>
          <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/30">
            <div className="text-sm text-slate-600 dark:text-slate-400">Active Schedules</div>
            <div className="text-2xl font-semibold text-primary-700 dark:text-primary-300">
              {schedules.filter((s) => s.enabled).length}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
        {[
          { id: 'backups', label: 'Backups', icon: HardDrive },
          { id: 'schedules', label: 'Schedules', icon: Calendar },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'dr-test', label: 'DR Testing', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100 border-b-2 border-primary-500'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-600 dark:text-slate-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Backups Tab */}
          {activeTab === 'backups' && (
            <div className="space-y-2">
              {backupLoadError ? (
                <DegradedState title="Backup service unavailable" description={backupLoadError} />
              ) : backups.length === 0 ? (
                <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                  <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No backups available</p>
                  <p className="text-sm mt-1">Create your first backup to get started</p>
                </div>
              ) : (
                backups.map((backup) => {
                  const typeConfig = BACKUP_TYPE_CONFIG[backup.type] || fallbackBackupTypeConfig;
                  const statusConfig = STATUS_CONFIG[backup.status] || fallbackStatusConfig;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={backup.id}
                      className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${statusConfig.color}/20`}>
                            <StatusIcon
                              className={`w-5 h-5 ${statusConfig.text} ${
                                backup.status === 'in_progress' ? 'animate-spin' : ''
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded ${typeConfig.color}`}>
                                {typeConfig.label}
                              </span>
                              <code className="text-sm text-slate-900 dark:text-slate-100 font-mono">
                                {backup.filename}
                              </code>
                              {backup.encrypted && <Lock className="w-3 h-3 text-emerald-400" />}
                              {backup.hasS3 && <Cloud className="w-3 h-3 text-blue-400" />}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>{formatBytes(backup.sizeBytes)}</span>
                              <span>•</span>
                              <span>Created: {formatDateTime(backup.createdAt)}</span>
                              <span>•</span>
                              <span>Reason: {backup.reason}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${statusConfig.color}/20 ${statusConfig.text}`}
                          >
                            {STATUS_CONFIG[backup.status]
                              ? backup.status.replace('_', ' ')
                              : 'unknown'}
                          </span>
                          {backup.status === 'completed' && (
                            <>
                              <button
                                disabled
                                className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                                title={destructiveBackupActionReason}
                              >
                                <Upload className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                              </button>
                              <button
                                disabled
                                className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                                title={destructiveBackupActionReason}
                              >
                                <Download className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                              </button>
                            </>
                          )}
                          <button
                            disabled
                            className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                            title={destructiveBackupActionReason}
                          >
                            <Trash2 className="w-4 h-4 text-danger-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Schedules Tab */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  Backup Schedules
                </h3>
                <button
                  disabled
                  title={destructiveBackupActionReason}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 text-sm rounded-lg opacity-50 cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Schedule
                </button>
              </div>

              <div className="space-y-2">
                {scheduleLoadError ? (
                  <DegradedState
                    title="Backup schedules unavailable"
                    description={scheduleLoadError}
                  />
                ) : schedules.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No backup schedules configured</p>
                    <p className="text-sm mt-1">
                      Schedules can be enabled after backend workflow setup.
                    </p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${schedule.enabled ? 'bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700'}`}
                          >
                            <Calendar
                              className={`w-5 h-5 ${schedule.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {schedule.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${BACKUP_TYPE_CONFIG[schedule.type].color}`}
                              >
                                {BACKUP_TYPE_CONFIG[schedule.type].label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-1">
                              <span className="capitalize">
                                {schedule.frequency} at {schedule.time}
                              </span>
                              <span>•</span>
                              <span>Retention: {schedule.retention_days} days</span>
                              {schedule.next_run && (
                                <>
                                  <span>•</span>
                                  <span>Next run: {formatDateTime(schedule.next_run)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              schedule.enabled
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700 text-slate-600 dark:text-slate-500'
                            }`}
                          >
                            {schedule.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button
                            disabled
                            title="Schedule editing requires an audited schedule editor workflow."
                            className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                          >
                            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <ReadOnlyState
                title="Backup settings are read-only"
                description="Retention, encryption, and cloud storage settings are displayed as local defaults until a persisted backup configuration endpoint is connected."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">
                    Retention Policy
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="backup-retention-days"
                        className="block text-sm text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Retention Days
                      </label>
                      <input
                        id="backup-retention-days"
                        type="number"
                        value={config.retention_days}
                        disabled
                        onChange={(e) =>
                          setConfig({ ...config, retention_days: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="backup-max-local-backups"
                        className="block text-sm text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Max Local Backups
                      </label>
                      <input
                        id="backup-max-local-backups"
                        type="number"
                        value={config.max_local_backups}
                        disabled
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            max_local_backups: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Security</h4>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Encrypt backups at rest
                      </span>
                      <input
                        type="checkbox"
                        checked={config.encryption_enabled}
                        disabled
                        onChange={(e) =>
                          setConfig({ ...config, encryption_enabled: e.target.checked })
                        }
                        className="rounded border-slate-300 bg-white text-primary-600 dark:border-slate-600 dark:bg-slate-800 dark:text-primary-500"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Auto-verify after backup
                      </span>
                      <input
                        type="checkbox"
                        checked={config.auto_verify}
                        disabled
                        onChange={(e) => setConfig({ ...config, auto_verify: e.target.checked })}
                        className="rounded border-slate-300 bg-white text-primary-600 dark:border-slate-600 dark:bg-slate-800 dark:text-primary-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 md:col-span-2">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-400" />
                    Cloud Storage
                  </h4>
                  <label className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Enable cloud backup sync
                    </span>
                    <input
                      type="checkbox"
                      checked={config.cloud_storage_enabled}
                      disabled
                      onChange={(e) =>
                        setConfig({ ...config, cloud_storage_enabled: e.target.checked })
                      }
                      className="rounded border-slate-300 bg-white text-primary-600 dark:border-slate-600 dark:bg-slate-800 dark:text-primary-500"
                    />
                  </label>
                  {config.cloud_storage_enabled && (
                    <div className="grid grid-cols-3 gap-2">
                      {['AWS S3', 'Google Cloud Storage', 'Azure Blob'].map((provider) => (
                        <button
                          key={provider}
                          className={`p-3 rounded-lg border transition-colors ${
                            config.cloud_provider === provider
                              ? 'bg-primary-600/10 border-primary-500/30 text-primary-700 dark:text-primary-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                          onClick={() => setConfig({ ...config, cloud_provider: provider })}
                        >
                          {provider}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled
                  title="Backup settings persistence is not connected"
                  className="px-4 py-2 bg-navy-900 text-white rounded-lg transition-colors opacity-50 cursor-not-allowed"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* DR Testing Tab */}
          {activeTab === 'dr-test' && (
            <div className="space-y-6">
              <ReadOnlyState
                title="Disaster recovery workflow unavailable"
                description={destructiveBackupActionReason}
              />

              <div className="p-6 bg-gradient-to-br from-amber-500/10 to-amber-500/10 rounded-xl border border-amber-500/30">
                <div className="flex items-start gap-4">
                  <Shield className="w-8 h-8 text-amber-400" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                      Disaster Recovery Testing
                    </h3>
                    <p className="text-slate-600 dark:text-slate-500 mb-4">
                      Regularly test your backup and recovery procedures to ensure business
                      continuity. DR tests run in an isolated environment and do not affect
                      production data.
                    </p>
                    <button
                      disabled
                      title={destructiveBackupActionReason}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg opacity-50 cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      Start DR Test
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                  DR Test History
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No verified disaster recovery test history is available until the backend job
                  lifecycle is connected.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Create Backup
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-500">Select backup type:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCreateBackup('full')}
                  disabled={creating}
                  className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg text-left hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-primary-400 mb-1">Full Backup</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Complete database snapshot
                  </div>
                </button>
                <button
                  onClick={() => handleCreateBackup('incremental')}
                  disabled={creating}
                  className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-blue-400 mb-1">Incremental</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Changes since last backup
                  </div>
                </button>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseBackupPanel;
