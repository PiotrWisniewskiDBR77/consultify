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
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Link,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Unlink,
  Webhook,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

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
  config: any;
  error_message?: string;
  created_at: string;
}

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

const STATUS_CONFIG = {
  connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle },
  disconnected: {
    color: 'text-slate-400 dark:text-slate-500',
    bg: 'bg-slate-500/20',
    icon: Unlink,
  },
  error: { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Clock },
};

export const EnterpriseIntegrationsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks' | 'catalog'>(
    'integrations'
  );
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await Api.getSystemIntegrations();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      setIntegrations([]);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await Api.getSystemWebhooks();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
      setWebhooks([]);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchIntegrations(), fetchWebhooks()]);
      setLoading(false);
    };
    loadData();
  }, [fetchIntegrations, fetchWebhooks]);

  const handleSync = async (id: string) => {
    try {
      await Api.refreshSystemIntegration(id);
      toast.success('Sync started');
      fetchIntegrations();
    } catch (error) {
      toast.error('Failed to start sync');
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      await Api.deleteSystemIntegration(id);
      toast.success('Integration disconnected');
      fetchIntegrations();
    } catch (error) {
      toast.error('Failed to disconnect integration');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await Api.deleteSystemWebhook(id);
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await Api.testSystemWebhook(id);
      toast.success('Test webhook sent');
    } catch (error) {
      toast.error('Failed to send test webhook');
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    try {
      const data = await Api.getSystemWebhookDeliveries(webhook.id);
      setDeliveries(data);
    } catch (error) {
      setDeliveries([]);
    }
  };

  const filteredCatalog = CONNECTOR_CATALOG.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || c.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(CONNECTOR_CATALOG.map((c) => c.category))];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Integrations Hub</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Connect Consultinity with your existing tools and workflows
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10">
          <div className="text-sm text-slate-400 dark:text-slate-500">Connected</div>
          <div className="text-2xl font-bold text-white">
            {integrations.filter((i) => i.status === 'connected').length}
          </div>
        </div>
        <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
          <div className="text-sm text-slate-400 dark:text-slate-500">Active Webhooks</div>
          <div className="text-2xl font-bold text-emerald-400">
            {webhooks.filter((w) => w.is_active).length}
          </div>
        </div>
        <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
          <div className="text-sm text-slate-400 dark:text-slate-500">Errors</div>
          <div className="text-2xl font-bold text-red-400">
            {integrations.filter((i) => i.status === 'error').length}
          </div>
        </div>
        <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
          <div className="text-sm text-slate-400 dark:text-slate-500">Available</div>
          <div className="text-2xl font-bold text-cyan-400">
            {CONNECTOR_CATALOG.filter((c) => c.status === 'available').length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-1">
        {[
          { id: 'integrations', label: 'Connected', icon: Link, count: integrations.length },
          { id: 'webhooks', label: 'Webhooks', icon: Webhook, count: webhooks.length },
          { id: 'catalog', label: 'Catalog', icon: Globe, count: CONNECTOR_CATALOG.length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-white/10 text-white border-b-2 border-cyan-500'
                : 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded">{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Connected Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Connected Integrations</h3>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Integration
                </button>
              </div>

              {integrations.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <Link className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No integrations connected</p>
                  <p className="text-sm mt-1">Browse the catalog to add your first integration</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {integrations.map((integration) => {
                    const statusConfig = STATUS_CONFIG[integration.status];
                    const StatusIcon = statusConfig.icon;
                    const connector = CONNECTOR_CATALOG.find((c) => c.id === integration.type);

                    return (
                      <div
                        key={integration.id}
                        className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">{connector?.icon || '🔗'}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{integration.name}</span>
                                <span
                                  className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${statusConfig.bg} ${statusConfig.color}`}
                                >
                                  <StatusIcon className="w-3 h-3" />
                                  {integration.status}
                                </span>
                              </div>
                              {integration.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                  {integration.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {integration.last_sync_at && (
                                  <span>
                                    Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                                  </span>
                                )}
                                {integration.sync_frequency && (
                                  <span>• {integration.sync_frequency}</span>
                                )}
                              </div>
                              {integration.error_message && (
                                <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {integration.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSync(integration.id)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                              title="Sync now"
                            >
                              <RefreshCw className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </button>
                            <button
                              onClick={() => setSelectedIntegration(integration)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                              title="Settings"
                            >
                              <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteIntegration(integration.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Disconnect"
                            >
                              <Unlink className="w-4 h-4 text-red-400" />
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
                <h3 className="text-lg font-medium text-white">Webhooks</h3>
                <button
                  onClick={() => setShowAddWebhook(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Webhook
                </button>
              </div>

              {webhooks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured</p>
                  <p className="text-sm mt-1">
                    Create a webhook to receive real-time notifications
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{webhook.name}</span>
                            {webhook.is_active ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 break-all">
                            {webhook.url}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {webhook.events.map((event) => (
                              <span
                                key={event}
                                className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
                              >
                                {WEBHOOK_EVENTS.find((e) => e.id === event)?.label || event}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                            <span className="text-emerald-400">✓ {webhook.success_count}</span>
                            <span className="text-red-400">✗ {webhook.failure_count}</span>
                            {webhook.last_triggered_at && (
                              <span>
                                Last: {new Date(webhook.last_triggered_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestWebhook(webhook.id)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                            title="Test"
                          >
                            <Play className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </button>
                          <button
                            onClick={() => handleViewDeliveries(webhook)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                            title="View deliveries"
                          >
                            <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Catalog Tab */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
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
                    className="w-full pl-10 pr-4 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white"
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
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{connector.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{connector.name}</span>
                              {connector.status === 'beta' && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                                  Beta
                                </span>
                              )}
                              {connector.status === 'coming_soon' && (
                                <span className="px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-navy-800/300/20 text-slate-400 dark:text-slate-500 rounded">
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
                      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
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
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            }`}
                            disabled={isConnected}
                          >
                            {isConnected ? 'Connected' : 'Connect'}
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

      {/* Webhook Create/Edit Modal */}
      {showAddWebhook && (
        <WebhookModal
          onClose={() => setShowAddWebhook(false)}
          onSave={() => {
            fetchWebhooks();
            setShowAddWebhook(false);
          }}
          events={WEBHOOK_EVENTS}
        />
      )}

      {/* Deliveries Modal */}
      {selectedWebhook && (
        <DeliveriesModal
          webhook={selectedWebhook}
          deliveries={deliveries}
          onClose={() => {
            setSelectedWebhook(null);
            setDeliveries([]);
          }}
        />
      )}
    </div>
  );
};

// Webhook Modal
const WebhookModal: React.FC<{
  onClose: () => void;
  onSave: () => void;
  events: { id: string; label: string }[];
}> = ({ onClose, onSave, events }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Api.createWebhook({ ...formData, organization_id: 'current', is_active: true });
      toast.success('Webhook created');
      onSave();
    } catch (error) {
      toast.error('Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Create Webhook</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white"
              placeholder="My Webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">URL *</label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white"
              placeholder="https://api.example.com/webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Secret (for signature verification)
            </label>
            <input
              type="text"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white"
              placeholder="Optional secret key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Events *</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-800/50 rounded-lg">
              {events.map((event) => (
                <label key={event.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, events: [...formData.events, event.id] });
                      } else {
                        setFormData({
                          ...formData,
                          events: formData.events.filter((id) => id !== event.id),
                        });
                      }
                    }}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500"
                  />
                  <span className="text-sm text-slate-300">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || formData.events.length === 0}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Deliveries Modal
const DeliveriesModal: React.FC<{
  webhook: Webhook;
  deliveries: WebhookDelivery[];
  onClose: () => void;
}> = ({ webhook, deliveries, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Webhook Deliveries</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500">{webhook.name}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
        >
          <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </button>
      </div>

      {deliveries.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No deliveries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="p-3 bg-slate-50/30 dark:bg-navy-950/20 rounded-lg border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {delivery.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : delivery.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-sm text-white">{delivery.event_type}</span>
                  {delivery.response_code && (
                    <span
                      className={`text-xs ${
                        delivery.response_code < 300 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      HTTP {delivery.response_code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(delivery.created_at).toLocaleString()}
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
