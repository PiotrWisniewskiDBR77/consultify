/**
 * ConnectedAppsSettings - Manage connected applications
 *
 * Uses the User-Level Integration System for OAuth connections.
 * Each user can connect their own Slack, Teams, Jira, ClickUp accounts.
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Provider, UserIntegration, useUserIntegrations } from '../../hooks/useUserIntegrations';
import {
  V8SyncApi,
  type V8SyncCatalogConnector,
  type V8SyncIntegrationInventoryRow,
} from '../../services/api/v8/sync';

// Slack icon
const SlackIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

// Provider icons mapping
const PROVIDER_ICONS: Record<string, React.ElementType> = {
  slack: SlackIcon,
  teams: MessageSquare,
  jira: Database,
  clickup: CheckCircle2,
  hubspot: MessageSquare,
  monday: Calendar,
  asana: CheckCircle2,
  notion: FileText,
  trello: CheckCircle2,
  google_ai: Database,
  openai: Database,
  anthropic: Database,
};

// Integration categories
export type IntegrationCategory = 'productivity' | 'ai' | 'communication' | 'crm' | 'all';

// Provider descriptions and features
const PROVIDER_INFO: Record<
  string,
  {
    description: string;
    features: string[];
    category: IntegrationCategory;
    popular?: boolean;
  }
> = {
  slack: {
    description: 'Receive notifications and create tasks from Slack',
    features: ['Real-time notifications', 'Interactive buttons'],
    category: 'communication',
    popular: true,
  },
  teams: {
    description: 'Get notified in Microsoft Teams',
    features: ['Adaptive cards', 'Direct messages'],
    category: 'communication',
    popular: true,
  },
  jira: {
    description: 'Sync tasks and issues with Jira',
    features: ['Bi-directional sync', 'Status mapping'],
    category: 'productivity',
    popular: true,
  },
  clickup: {
    description: 'Sync tasks with ClickUp',
    features: ['Task sync', 'Status sync'],
    category: 'productivity',
    popular: true,
  },
  hubspot: {
    description: 'Sync contacts, deals, and activities with HubSpot',
    features: ['Contact sync', 'Deal tracking', 'Activity logging'],
    category: 'crm',
    popular: true,
  },
  monday: {
    description: 'Sync boards and items with Monday.com',
    features: ['Board sync', 'Item mapping', 'Status sync'],
    category: 'productivity',
    popular: true,
  },
  asana: {
    description: 'Sync tasks and projects with Asana',
    features: ['Task sync', 'Project sync', 'Status mapping'],
    category: 'productivity',
  },
  notion: {
    description: 'Sync pages and databases with Notion',
    features: ['Page sync', 'Database sync', 'Content mapping'],
    category: 'productivity',
  },
  trello: {
    description: 'Sync boards and cards with Trello',
    features: ['Board sync', 'Card sync', 'List mapping'],
    category: 'productivity',
  },
  google_ai: {
    description: 'Connect to Google AI Studio for advanced AI capabilities',
    features: ['Gemini API', 'Custom models', 'Token tracking'],
    category: 'ai',
    popular: true,
  },
  openai: {
    description: 'Connect to OpenAI for GPT models and embeddings',
    features: ['GPT-4', 'Embeddings', 'Fine-tuning'],
    category: 'ai',
    popular: true,
  },
  anthropic: {
    description: 'Connect to Anthropic Claude for AI assistance',
    features: ['Claude API', 'Long context', 'Advanced reasoning'],
    category: 'ai',
    popular: true,
  },
};

interface ConnectedAppsSettingsProps {
  className?: string;
}

export const ConnectedAppsSettings: React.FC<ConnectedAppsSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [v8Catalog, setV8Catalog] = useState<V8SyncCatalogConnector[]>([]);
  const [v8Integrations, setV8Integrations] = useState<V8SyncIntegrationInventoryRow[]>([]);
  const [v8Loading, setV8Loading] = useState(false);
  const [v8Error, setV8Error] = useState<string | null>(null);
  const [v8ConnectOpen, setV8ConnectOpen] = useState(false);
  const [v8SelectedConnector, setV8SelectedConnector] = useState<V8SyncCatalogConnector | null>(null);
  const [v8DraftConfig, setV8DraftConfig] = useState<Record<string, string>>({});
  const [v8Connecting, setV8Connecting] = useState(false);

  const {
    integrations,
    providers,
    connectedCount,
    loading,
    error,
    connect,
    disconnect,
    testConnection,
    refresh,
  } = useUserIntegrations();

  const refreshV8 = useCallback(async () => {
    setV8Loading(true);
    setV8Error(null);
    try {
      const [catalogRes, integrationsRes] = await Promise.all([
        V8SyncApi.getConnectors(),
        V8SyncApi.getIntegrations(),
      ]);
      setV8Catalog((catalogRes?.connectors || []) as V8SyncCatalogConnector[]);
      setV8Integrations((integrationsRes?.integrations || []) as V8SyncIntegrationInventoryRow[]);
    } catch (e: any) {
      setV8Error(
        e?.data?.error ||
          e?.message ||
          t('settings.integrations.v8LoadFailed', 'Failed to load connector catalog')
      );
    } finally {
      setV8Loading(false);
    }
  }, [t]);

  useEffect(() => {
    refreshV8();
  }, [refreshV8]);

  const v8LatestByConnector = useMemo(() => {
    const map = new Map<string, V8SyncIntegrationInventoryRow>();
    for (const row of v8Integrations) {
      const id = String(row.connectorId || '').trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, row);
    }
    return map;
  }, [v8Integrations]);

  const v8FilteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return v8Catalog.filter((c) => {
      if (!q) return true;
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.id || '').toLowerCase().includes(q) ||
        String(c.category || '').toLowerCase().includes(q)
      );
    });
  }, [v8Catalog, searchQuery]);

  // Filter providers by category and search
  const filteredProviders = providers.filter((provider) => {
    const info = PROVIDER_INFO[provider.id];
    if (!info) return true;

    const matchesCategory = selectedCategory === 'all' || info.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      info.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Get popular providers
  const popularProviders = providers.filter((p) => PROVIDER_INFO[p.id]?.popular);

  // Handle connect
  const handleConnect = async (provider: string) => {
    try {
      await connect(provider);
    } catch (err) {
      toast.error(t('settings.integrations.connectError', 'Failed to initiate connection'));
    }
  };

  // Handle disconnect
  const handleDisconnect = async (provider: string) => {
    const confirmed = window.confirm(
      t(
        'settings.integrations.disconnectConfirm',
        'Are you sure you want to disconnect this integration?'
      )
    );
    if (confirmed) {
      const success = await disconnect(provider);
      if (success) {
        toast.success(t('settings.integrations.disconnected', 'Disconnected successfully'));
      }
    }
  };

  // Handle test connection
  const handleTest = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const result = await testConnection(provider);
      if (result.success) {
        toast.success(t('settings.integrations.testSuccess', 'Connection working!'));
      } else {
        toast.error(
          result.error || t('settings.integrations.testFailed', 'Connection test failed')
        );
      }
    } catch {
      toast.error(t('settings.integrations.testFailed', 'Connection test failed'));
    } finally {
      setTestingProvider(null);
    }
  };

  // Get provider icon
  const getProviderIcon = (providerId: string) => {
    const Icon = PROVIDER_ICONS[providerId] || Link2;
    return <Icon className="w-5 h-5" />;
  };

  const openV8Connect = (connector: V8SyncCatalogConnector) => {
    setV8SelectedConnector(connector);
    const nextDraft: Record<string, string> = {};
    (connector.configFields || []).forEach((f) => {
      nextDraft[f] = '';
    });
    setV8DraftConfig(nextDraft);
    setV8ConnectOpen(true);
  };

  const submitV8Connect = async () => {
    if (!v8SelectedConnector) return;
    setV8Connecting(true);
    try {
      const rawConfig: Record<string, unknown> = {};
      Object.entries(v8DraftConfig).forEach(([k, v]) => {
        if (String(v || '').trim().length > 0) rawConfig[k] = v.trim();
      });

      const initiated = await V8SyncApi.connectIntegration(v8SelectedConnector.id, {
        displayName: v8SelectedConnector.name,
        config: rawConfig,
      });

      const integrationId = initiated?.integration?.id;
      if (!integrationId) {
        throw new Error('Missing integration id');
      }

      const configured = await V8SyncApi.configureIntegration(integrationId, { config: rawConfig });
      const authUrl = configured?.externalAuth?.authUrl;
      if (authUrl) {
        window.open(authUrl, '_blank', 'noopener,noreferrer,width=900,height=780');
      }

      toast.success(t('settings.integrations.connectStarted', 'Connection started'));
      setV8ConnectOpen(false);
      setV8SelectedConnector(null);
      await refreshV8();
    } catch (e: any) {
      toast.error(
        e?.data?.error ||
          e?.message ||
          t('settings.integrations.connectError', 'Failed to initiate connection')
      );
    } finally {
      setV8Connecting(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 size={20} />
            {t('settings.integrations.appsTitle', 'Connected Apps')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'settings.integrations.appsDesc',
              'Manage third-party applications connected to your account.'
            )}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  const categories: { id: IntegrationCategory; label: string; count?: number }[] = [
    { id: 'all', label: t('settings.integrations.categories.all', 'All') },
    {
      id: 'productivity',
      label: t('settings.integrations.categories.productivity', 'Productivity'),
    },
    { id: 'ai', label: t('settings.integrations.categories.ai', 'AI') },
    {
      id: 'communication',
      label: t('settings.integrations.categories.communication', 'Communication'),
    },
    { id: 'crm', label: t('settings.integrations.categories.crm', 'CRM') },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 size={20} />
            {t('settings.integrations.appsTitle', 'Connected Apps')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'settings.integrations.appsDesc',
              'Manage third-party applications connected to your account.'
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Search and Categories */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('settings.integrations.searchPlaceholder', 'Search integrations...')}
            className="w-full px-4 py-2 pl-10 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              {category.label}
              {category.count !== undefined && (
                <span className="ml-2 px-1.5 py-0.5 bg-white/20 dark:bg-white/10 rounded text-xs">
                  {category.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Integrations */}
      {selectedCategory === 'all' && popularProviders.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {t('settings.integrations.popular', 'Popular Integrations')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {popularProviders.slice(0, 4).map((provider) => {
              const connection = integrations.find((i) => i.provider === provider.id);
              const isConnected = provider.isConnected;
              const info = PROVIDER_INFO[provider.id] || { description: '', features: [] };
              const Icon = PROVIDER_ICONS[provider.id] || Link2;

              return (
                <div
                  key={provider.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isConnected
                      ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                      : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                          isConnected
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-white dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white text-sm">
                          {provider.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {info.description}
                        </p>
                      </div>
                    </div>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check size={12} />
                        {t('common.connected', 'Connected')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConnect(provider.id)}
                        className="px-3 py-1 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
                      >
                        {t('common.connect', 'Connect')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection count badge */}
      {connectedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check size={16} />
          {t('settings.integrations.connectedCount', '{{count}} app(s) connected', {
            count: connectedCount,
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-3">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-navy-800/50 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">
              {t('settings.integrations.noResults', 'No integrations found')}
            </p>
          </div>
        ) : (
          filteredProviders.map((provider) => {
            const connection = integrations.find((i) => i.provider === provider.id);
            const isConnected = provider.isConnected;
            const isError = connection?.status === 'error';
            const isExpired = connection?.status === 'expired';
            const needsReauth = isError || isExpired;
            const info = PROVIDER_INFO[provider.id] || { description: '', features: [] };

            return (
              <div
                key={provider.id}
                className={`p-4 rounded-xl border transition-all ${
                  isConnected
                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                    : needsReauth
                      ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                      : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Provider info */}
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                        isConnected
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          : 'bg-white dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {getProviderIcon(provider.id)}
                    </div>

                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{provider.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {info.description}
                      </p>

                      {/* Status badges */}
                      {isConnected && connection && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            <Check size={10} />
                            {t('settings.integrations.connected', 'Connected')}
                          </span>
                          {connection.externalWorkspaceName && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {connection.externalWorkspaceName}
                            </span>
                          )}
                        </div>
                      )}

                      {needsReauth && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            {isExpired ? <Clock size={10} /> : <AlertTriangle size={10} />}
                            {isExpired
                              ? t('settings.integrations.expired', 'Token Expired')
                              : t('settings.integrations.error', 'Connection Error')}
                          </span>
                        </div>
                      )}

                      {connection?.lastSyncAt && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {t('settings.integrations.lastSync', 'Last sync')}:{' '}
                          {new Date(connection.lastSyncAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {isConnected && (
                      <button
                        onClick={() => handleTest(provider.id)}
                        disabled={testingProvider === provider.id}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand rounded-lg hover:bg-white dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
                        title={t('settings.integrations.testConnection', 'Test connection')}
                      >
                        {testingProvider === provider.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                      </button>
                    )}

                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(provider.id)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        {t('settings.integrations.disconnect', 'Disconnect')}
                      </button>
                    ) : needsReauth ? (
                      <button
                        onClick={() => handleConnect(provider.id)}
                        className="px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                      >
                        {t('settings.integrations.reconnect', 'Reconnect')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(provider.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} />
                        {t('settings.integrations.connect', 'Connect')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Features tags */}
                {info.features.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-navy-700">
                    {info.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-navy-700 px-2 py-0.5 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Error message */}
                {connection?.lastError && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                    {connection.lastError}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* V8 connector catalog (tenant sync) */}
      <div className="pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('settings.integrations.v8CatalogTitle', 'Sync connector catalog')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t(
                'settings.integrations.v8CatalogDesc',
                'Connect external systems for governed sync. Admin can monitor who connected what.'
              )}
            </p>
          </div>
          <button
            onClick={refreshV8}
            disabled={v8Loading}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={v8Loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {v8Error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={16} />
            {v8Error}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-navy-900/40 text-slate-500 dark:text-slate-400">
                <tr className="text-left text-xs">
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2">{t('settings.integrations.catalogApp', 'App')}</th>
                  <th className="px-3 py-2 hidden md:table-cell">
                    {t('settings.integrations.catalogCapabilities', 'Capabilities')}
                  </th>
                  <th className="px-3 py-2 w-28">{t('settings.integrations.catalogStatus', 'Status')}</th>
                  <th className="px-3 py-2 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                {v8FilteredCatalog.map((conn) => {
                  const Icon = (PROVIDER_ICONS as any)[conn.id] || Link2;
                  const existing = v8LatestByConnector.get(conn.id);
                  const isConnected = Boolean(existing);
                  return (
                    <tr
                      key={conn.id}
                      className="text-slate-700 dark:text-slate-200 hover:bg-slate-50/70 dark:hover:bg-navy-800/40"
                    >
                      <td className="px-3 py-2.5">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                          <Icon className="w-4 h-4" />
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {conn.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-500">
                          {conn.category}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(conn.capabilities || []).slice(0, 4).map((cap) => (
                            <span
                              key={cap}
                              className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-700/60 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-600"
                            >
                              {cap}
                            </span>
                          ))}
                          {(conn.capabilities || []).length > 4 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100/60 dark:bg-navy-700/30 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700">
                              +{(conn.capabilities || []).length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Check size={12} /> {t('common.connected', 'Connected')}
                          </span>
                        ) : conn.comingSoon ? (
                          <span className="text-xs text-slate-500 italic">
                            {t('settings.integrations.comingSoon', 'Coming soon')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('settings.integrations.ready', 'Ready')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isConnected ? null : conn.comingSoon ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <button
                            onClick={() => openV8Connect(conn)}
                            className="px-3 py-1 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
                          >
                            {t('common.connect', 'Connect')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {v8FilteredCatalog.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {t('settings.integrations.noResults', 'No integrations found')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* V8 connect modal */}
      {v8ConnectOpen && v8SelectedConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('settings.integrations.connectModalTitle', 'Connect')}
                  {': '} {v8SelectedConnector.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t(
                    'settings.integrations.connectModalDesc',
                    'Provide required fields. If OAuth is required, a new window will open.'
                  )}
                </div>
              </div>
              <button
                onClick={() => setV8ConnectOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {(v8SelectedConnector.configFields || []).length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {t('settings.integrations.noConfigNeeded', 'No additional configuration required.')}
                </div>
              ) : (
                (v8SelectedConnector.configFields || []).map((field) => (
                  <div key={field} className="space-y-1">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {field}
                    </div>
                    <input
                      value={v8DraftConfig[field] || ''}
                      onChange={(e) =>
                        setV8DraftConfig((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder={t('settings.integrations.fieldPlaceholder', 'Enter value')}
                    />
                  </div>
                ))
              )}
            </div>
            <div className="p-4 pt-0 flex items-center justify-end gap-2">
              <button
                onClick={() => setV8ConnectOpen(false)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={submitV8Connect}
                disabled={v8Connecting}
                className="px-3 py-2 text-sm rounded-lg bg-brand hover:bg-brand-dark text-white transition-colors disabled:opacity-50"
              >
                {v8Connecting ? t('common.working', 'Working…') : t('common.connect', 'Connect')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800/50 rounded-lg p-3 space-y-1">
        <p className="font-medium">{t('settings.integrations.note', 'Note:')}</p>
        <ul className="list-disc list-inside space-y-0.5 text-slate-400 dark:text-slate-500">
          <li>{t('settings.integrations.notePersonal', 'These are your personal connections.')}</li>
          <li>
            {t(
              'settings.integrations.noteOAuth',
              'We use secure OAuth - we never store your passwords.'
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectedAppsSettings;
