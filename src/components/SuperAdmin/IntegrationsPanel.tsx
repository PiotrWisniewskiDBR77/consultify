/**
 * IntegrationsPanel - Full Implementation
 *
 * Complete integration management with webhooks and connectors
 */

import {
  Activity,
  CheckCircle,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface Integration {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  last_sync_at?: string;
  last_sync_status?: string;
  config: any;
  auth_config: any;
}

export const IntegrationsPanel: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks'>('integrations');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      if (activeTab === 'integrations') {
        const data = await Api.getSystemIntegrations();
        const list = Array.isArray((data as any)?.integrations)
          ? (data as any).integrations
          : Array.isArray(data)
            ? (data as any)
            : [];
        setIntegrations(list);
      } else {
        const data = await Api.getSystemWebhooks();
        const list = Array.isArray((data as any)?.webhooks)
          ? (data as any).webhooks
          : Array.isArray(data)
            ? (data as any)
            : [];
        setWebhooks(list || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(true);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await Api.refreshSystemIntegration(id);
      toast.success('Sync started');
      fetchData();
    } catch (error) {
      console.error('Failed to sync:', error);
      toast.error('Failed to start sync');
    }
  };

  const handleDelete = async (id: string, type: 'integration' | 'webhook') => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === 'integration') {
        await Api.deleteSystemIntegration(id);
      } else {
        await Api.deleteSystemWebhook(id);
      }
      toast.success(`${type} deleted`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(`Failed to delete ${type}`);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Integrations Hub
          </h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Connect Consultify with your existing tools
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={16} />
          {activeTab === 'integrations' ? 'Add Integration' : 'Create Webhook'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-c-border-subtle">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'integrations'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          Webhooks
        </button>
      </div>

      {/* Content */}
      {error ? (
        <div className="text-center py-12">
          <XCircle size={40} className="mx-auto mb-3 text-danger-500 opacity-80" />
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
            {t('superAdmin.integrations.loadFailed')}
          </p>
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
            {t('common.retry')}
          </button>
        </div>
      ) : activeTab === 'integrations' ? (
        <div className="space-y-2">
          {integrations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Webhook size={48} className="mx-auto mb-4 opacity-50" />
              <p>No integrations configured</p>
            </div>
          ) : (
            integrations.map((integration) => (
              <div
                key={integration.id}
                className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-c-border-subtle hover:bg-slate-50 dark:hover:bg-navy-900/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-slate-900 dark:text-slate-100 font-medium">
                        {integration.name}
                      </h3>
                      <span className="px-2 py-0.5 text-xs bg-primary-600/10 text-primary-700 dark:text-primary-300 rounded">
                        {integration.type}
                      </span>
                      {integration.enabled ? (
                        <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-danger-600 dark:text-danger-400" />
                      )}
                    </div>
                    {integration.last_sync_at && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                        {integration.last_sync_status && (
                          <span
                            className={`ml-2 ${
                              integration.last_sync_status === 'success'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-danger-700 dark:text-danger-400'
                            }`}
                          >
                            ({integration.last_sync_status})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(integration.type)}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title="Sync"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(integration.type, 'integration')}
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
      ) : (
        <div className="space-y-2">
          {webhooks.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Webhook size={48} className="mx-auto mb-4 opacity-50" />
              <p>No webhooks configured</p>
            </div>
          ) : (
            webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-c-border-subtle hover:bg-slate-50 dark:hover:bg-navy-900/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-slate-900 dark:text-slate-100 font-medium">
                        {webhook.name}
                      </h3>
                      {webhook.is_active ? (
                        <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-danger-600 dark:text-danger-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                      {webhook.url}
                    </p>
                    {webhook.events && Array.isArray(webhook.events) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(webhook.id, 'webhook')}
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
      )}
    </div>
  );
};

export default IntegrationsPanel;
