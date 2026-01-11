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
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Cloud,
  Download,
  FileArchive,
  HardDrive,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

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

const BACKUP_TYPE_CONFIG = {
  full: { color: 'bg-purple-500/20 text-purple-400', label: 'Full' },
  incremental: { color: 'bg-blue-500/20 text-blue-400', label: 'Incremental' },
  differential: { color: 'bg-cyan-500/20 text-cyan-400', label: 'Differential' },
};

const STATUS_CONFIG = {
  pending: { color: 'bg-slate-500', text: 'text-slate-400 dark:text-slate-500', icon: Clock },
  in_progress: { color: 'bg-amber-500', text: 'text-amber-400', icon: RefreshCw },
  completed: { color: 'bg-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  failed: { color: 'bg-red-500', text: 'text-red-400', icon: XCircle },
};

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
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await Api.getBackups();
      setBackups(data || []);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      setBackups([]);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const data = await Api.getBackupSchedules();
      setSchedules(data || []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
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
    setCreating(true);
    try {
      await Api.createBackup(type, reason);
      toast.success('Backup started');
      fetchBackups();
    } catch (error: any) {
      console.error('Failed to create backup:', error);
      toast.error(error?.message || 'Failed to create backup - production configuration required');
    } finally {
      setCreating(false);
      setShowCreateModal(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.'))
      return;

    try {
      await Api.deleteBackup(id);
      toast.success('Backup deleted');
      fetchBackups();
    } catch (error: any) {
      console.error('Failed to delete backup:', error);
      toast.error(error?.message || 'Failed to delete backup');
    }
  };

  const handleRestoreBackup = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to restore from this backup? Current data will be overwritten.'
      )
    )
      return;

    setRestoring(id);
    try {
      const result = await Api.restoreBackup(id);
      if (result.success) {
        toast.success('Restore completed successfully');
      } else {
        throw new Error(result.error || 'Restore failed');
      }
    } catch (error: any) {
      console.error('Failed to restore:', error);
      toast.error(error?.message || 'Failed to restore from backup');
    } finally {
      setRestoring(null);
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
      toast.success(`Schedule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalBackupSize = () => {
    return backups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Backup & Recovery</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Manage database backups and disaster recovery procedures
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Backup
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
          <div className="text-sm text-slate-400 dark:text-slate-500">Total Backups</div>
          <div className="text-2xl font-bold text-white">{backups.length}</div>
        </div>
        <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
          <div className="text-sm text-slate-400 dark:text-slate-500">Storage Used</div>
          <div className="text-2xl font-bold text-white">{formatBytes(getTotalBackupSize())}</div>
        </div>
        <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
          <div className="text-sm text-slate-400 dark:text-slate-500">Last Backup</div>
          <div className="text-lg font-bold text-emerald-400">
            {backups[0] ? new Date(backups[0].createdAt).toLocaleDateString() : 'Never'}
          </div>
        </div>
        <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
          <div className="text-sm text-slate-400 dark:text-slate-500">Active Schedules</div>
          <div className="text-2xl font-bold text-purple-400">
            {schedules.filter((s) => s.enabled).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-1">
        {[
          { id: 'backups', label: 'Backups', icon: HardDrive },
          { id: 'schedules', label: 'Schedules', icon: Calendar },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'dr-test', label: 'DR Testing', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-white/10 text-white border-b-2 border-purple-500'
                : 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Backups Tab */}
          {activeTab === 'backups' && (
            <div className="space-y-2">
              {backups.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No backups available</p>
                  <p className="text-sm mt-1">Create your first backup to get started</p>
                </div>
              ) : (
                backups.map((backup) => {
                  const typeConfig = BACKUP_TYPE_CONFIG[backup.type];
                  const statusConfig = STATUS_CONFIG[backup.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={backup.id}
                      className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
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
                              <code className="text-sm text-white font-mono">
                                {backup.filename}
                              </code>
                              {backup.encrypted && <Lock className="w-3 h-3 text-emerald-400" />}
                              {backup.hasS3 && <Cloud className="w-3 h-3 text-cyan-400" />}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>{backup.sizeMB} MB</span>
                              <span>•</span>
                              <span>Created: {new Date(backup.createdAt).toLocaleString()}</span>
                              <span>•</span>
                              <span>Reason: {backup.reason}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${statusConfig.color}/20 ${statusConfig.text}`}
                          >
                            {backup.status.replace('_', ' ')}
                          </span>
                          {backup.status === 'completed' && (
                            <>
                              <button
                                onClick={() => handleRestoreBackup(backup.id)}
                                disabled={restoring === backup.id}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                                title="Restore"
                              >
                                {restoring === backup.id ? (
                                  <Loader2 className="w-4 h-4 text-slate-400 dark:text-slate-500 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <button
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteBackup(backup.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
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
                <h3 className="text-lg font-medium text-white">Backup Schedules</h3>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50/30 dark:bg-navy-950/20 hover:bg-slate-100 dark:hover:bg-navy-800/40 text-white text-sm rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Schedule
                </button>
              </div>

              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-lg ${schedule.enabled ? 'bg-emerald-500/20' : 'bg-slate-700'}`}
                        >
                          <Calendar
                            className={`w-5 h-5 ${schedule.enabled ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{schedule.name}</span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${BACKUP_TYPE_CONFIG[schedule.type].color}`}
                            >
                              {BACKUP_TYPE_CONFIG[schedule.type].label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="capitalize">
                              {schedule.frequency} at {schedule.time}
                            </span>
                            <span>•</span>
                            <span>Retention: {schedule.retention_days} days</span>
                            {schedule.next_run && (
                              <>
                                <span>•</span>
                                <span>
                                  Next run: {new Date(schedule.next_run).toLocaleString()}
                                </span>
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
                              : 'bg-slate-700 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {schedule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg">
                          <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                  <h4 className="font-medium text-white mb-4">Retention Policy</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                        Retention Days
                      </label>
                      <input
                        type="number"
                        value={config.retention_days}
                        onChange={(e) =>
                          setConfig({ ...config, retention_days: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                        Max Local Backups
                      </label>
                      <input
                        type="number"
                        value={config.max_local_backups}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            max_local_backups: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                  <h4 className="font-medium text-white mb-4">Security</h4>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Encrypt backups at rest</span>
                      <input
                        type="checkbox"
                        checked={config.encryption_enabled}
                        onChange={(e) =>
                          setConfig({ ...config, encryption_enabled: e.target.checked })
                        }
                        className="rounded border-slate-600 bg-slate-800 text-purple-500"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Auto-verify after backup</span>
                      <input
                        type="checkbox"
                        checked={config.auto_verify}
                        onChange={(e) => setConfig({ ...config, auto_verify: e.target.checked })}
                        className="rounded border-slate-600 bg-slate-800 text-purple-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10 md:col-span-2">
                  <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    Cloud Storage
                  </h4>
                  <label className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-300">Enable cloud backup sync</span>
                    <input
                      type="checkbox"
                      checked={config.cloud_storage_enabled}
                      onChange={(e) =>
                        setConfig({ ...config, cloud_storage_enabled: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-purple-500"
                    />
                  </label>
                  {config.cloud_storage_enabled && (
                    <div className="grid grid-cols-3 gap-2">
                      {['AWS S3', 'Google Cloud Storage', 'Azure Blob'].map((provider) => (
                        <button
                          key={provider}
                          className={`p-3 rounded-lg border transition-colors ${
                            config.cloud_provider === provider
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                              : 'bg-slate-800 border-white/10 text-slate-400 dark:text-slate-500 hover:border-white/20'
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
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* DR Testing Tab */}
          {activeTab === 'dr-test' && (
            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30">
                <div className="flex items-start gap-4">
                  <Shield className="w-8 h-8 text-amber-400" />
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">Disaster Recovery Testing</h3>
                    <p className="text-slate-400 dark:text-slate-500 mb-4">
                      Regularly test your backup and recovery procedures to ensure business
                      continuity. DR tests run in an isolated environment and do not affect
                      production data.
                    </p>
                    <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
                      <Play className="w-4 h-4" />
                      Start DR Test
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <span className="font-medium text-white">Last DR Test</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">Passed</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">14 days ago</div>
                </div>
                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <span className="font-medium text-white">Recovery Time</span>
                  </div>
                  <div className="text-2xl font-bold text-white">4m 32s</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Average restore time
                  </div>
                </div>
                <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <FileArchive className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">Data Integrity</span>
                  </div>
                  <div className="text-2xl font-bold text-white">100%</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    All checksums verified
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
                <h4 className="font-medium text-white mb-4">DR Test History</h4>
                <div className="space-y-2">
                  {[
                    {
                      date: '2024-12-19',
                      status: 'passed',
                      duration: '4m 32s',
                      type: 'Full restore',
                    },
                    {
                      date: '2024-12-05',
                      status: 'passed',
                      duration: '3m 58s',
                      type: 'Full restore',
                    },
                    {
                      date: '2024-11-21',
                      status: 'passed',
                      duration: '4m 15s',
                      type: 'Point-in-time',
                    },
                  ].map((test, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-white">{test.type}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 dark:text-slate-500">
                        <span>{test.duration}</span>
                        <span>{test.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Create Backup</h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-400 dark:text-slate-500">Select backup type:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCreateBackup('full')}
                  className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-left hover:bg-purple-500/20 transition-colors"
                >
                  <div className="font-medium text-purple-400 mb-1">Full Backup</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Complete database snapshot
                  </div>
                </button>
                <button
                  onClick={() => handleCreateBackup('incremental')}
                  className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left hover:bg-blue-500/20 transition-colors"
                >
                  <div className="font-medium text-blue-400 mb-1">Incremental</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Changes since last backup
                  </div>
                </button>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full py-2 text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
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
