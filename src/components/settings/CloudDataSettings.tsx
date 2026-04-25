/**
 * CloudDataSettings
 *
 * Settings panel for managing cloud storage connections (Google Drive, OneDrive, etc.)
 * Used in Settings → Integrations.
 */

import { Cloud, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface CloudSource {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt?: string;
  createdAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  sharepoint: 'SharePoint',
};

const PROVIDER_ICONS: Record<string, string> = {
  google_drive: '📁',
  onedrive: '☁️',
  dropbox: '💧',
  sharepoint: '🏢',
};

export const CloudDataSettings: React.FC = () => {
  const { t } = useTranslation();
  const [sources, setSources] = useState<CloudSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('google_drive');
  const [newName, setNewName] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const data = await Api.get('/api/cloud/sources');
      setSources(data?.sources || []);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await Api.post('/api/cloud/sources', { provider: newProvider, name: newName.trim() });
      toast.success(t('cloud.sourceConnected', 'Cloud source connected'));
      setShowAddForm(false);
      setNewName('');
      fetchSources();
    } catch {
      toast.error(t('cloud.connectFailed', 'Failed to connect cloud source'));
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const data = await Api.post(`/api/cloud/sources/${id}/sync`, {});
      toast.success(t('cloud.syncComplete', `Synced ${data?.filesSynced || 0} files`));
      fetchSources();
    } catch {
      toast.error(t('cloud.syncFailed', 'Sync failed'));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      t(
        'cloud.deleteConfirm',
        'Are you sure you want to disconnect this cloud source? This will stop syncing files from this source.'
      )
    );
    if (!confirmed) return;

    try {
      await Api.delete(`/api/cloud/sources/${id}`);
      toast.success(t('cloud.sourceDisconnected', 'Cloud source disconnected'));
      fetchSources();
    } catch {
      toast.error(t('cloud.disconnectFailed', 'Failed to disconnect'));
    }
  };

  const openInProvider = (source: CloudSource) => {
    const urls: Record<string, string> = {
      google_drive: 'https://drive.google.com',
      onedrive: 'https://onedrive.live.com',
      dropbox: 'https://www.dropbox.com/home',
      sharepoint: 'https://sharepoint.com',
    };
    const url = urls[source.provider];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getProviderLabel = (provider: string) =>
    t(`cloud.providers.${provider}`, PROVIDER_LABELS[provider] || provider);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={20} className="text-brand" />
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
            {t('cloud.title', 'Cloud Data Sources')}
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('cloud.addSource', 'Add source')}
        </button>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t('cloud.description', 'Connect cloud storage to import documents for AI analysis.')}
      </p>

      {showAddForm && (
        <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('cloud.provider', 'Provider')}
            </label>
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg"
            >
              {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {PROVIDER_ICONS[key]} {getProviderLabel(key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('cloud.sourceName', 'Name')}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('cloud.sourceNamePlaceholder', 'e.g. Company Drive')}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-brand hover:bg-brand-dark disabled:bg-slate-300 rounded-lg"
            >
              {t('cloud.connect', 'Connect')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">{t('common.loading', 'Loading...')}</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <Cloud size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('cloud.noSources', 'No cloud sources connected yet.')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{PROVIDER_ICONS[source.provider] || '📁'}</span>
                <div>
                  <div className="text-sm font-medium text-navy-900 dark:text-white">
                    {source.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {getProviderLabel(source.provider)} ·{' '}
                    <span
                      className={
                        source.status === 'active'
                          ? 'text-green-500'
                          : source.status === 'error'
                            ? 'text-red-500'
                            : 'text-slate-400'
                      }
                    >
                      {t(`cloud.status.${source.status}`, source.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSync(source.id)}
                  disabled={syncingId === source.id}
                  className="p-1.5 text-blue-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                  title={t('cloud.sync', 'Sync files')}
                >
                  <RefreshCw size={14} className={syncingId === source.id ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => openInProvider(source)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
                  title={t('cloud.openInProvider', 'Open in provider')}
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={() => handleDelete(source.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title={t('cloud.disconnect', 'Disconnect')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CloudDataSettings;
