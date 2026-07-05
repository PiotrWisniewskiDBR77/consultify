/**
 * BackupPanel - Backup & Disaster Recovery Management
 */

import { CheckCircle, Download, HardDrive, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const BackupPanel: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await (Api as any).getBackups();
      setBackups(data);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await (Api as any).createBackup('full', 'manual');
      toast.success('Backup created successfully');
      fetchBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    try {
      await (Api as any).deleteBackup(id);
      toast.success('Backup deleted');
      fetchBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error('Failed to delete backup');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text mb-2">Backup & Recovery</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Manage database backups and disaster recovery
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Create Backup
        </button>
      </div>

      <div className="space-y-2">
        {backups.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <HardDrive size={48} className="mx-auto mb-4 opacity-50" />
            <p>No backups available</p>
          </div>
        ) : (
          backups.map((backup) => (
            <div
              key={backup.id}
              className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-c-text font-medium">{backup.backup_type} Backup</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        backup.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : backup.status === 'failed'
                            ? 'bg-danger-500/20 text-danger-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {backup.status}
                    </span>
                    {backup.status === 'completed' ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : (
                      <XCircle size={16} className="text-danger-400" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Created: {new Date(backup.started_at).toLocaleString()}
                  </p>
                  {backup.size_bytes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Size: {(backup.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {backup.status === 'completed' && (
                    <button
                      className="p-2 rounded-lg bg-c-surface-raised text-slate-300 hover:bg-slate-600 transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(backup.id)}
                    className="p-2 rounded-lg bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BackupPanel;
