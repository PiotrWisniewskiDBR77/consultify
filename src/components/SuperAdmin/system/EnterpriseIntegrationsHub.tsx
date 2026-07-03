/**
 * EnterpriseIntegrationsHub - Comprehensive Integration Management
 *
 * Features:
 * - Available connectors catalog
 * - OAuth flow management
 * - Webhook configuration & delivery tracking
 * - Sync status monitoring
 * - Integration health checks
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Link,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Unlink,
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '@/components/shared/states';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState, ReadOnlyState } from '../../Admin/AdminState';

interface Integration {
  id: string;
  type: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  last_sync_at?: string;
  last_sync_status?: string;
  sync_frequency?: string;
  config: unknown;
  error_message?: string;
  created_at: string;
}

const asText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const normalizeStatus = (value: unknown): Integration['status'] => {
  if (
    value === 'connected' ||
    value === 'disconnected' ||
    value === 'error' ||
    value === 'pending'
  ) {
    return value;
  }
  return 'disconnected';
};

const normalizeIntegrations = (payload: unknown): Integration[] => {
  if (Array.isArray(payload)) return payload as Integration[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { integrations?: unknown; data?: unknown; items?: unknown };
    if (Array.isArray(candidate.integrations)) return candidate.integrations as Integration[];
    if (Array.isArray(candidate.data)) return candidate.data as Integration[];
    if (Array.isArray(candidate.items)) return candidate.items as Integration[];
  }
  throw new Error('Integrations response was not a list');
};

const normalizeWebhooks = (payload: unknown): Webhook[] => {
  if (Array.isArray(payload)) return payload as Webhook[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { webhooks?: unknown; data?: unknown; items?: unknown };
    if (Array.isArray(candidate.webhooks)) return candidate.webhooks as Webhook[];
    if (Array.isArray(candidate.data)) return candidate.data as Webhook[];
    if (Array.isArray(candidate.items)) return candidate.items as Webhook[];
  }
  throw new Error('Webhooks response was not a list');
};

const normalizeDeliveries = (payload: unknown): WebhookDelivery[] => {
  if (Array.isArray(payload)) return payload as WebhookDelivery[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { deliveries?: unknown; data?: unknown; items?: unknown };
    if (Array.isArray(candidate.deliveries)) return candidate.deliveries as WebhookDelivery[];
    if (Array.isArray(candidate.data)) return candidate.data as WebhookDelivery[];
    if (Array.isArray(candidate.items)) return candidate.items as WebhookDelivery[];
  }
  throw new Error('Webhook deliveries response was not a list');
};

const formatDateTime = (value?: unknown) => {
  if (!value) return 'Never';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
  last_triggered_at?: string;
  success_count: number;
  failure_count: number;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'success' | 'failed' | 'pending';
  response_code?: number;
  response_body?: string;
  attempts: number;
  created_at: string;
  delivered_at?: string;
}

interface ConnectorType {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  auth_type: 'oauth' | 'api_key' | 'basic' | 'none';
  status: 'available' | 'coming_soon' | 'beta';
}

const CONNECTOR_CATALOG: ConnectorType[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication & notifications',
    category: 'Communication',
    icon: '💬',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Team collaboration & meetings',
    category: 'Communication',
    icon: '👥',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Project & issue tracking',
    category: 'Project Management',
    icon: '📋',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Work management platform',
    category: 'Project Management',
    icon: '✅',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Calendar integration',
    category: 'Productivity',
    icon: '📅',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM integration',
    category: 'CRM',
    icon: '☁️',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Marketing & sales platform',
    category: 'CRM',
    icon: '🧲',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automation workflows',
    category: 'Automation',
    icon: '⚡',
    auth_type: 'api_key',
    status: 'available',
  },
  {
    id: 'power_automate',
    name: 'Power Automate',
    description: 'Microsoft automation',
    category: 'Automation',
    icon: '🔄',
    auth_type: 'oauth',
    status: 'beta',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Code repository',
    category: 'Development',
    icon: '🐙',
    auth_type: 'oauth',
    status: 'available',
  },
  {
    id: 'azure_devops',
    name: 'Azure DevOps',
    description: 'Development lifecycle',
    category: 'Development',
    icon: '🔷',
    auth_type: 'oauth',
    status: 'coming_soon',
  },
  {
    id: 'aws_s3',
    name: 'AWS S3',
    description: 'Cloud storage',
    category: 'Storage',
    icon: '📦',
    auth_type: 'api_key',
    status: 'available',
  },
];

const WEBHOOK_EVENTS = [
  { id: 'project.created', label: 'Project Created' },
  { id: 'project.updated', label: 'Project Updated' },
  { id: 'project.deleted', label: 'Project Deleted' },
  { id: 'initiative.created', label: 'Initiative Created' },
  { id: 'initiative.status_changed', label: 'Initiative Status Changed' },
  { id: 'task.created', label: 'Task Created' },
  { id: 'task.completed', label: 'Task Completed' },
  { id: 'assessment.completed', label: 'Assessment Completed' },
  { id: 'report.generated', label: 'Report Generated' },
  { id: 'user.invited', label: 'User Invited' },
  { id: 'user.joined', label: 'User Joined' },
];

const CATALOG_CONNECT_UNAVAILABLE =
  'Connector setup is not wired from this catalog yet. Existing integrations and webhook reads remain available.';

const WEBHOOK_MUTATION_UNAVAILABLE =
  'Webhook create, test, and delete actions are disabled until duplicate superadmin webhook routes are reconciled behind one audited backend workflow.';

const STATUS_CONFIG = {
  connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle },
  disconnected: {
    color: 'text-slate-600 dark:text-slate-500',
    bg: 'bg-slate-500/20',
    icon: Unlink,
  },
  error: { color: 'text-danger-400', bg: 'bg-danger-500/20', icon: XCircle },
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Clock },
};

export const EnterpriseIntegrationsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks' | 'catalog'>(
    'integrations'
  );
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [connectorCatalog, setConnectorCatalog] = useState<ConnectorType[]>(CONNECTOR_CATALOG);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadErrors, setLoadErrors] = useState<Record<string, string | null>>({});
  const [deliveryLoadError, setDeliveryLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, integrations: null }));
      const data = await Api.getSystemIntegrations();
      const normalized = normalizeIntegrations(data);
      setIntegrations(normalized);
      return normalized;
    } catch (error) {
      setLoadErrors((prev) => ({
        ...prev,
        integrations: normalizeApiErrorMessage(error, 'Failed to fetch integrations'),
      }));
      setIntegrations([]);
      return null;
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, webhooks: null }));
      const data = await Api.getSystemWebhooks();
      const normalized = normalizeWebhooks(data);
      setWebhooks(normalized);
      return normalized;
    } catch (error: unknown) {
      setLoadErrors((prev) => ({
        ...prev,
        webhooks: normalizeApiErrorMessage(error, 'Failed to fetch webhooks'),
      }));
      setWebhooks([]);
      return null;
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await Api.get('/superadmin/integrations/catalog');
      const payload = data?.data ?? data;
      if (payload?.connectors?.length) {
        setConnectorCatalog(payload.connectors);
        setCatalogNotice(null);
      }
    } catch {
      setCatalogNotice(
        'Live connector catalog is unavailable. Showing bundled connector definitions.'
      );
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchIntegrations(), fetchWebhooks(), fetchCatalog()]);
      setLoading(false);
    };
    loadData();
  }, [fetchCatalog, fetchIntegrations, fetchWebhooks]);

  const handleSync = async (provider: string) => {
    try {
      await Api.refreshSystemIntegration(provider);
      const refreshed = await fetchIntegrations();
      if (!refreshed?.some((integration) => integration.type === provider)) {
        throw new Error('Integration sync was not confirmed by the server');
      }
      toast.success('Sync started');
    } catch (error) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to start sync'));
    }
  };

  const handleDeleteIntegration = async (provider: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      const target = integrations.find((integration) => integration.type === provider);
      await Api.deleteSystemIntegration(provider);
      const refreshed = await fetchIntegrations();
      if (!refreshed || refreshed.some((integration) => integration.id === target?.id)) {
        throw new Error('Integration disconnect was not confirmed by the server');
      }
      toast.success('Integration disconnected');
    } catch (error) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to disconnect integration'));
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDeliveryLoadError(null);
    try {
      const data = await Api.getSystemWebhookDeliveries(webhook.id);
      setDeliveries(normalizeDeliveries(data));
    } catch (error) {
      setDeliveryLoadError(normalizeApiErrorMessage(error, 'Failed to fetch webhook deliveries'));
      setDeliveries([]);
    }
  };

  const filteredCatalog = connectorCatalog.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || c.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(connectorCatalog.map((c) => c.category))];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Integrations Hub
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Connect Consultify with your existing tools and workflows
          </p>
        </div>
      </div>

      {/* Stats */}
      {loadErrors.integrations || loadErrors.webhooks ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-navy-950/20">
          <DegradedState
            title="Integration overview unavailable"
            description={
              loadErrors.integrations || loadErrors.webhooks || 'Failed to fetch integrations'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="text-sm text-slate-600 dark:text-slate-400">Connected</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {integrations.filter((i) => normalizeStatus(i.status) === 'connected').length}
            </div>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <div className="text-sm text-slate-600 dark:text-slate-400">Active Webhooks</div>
            <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {webhooks.filter((w) => Boolean(w.is_active)).length}
            </div>
          </div>
          <div className="p-4 bg-danger-500/10 rounded-xl border border-danger-500/30">
            <div className="text-sm text-slate-600 dark:text-slate-400">Errors</div>
            <div className="text-2xl font-semibold text-danger-700 dark:text-danger-400">
              {integrations.filter((i) => normalizeStatus(i.status) === 'error').length}
            </div>
          </div>
          <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="text-sm text-slate-600 dark:text-slate-400">Available</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {connectorCatalog.filter((c) => c.status === 'available').length}
            </div>
          </div>
        </div>
      )}

      {catalogNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {catalogNotice}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
        {[
          {
            id: 'integrations',
            label: 'Connected',
            icon: Link,
            count: loadErrors.integrations ? '!' : integrations.length,
          },
          {
            id: 'webhooks',
            label: 'Webhooks',
            icon: Webhook,
            count: loadErrors.webhooks ? '!' : webhooks.length,
          },
          { id: 'catalog', label: 'Catalog', icon: Globe, count: connectorCatalog.length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'integrations' | 'webhooks' | 'catalog')}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-slate-100 border-b-2 border-primary-500'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState template="card" count={6} />
      ) : (
        <>
          {/* Connected Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  Connected Integrations
                </h3>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Integration
                </button>
              </div>

              {loadErrors.integrations ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-navy-950/20">
                  <DegradedState
                    title="Connected integrations unavailable"
                    description={loadErrors.integrations}
                  />
                </div>
              ) : integrations.length === 0 ? (
                <div className="text-center py-12 text-slate-600 dark:text-slate-500">
                  <Link className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No integrations connected</p>
                  <p className="text-sm mt-1">Browse the catalog to add your first integration</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {integrations.map((integration) => {
                    const status = normalizeStatus(integration.status);
                    const statusConfig = STATUS_CONFIG[status];
                    const StatusIcon = statusConfig.icon;
                    const connector = connectorCatalog.find((c) => c.id === integration.type);

                    return (
                      <div
                        key={integration.id}
                        className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">{connector?.icon || '🔗'}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {asText(integration.name, 'Unknown integration')}
                                </span>
                                <span
                                  className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${statusConfig.bg} ${statusConfig.color}`}
                                >
                                  <StatusIcon className="w-3 h-3" />
                                  {status}
                                </span>
                              </div>
                              {integration.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {asText(integration.description, '')}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {integration.last_sync_at && (
                                  <span>Last sync: {formatDateTime(integration.last_sync_at)}</span>
                                )}
                                {integration.sync_frequency && (
                                  <span>• {asText(integration.sync_frequency, 'unknown')}</span>
                                )}
                              </div>
                              {integration.error_message && (
                                <div className="flex items-center gap-1 text-xs text-danger-400 mt-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {asText(integration.error_message, 'Unknown integration error')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSync(integration.type)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                              title="Sync now"
                            >
                              <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                            </button>
                            <button
                              disabled
                              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                              title="Integration settings editing requires an audited configuration workflow"
                            >
                              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteIntegration(integration.type)}
                              className="p-2 hover:bg-danger-500/20 rounded-lg transition-colors"
                              title="Disconnect"
                            >
                              <Unlink className="w-4 h-4 text-danger-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Webhooks</h3>
                <button
                  disabled
                  title={loadErrors.webhooks || WEBHOOK_MUTATION_UNAVAILABLE}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Webhook
                </button>
              </div>

              {loadErrors.webhooks ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-navy-950/20">
                  <DegradedState title="Webhooks unavailable" description={loadErrors.webhooks} />
                </div>
              ) : (
                <>
                  <ReadOnlyState
                    title="Webhook mutations unavailable"
                    description={WEBHOOK_MUTATION_UNAVAILABLE}
                  />

                  {webhooks.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 dark:text-slate-500">
                      <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No webhooks configured</p>
                      <p className="text-sm mt-1">
                        Existing webhook reads are available when the backend returns data.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {asText(webhook.name, 'Unnamed webhook')}
                                </span>
                                {webhook.is_active ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-danger-400" />
                                )}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 break-all">
                                {asText(webhook.url, 'Unknown URL')}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {asArray<string>(webhook.events).map((event) => (
                                  <span
                                    key={event}
                                    className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded"
                                  >
                                    {WEBHOOK_EVENTS.find((e) => e.id === event)?.label ||
                                      asText(event, 'unknown')}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mt-2">
                                <span className="text-emerald-400">
                                  ✓ {safeNumber(webhook.success_count)}
                                </span>
                                <span className="text-danger-400">
                                  ✗ {safeNumber(webhook.failure_count)}
                                </span>
                                {webhook.last_triggered_at && (
                                  <span>Last: {formatDateTime(webhook.last_triggered_at)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                disabled
                                className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                                title={WEBHOOK_MUTATION_UNAVAILABLE}
                              >
                                <Play className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleViewDeliveries(webhook)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                                title="View deliveries"
                              >
                                <Activity className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                              </button>
                              <button
                                disabled
                                className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                                title={WEBHOOK_MUTATION_UNAVAILABLE}
                              >
                                <Trash2 className="w-4 h-4 text-danger-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Catalog Tab */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                {CATALOG_CONNECT_UNAVAILABLE}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search connectors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((connector) => {
                  const isConnected = integrations.some((i) => i.type === connector.id);
                  return (
                    <div
                      key={connector.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        isConnected
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{connector.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {connector.name}
                              </span>
                              {connector.status === 'beta' && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                                  Beta
                                </span>
                              )}
                              {connector.status === 'coming_soon' && (
                                <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-navy-800/20 text-slate-600 dark:text-slate-500 rounded">
                                  Planned
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {connector.category}
                            </span>
                          </div>
                        </div>
                        {isConnected && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        {connector.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Lock className="w-3 h-3" />
                          {connector.auth_type === 'oauth'
                            ? 'OAuth'
                            : connector.auth_type === 'api_key'
                              ? 'API Key'
                              : connector.auth_type === 'basic'
                                ? 'Basic Auth'
                                : 'None'}
                        </div>
                        {connector.status === 'available' && (
                          <button
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              isConnected
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                            }`}
                            disabled
                            title={isConnected ? 'Already connected' : CATALOG_CONNECT_UNAVAILABLE}
                          >
                            {isConnected ? 'Connected' : 'Unavailable'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Deliveries Modal */}
      {selectedWebhook && (
        <DeliveriesModal
          webhook={selectedWebhook}
          deliveries={deliveries}
          onClose={() => {
            setSelectedWebhook(null);
            setDeliveries([]);
            setDeliveryLoadError(null);
          }}
          loadError={deliveryLoadError}
        />
      )}
    </div>
  );
};

// Deliveries Modal
const DeliveriesModal: React.FC<{
  webhook: Webhook;
  deliveries: WebhookDelivery[];
  loadError?: string | null;
  onClose: () => void;
}> = ({ webhook, deliveries, loadError, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Webhook Deliveries</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">
            {asText(webhook.name, 'Unnamed webhook')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
        >
          <X className="w-5 h-5 text-slate-600 dark:text-slate-500" />
        </button>
      </div>

      {loadError ? (
        <DegradedState title="Webhook deliveries unavailable" description={loadError} />
      ) : deliveries.length === 0 ? (
        <div className="text-center py-8 text-slate-600 dark:text-slate-500">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No deliveries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="p-3 bg-slate-50/30 dark:bg-navy-950/20 rounded-lg border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {delivery.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : delivery.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-danger-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-sm text-slate-900 dark:text-white">
                    {asText(delivery.event_type, 'unknown')}
                  </span>
                  {delivery.response_code && (
                    <span
                      className={`text-xs ${
                        delivery.response_code < 300 ? 'text-emerald-400' : 'text-danger-400'
                      }`}
                    >
                      HTTP {delivery.response_code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(delivery.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default EnterpriseIntegrationsHub;
