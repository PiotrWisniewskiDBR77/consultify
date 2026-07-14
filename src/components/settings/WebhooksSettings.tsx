/**
 * WebhooksSettings - Enhanced Webhook Management
 *
 * Features:
 * - Signature verification setup
 * - Retry logic configuration
 * - Event filtering rules builder
 * - Payload transformation editor (JSONPath)
 * - Testing playground
 * - Delivery status tracking with timeline
 * - Failed delivery alerts
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';
import { MetaChip, StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

interface WebhookConfig {
  id: string;
  name?: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
  lastStatus?: 'success' | 'failed';
  signatureSecret?: string;
  retryConfig?: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    retryDelays: number[];
  };
  filterRules?: {
    eventType?: string;
    conditions?: any[];
  };
  version?: string;
}

type WebhookApiRow = {
  id?: string;
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean | number;
  lastTriggeredAt?: string;
  lastStatus?: number;
  secret?: string;
  failureCount?: number;
  retryConfig?: string | WebhookConfig['retryConfig'];
  filterRules?: string | WebhookConfig['filterRules'];
};

interface DeliveryLog {
  id: string;
  event_type: string;
  status: string;
  response_code?: number;
  response_time_ms?: number;
  retry_count: number;
  error_message?: string;
  delivered_at?: string;
  created_at: string;
}

interface WebhooksSettingsProps {
  className?: string;
  currentUser?: unknown;
}

const AVAILABLE_EVENTS = [
  'task.created',
  'task.completed',
  'task.updated',
  'task.deleted',
  'initiative.created',
  'initiative.updated',
  'initiative.completed',
  'assessment.completed',
  'report.generated',
  'decision.created',
  'decision.approved',
  'decision.rejected',
  'user.joined',
  'user.left',
];

export const WebhooksSettings: React.FC<WebhooksSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryLog[]>>({});
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    signatureSecret: '',
    retryConfig: {
      maxRetries: 3,
      backoffStrategy: 'exponential' as 'linear' | 'exponential',
      retryDelays: [1000, 2000, 5000],
    },
    filterRules: {} as any,
  });

  // Settings form state
  const [webhookSettings, setWebhookSettings] = useState<
    Record<
      string,
      {
        signatureSecret: string;
        retryConfig: any;
        filterRules: any;
        version: string;
      }
    >
  >({});

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (selectedWebhook) {
      fetchDeliveries(selectedWebhook);
    }
  }, [selectedWebhook]);

  const parseObjectField = <T,>(value: unknown, fallback: T): T => {
    if (!value) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value as T;
  };

  const normalizeWebhookRows = (rows: unknown): WebhookConfig[] =>
    Array.isArray(rows)
      ? rows.map((s: WebhookApiRow) => ({
          id: String(s.id || ''),
          name: s.name,
          url: String(s.url || ''),
          events: Array.isArray(s.events) ? s.events : [],
          active: Boolean(s.isActive),
          lastTriggered: s.lastTriggeredAt,
          lastStatus:
            typeof s.lastStatus === 'number' && s.lastStatus >= 200 && s.lastStatus < 300
              ? 'success'
              : s.lastStatus
                ? 'failed'
                : undefined,
          signatureSecret: s.secret,
          failureCount: s.failureCount,
          retryConfig: parseObjectField(s.retryConfig, undefined),
          filterRules: parseObjectField(s.filterRules, undefined),
          version: '1.0',
        }))
      : [];

  const webhookMatchesCreate = (webhook: WebhookConfig, expected: typeof newWebhook) =>
    webhook.url === expected.url.trim() &&
    expected.events.every((event) => webhook.events.includes(event)) &&
    (!expected.name.trim() || webhook.name === expected.name.trim());

  const webhookSettingsMatch = (
    webhook: WebhookConfig | undefined,
    settings: {
      signatureSecret: string;
      retryConfig: WebhookConfig['retryConfig'];
      filterRules: WebhookConfig['filterRules'];
    }
  ) => {
    if (!webhook) return false;
    return (
      (webhook.signatureSecret || '') === (settings.signatureSecret || '') &&
      JSON.stringify(webhook.retryConfig || {}) === JSON.stringify(settings.retryConfig || {}) &&
      JSON.stringify(webhook.filterRules || {}) === JSON.stringify(settings.filterRules || {})
    );
  };

  const fetchWebhooks = async (): Promise<WebhookConfig[] | null> => {
    try {
      setLoadError(null);
      const response = await Api.get('/api/settings/webhooks');
      const webhookList = response?.data?.webhooks || [];
      const formatted = normalizeWebhookRows(webhookList);
      setWebhooks(formatted);

      // Initialize settings
      const settings: Record<string, any> = {};
      formatted.forEach((w: WebhookConfig) => {
        settings[w.id] = {
          signatureSecret: w.signatureSecret || '',
          retryConfig: w.retryConfig || {
            maxRetries: 3,
            backoffStrategy: 'exponential',
            retryDelays: [1000, 2000, 5000],
          },
          filterRules: w.filterRules || {},
          version: w.version || '1.0',
        };
      });
      setWebhookSettings(settings);
      return formatted;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load webhooks');
      setLoadError(message);
      setWebhooks([]);
      setWebhookSettings({});
      return null;
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      const response = await Api.get(`/api/webhooks/${encodeURIComponent(webhookId)}/deliveries`);
      const deliveryRows = Array.isArray(response?.data) ? response.data : [];

      setDeliveries((prev) => ({
        ...prev,
        [webhookId]: deliveryRows.map((delivery: any) => ({
          id: delivery.id,
          event_type: delivery.event_type || delivery.event || 'unknown',
          status: delivery.status || 'pending',
          response_code: delivery.response_code ?? delivery.status_code,
          response_time_ms: delivery.response_time_ms ?? delivery.duration_ms,
          retry_count: delivery.retry_count ?? delivery.attempts ?? 0,
          error_message: delivery.error_message,
          delivered_at: delivery.delivered_at,
          created_at: delivery.created_at || delivery.delivered_at || new Date().toISOString(),
        })),
      }));
    } catch (error) {
      console.error('Failed to fetch webhook deliveries:', error);
      toast.error(t('settings.webhooks.deliveriesError', 'Failed to load delivery history'));
      setDeliveries((prev) => ({ ...prev, [webhookId]: [] }));
    }
  };

  const createWebhook = async () => {
    if (!newWebhook.url.trim() || newWebhook.events.length === 0) {
      toast.error(t('settings.webhooks.fillRequired', 'Please fill all required fields'));
      return;
    }

    try {
      setActionError(null);
      const expected = {
        ...newWebhook,
        name: newWebhook.name.trim(),
        url: newWebhook.url.trim(),
      };
      await Api.post('/api/settings/webhooks', {
        name: expected.name || `Webhook ${Date.now()}`,
        url: expected.url,
        events: expected.events,
        secret: newWebhook.signatureSecret || undefined,
      });

      const refreshed = await fetchWebhooks();
      if (!refreshed?.some((webhook) => webhookMatchesCreate(webhook, expected))) {
        throw new Error('Webhook creation was not confirmed by the server');
      }

      toast.success(t('settings.webhooks.created', 'Webhook created'));
      setShowNew(false);
      setNewWebhook({
        name: '',
        url: '',
        events: [],
        signatureSecret: '',
        retryConfig: {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          retryDelays: [1000, 2000, 5000],
        },
        filterRules: {},
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.webhooks.createError', 'Failed to create webhook')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm(t('settings.webhooks.deleteConfirm', 'Delete this webhook?'))) return;

    try {
      setActionError(null);
      await Api.delete(`/api/settings/webhooks/${webhookId}`);
      const refreshed = await fetchWebhooks();
      if (!refreshed || refreshed.some((webhook) => webhook.id === webhookId)) {
        throw new Error('Webhook deletion was not confirmed by the server');
      }
      toast.success(t('settings.webhooks.deleted', 'Webhook deleted'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.webhooks.deleteError', 'Failed to delete')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const testWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    try {
      const response = await Api.post(`/api/settings/webhooks/${webhookId}/test`, {});

      if (response?.data?.success) {
        toast.success(t('settings.webhooks.testSent', 'Test event sent'));
      } else {
        toast.error(response?.data?.error || t('settings.webhooks.testFailed', 'Test failed'));
      }
    } catch (error) {
      toast.error(t('settings.webhooks.testError', 'Failed to send test event'));
    } finally {
      setTestingWebhook(null);
    }
  };

  const retryDelivery = async (webhookId: string, deliveryId: string) => {
    try {
      await Api.post(`/api/settings/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {});
      toast.success(t('settings.webhooks.retryStarted', 'Retry started'));
      setTimeout(() => fetchDeliveries(webhookId), 1500);
    } catch {
      toast.error(t('settings.webhooks.retryError', 'Failed to retry'));
    }
  };

  const saveWebhookSettings = async (webhookId: string) => {
    const settings = webhookSettings[webhookId];
    if (!settings) return;

    try {
      setActionError(null);
      const existing = webhooks.find((w) => w.id === webhookId);
      await Api.put(`/api/settings/webhooks/${webhookId}`, {
        name: existing?.name,
        url: existing?.url,
        events: existing?.events,
        headers: undefined,
        isActive: existing?.active ? 1 : 0,
        secret: settings.signatureSecret || undefined,
        retryConfig: settings.retryConfig ? JSON.stringify(settings.retryConfig) : undefined,
        filterRules: settings.filterRules ? JSON.stringify(settings.filterRules) : undefined,
      });

      const refreshed = await fetchWebhooks();
      const persisted = refreshed?.find((webhook) => webhook.id === webhookId);
      if (!webhookSettingsMatch(persisted, settings)) {
        throw new Error('Webhook settings save was not confirmed by the server');
      }
      toast.success(t('settings.webhooks.settingsSaved', 'Settings saved'));
      setShowSettings(null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.webhooks.saveError', 'Failed to save settings')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Webhook size={20} />
            {t('settings.webhooks.title', 'Webhooks')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t('settings.webhooks.desc', 'Receive real-time notifications via HTTP callbacks.')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={!!loadError}
          className="flex items-center gap-2 px-3 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] transition-colors"
        >
          <Plus size={16} />
          {t('settings.webhooks.add', 'Add Webhook')}
        </button>
      </div>

      {loadError && <DegradedState title="Webhooks unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* New Webhook Form */}
      {showNew && !loadError && (
        <div className="p-6 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
          <h4 className="text-sm font-semibold text-c-text">
            {t('settings.webhooks.createNew', 'Create New Webhook')}
          </h4>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.webhooks.name', 'Name')} <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={newWebhook.name}
              onChange={(e) => setNewWebhook((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('settings.webhooks.namePlaceholder', 'My Webhook')}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.webhooks.url', 'Endpoint URL')}{' '}
              <span className="text-danger-500">*</span>
            </label>
            <input
              type="url"
              value={newWebhook.url}
              onChange={(e) => setNewWebhook((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://api.example.com/webhook"
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.webhooks.events', 'Events')} <span className="text-danger-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    newWebhook.events.includes(event)
                      ? 'bg-navy-900 text-white'
                      : 'bg-c-surface border border-c-border-subtle dark:border-navy-600 text-c-text-secondary'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.webhooks.signatureSecret', 'Signature Secret')} (Optional)
            </label>
            <input
              type="password"
              value={newWebhook.signatureSecret}
              onChange={(e) =>
                setNewWebhook((prev) => ({ ...prev, signatureSecret: e.target.value }))
              }
              placeholder={t('settings.webhooks.secretPlaceholder', 'HMAC secret for verification')}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text font-mono text-sm"
            />
            <p className="text-xs text-c-text-muted mt-1">
              {t(
                'settings.webhooks.secretHint',
                'Used to verify webhook authenticity via HMAC signature'
              )}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={createWebhook}
              disabled={!newWebhook.url.trim() || newWebhook.events.length === 0}
              className="px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] disabled:opacity-50"
            >
              {t('common.create', 'Create')}
            </button>
            <button
              onClick={() => {
                setShowNew(false);
                setNewWebhook({
                  name: '',
                  url: '',
                  events: [],
                  signatureSecret: '',
                  retryConfig: {
                    maxRetries: 3,
                    backoffStrategy: 'exponential',
                    retryDelays: [1000, 2000, 5000],
                  },
                  filterRules: {},
                });
              }}
              className="px-4 py-2 border border-c-border-subtle dark:border-navy-600 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <EmptyState
            icon={<Webhook />}
            title={t('settings.webhooks.empty', 'No webhooks configured')}
            description={t(
              'settings.webhooks.emptyDescription',
              'Add a webhook to receive real-time event notifications at your own endpoints.'
            )}
          />
        ) : (
          webhooks.map((webhook) => {
            const isExpanded = selectedWebhook === webhook.id;
            const showWebhookSettings = showSettings === webhook.id;
            const webhookDeliveries = deliveries[webhook.id] || [];
            const failedDeliveries = webhookDeliveries.filter((d) => d.status === 'failed');
            const settings = webhookSettings[webhook.id];

            return (
              <div
                key={webhook.id}
                className="bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden"
              >
                {/* Webhook Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-c-text">
                          {webhook.name || t('settings.webhooks.unnamed', 'Unnamed Webhook')}
                        </h4>
                        {webhook.active ? (
                          <StatusChip tone="success" label={t('common.active', 'Active')} />
                        ) : (
                          <StatusChip tone="neutral" label={t('common.inactive', 'Inactive')} />
                        )}
                        {webhook.version && <MetaChip label={`v${webhook.version}`} />}
                      </div>
                      <code className="text-sm text-c-text-secondary font-mono break-all">
                        {webhook.url}
                      </code>
                      {webhook.lastTriggered && (
                        <p className="text-xs text-c-text-muted mt-1">
                          {t('settings.webhooks.lastTriggered', 'Last triggered')}:{' '}
                          {new Date(webhook.lastTriggered).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id}
                        className="p-2 text-c-text-muted hover:text-brand rounded-lg transition-colors disabled:opacity-50"
                        title={t('settings.webhooks.test', 'Send test event')}
                      >
                        {testingWebhook === webhook.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setShowSettings(showSettings === webhook.id ? null : webhook.id)
                        }
                        className={`p-2 rounded-lg transition-colors ${
                          showSettings === webhook.id
                            ? 'bg-navy-900 text-white'
                            : 'text-c-text-muted hover:text-brand hover:bg-c-surface-raised dark:hover:bg-navy-700'
                        }`}
                        title={t('common.settings', 'Settings')}
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        onClick={() => setSelectedWebhook(isExpanded ? null : webhook.id)}
                        className="p-2 text-c-text-muted hover:text-brand rounded-lg transition-colors"
                        title={t('settings.webhooks.viewDeliveries', 'View deliveries')}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button
                        onClick={() => deleteWebhook(webhook.id)}
                        className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-0.5 text-xs bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-300 rounded"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  {/* Features Indicators */}
                  <div className="flex items-center gap-4 text-xs text-c-text-muted">
                    {webhook.signatureSecret && (
                      <div className="flex items-center gap-1">
                        <Shield size={12} />
                        <span>{t('settings.webhooks.signed', 'Signed')}</span>
                      </div>
                    )}
                    {webhook.retryConfig && (
                      <div className="flex items-center gap-1">
                        <RefreshCw size={12} />
                        <span>
                          {webhook.retryConfig.maxRetries}{' '}
                          {t('settings.webhooks.retries', 'retries')}
                        </span>
                      </div>
                    )}
                    {failedDeliveries.length > 0 && (
                      <div className="flex items-center gap-1 text-danger-600 dark:text-danger-400">
                        <AlertTriangle size={12} />
                        <span>
                          {failedDeliveries.length} {t('settings.webhooks.failed', 'failed')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Settings */}
                {showWebhookSettings && settings && (
                  <div className="px-4 pb-4 border-t border-c-border-subtle dark:border-navy-700 pt-4 space-y-4">
                    <h5 className="text-sm font-semibold text-c-text">
                      {t('settings.webhooks.advancedSettings', 'Advanced Settings')}
                    </h5>

                    {/* Signature Secret */}
                    <div>
                      <label className="block text-xs font-medium text-c-text-secondary mb-1">
                        {t('settings.webhooks.signatureSecret', 'Signature Secret')}
                      </label>
                      <input
                        type="password"
                        value={settings.signatureSecret}
                        onChange={(e) =>
                          setWebhookSettings((prev) => ({
                            ...prev,
                            [webhook.id]: {
                              ...prev[webhook.id],
                              signatureSecret: e.target.value,
                            },
                          }))
                        }
                        placeholder={t('settings.webhooks.secretPlaceholder', 'HMAC secret')}
                        className="w-full px-3 py-2 text-sm bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg font-mono"
                      />
                    </div>

                    {/* Retry Configuration */}
                    <div>
                      <label className="block text-xs font-medium text-c-text-secondary mb-2">
                        {t('settings.webhooks.retryConfig', 'Retry Configuration')}
                      </label>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-c-text-secondary">
                            {t('settings.webhooks.maxRetries', 'Max Retries')}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={settings.retryConfig.maxRetries}
                            onChange={(e) =>
                              setWebhookSettings((prev) => ({
                                ...prev,
                                [webhook.id]: {
                                  ...prev[webhook.id],
                                  retryConfig: {
                                    ...prev[webhook.id].retryConfig,
                                    maxRetries: parseInt(e.target.value) || 0,
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-c-text-secondary">
                            {t('settings.webhooks.backoffStrategy', 'Backoff Strategy')}
                          </label>
                          <select
                            value={settings.retryConfig.backoffStrategy}
                            onChange={(e) =>
                              setWebhookSettings((prev) => ({
                                ...prev,
                                [webhook.id]: {
                                  ...prev[webhook.id],
                                  retryConfig: {
                                    ...prev[webhook.id].retryConfig,
                                    backoffStrategy: e.target.value as 'linear' | 'exponential',
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                          >
                            <option value="linear">
                              {t('settings.webhooks.linear', 'Linear')}
                            </option>
                            <option value="exponential">
                              {t('settings.webhooks.exponential', 'Exponential')}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Event Filtering */}
                    <div>
                      <label className="block text-xs font-medium text-c-text-secondary mb-1">
                        {t('settings.webhooks.eventFilters', 'Event Filters')} (JSONPath)
                      </label>
                      <textarea
                        value={JSON.stringify(settings.filterRules, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            setWebhookSettings((prev) => ({
                              ...prev,
                              [webhook.id]: { ...prev[webhook.id], filterRules: parsed },
                            }));
                          } catch {}
                        }}
                        rows={4}
                        className="w-full px-3 py-2 text-sm bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg font-mono"
                        placeholder='{"eventType": "task.created", "conditions": []}'
                      />
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => saveWebhookSettings(webhook.id)}
                        className="flex-1 px-3 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] text-sm font-medium"
                      >
                        {t('common.save', 'Save')}
                      </button>
                      <button
                        onClick={() => setShowSettings(null)}
                        className="px-3 py-2 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 text-sm"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Delivery Timeline */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-c-border-subtle dark:border-navy-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-semibold text-c-text">
                        {t('settings.webhooks.deliveryHistory', 'Delivery History')}
                      </h5>
                      <button
                        onClick={() => fetchDeliveries(webhook.id)}
                        className="p-1 text-c-text-muted hover:text-brand rounded"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    {webhookDeliveries.length === 0 ? (
                      <p className="text-xs text-c-text-muted text-center py-4">
                        {t('settings.webhooks.noDeliveries', 'No deliveries yet')}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {webhookDeliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            className={`p-3 rounded-lg border ${
                              delivery.status === 'success'
                                ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                                : delivery.status === 'failed'
                                  ? 'bg-danger-50/50 dark:bg-danger-900/10 border-danger-200 dark:border-danger-900/30'
                                  : 'bg-c-surface-raised border-c-border-subtle dark:border-navy-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {delivery.status === 'success' ? (
                                    <CheckCircle size={14} className="text-green-500" />
                                  ) : (
                                    <XCircle size={14} className="text-danger-500" />
                                  )}
                                  <span className="text-xs font-medium text-c-text">
                                    {delivery.event_type}
                                  </span>
                                  {delivery.retry_count > 0 && (
                                    <span className="text-xs text-c-text-muted">
                                      ({t('settings.webhooks.retry', 'retry')}{' '}
                                      {delivery.retry_count})
                                    </span>
                                  )}
                                </div>
                                {delivery.response_code && (
                                  <p className="text-xs text-c-text-secondary">
                                    {delivery.response_code} • {delivery.response_time_ms}ms
                                  </p>
                                )}
                                {delivery.error_message && (
                                  <p className="text-xs text-danger-600 dark:text-danger-400 mt-1">
                                    {delivery.error_message}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-c-text-muted">
                                  {new Date(delivery.created_at).toLocaleString()}
                                </p>
                                {delivery.status === 'failed' && (
                                  <button
                                    onClick={() => retryDelivery(webhook.id, delivery.id)}
                                    className="mt-1 text-xs text-brand hover:underline"
                                  >
                                    {t('settings.webhooks.retry', 'Retry')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WebhooksSettings;
