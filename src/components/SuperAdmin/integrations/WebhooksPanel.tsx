/**
 * WebhooksPanel - Webhook Management
 *
 * Features:
 * - Webhook endpoints list
 * - Event type selector
 * - Delivery logs with retry
 * - Test webhook button
 */

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { WebhookDeliveriesModal } from './WebhookDeliveriesModal';

interface WebhookConfig {
  id: string;
  organization_id: string;
  organization_name?: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  is_active: number;
  headers?: Record<string, string>;
  retry_count: number;
  timeout_ms: number;
  last_delivery_at?: string;
  last_delivery_status?: string;
  created_at: string;
  updated_at: string;
}

interface Organization {
  id: string;
  name: string;
}

const AVAILABLE_EVENTS = [
  { id: 'user.created', label: 'User Created' },
  { id: 'user.updated', label: 'User Updated' },
  { id: 'user.deleted', label: 'User Deleted' },
  { id: 'project.created', label: 'Project Created' },
  { id: 'project.updated', label: 'Project Updated' },
  { id: 'project.completed', label: 'Project Completed' },
  { id: 'task.created', label: 'Task Created' },
  { id: 'task.updated', label: 'Task Updated' },
  { id: 'task.completed', label: 'Task Completed' },
  { id: 'invoice.created', label: 'Invoice Created' },
  { id: 'invoice.paid', label: 'Invoice Paid' },
  { id: 'subscription.created', label: 'Subscription Created' },
  { id: 'subscription.canceled', label: 'Subscription Canceled' },
  { id: 'ai.request.completed', label: 'AI Request Completed' },
  { id: 'ai.tokens.threshold', label: 'AI Tokens Threshold' },
];

export const WebhooksPanel: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    organizationId: '',
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    retryCount: 3,
    timeoutMs: 30000,
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [webhooksResult, orgsResult] = await Promise.all([
        Api.get(`/settings/webhooks${filterOrgId ? `?organizationId=${filterOrgId}` : ''}`),
        Api.getOrganizations(),
      ]);
      setWebhooks(webhooksResult.webhooks || webhooksResult || []);
      setOrganizations(orgsResult || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, [filterOrgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateWebhook = async () => {
    if (
      !formData.organizationId ||
      !formData.name ||
      !formData.url ||
      formData.events.length === 0
    ) {
      toast.error('Please fill in all required fields and select at least one event');
      return;
    }

    setSaving(true);
    try {
      if (editingWebhook) {
        await Api.put(`/settings/webhooks/${editingWebhook.id}`, formData);
        toast.success('Webhook updated');
      } else {
        await Api.post('/settings/webhooks', formData);
        toast.success('Webhook created');
      }
      setShowCreateModal(false);
      setEditingWebhook(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    setDeletingIds((prev) => new Set(prev).add(webhookId));
    try {
      await Api.delete(`/settings/webhooks/${webhookId}`);
      toast.success('Webhook deleted');
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete webhook');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(webhookId);
        return next;
      });
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingIds((prev) => new Set(prev).add(webhookId));
    try {
      await Api.post(`/settings/webhooks/${webhookId}/test`, {});
      toast.success('Test webhook sent');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test webhook';
      toast.error(errorMessage);
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(webhookId);
        return next;
      });
    }
  };

  const handleToggleWebhook = async (webhook: WebhookConfig) => {
    try {
      await Api.put(`/settings/webhooks/${webhook.id}`, { isActive: !webhook.is_active });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? { ...w, is_active: w.is_active ? 0 : 1 } : w))
      );
      toast.success(`Webhook ${webhook.is_active ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle webhook');
    }
  };

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormData({
      organizationId: webhook.organization_id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events || [],
      retryCount: webhook.retry_count,
      timeoutMs: webhook.timeout_ms,
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      organizationId: '',
      name: '',
      url: '',
      secret: '',
      events: [],
      retryCount: 3,
      timeoutMs: 30000,
    });
  };

  const filteredWebhooks = webhooks.filter((webhook) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      webhook.name.toLowerCase().includes(query) ||
      webhook.url.toLowerCase().includes(query) ||
      webhook.organization_name?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (webhook: WebhookConfig) => {
    if (!webhook.is_active) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 dark:bg-navy-800/300/20 text-slate-600 dark:text-slate-500">
          <XCircle size={14} />
          Disabled
        </span>
      );
    }

    if (webhook.last_delivery_status === 'success') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 size={14} />
          Active
        </span>
      );
    }

    if (webhook.last_delivery_status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger-500/20 text-danger-400">
          <AlertTriangle size={14} />
          Failing
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
        <Clock size={14} />
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder="Search webhooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none w-64"
            />
          </div>

          <select
            value={filterOrgId}
            onChange={(e) => setFilterOrgId(e.target.value)}
            className="px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingWebhook(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-white font-medium transition-colors"
          >
            <Plus size={18} />
            Create Webhook
          </button>
        </div>
      </div>

      {/* Webhooks List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredWebhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Webhook size={48} className="mb-4 opacity-50" />
          <p>No webhooks configured</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWebhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{webhook.name}</h3>
                    {getStatusBadge(webhook)}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-500 mb-3">
                    <ExternalLink size={14} />
                    <code className="px-2 py-0.5 bg-slate-900/50 rounded font-mono text-xs break-all">
                      {webhook.url}
                    </code>
                  </div>

                  {webhook.organization_name && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-3">
                      <Building2 size={14} />
                      <span>{webhook.organization_name}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {webhook.events?.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-xs"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  {webhook.last_delivery_at && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      Last delivery: {new Date(webhook.last_delivery_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingDeliveries(webhook.id)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="View Deliveries"
                  >
                    <Activity size={16} className="text-slate-600 dark:text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingIds.has(webhook.id)}
                    className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Send Test"
                  >
                    {testingIds.has(webhook.id) ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleWebhook(webhook)}
                    className={`p-2 rounded-lg transition-colors ${
                      webhook.is_active
                        ? 'hover:bg-amber-500/10 text-amber-400'
                        : 'hover:bg-emerald-500/10 text-emerald-400'
                    }`}
                    title={webhook.is_active ? 'Disable' : 'Enable'}
                  >
                    {webhook.is_active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} className="text-slate-600 dark:text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    disabled={deletingIds.has(webhook.id)}
                    className="p-2 hover:bg-danger-500/10 text-danger-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingIds.has(webhook.id) ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-6">
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Organization
                </label>
                <select
                  value={formData.organizationId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, organizationId: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="My Webhook"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/webhook"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Secret (optional)
                </label>
                <input
                  type="password"
                  value={formData.secret}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
                  placeholder="Signing secret for verification"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Events</label>
                <div className="max-h-48 overflow-y-auto bg-slate-800/50 rounded-lg p-3 space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              events: [...prev.events, event.id],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              events: prev.events.filter((e) => e !== event.id),
                            }));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-white">
                        {event.label}
                      </span>
                      <code className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                        {event.id}
                      </code>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Retry Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.retryCount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, retryCount: parseInt(e.target.value) }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    value={formData.timeoutMs}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, timeoutMs: parseInt(e.target.value) }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:border-primary-500/50 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingWebhook(null);
                  resetForm();
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWebhook}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {editingWebhook ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Modal */}
      {viewingDeliveries && (
        <WebhookDeliveriesModal
          webhookId={viewingDeliveries}
          onClose={() => setViewingDeliveries(null)}
        />
      )}
    </div>
  );
};

export default WebhooksPanel;
