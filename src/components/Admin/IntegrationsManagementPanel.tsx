/**
 * IntegrationsManagementPanel - Webhooks & Third-party Integrations
 *
 * Features:
 * - Webhooks management
 * - Connected apps (Slack, Jira, etc.)
 * - OAuth connections status
 * - Sync status dashboard
 */

import { motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Webhook,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ReadOnlyState } from '../Admin/AdminState';
import { InfoButton } from '../shared/InfoButton';

// Types
interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastTriggered: string | null;
  lastStatus: 'success' | 'failed' | 'pending' | null;
  createdAt: string;
  failureCount: number;
}

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string | null;
  category: 'communication' | 'project' | 'storage' | 'calendar' | 'crm';
}

// Available webhook events
const WEBHOOK_EVENTS = [
  { id: 'project.created', label: 'Project Created', category: 'Projects' },
  { id: 'project.updated', label: 'Project Updated', category: 'Projects' },
  { id: 'project.deleted', label: 'Project Deleted', category: 'Projects' },
  { id: 'task.created', label: 'Task Created', category: 'Tasks' },
  { id: 'task.updated', label: 'Task Updated', category: 'Tasks' },
  { id: 'task.completed', label: 'Task Completed', category: 'Tasks' },
  { id: 'task.deleted', label: 'Task Deleted', category: 'Tasks' },
  { id: 'user.invited', label: 'User Invited', category: 'Users' },
  { id: 'user.joined', label: 'User Joined', category: 'Users' },
  { id: 'user.removed', label: 'User Removed', category: 'Users' },
  { id: 'comment.created', label: 'Comment Created', category: 'Comments' },
  { id: 'document.uploaded', label: 'Document Uploaded', category: 'Documents' },
];

// Available integrations
const AVAILABLE_INTEGRATIONS: ConnectedApp[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Send notifications to Slack channels',
    status: 'disconnected',
    lastSync: null,
    category: 'communication',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '👥',
    description: 'Integrate with Microsoft Teams',
    status: 'disconnected',
    lastSync: null,
    category: 'communication',
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: '🔷',
    description: 'Sync issues with Jira',
    status: 'disconnected',
    lastSync: null,
    category: 'project',
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: '🎯',
    description: 'Import/export tasks from Asana',
    status: 'disconnected',
    lastSync: null,
    category: 'project',
  },
  {
    id: 'trello',
    name: 'Trello',
    icon: '📋',
    description: 'Sync boards with Trello',
    status: 'disconnected',
    lastSync: null,
    category: 'project',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    description: 'Attach files from Google Drive',
    status: 'disconnected',
    lastSync: null,
    category: 'storage',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    description: 'Connect Dropbox for file storage',
    status: 'disconnected',
    lastSync: null,
    category: 'storage',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Sync deadlines with Calendar',
    status: 'disconnected',
    lastSync: null,
    category: 'calendar',
  },
  {
    id: 'outlook',
    name: 'Outlook Calendar',
    icon: '📆',
    description: 'Sync with Outlook Calendar',
    status: 'disconnected',
    lastSync: null,
    category: 'calendar',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🧡',
    description: 'Sync contacts and deals',
    status: 'disconnected',
    lastSync: null,
    category: 'crm',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    description: 'Connect to Salesforce CRM',
    status: 'disconnected',
    lastSync: null,
    category: 'crm',
  },
];

const WEBHOOK_MUTATION_UNAVAILABLE =
  'Webhook create, edit, test, enable, disable, and delete actions are disabled until tenant admin webhook routes persist data and expose read-back.';

const APP_CONNECT_UNAVAILABLE =
  'Integration connect and disconnect actions are disabled until OAuth/provider status is wired to the tenant admin backend.';

interface IntegrationsManagementPanelProps {
  className?: string;
}

export const IntegrationsManagementPanel: React.FC<IntegrationsManagementPanelProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'webhooks' | 'apps'>('webhooks');
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [apps] = useState<ConnectedApp[]>(AVAILABLE_INTEGRATIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    isActive: true,
  });

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, fetch from API
      // const webhooksData = await Api.getWebhooks(currentOrganization?.id);
      // const appsData = await Api.getConnectedApps(currentOrganization?.id);
    } catch {
      toast.error(t('admin.integrations.loadError', 'Failed to load integrations'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter webhooks
  const filteredWebhooks = webhooks.filter(
    (wh) =>
      wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter apps
  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Start creating webhook
  const startCreating = () => {
    setSelectedWebhook(null);
    setFormData({
      name: '',
      url: '',
      events: [],
      isActive: true,
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  // Start editing webhook
  const startEditing = (webhook: WebhookEndpoint) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  // Toggle event selection
  const toggleEvent = (eventId: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  // Save webhook
  const saveWebhook = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error(t('admin.integrations.requiredFields', 'Name and URL are required'));
      return;
    }

    if (formData.events.length === 0) {
      toast.error(t('admin.integrations.selectEvents', 'Select at least one event'));
      return;
    }

    try {
      if (isCreating) {
        const newWebhook: WebhookEndpoint = {
          id: `wh_${Date.now()}`,
          name: formData.name,
          url: formData.url,
          secret: `whsec_${Math.random().toString(36).substring(2, 15)}`,
          events: formData.events,
          isActive: formData.isActive,
          lastTriggered: null,
          lastStatus: null,
          createdAt: new Date().toISOString(),
          failureCount: 0,
        };
        setWebhooks((prev) => [...prev, newWebhook]);
        toast.success(t('admin.integrations.webhookCreated', 'Webhook created'));
      } else if (selectedWebhook) {
        setWebhooks((prev) =>
          prev.map((wh) => (wh.id === selectedWebhook.id ? { ...wh, ...formData } : wh))
        );
        toast.success(t('admin.integrations.webhookUpdated', 'Webhook updated'));
      }

      setIsCreating(false);
      setIsEditing(false);
      setSelectedWebhook(null);
    } catch {
      toast.error(t('admin.integrations.saveError', 'Failed to save webhook'));
    }
  };

  // Delete webhook
  const deleteWebhook = (webhook: WebhookEndpoint) => {
    setWebhooks((prev) => prev.filter((wh) => wh.id !== webhook.id));
    toast.success(t('admin.integrations.webhookDeleted', 'Webhook deleted'));
  };

  // Toggle webhook active state
  const toggleWebhookActive = (webhook: WebhookEndpoint) => {
    setWebhooks((prev) =>
      prev.map((wh) => (wh.id === webhook.id ? { ...wh, isActive: !wh.isActive } : wh))
    );
    toast.success(
      webhook.isActive
        ? t('admin.integrations.webhookDisabled', 'Webhook disabled')
        : t('admin.integrations.webhookEnabled', 'Webhook enabled')
    );
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedWebhook(null);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  // Render webhook card
  const renderWebhookCard = (webhook: WebhookEndpoint) => {
    return (
      <motion.div
        key={webhook.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg ${
                webhook.isActive
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <Webhook
                className={
                  webhook.isActive ? 'text-green-500' : 'text-slate-400 dark:text-slate-500'
                }
                size={20}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{webhook.name}</h3>
                {webhook.isActive ? (
                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono truncate max-w-md">
                {webhook.url}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Zap size={12} />
                  {webhook.events.length} events
                </span>
                {webhook.lastTriggered && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    Last: {new Date(webhook.lastTriggered).toLocaleString()}
                  </span>
                )}
                {webhook.lastStatus && (
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      webhook.lastStatus === 'success' ? 'text-green-500' : 'text-rose-500'
                    }`}
                  >
                    {webhook.lastStatus === 'success' ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {webhook.lastStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title={WEBHOOK_MUTATION_UNAVAILABLE}
            >
              <Send size={16} />
            </button>
            <button
              onClick={() => toggleWebhookActive(webhook)}
              disabled
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title={WEBHOOK_MUTATION_UNAVAILABLE}
            >
              {webhook.isActive ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={() => startEditing(webhook)}
              disabled
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title={WEBHOOK_MUTATION_UNAVAILABLE}
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => deleteWebhook(webhook)}
              disabled
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title={WEBHOOK_MUTATION_UNAVAILABLE}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render app card
  const renderAppCard = (app: ConnectedApp) => {
    return (
      <motion.div
        key={app.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-navy-700 flex items-center justify-center text-2xl">
              {app.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{app.name}</h3>
                {app.status === 'connected' && (
                  <CheckCircle2 className="text-green-500" size={14} />
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{app.description}</p>
              {app.status === 'connected' && app.lastSync && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                  <RefreshCw size={12} />
                  Last sync: {new Date(app.lastSync).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div>
            {app.status === 'connected' ? (
              <button
                disabled
                title={APP_CONNECT_UNAVAILABLE}
                className="px-3 py-1.5 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              >
                {t('admin.integrations.disconnect', 'Disconnect')}
              </button>
            ) : (
              <button
                disabled
                title={APP_CONNECT_UNAVAILABLE}
                className="px-3 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                {t('admin.integrations.connect', 'Connect')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Render webhook editor
  const renderWebhookEditor = () => {
    const eventsByCategory = WEBHOOK_EVENTS.reduce(
      (acc, event) => {
        if (!acc[event.category]) acc[event.category] = [];
        acc[event.category].push(event);
        return acc;
      },
      {} as Record<string, typeof WEBHOOK_EVENTS>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isCreating
              ? t('admin.integrations.createWebhook', 'Create Webhook')
              : t('admin.integrations.editWebhook', 'Edit Webhook')}
          </h3>
          <button
            onClick={cancelEditing}
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.integrations.webhookName', 'Webhook Name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              placeholder={t('admin.integrations.webhookNamePlaceholder', 'My Webhook')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.integrations.endpointUrl', 'Endpoint URL')}
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
              placeholder="https://api.example.com/webhooks"
            />
          </div>

          {selectedWebhook?.secret && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.integrations.signingSecret', 'Signing Secret')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={selectedWebhook.secret}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                >
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={() => copyToClipboard(selectedWebhook.secret)}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('admin.integrations.events', 'Events')}
            </label>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {Object.entries(eventsByCategory).map(([category, events]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {events.map((event) => (
                      <label
                        key={event.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {event.label}
                        </span>
                        <code className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-navy-600 px-1.5 py-0.5 rounded">
                          {event.id}
                        </code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('admin.integrations.activateImmediately', 'Activate immediately')}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={saveWebhook}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Check size={16} />
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={cancelEditing}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('admin.integrations.title', 'Integrations')}
            </h2>
            <InfoButton cardId="admin-integrations" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.integrations.subtitle', 'Connect with external services and webhooks')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {activeTab === 'webhooks' && (
            <button
              onClick={startCreating}
              disabled
              title={WEBHOOK_MUTATION_UNAVAILABLE}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              {t('admin.integrations.addWebhook', 'Add Webhook')}
            </button>
          )}
        </div>
      </div>

      <ReadOnlyState
        title="Integrations are read-only"
        description={
          activeTab === 'webhooks' ? WEBHOOK_MUTATION_UNAVAILABLE : APP_CONNECT_UNAVAILABLE
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-navy-700">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'webhooks'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Webhook size={16} />
            {t('admin.integrations.webhooks', 'Webhooks')}
            <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 rounded">
              {webhooks.length}
            </span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('apps')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'apps'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Link2 size={16} />
            {t('admin.integrations.connectedApps', 'Connected Apps')}
            <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 rounded">
              {apps.filter((a) => a.status === 'connected').length}
            </span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.integrations.searchPlaceholder', 'Search integrations...')}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Items */}
          {activeTab === 'webhooks' ? (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="animate-spin mx-auto text-primary-500 mb-2" size={24} />
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('common.loading', 'Loading...')}
                  </p>
                </div>
              ) : filteredWebhooks.length > 0 ? (
                filteredWebhooks.map(renderWebhookCard)
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Webhook className="mx-auto mb-2 opacity-50" size={32} />
                  {t('admin.integrations.noWebhooks', 'No webhooks configured')}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredApps.map(renderAppCard)}
            </div>
          )}
        </div>

        {/* Editor Panel */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {isEditing || isCreating ? (
            renderWebhookEditor()
          ) : (
            <div className="text-center py-12">
              <Webhook className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('admin.integrations.selectOrCreate', 'Select or Create')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t(
                  'admin.integrations.selectOrCreateDesc',
                  'Select a webhook to edit or create a new one'
                )}
              </p>
              <button
                onClick={startCreating}
                disabled
                title={WEBHOOK_MUTATION_UNAVAILABLE}
                className="px-4 py-2 border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg flex items-center gap-2 mx-auto transition-colors"
              >
                <Plus size={16} />
                {t('admin.integrations.addWebhook', 'Add Webhook')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsManagementPanel;
