import {
  AlertCircle,
  Building2,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Plus,
  Puzzle,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  Webhook,
} from 'lucide-react';
import {
  Calendar,
  CheckSquare,
  Database,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquare,
  Slack,
  Trello,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { Api } from '../../services/api';
import { User } from '../../types';
import { EasySyncSetupShellPanel } from '../shared/EasySyncSetupShellPanel';

// Webhook types
interface WebhookSubscription {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  isActive: boolean;
  secretKey?: string;
  createdAt: string;
}

interface EventCategory {
  category: string;
  events: { type: string; description: string }[];
}

interface IntegrationProvider {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description?: string | null;
  authType?: 'oauth2' | 'api_key' | 'webhook' | string;
  isActive: boolean;
  isBeta: boolean;
  isEnterpriseOnly: boolean;
}

const PROVIDER_ICON: Record<string, any> = {
  slack: Slack,
  microsoft_teams: MessageCircle,
  jira: Database,
  asana: CheckSquare,
  monday: Calendar,
  google_drive: FileText,
  google_calendar: Calendar,
  onedrive: FileText,
  outlook: Calendar,
  zapier: RefreshCw,
  make: RefreshCw,
  trello: Trello,
};

interface IntegrationSettingsProps {
  currentUser: User;
}

interface Integration {
  id: string;
  name?: string;
  provider: string;
  config: any;
  sync_scope?: 'read_only' | 'bidirectional' | string;
  sync_scope_label?: string | null;
  status: 'active' | 'paused' | 'error' | 'disconnected' | 'connected' | 'disabled' | string;
  created_at?: string | null;
  last_synced_at?: string | null;
  last_error?: string | null;
  error_count?: number | null;
  onboarding_status?:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'authorization_callback_received_pending_verification'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation'
    | null;
  configured_fields?: string[];
  required_fields?: string[];
}

const READY_INTEGRATION_STATUSES = new Set(['active', 'connected']);

function getIntegrationReadinessMeta(
  integration: Integration | undefined,
  t: (key: string, fallback: string) => string
) {
  if (!integration) {
    return {
      isReady: false,
      isPending: false,
      badgeLabel: null as string | null,
      badgeClassName: '',
      guidance: null as string | null,
      nextStep: null as string | null,
    };
  }

  if (READY_INTEGRATION_STATUSES.has(integration.status)) {
    return {
      isReady: true,
      isPending: false,
      badgeLabel: t('settings.integrations.readiness.connected', 'Connected'),
      badgeClassName: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      guidance: null,
      nextStep: null,
    };
  }

  if (integration.status === 'pending') {
    const onboardingStatus = integration.onboarding_status;
    if (onboardingStatus === 'authorization_callback_received_pending_verification') {
      return {
        isReady: false,
        isPending: true,
        badgeLabel: t(
          'settings.integrations.readiness.verificationPending',
          'Verification pending'
        ),
        badgeClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
        guidance: t(
          'settings.integrations.readiness.verificationPendingGuidance',
          'Authorization callback reached governed sync, but verification still completes in Sync Hub.'
        ),
        nextStep: t(
          'settings.integrations.readiness.verificationPendingNextStep',
          'Wait for governed verification to complete.'
        ),
      };
    }
    if (onboardingStatus === 'pending_external_auth') {
      return {
        isReady: false,
        isPending: true,
        badgeLabel: t(
          'settings.integrations.readiness.authorizationPending',
          'Authorization pending'
        ),
        badgeClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
        guidance: t(
          'settings.integrations.readiness.authorizationPendingGuidance',
          'Governed setup is waiting for external authorization in Sync Hub.'
        ),
        nextStep: t(
          'settings.integrations.readiness.authorizationPendingNextStep',
          'Finish external authorization in Sync Hub.'
        ),
      };
    }
    if (onboardingStatus === 'configuration_submitted_pending_validation') {
      return {
        isReady: false,
        isPending: true,
        badgeLabel: t('settings.integrations.readiness.validationPending', 'Validation pending'),
        badgeClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
        guidance: t(
          'settings.integrations.readiness.validationPendingGuidance',
          'Configuration was submitted, but governed validation has not finished yet.'
        ),
        nextStep: t(
          'settings.integrations.readiness.validationPendingNextStep',
          'Wait for governed validation before sync controls become available.'
        ),
      };
    }

    return {
      isReady: false,
      isPending: true,
      badgeLabel: t('settings.integrations.readiness.pendingSetup', 'Pending setup'),
      badgeClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
      guidance: t(
        'settings.integrations.readiness.pendingSetupGuidance',
        'This integration exists on the governed sync path, but setup is not complete yet.'
      ),
      nextStep: t(
        'settings.integrations.readiness.pendingSetupNextStep',
        'Complete provider configuration before sync can start.'
      ),
    };
  }

  if (integration.status === 'requires_reauth') {
    return {
      isReady: false,
      isPending: false,
      badgeLabel: t('settings.integrations.readiness.reauthRequired', 'Reauth Required'),
      badgeClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
      guidance: t(
        'settings.integrations.readiness.reauthRequiredGuidance',
        'Governed sync marked this connection as requiring re-authorization before sync can resume.'
      ),
      nextStep: t(
        'settings.integrations.readiness.reauthRequiredNextStep',
        'Re-authorize this provider in Sync Hub.'
      ),
    };
  }

  if (integration.status === 'error') {
    return {
      isReady: false,
      isPending: false,
      badgeLabel: t('settings.integrations.readiness.error', 'Error'),
      badgeClassName: 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300',
      guidance: t(
        'settings.integrations.readiness.errorGuidance',
        'The last governed sync run failed. Review the latest error before resuming sync.'
      ),
      nextStep: t(
        'settings.integrations.readiness.errorNextStep',
        'Review the latest error and fix provider setup or auth.'
      ),
    };
  }

  if (integration.status === 'disconnected' || integration.status === 'disabled') {
    return {
      isReady: false,
      isPending: false,
      badgeLabel:
        integration.status === 'disabled'
          ? t('settings.integrations.readiness.disabled', 'Disabled')
          : t('settings.integrations.readiness.disconnected', 'Disconnected'),
      badgeClassName: 'bg-c-surface-raised text-c-text-secondary',
      guidance: t(
        'settings.integrations.readiness.disconnectedGuidance',
        'This provider is not currently connected on the governed sync path.'
      ),
      nextStep: t(
        'settings.integrations.readiness.disconnectedNextStep',
        'Reconnect the provider to restore governed sync.'
      ),
    };
  }

  return {
    isReady: false,
    isPending: false,
    badgeLabel: integration.status,
    badgeClassName: 'bg-c-surface-raised text-c-text-secondary',
    guidance: null,
    nextStep: null,
  };
}

interface ProjectOption {
  id: string;
  name: string;
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  const [configInput, setConfigInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncingIntegrationId, setSyncingIntegrationId] = useState<string | null>(null);

  const [logsModal, setLogsModal] = useState<{
    open: boolean;
    integrationId: string | null;
    providerLabel?: string;
    loading: boolean;
    logs: any[];
  }>({ open: false, integrationId: null, loading: false, logs: [] });

  // Webhooks state
  const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks' | 'mcp'>('integrations');
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [availableEvents, setAvailableEvents] = useState<EventCategory[]>([]);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    targetUrl: '',
    eventTypes: [] as string[],
  });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  // MCP state
  const isAdmin =
    String((currentUser as any)?.role || '')
      .toLowerCase()
      .includes('admin') ||
    String((currentUser as any)?.role || '')
      .toLowerCase()
      .includes('super');

  const [mcpProviders, setMcpProviders] = useState<any[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpModal, setMcpModal] = useState<{
    open: boolean;
    providerId: string | null;
    name: string;
    status: string;
    configInput: string;
  }>({ open: false, providerId: null, name: '', status: 'active', configInput: '' });
  const [testingMcpProviderId, setTestingMcpProviderId] = useState<string | null>(null);
  const [mcpToolsModal, setMcpToolsModal] = useState<{
    open: boolean;
    providerId: string | null;
    name?: string;
    loading: boolean;
    tools: any;
  }>({ open: false, providerId: null, loading: false, tools: null });
  const [allowlistModal, setAllowlistModal] = useState<{
    open: boolean;
    providerId: string | null;
    loading: boolean;
    mode: 'allow' | 'deny';
    toolsText: string;
    saving: boolean;
  }>({
    open: false,
    providerId: null,
    loading: false,
    mode: 'allow',
    toolsText: '["*"]',
    saving: false,
  });

  const getSyncScopeMeta = useCallback(
    (scope?: string | null) => {
      const normalized = String(scope || '').toLowerCase();
      const readOnly = normalized === 'read_only' || normalized === 'readonly';
      return {
        label: readOnly
          ? t('integrations.scope.readOnly', 'Read-only sync')
          : t('integrations.scope.bidirectional', 'Bidirectional sync'),
        className: readOnly
          ? 'bg-c-surface-raised text-c-text-secondary'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
      };
    },
    [t]
  );

  const fetchMcpProviders = useCallback(async () => {
    setMcpLoading(true);
    try {
      const data = await (Api as any).getMcpProviders?.();
      setMcpProviders(Array.isArray(data) ? data : data?.providers || []);
    } catch (e: any) {
      setMcpProviders([]);
      // Non-admin users may not have access depending on environment policy; keep quiet unless user is admin.
      if (isAdmin) toast.error(e?.message || 'Failed to load MCP providers');
    } finally {
      setMcpLoading(false);
    }
  }, [isAdmin]);

  // Fetch Webhooks
  const fetchWebhooks = useCallback(async () => {
    try {
      const result = await Api.get('/integrations/webhook-subscriptions');
      const rows = Array.isArray(result) ? result : result?.subscriptions || [];
      const subs: WebhookSubscription[] = (rows || []).map((r: any) => {
        const eventsRaw = r?.events_json ?? r?.events ?? r?.eventsJson ?? r?.eventsJSON ?? null;
        let eventTypes: string[] = [];
        try {
          eventTypes = Array.isArray(eventsRaw)
            ? eventsRaw
            : typeof eventsRaw === 'string'
              ? (JSON.parse(eventsRaw) as string[])
              : [];
        } catch {
          eventTypes = [];
        }
        return {
          id: String(r?.id),
          name: String(r?.name || ''),
          targetUrl: String(r?.url || r?.targetUrl || ''),
          eventTypes,
          isActive: Boolean(r?.is_active ?? r?.isActive ?? true),
          secretKey: typeof r?.secret === 'string' ? r.secret : undefined,
          createdAt: String(r?.created_at || r?.createdAt || new Date().toISOString()),
        };
      });
      setWebhooks(subs);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  }, []);

  // Fetch Available Events
  const fetchAvailableEvents = useCallback(async () => {
    try {
      const result = await Api.get('/integrations/webhook-subscriptions/catalog');
      const events = Array.isArray(result?.events) ? result.events : [];
      const byCategory = new Map<string, { type: string; description: string }[]>();
      for (const e of events) {
        const id = String(e?.id || '').trim();
        if (!id) continue;
        const category = id.includes('.') ? id.split('.')[0] : 'other';
        const entry = { type: id, description: String(e?.description || id) };
        const list = byCategory.get(category) || [];
        list.push(entry);
        byCategory.set(category, list);
      }
      const categories: EventCategory[] = Array.from(byCategory.entries()).map(
        ([category, evs]) => ({
          category,
          events: evs.sort((a, b) => a.type.localeCompare(b.type)),
        })
      );
      setAvailableEvents(categories.sort((a, b) => a.category.localeCompare(b.category)));
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, []);

  // Fetch Integrations
  const fetchIntegrations = async () => {
    if (!currentUser.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await Api.getIntegrations();
      // Handle different response formats
      if (data.integrations) {
        setIntegrations(data.integrations);
      } else if (Array.isArray(data)) {
        setIntegrations(data);
      } else {
        setIntegrations([]);
      }
    } catch (err: any) {
      console.error('Failed to load integrations:', err);
      toast.error('Failed to load integrations');
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = useCallback(async () => {
    try {
      const data = await (Api as any).getIntegrationProviders?.();
      const list = Array.isArray(data) ? data : data?.providers || [];
      setProviders(list || []);
    } catch (err) {
      console.error('Failed to load integration providers:', err);
      setProviders([]);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await (Api as any).getProjects?.();
      const rows = Array.isArray(data) ? data : data?.projects || [];
      setProjects(
        (rows || []).map((item: any) => ({
          id: String(item?.id || ''),
          name: String(item?.name || 'Untitled project'),
        }))
      );
    } catch (err) {
      console.error('Failed to load projects for integration mappings:', err);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    fetchProviders();
    fetchProjects();
    fetchWebhooks();
    fetchAvailableEvents();
    fetchMcpProviders();
  }, [
    currentUser.organizationId,
    fetchWebhooks,
    fetchAvailableEvents,
    fetchProviders,
    fetchProjects,
  ]);

  const openGovernedSyncHub = useCallback(() => {
    navigate(`${ROUTES.ADMIN.ROOT}/integrations`);
  }, [navigate]);

  // Show message if user has no organization
  if (!currentUser.organizationId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-c-text">Integrations</h2>
          <p className="text-c-text-muted">Connect external tools to streamline your workflow.</p>
        </div>
        <EasySyncSetupShellPanel compact />
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-8 text-center">
          <Building2 size={48} className="mx-auto text-amber-600 dark:text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-400 mb-2">
            Organization Required
          </h3>
          <p className="text-amber-700 dark:text-amber-500/80 text-sm max-w-md mx-auto">
            Integrations are configured at the organization level. Please create or join an
            organization first in the Organization settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-c-accent" />
      </div>
    );
  }

  const handleConnect = (providerId: string) => {
    setSelectedProvider(providerId);
    setEditingIntegrationId(null);
    if (providerId === 'slack' || providerId === 'microsoft_teams' || providerId === 'teams') {
      setConfigInput(
        JSON.stringify(
          {
            webhookUrl: '',
            projectChannelMappings: [],
          },
          null,
          2
        )
      );
    } else {
      setConfigInput('');
    }
    setIsModalOpen(true);
  };

  const handleEditConfig = (integration: Integration) => {
    setSelectedProvider(integration.provider);
    setEditingIntegrationId(integration.id);
    try {
      const raw = integration.config;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      setConfigInput(JSON.stringify(parsed || {}, null, 2));
    } catch {
      setConfigInput(
        typeof integration.config === 'string'
          ? integration.config
          : JSON.stringify(integration.config)
      );
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedProvider || !configInput) {
      toast.error('Please provide a webhook URL or API token');
      return;
    }
    setConnecting(true);
    try {
      const config = (() => {
        const raw = String(configInput || '').trim();
        if (!raw) return {};
        try {
          return JSON.parse(raw);
        } catch {
          // Treat non-JSON as a webhook URL for quick setup
          return { webhookUrl: raw };
        }
      })();

      if (editingIntegrationId) {
        await (Api as any).updateIntegrationSettings?.(editingIntegrationId, config);
        toast.success('Integration settings updated!');
      } else {
        const result = await Api.connectIntegration(selectedProvider, config);
        if (result?.authUrl) {
          window.open(result.authUrl, '_blank', 'width=600,height=700');
          toast.success('Authorization started. Finish the external auth step to complete setup.');
        } else if (
          result?.onboardingStatus === 'pending_external_auth_or_configuration' ||
          result?.onboardingStatus === 'pending_configuration'
        ) {
          toast.success('Setup started. Complete the required configuration fields to continue.');
        } else if (result?.onboardingStatus === 'configuration_submitted_pending_validation') {
          toast.success('Configuration submitted. Validation is still pending.');
        } else {
          toast.success('Integration setup started.');
        }
      }

      await fetchIntegrations();
      setIsModalOpen(false);
      setConfigInput('');
      setEditingIntegrationId(null);
    } catch (err: any) {
      console.error('Failed to connect integration:', err);
      toast.error(err.message || 'Failed to connect integration');
    } finally {
      setConnecting(false);
    }
  };

  const isCommunicationProvider =
    selectedProvider === 'slack' ||
    selectedProvider === 'microsoft_teams' ||
    selectedProvider === 'teams';

  const parseEditorConfig = () => {
    const raw = String(configInput || '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { webhookUrl: raw };
    }
  };

  const setEditorConfig = (next: any) => {
    setConfigInput(JSON.stringify(next || {}, null, 2));
  };

  const communicationConfig = isCommunicationProvider ? parseEditorConfig() : {};
  const communicationMappings = Array.isArray((communicationConfig as any)?.projectChannelMappings)
    ? (communicationConfig as any).projectChannelMappings
    : [];

  const handleDelete = async (id: string) => {
    if (!confirm('Disconnect this integration?')) return;
    try {
      // Find the integration to get the provider
      const integration = integrations.find((i) => i.id === id);
      if (!integration) {
        toast.error('Integration not found');
        return;
      }

      // Use disconnectIntegration API method with integration id
      await Api.disconnectIntegration(integration.id);
      toast.success('Integration disconnected');
      fetchIntegrations();
    } catch (err: any) {
      console.error('Failed to disconnect integration:', err);
      toast.error(err.message || 'Failed to disconnect integration');
    }
  };

  // Webhook handlers
  const handleCreateWebhook = async () => {
    if (!webhookForm.name || !webhookForm.targetUrl || webhookForm.eventTypes.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setConnecting(true);
    try {
      await Api.post('/integrations/webhook-subscriptions', {
        name: webhookForm.name,
        url: webhookForm.targetUrl,
        events: webhookForm.eventTypes,
      });
      toast.success('Webhook created successfully!');
      setIsWebhookModalOpen(false);
      setWebhookForm({ name: '', targetUrl: '', eventTypes: [] });
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create webhook');
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await Api.delete(`/integrations/webhook-subscriptions/${id}`);
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (targetUrl: string) => {
    setTestingWebhook(true);
    try {
      const result = await Api.post('/integrations/webhook-subscriptions/test', { targetUrl });
      if (result.success) {
        toast.success(`Test successful! Response: ${result.statusCode} (${result.durationMs}ms)`);
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error('Failed to test webhook');
    } finally {
      setTestingWebhook(false);
    }
  };

  const toggleEventType = (eventType: string) => {
    if (webhookForm.eventTypes.includes(eventType)) {
      setWebhookForm({
        ...webhookForm,
        eventTypes: webhookForm.eventTypes.filter((e) => e !== eventType),
      });
    } else {
      setWebhookForm({
        ...webhookForm,
        eventTypes: [...webhookForm.eventTypes, eventType],
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openMcpPreset = (preset: 'iris' | 'marketplace') => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    const base =
      preset === 'iris'
        ? {
            mes_base_url: '',
            mcpPath: '/mcp',
            mes_api_token: '',
            factory_id: '',
            headers: {},
          }
        : {
            baseUrl: '',
            mcpPath: '/mcp',
            marketplace_token: '',
            headers: {},
          };
    setMcpModal({
      open: true,
      providerId: null,
      name: preset === 'iris' ? 'IRIS' : 'Marketplace',
      status: 'active',
      configInput: JSON.stringify(base, null, 2),
    });
  };

  const openEditMcpProvider = (p: any) => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    const cfg = typeof p?.config === 'string' ? p.config : JSON.stringify(p?.config || {});
    let pretty = cfg;
    try {
      pretty = JSON.stringify(
        typeof p?.config === 'string' ? JSON.parse(p.config) : p.config || {},
        null,
        2
      );
    } catch {}
    setMcpModal({
      open: true,
      providerId: p.id,
      name: String(p.name || ''),
      status: String(p.status || 'active'),
      configInput: pretty,
    });
  };

  const saveMcpProvider = async () => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    const name = String(mcpModal.name || '').trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    let cfg: any = {};
    try {
      cfg = JSON.parse(String(mcpModal.configInput || '{}'));
    } catch {
      toast.error('Config must be valid JSON');
      return;
    }
    try {
      if (mcpModal.providerId) {
        await (Api as any).updateMcpProvider?.(mcpModal.providerId, {
          name,
          status: mcpModal.status,
          config: cfg,
        });
        toast.success('MCP provider updated');
      } else {
        await (Api as any).createMcpProvider?.({
          name,
          type: 'streamable_http',
          status: mcpModal.status,
          config: cfg,
        });
        toast.success('MCP provider created');
      }
      setMcpModal({ open: false, providerId: null, name: '', status: 'active', configInput: '' });
      await fetchMcpProviders();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save MCP provider');
    }
  };

  const testMcpProvider = async (providerId: string) => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    setTestingMcpProviderId(providerId);
    try {
      const data = await (Api as any).testMcpProvider?.(providerId);
      toast.success('Test completed. Tools cached.');
      setMcpToolsModal({ open: true, providerId, loading: false, tools: data?.tools || data });
      await fetchMcpProviders();
    } catch (e: any) {
      toast.error(e?.message || 'Test failed');
    } finally {
      setTestingMcpProviderId(null);
    }
  };

  const openMcpTools = async (providerId: string, name?: string) => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    setMcpToolsModal({ open: true, providerId, name, loading: true, tools: null });
    try {
      const data = await (Api as any).getMcpProviderTools?.(providerId);
      setMcpToolsModal({
        open: true,
        providerId,
        name,
        loading: false,
        tools: data?.tools || data,
      });
    } catch (e: any) {
      setMcpToolsModal({ open: true, providerId, name, loading: false, tools: null });
      toast.error(e?.message || 'Failed to load tools cache');
    }
  };

  const openAllowlist = async (providerId: string) => {
    if (!isAdmin) {
      toast.error('Admin permissions required');
      return;
    }
    setAllowlistModal({
      open: true,
      providerId,
      loading: true,
      mode: 'allow',
      toolsText: '["*"]',
      saving: false,
    });
    try {
      const data = await (Api as any).getMcpProviderAllowlist?.(providerId);
      const mode = String(data?.mode || 'allow') as any;
      const raw = data?.tools_json || data?.toolsJson || data?.tools || '["*"]';
      setAllowlistModal({
        open: true,
        providerId,
        loading: false,
        mode: mode === 'deny' ? 'deny' : 'allow',
        toolsText: typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2),
        saving: false,
      });
    } catch (e: any) {
      setAllowlistModal((s) => ({ ...s, loading: false }));
      toast.error(e?.message || 'Failed to load allowlist');
    }
  };

  const saveAllowlist = async () => {
    if (!isAdmin || !allowlistModal.providerId) return;
    setAllowlistModal((s) => ({ ...s, saving: true }));
    try {
      const tools = JSON.parse(String(allowlistModal.toolsText || '["*"]'));
      if (!Array.isArray(tools)) throw new Error('tools must be a JSON array');
      await (Api as any).updateMcpProviderAllowlist?.(allowlistModal.providerId, {
        mode: allowlistModal.mode,
        tools,
      });
      toast.success('Allowlist updated');
      setAllowlistModal((s) => ({ ...s, saving: false, open: false }));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save allowlist');
      setAllowlistModal((s) => ({ ...s, saving: false }));
    }
  };

  const handleSyncNow = async (integrationId: string) => {
    setSyncingIntegrationId(integrationId);
    try {
      await (Api as any).syncIntegration?.(integrationId);
      toast.success('Sync initiated');
      await fetchIntegrations();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync integration');
    } finally {
      setSyncingIntegrationId(null);
    }
  };

  const handleOpenLogs = async (integrationId: string, providerLabel?: string) => {
    setLogsModal({ open: true, integrationId, providerLabel, loading: true, logs: [] });
    try {
      const data = await (Api as any).getIntegrationLogs?.(integrationId);
      const logs = Array.isArray(data) ? data : data?.logs || [];
      setLogsModal({ open: true, integrationId, providerLabel, loading: false, logs });
    } catch (err: any) {
      setLogsModal({ open: true, integrationId, providerLabel, loading: false, logs: [] });
      toast.error(err?.message || 'Failed to load sync logs');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-c-text">
          {t('settings.integrations.title', 'Integrations')}
        </h2>
        <p className="text-c-text-muted">
          {t('settings.integrations.description', 'Connect external tools and configure webhooks.')}
        </p>
      </div>
      <EasySyncSetupShellPanel compact />
      {/* Tabs */}
      <div className="flex gap-1 bg-c-surface-raised p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            activeTab === 'integrations'
              ? 'bg-c-surface text-c-text shadow'
              : 'text-c-text-muted hover:text-c-text-secondary'
          }`}
        >
          External Tools
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'webhooks'
              ? 'bg-c-surface text-c-text shadow'
              : 'text-c-text-muted hover:text-c-text-secondary'
          }`}
        >
          <Webhook size={16} />
          Webhooks
        </button>
        <button
          onClick={() => setActiveTab('mcp')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'mcp'
              ? 'bg-c-surface text-c-text shadow'
              : 'text-c-text-muted hover:text-c-text-secondary'
          }`}
        >
          <Database size={16} />
          MCP
        </button>
      </div>
      {activeTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(providers || [])
            .filter((p) => p.isActive !== false)
            .map((p) => {
              const connected = integrations.find(
                (i) => i.provider === p.name || i.provider === p.id
              );
              const readiness = getIntegrationReadinessMeta(connected, t);
              const missingFields =
                connected?.required_fields?.filter(
                  (field) => !(connected.configured_fields || []).includes(field)
                ) || [];
              const lastOperationalLabel = connected?.last_synced_at
                ? t('settings.integrations.lastGovernedSync', 'Last governed sync')
                : connected?.created_at
                  ? t('settings.integrations.governedEntryCreated', 'Governed entry created')
                  : t('settings.integrations.lastGovernedEvent', 'Last governed event');
              const lastOperationalValue = connected?.last_synced_at
                ? new Date(connected.last_synced_at).toLocaleString()
                : connected?.created_at
                  ? new Date(connected.created_at).toLocaleString()
                  : '—';
              const Icon = PROVIDER_ICON[p.name] || PROVIDER_ICON[p.id] || Puzzle;

              return (
                <div
                  key={p.id}
                  className="bg-c-surface p-6 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 flex flex-col justify-between hover:shadow-lg transition-shadow"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`p-2 rounded-lg ${
                          !connected
                            ? 'bg-c-surface-raised text-c-text-secondary'
                            : readiness.isReady
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-c-text">{p.displayName}</h3>
                        <p className="text-xs text-c-text-muted">{p.description || p.category}</p>
                      </div>
                    </div>
                    {connected && (
                      <div className="mb-4 space-y-2">
                        {readiness.badgeLabel ? (
                          <div
                            className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${readiness.badgeClassName}`}
                          >
                            {readiness.isReady ? (
                              <CheckCircle size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {readiness.badgeLabel}
                          </div>
                        ) : null}
                        {readiness.isReady ? (
                          <div
                            className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${getSyncScopeMeta(connected.sync_scope).className}`}
                          >
                            <Info size={12} />
                            {connected.sync_scope_label ||
                              getSyncScopeMeta(connected.sync_scope).label}
                          </div>
                        ) : null}
                        <div className="text-xs text-c-text-muted">
                          <div>
                            Status:{' '}
                            <span className="font-medium text-c-text-secondary">
                              {readiness.badgeLabel || connected.status || 'active'}
                            </span>
                          </div>
                          <div>
                            {lastOperationalLabel}:{' '}
                            <span className="font-medium text-c-text-secondary">
                              {lastOperationalValue}
                            </span>
                          </div>
                          {connected.last_error ? (
                            <div className="text-danger-600 dark:text-danger-400 mt-1">
                              Last error: {String(connected.last_error).slice(0, 120)}
                            </div>
                          ) : null}
                          {readiness.guidance ? (
                            <div className="mt-2 text-amber-700 dark:text-amber-300">
                              {readiness.guidance}
                            </div>
                          ) : null}
                          {readiness.nextStep ? (
                            <div className="mt-2">
                              Next step:{' '}
                              <span className="font-medium text-c-text-secondary">
                                {readiness.nextStep}
                              </span>
                            </div>
                          ) : null}
                          {missingFields.length > 0 ? (
                            <div className="mt-1">
                              {t(
                                'settings.integrations.missingSetupFields',
                                'Missing setup fields'
                              )}
                              : {missingFields.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  {connected ? (
                    readiness.isReady ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleSyncNow(connected.id)}
                          disabled={syncingIntegrationId === connected.id}
                          className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {syncingIntegrationId === connected.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <RefreshCw size={16} />
                          )}
                          Sync now
                        </button>
                        <button
                          onClick={() => handleOpenLogs(connected.id, p.displayName)}
                          className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 flex items-center justify-center gap-2"
                        >
                          <Eye size={16} />
                          View logs
                        </button>
                        <button
                          onClick={() => handleEditConfig(connected)}
                          className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface text-c-text-secondary hover:bg-c-surface-raised border border-c-border-subtle dark:hover:bg-navy-700 dark:border-navy-700 flex items-center justify-center gap-2"
                        >
                          <Settings size={16} />
                          Edit config
                        </button>
                        <button
                          onClick={() => handleDelete(connected.id)}
                          className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface-raised text-c-text-secondary hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(connected.onboarding_status === 'pending_configuration' ||
                          connected.onboarding_status ===
                            'pending_external_auth_or_configuration') && (
                          <button
                            onClick={() => handleEditConfig(connected)}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-2"
                          >
                            <Settings size={16} />
                            {t('settings.integrations.completeSetup', 'Complete setup')}
                          </button>
                        )}
                        {(connected.onboarding_status === 'pending_external_auth' ||
                          connected.onboarding_status ===
                            'authorization_callback_received_pending_verification' ||
                          connected.onboarding_status ===
                            'configuration_submitted_pending_validation' ||
                          connected.status === 'requires_reauth' ||
                          connected.status === 'error') && (
                          <button
                            onClick={openGovernedSyncHub}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={16} />
                            Open governed Sync Hub
                          </button>
                        )}
                        {(connected.onboarding_status === 'pending_external_auth' ||
                          connected.onboarding_status ===
                            'authorization_callback_received_pending_verification' ||
                          connected.onboarding_status ===
                            'configuration_submitted_pending_validation' ||
                          connected.status === 'requires_reauth' ||
                          connected.status === 'error') && (
                          <button
                            onClick={() => handleOpenLogs(connected.id, p.displayName)}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 flex items-center justify-center gap-2"
                          >
                            <Eye size={16} />
                            View governed status
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(connected.id)}
                          className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-c-surface-raised text-c-text-secondary hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
                        >
                          Disconnect
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => handleConnect(p.name)}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}{' '}
      {/* Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-c-surface rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-c-text">
              {editingIntegrationId ? 'Edit' : 'Connect'}{' '}
              {providers.find((p) => p.name === selectedProvider)?.displayName || selectedProvider}
            </h3>
            <div className="space-y-4">
              {isCommunicationProvider && (
                <div className="space-y-4 rounded-xl border border-c-border-subtle dark:border-navy-700 p-4 bg-c-surface-raised">
                  <div>
                    <div className="text-sm font-medium text-c-text">Project channel mappings</div>
                    <div className="text-xs text-c-text-muted mt-1">
                      Assign at least one project to a Slack or Teams channel. Optional mapping
                      webhook URLs can override the default webhook per project.
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Default webhook URL
                    </label>
                    <input
                      value={String((communicationConfig as any)?.webhookUrl || '')}
                      onChange={(e) =>
                        setEditorConfig({
                          ...communicationConfig,
                          webhookUrl: e.target.value,
                          projectChannelMappings: communicationMappings,
                        })
                      }
                      className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg text-sm"
                      placeholder="https://hooks.slack.com/... or Teams incoming webhook"
                    />
                  </div>

                  <div className="space-y-3">
                    {communicationMappings.map((mapping: any, index: number) => (
                      <div
                        key={`${mapping?.projectId || 'global'}-${index}`}
                        className="grid gap-3 md:grid-cols-[1.2fr_1fr_1.3fr_auto]"
                      >
                        <select
                          value={String(mapping?.projectId || '')}
                          onChange={(e) => {
                            const next = [...communicationMappings];
                            next[index] = { ...next[index], projectId: e.target.value || null };
                            setEditorConfig({
                              ...communicationConfig,
                              projectChannelMappings: next,
                            });
                          }}
                          className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg text-sm"
                        >
                          <option value="">Select project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={String(mapping?.channelId || '')}
                          onChange={(e) => {
                            const next = [...communicationMappings];
                            next[index] = { ...next[index], channelId: e.target.value };
                            setEditorConfig({
                              ...communicationConfig,
                              projectChannelMappings: next,
                            });
                          }}
                          className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg text-sm"
                          placeholder="channel-id"
                        />
                        <input
                          value={String(mapping?.webhookUrl || '')}
                          onChange={(e) => {
                            const next = [...communicationMappings];
                            next[index] = { ...next[index], webhookUrl: e.target.value };
                            setEditorConfig({
                              ...communicationConfig,
                              projectChannelMappings: next,
                            });
                          }}
                          className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg text-sm"
                          placeholder="Optional project-specific webhook URL"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = communicationMappings.filter(
                              (_: any, i: number) => i !== index
                            );
                            setEditorConfig({
                              ...communicationConfig,
                              projectChannelMappings: next,
                            });
                          }}
                          className="px-3 py-2 rounded-lg text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] text-c-text-secondary hover:text-danger-600 hover:bg-danger-50 dark:border-navy-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setEditorConfig({
                          ...communicationConfig,
                          projectChannelMappings: [
                            ...communicationMappings,
                            { projectId: null, channelId: '', webhookUrl: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-c-surface border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised dark:border-navy-700"
                    >
                      <Plus size={14} />
                      Add project mapping
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Webhook URL / API Token / JSON config
                </label>
                <textarea
                  value={configInput}
                  onChange={(e) => setConfigInput(e.target.value)}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] font-mono text-xs"
                  placeholder="https://hooks.slack.com/..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={connecting || !configInput}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  {connecting && <Loader2 size={16} className="animate-spin" />}
                  {connecting
                    ? editingIntegrationId
                      ? 'Saving...'
                      : 'Connecting...'
                    : editingIntegrationId
                      ? 'Save settings'
                      : 'Save integration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Logs Modal */}
      {logsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-c-surface rounded-xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-c-text">
                Sync logs{logsModal.providerLabel ? ` — ${logsModal.providerLabel}` : ''}
              </h3>
              <button
                onClick={() =>
                  setLogsModal({ open: false, integrationId: null, loading: false, logs: [] })
                }
                className="px-3 py-1 text-sm text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
              >
                Close
              </button>
            </div>

            {logsModal.loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            ) : logsModal.logs.length === 0 ? (
              <div className="text-sm text-c-text-muted py-10 text-center">No sync logs yet.</div>
            ) : (
              <div className="overflow-auto border border-c-border-subtle dark:border-navy-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-c-surface-raised">
                    <tr>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Started</th>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Status</th>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Type</th>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Processed</th>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Scope</th>
                      <th className="text-left p-3 text-c-text-secondary font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsModal.logs.map((l: any) => (
                      <tr
                        key={l.id}
                        className="border-t border-c-border-subtle dark:border-navy-700"
                      >
                        <td className="p-3 text-c-text">
                          {l.startedAt ? new Date(l.startedAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              l.status === 'success'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : l.status === 'failed'
                                  ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/20 dark:text-danger-400'
                                  : 'bg-c-surface-raised text-c-text-secondary'
                            }`}
                          >
                            {l.status || 'unknown'}
                          </span>
                        </td>
                        <td className="p-3 text-c-text-secondary">{l.syncType || '—'}</td>
                        <td className="p-3 text-c-text-secondary">
                          {typeof l.itemsProcessed === 'number' ? l.itemsProcessed : '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getSyncScopeMeta(l.syncScope).className}`}
                          >
                            {l.syncScopeLabel || getSyncScopeMeta(l.syncScope).label}
                          </span>
                        </td>
                        <td className="p-3 text-c-text-secondary">
                          {typeof l.durationMs === 'number' ? `${l.durationMs}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300">Webhooks</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Webhooks allow you to receive real-time notifications when events happen in
                  Consultify. Configure a URL to receive HTTP POST requests with event data.
                </p>
              </div>
            </div>
          </div>

          {/* Add Webhook Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg font-medium flex items-center gap-2"
            >
              <Plus size={18} />
              Add Webhook
            </button>
          </div>

          {/* Webhooks List */}
          {webhooks.length === 0 ? (
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-12 text-center">
              <Webhook size={48} className="mx-auto text-c-text-secondary mb-4" />
              <h3 className="text-lg font-semibold text-c-text-secondary mb-2">
                No webhooks configured
              </h3>
              <p className="text-c-text-muted text-sm mb-4">
                Create a webhook to start receiving real-time event notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-c-text flex items-center gap-2">
                        {webhook.name}
                        {webhook.isActive ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-c-surface-raised text-c-text-secondary rounded-full">
                            Inactive
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-c-text-muted font-mono mt-1 break-all">
                        {webhook.targetUrl}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestWebhook(webhook.targetUrl)}
                        disabled={testingWebhook}
                        className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg text-c-text-muted hover:text-c-accent transition-colors"
                        title="Test webhook"
                      >
                        {testingWebhook ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="p-2 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg text-c-text-muted hover:text-danger-600 transition-colors"
                        title="Delete webhook"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {webhook.eventTypes.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 text-xs font-medium bg-c-accent-soft text-c-accent rounded"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  {webhook.secretKey && (
                    <div className="pt-4 border-t border-c-border-subtle dark:border-navy-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-c-text-muted">Secret Key:</span>
                        <code className="text-xs bg-c-surface-raised px-2 py-1 rounded font-mono">
                          {showSecret === webhook.id ? webhook.secretKey : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() =>
                            setShowSecret(showSecret === webhook.id ? null : webhook.id)
                          }
                          className="p-1 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded text-c-text-secondary"
                        >
                          {showSecret === webhook.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(webhook.secretKey || '')}
                          className="p-1 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded text-c-text-secondary"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Webhook Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-c-surface rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-c-text">Create Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                  placeholder="My Webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Target URL *
                </label>
                <input
                  type="url"
                  value={webhookForm.targetUrl}
                  onChange={(e) => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                  placeholder="https://your-server.com/webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Events to Subscribe *
                </label>
                <div className="space-y-4 max-h-60 overflow-y-auto border border-c-border-subtle dark:border-navy-700 rounded-lg p-4">
                  {availableEvents.map((category) => (
                    <div key={category.category}>
                      <h4 className="text-sm font-semibold text-c-text-secondary mb-2">
                        {category.category}
                      </h4>
                      <div className="space-y-2">
                        {category.events.map((event) => (
                          <label
                            key={event.type}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={webhookForm.eventTypes.includes(event.type)}
                              onChange={() => toggleEventType(event.type)}
                              className="w-4 h-4 rounded border-c-border-subtle dark:border-navy-700 text-c-accent focus:ring-[color:var(--c-focus)]"
                            />
                            <div>
                              <span className="text-sm font-medium text-c-text-secondary">
                                {event.type}
                              </span>
                              <p className="text-xs text-c-text-muted">{event.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setIsWebhookModalOpen(false);
                    setWebhookForm({ name: '', targetUrl: '', eventTypes: [] });
                  }}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWebhook}
                  disabled={
                    connecting ||
                    !webhookForm.name ||
                    !webhookForm.targetUrl ||
                    webhookForm.eventTypes.length === 0
                  }
                  className="px-4 py-2 bg-c-text text-c-surface rounded-lg hover:bg-c-text disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  {connecting && <Loader2 size={16} className="animate-spin" />}
                  {connecting ? 'Creating...' : 'Create Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MCP Tab */}
      {activeTab === 'mcp' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300">
                  {t('settings.mcp.title', 'MCP Providers')}
                </h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
                  {t(
                    'settings.mcp.description',
                    'Configure external MCP servers (IRIS, Marketplace). Use “Test” to cache the tools list.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => openMcpPreset('iris')}
                disabled={!isAdmin}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={18} />
                {t('settings.mcp.addIris', 'Add IRIS preset')}
              </button>
              <button
                onClick={() => openMcpPreset('marketplace')}
                disabled={!isAdmin}
                className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={18} />
                {t('settings.mcp.addMarketplace', 'Add Marketplace preset')}
              </button>
            </div>
            <button
              onClick={fetchMcpProviders}
              className="px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle dark:border-navy-700 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              {t('common.refresh', 'Refresh')}
            </button>
          </div>

          {mcpLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-indigo-600" />
            </div>
          ) : mcpProviders.length === 0 ? (
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-12 text-center">
              <Database size={48} className="mx-auto text-c-text-secondary mb-4" />
              <h3 className="text-lg font-semibold text-c-text-secondary mb-2">
                {t('settings.mcp.emptyTitle', 'No MCP providers configured')}
              </h3>
              <p className="text-c-text-muted text-sm">
                {t('settings.mcp.emptyHint', 'Add IRIS or Marketplace preset to start.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mcpProviders.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-c-text">{p.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            String(p.status || '').toLowerCase() === 'active'
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-c-surface-raised text-c-text-secondary'
                          }`}
                        >
                          {String(p.status || 'active')}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-600 rounded-full">
                          {String(p.type || 'streamable_http')}
                        </span>
                      </div>
                      {p.last_error ? (
                        <div className="text-sm text-danger-600 dark:text-danger-400 mt-2">
                          {t('common.error', 'Error')}: {String(p.last_error).slice(0, 160)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => testMcpProvider(p.id)}
                        disabled={!isAdmin || testingMcpProviderId === p.id}
                        className="px-3 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised flex items-center gap-2 disabled:opacity-60"
                      >
                        {testingMcpProviderId === p.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                        {t('settings.mcp.test', 'Test + cache tools')}
                      </button>
                      <button
                        onClick={() => openMcpTools(p.id, p.name)}
                        disabled={!isAdmin}
                        className="px-3 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 flex items-center gap-2 disabled:opacity-60"
                      >
                        <Eye size={16} />
                        {t('settings.mcp.viewTools', 'View tools')}
                      </button>
                      <button
                        onClick={() => openAllowlist(p.id)}
                        disabled={!isAdmin}
                        className="px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised dark:border-navy-700 dark:hover:bg-navy-700 flex items-center gap-2 disabled:opacity-60"
                      >
                        <CheckSquare size={16} />
                        {t('settings.mcp.allowlist', 'Allowlist')}
                      </button>
                      <button
                        onClick={() => openEditMcpProvider(p)}
                        disabled={!isAdmin}
                        className="px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised dark:border-navy-700 dark:hover:bg-navy-700 flex items-center gap-2 disabled:opacity-60"
                      >
                        <Settings size={16} />
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        onClick={async () => {
                          if (!isAdmin) {
                            toast.error('Admin permissions required');
                            return;
                          }
                          if (!confirm(`Delete MCP provider "${p.name}"?`)) return;
                          try {
                            await (Api as any).deleteMcpProvider?.(p.id);
                            toast.success('Deleted');
                            await fetchMcpProviders();
                          } catch (e: any) {
                            toast.error(e?.message || 'Failed to delete');
                          }
                        }}
                        disabled={!isAdmin}
                        className="px-3 py-2 rounded-lg text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10 flex items-center gap-2 disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MCP Provider Modal */}
          {mcpModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-c-surface rounded-xl max-w-xl w-full p-6 shadow-2xl">
                <h3 className="text-lg font-bold mb-4 text-c-text">
                  {mcpModal.providerId
                    ? t('settings.mcp.edit', 'Edit MCP provider')
                    : t('settings.mcp.add', 'Add MCP provider')}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('common.name', 'Name')}
                      </label>
                      <input
                        value={mcpModal.name}
                        onChange={(e) => setMcpModal((s) => ({ ...s, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('common.status', 'Status')}
                      </label>
                      <select
                        value={mcpModal.status}
                        onChange={(e) => setMcpModal((s) => ({ ...s, status: e.target.value }))}
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                        <option value="error">error</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      {t('settings.mcp.configJson', 'Config (JSON)')}
                    </label>
                    <textarea
                      value={mcpModal.configInput}
                      onChange={(e) => setMcpModal((s) => ({ ...s, configInput: e.target.value }))}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[180px] font-mono text-xs"
                      placeholder='{"baseUrl":"https://...","mcpPath":"/mcp"}'
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      onClick={() =>
                        setMcpModal({
                          open: false,
                          providerId: null,
                          name: '',
                          status: 'active',
                          configInput: '',
                        })
                      }
                      className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={saveMcpProvider}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                    >
                      {t('common.save', 'Save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MCP Tools Modal */}
          {mcpToolsModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-c-surface rounded-xl max-w-3xl w-full p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-c-text">
                    {t('settings.mcp.toolsCache', 'Tools cache')}
                    {mcpToolsModal.name ? ` — ${mcpToolsModal.name}` : ''}
                  </h3>
                  <button
                    onClick={() =>
                      setMcpToolsModal({
                        open: false,
                        providerId: null,
                        loading: false,
                        tools: null,
                      })
                    }
                    className="px-3 py-1 text-sm text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
                {mcpToolsModal.loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                  </div>
                ) : (
                  <pre className="text-xs bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-xl p-4 overflow-auto max-h-[60vh]">
                    {JSON.stringify(mcpToolsModal.tools, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Allowlist Modal */}
          {allowlistModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-c-surface rounded-xl max-w-xl w-full p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-c-text">
                    {t('settings.mcp.allowlistTitle', 'Provider allowlist')}
                  </h3>
                  <button
                    onClick={() =>
                      setAllowlistModal((s) => ({
                        ...s,
                        open: false,
                        providerId: null,
                        loading: false,
                      }))
                    }
                    className="px-3 py-1 text-sm text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>

                {allowlistModal.loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('settings.mcp.allowlistMode', 'Mode')}
                      </label>
                      <select
                        value={allowlistModal.mode}
                        onChange={(e) =>
                          setAllowlistModal((s) => ({
                            ...s,
                            mode: e.target.value === 'deny' ? 'deny' : 'allow',
                          }))
                        }
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="allow">allow</option>
                        <option value="deny">deny</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('settings.mcp.toolsJson', 'Tools (JSON array)')}
                      </label>
                      <textarea
                        value={allowlistModal.toolsText}
                        onChange={(e) =>
                          setAllowlistModal((s) => ({ ...s, toolsText: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[140px] font-mono text-xs"
                        placeholder='["*"]'
                      />
                      <p className="text-xs text-c-text-muted mt-2">
                        {t(
                          'settings.mcp.allowlistHint',
                          'Use ["*"] to allow/deny everything, or list specific tool names.'
                        )}
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() =>
                          setAllowlistModal((s) => ({
                            ...s,
                            open: false,
                            providerId: null,
                            loading: false,
                          }))
                        }
                        className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={saveAllowlist}
                        disabled={allowlistModal.saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                      >
                        {allowlistModal.saving
                          ? t('common.saving', 'Saving...')
                          : t('common.save', 'Save')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
