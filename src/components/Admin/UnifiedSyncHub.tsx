/**
 * UnifiedSyncHub — T086 + T008
 *
 * Integrations command center with four tabs:
 * - Connected Apps (status, actions)
 * - Sync Health (runs, errors, guardrails)
 * - Webhooks
 * - Audit Log
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Layers,
  Link2Off,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Unplug,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  V8MultiplayerApi,
  type V8MultiplayerLockRecord,
  type V8MultiplayerResourceMapping,
  type V8MultiplayerRoomBinding,
  type V8MultiplayerSurfacePresence,
} from '@/services/api/v8/multiplayer';
import {
  V8SyncApi,
  shouldFallbackToLegacySync,
  type V8SyncConnectorAuthState,
  type V8SyncAuditEntry,
  type V8SyncAuthEscalation,
  type V8SyncConnectorHealthSummary,
  type V8SyncCatalogConnector,
  type V8SyncConflictRecord,
  type V8SyncCredentialHealthSummary,
  type V8SyncErrorItem,
  type V8SyncHealthSummary,
  type V8SyncInitiatedIntegration,
  type V8SyncIntegrationInventoryRow,
  type V8SyncProviderFamily,
  type V8SyncRefreshTimingPolicy,
} from '@/services/api/v8/sync';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';

// ── Types ──────────────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'requires_reauth';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type TabId = 'apps' | 'health' | 'webhooks' | 'audit';

interface SyncRun {
  id: string;
  status: string;
  items_processed: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
}

interface ConnectorInfo {
  id: string;
  name: string;
  category: string;
  capabilities: string[];
  authType: string;
  configFields: string[];
}

interface IntegrationItem {
  id: string;
  connectorId: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  health: HealthStatus;
  errorRate: number;
  unresolvedErrors: number;
  lastRun: SyncRun | null;
  configuredFields: string[];
  onboardingStatus:
    | 'pending_external_auth_or_configuration'
    | 'pending_external_auth'
    | 'authorization_callback_received_pending_verification'
    | 'pending_configuration'
    | 'configuration_submitted_pending_validation'
    | null;
  credential: {
    providerAccountId: string;
    workspaceOrTenantId: string;
    scopesGranted: string[];
    tokenExpiresAt: string | null;
    lastVerificationAt: string | null;
    lastRefreshAt: string | null;
    lastRefreshResult: 'success' | 'transient_failure' | 'credential_expired' | 'scope_revoked' | null;
  } | null;
  connector: ConnectorInfo | null;
}

interface ExternalAuthSessionInfo {
  callbackUrl: string;
  state: string;
  expiresAt: string;
}

interface CredentialDraft {
  providerAccountId: string;
  workspaceOrTenantId: string;
  scopesGranted: string;
  tokenExpiresAt: string;
}

type RefreshResultDraft = 'success' | 'transient_failure' | 'credential_expired' | 'scope_revoked';

interface CatalogConnector extends ConnectorInfo {
  isV2Ready: boolean;
  comingSoon: boolean;
}

interface AuditEntry {
  id: string;
  integration_id: string;
  action: string;
  actor_name: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface SyncErrorItem {
  id: string;
  integrationId: string;
  errorType: string;
  errorMessage: string;
  isRetryable: boolean;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

interface V8ConnectorHealthTarget {
  connectorId: string;
  name: string;
  category: string;
}

interface V8RefreshPolicyTarget {
  providerFamily: V8SyncProviderFamily;
  providerLabel: string;
  connectorId: string;
  integrationName: string;
}

// ── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  connected: {
    label: 'Connected',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: <CheckCircle2 size={14} />,
  },
  disconnected: {
    label: 'Disconnected',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    icon: <Link2Off size={14} />,
  },
  error: {
    label: 'Error',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    icon: <XCircle size={14} />,
  },
  pending: {
    label: 'Pending',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: <Loader2 size={14} className="animate-spin" />,
  },
  requires_reauth: {
    label: 'Reauth Required',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    icon: <ShieldAlert size={14} />,
  },
};

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; dot: string }> = {
  healthy: { label: 'Healthy', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  degraded: { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400' },
  unhealthy: { label: 'Unhealthy', color: 'text-red-400', dot: 'bg-red-400' },
};

const CONNECTOR_PROVIDER_FAMILY_MAP: Partial<Record<string, V8SyncProviderFamily>> = {
  jira: 'atlassian',
  gmail: 'google_workspace',
  teams: 'microsoft_365',
  asana: 'asana',
  linear: 'linear',
  clickup: 'clickup',
  monday: 'monday',
};

const PROVIDER_FAMILY_LABELS: Record<V8SyncProviderFamily, string> = {
  google_workspace: 'Google Workspace',
  microsoft_365: 'Microsoft 365',
  atlassian: 'Atlassian',
  asana: 'Asana',
  monday: 'Monday',
  clickup: 'ClickUp',
  linear: 'Linear',
};

const GOVERNED_REFRESH_POLICY_PRESETS: Record<
  V8SyncProviderFamily,
  { typicalTokenLifetimeMinutes: number; refreshWindowMinutes: number; maxRetryAttempts: number }
> = {
  google_workspace: { typicalTokenLifetimeMinutes: 60, refreshWindowMinutes: 10, maxRetryAttempts: 3 },
  microsoft_365: { typicalTokenLifetimeMinutes: 60, refreshWindowMinutes: 10, maxRetryAttempts: 3 },
  atlassian: { typicalTokenLifetimeMinutes: 120, refreshWindowMinutes: 15, maxRetryAttempts: 5 },
  asana: { typicalTokenLifetimeMinutes: 120, refreshWindowMinutes: 15, maxRetryAttempts: 4 },
  monday: { typicalTokenLifetimeMinutes: 120, refreshWindowMinutes: 15, maxRetryAttempts: 4 },
  clickup: { typicalTokenLifetimeMinutes: 120, refreshWindowMinutes: 15, maxRetryAttempts: 4 },
  linear: { typicalTokenLifetimeMinutes: 120, refreshWindowMinutes: 15, maxRetryAttempts: 4 },
};

function getProviderFamily(connectorId: string): V8SyncProviderFamily | null {
  return CONNECTOR_PROVIDER_FAMILY_MAP[connectorId.trim().toLowerCase()] ?? null;
}

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  project_management: 'Project Management',
  erp: 'ERP',
  crm: 'CRM',
  business_intelligence: 'BI Tools',
  hris: 'HRIS',
  finance: 'Finance',
  collaboration: 'Collaboration',
  calendar: 'Calendar',
  storage: 'Cloud Storage',
  email: 'Email',
};

const CATEGORY_ICONS: Record<string, string> = {
  communication: '💬',
  project_management: '📋',
  erp: '🏢',
  crm: '🤝',
  business_intelligence: '📊',
  hris: '👥',
  finance: '💰',
  collaboration: '🔗',
  calendar: '📅',
  storage: '☁️',
  email: '✉️',
};

// ── Helpers ────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatConfigFieldLabel(field: string): string {
  return field.replace(/_/g, ' ');
}

function isSecretConfigField(field: string): boolean {
  return field.includes('secret') || field.includes('token');
}

// ── Component ──────────────────────────────────────────────────

export const UnifiedSyncHub: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabId>('apps');
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogConnector[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [errors, setErrors] = useState<SyncErrorItem[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [v8WorkspaceMapping, setV8WorkspaceMapping] =
    useState<V8MultiplayerResourceMapping | null>(null);
  const [v8WorkspaceBinding, setV8WorkspaceBinding] = useState<V8MultiplayerRoomBinding | null>(null);
  const [v8WorkspacePresence, setV8WorkspacePresence] = useState<V8MultiplayerSurfacePresence[]>([]);
  const [v8WorkspaceLocks, setV8WorkspaceLocks] = useState<V8MultiplayerLockRecord[]>([]);
  const [v8AuthHealthSummary, setV8AuthHealthSummary] =
    useState<V8SyncCredentialHealthSummary | null>(null);
  const [v8AuthEscalations, setV8AuthEscalations] = useState<V8SyncAuthEscalation[]>([]);
  const [v8ConnectorHealth, setV8ConnectorHealth] = useState<
    Record<string, V8SyncConnectorHealthSummary>
  >({});
  const [v8ConnectorHealthLoading, setV8ConnectorHealthLoading] = useState(false);
  const [v8Conflicts, setV8Conflicts] = useState<V8SyncConflictRecord[]>([]);
  const [v8RefreshPolicies, setV8RefreshPolicies] = useState<
    Partial<Record<V8SyncProviderFamily, V8SyncRefreshTimingPolicy | null>>
  >({});
  const [mutatingConnectorAuthId, setMutatingConnectorAuthId] = useState<string | null>(null);
  const [resolvingAuthEscalationId, setResolvingAuthEscalationId] = useState<string | null>(null);
  const [recoveringAuthEscalationConnectorId, setRecoveringAuthEscalationConnectorId] = useState<string | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [mutatingRefreshPolicyFamily, setMutatingRefreshPolicyFamily] =
    useState<V8SyncProviderFamily | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingPendingConfigId, setEditingPendingConfigId] = useState<string | null>(null);
  const [savingPendingConfigId, setSavingPendingConfigId] = useState<string | null>(null);
  const [pendingConfigDrafts, setPendingConfigDrafts] = useState<Record<string, Record<string, string>>>({});
  const [externalAuthSessions, setExternalAuthSessions] = useState<Record<string, ExternalAuthSessionInfo>>({});
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [savingCredentialId, setSavingCredentialId] = useState<string | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, CredentialDraft>>({});
  const [editingRefreshResultId, setEditingRefreshResultId] = useState<string | null>(null);
  const [savingRefreshResultId, setSavingRefreshResultId] = useState<string | null>(null);
  const [refreshResultDrafts, setRefreshResultDrafts] = useState<Record<string, RefreshResultDraft>>({});

  const v8ConnectorHealthTargets = useMemo<V8ConnectorHealthTarget[]>(() => {
    const byConnectorId = new Map<string, V8ConnectorHealthTarget>();

    integrations.forEach((integration) => {
      const connectorId = integration.connectorId?.trim();
      if (!connectorId || byConnectorId.has(connectorId)) return;
      byConnectorId.set(connectorId, {
        connectorId,
        name: integration.name,
        category: integration.category,
      });
    });

    if (byConnectorId.size === 0) {
      catalog
        .filter((connector) => connector.isV2Ready && !connector.comingSoon)
        .slice(0, 5)
        .forEach((connector) => {
          const connectorId = connector.id?.trim();
          if (!connectorId || byConnectorId.has(connectorId)) return;
          byConnectorId.set(connectorId, {
            connectorId,
            name: connector.name,
            category: connector.category,
          });
        });
    }

    return Array.from(byConnectorId.values()).slice(0, 5);
  }, [catalog, integrations]);

  const v8RefreshPolicyTargets = useMemo<V8RefreshPolicyTarget[]>(() => {
    const byFamily = new Map<V8SyncProviderFamily, V8RefreshPolicyTarget>();

    integrations.forEach((integration) => {
      const providerFamily = getProviderFamily(integration.connectorId);
      if (!providerFamily || byFamily.has(providerFamily)) return;
      byFamily.set(providerFamily, {
        providerFamily,
        providerLabel: PROVIDER_FAMILY_LABELS[providerFamily],
        connectorId: integration.connectorId,
        integrationName: integration.name,
      });
    });

    return Array.from(byFamily.values());
  }, [integrations]);

  // ── Data loading ─────────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await V8SyncApi.getIntegrations();
      setIntegrations((data.integrations || []) as IntegrationItem[]);
      return;
    } catch {
      try {
        const res = await fetch(`${API_URL}/sync-hub/integrations`, { headers: getHeaders() });
        if (res.ok) {
          const data = (await res.json()) as { integrations?: V8SyncIntegrationInventoryRow[] };
          setIntegrations((data.integrations || []) as IntegrationItem[]);
        }
      } catch {
        /* handled below */
      }
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      try {
        const data = await V8SyncApi.getConnectors();
        setCatalog((data.connectors || []) as CatalogConnector[]);
        return;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
      }
      const res = await fetch(`${API_URL}/sync-hub/connectors`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.connectors || []);
      }
    } catch {
      /* */
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      try {
        const data = await V8SyncApi.getHubHealth();
        setHealthSummary((data.summary || null) as V8SyncHealthSummary | null);
        return;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
      }
      const res = await fetch(`${API_URL}/sync-hub/health`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHealthSummary(data.summary);
      }
    } catch {
      /* */
    }
  }, []);

  const fetchErrors = useCallback(async () => {
    try {
      try {
        const data = await V8SyncApi.getErrors();
        setErrors((data.errors || []) as SyncErrorItem[]);
        return;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
      }
      const res = await fetch(`${API_URL}/sync-hub/errors`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setErrors(data.errors || []);
      }
    } catch {
      /* */
    }
  }, []);

  const fetchV8AuthHealth = useCallback(async () => {
    try {
      const data = await V8SyncApi.getAuthHealth();
      setV8AuthHealthSummary(data.summary);
    } catch {
      setV8AuthHealthSummary(null);
    }
  }, []);

  const fetchV8AuthEscalations = useCallback(async () => {
    try {
      const data = await V8SyncApi.getAuthEscalations();
      setV8AuthEscalations(data.escalations || []);
    } catch {
      setV8AuthEscalations([]);
    }
  }, []);

  const fetchV8Conflicts = useCallback(async () => {
    try {
      const data = await V8SyncApi.getConflicts(10);
      setV8Conflicts(data.conflicts || []);
    } catch {
      setV8Conflicts([]);
    }
  }, []);

  const fetchV8RefreshPolicies = useCallback(async () => {
    if (v8RefreshPolicyTargets.length === 0) {
      setV8RefreshPolicies({});
      return;
    }

    const results = await Promise.all(
      v8RefreshPolicyTargets.map(async (target) => {
        try {
          const data = await V8SyncApi.getRefreshTimingPolicy(target.providerFamily);
          return [target.providerFamily, data.policy ?? null] as const;
        } catch {
          return [target.providerFamily, null] as const;
        }
      }),
    );

    setV8RefreshPolicies(Object.fromEntries(results));
  }, [v8RefreshPolicyTargets]);

  const fetchV8ConnectorHealth = useCallback(async () => {
    if (v8ConnectorHealthTargets.length === 0) {
      setV8ConnectorHealth({});
      return;
    }

    setV8ConnectorHealthLoading(true);
    try {
      const results = await Promise.all(
        v8ConnectorHealthTargets.map(async (target) => {
          try {
            const data = await V8SyncApi.getConnectorHealth(target.connectorId);
            return [target.connectorId, data.health] as const;
          } catch {
            return [target.connectorId, null] as const;
          }
        }),
      );

      setV8ConnectorHealth(
        Object.fromEntries(
          results.filter((entry): entry is [string, V8SyncConnectorHealthSummary] => entry[1] !== null),
        ),
      );
    } finally {
      setV8ConnectorHealthLoading(false);
    }
  }, [v8ConnectorHealthTargets]);

  const fetchV8WorkspaceMapping = useCallback(async () => {
    try {
      const data = await V8MultiplayerApi.getWorkspaceMapping();
      setV8WorkspaceMapping(data.mapping);
    } catch {
      setV8WorkspaceMapping(null);
    }
  }, []);

  const fetchV8WorkspaceBinding = useCallback(async () => {
    if (!currentOrganization?.id) {
      setV8WorkspaceBinding(null);
      return null;
    }

    try {
      const data = await V8MultiplayerApi.getRoomBinding('workspace', currentOrganization.id);
      setV8WorkspaceBinding(data.binding);
      return data.binding;
    } catch {
      setV8WorkspaceBinding(null);
      return null;
    }
  }, [currentOrganization?.id]);

  const fetchV8WorkspacePresenceAndLocks = useCallback(
    async (binding?: V8MultiplayerRoomBinding | null) => {
      const resolvedBinding = binding ?? (await fetchV8WorkspaceBinding());
      const roomId = resolvedBinding?.roomResourceId;

      if (!roomId) {
        setV8WorkspacePresence([]);
        setV8WorkspaceLocks([]);
        return;
      }

      try {
        const [presenceData, locksData] = await Promise.all([
          V8MultiplayerApi.getRoomPresence(roomId),
          V8MultiplayerApi.getRoomLocks(roomId),
        ]);
        setV8WorkspacePresence(presenceData.presence || []);
        setV8WorkspaceLocks(locksData.locks || []);
      } catch {
        setV8WorkspacePresence([]);
        setV8WorkspaceLocks([]);
      }
    },
    [fetchV8WorkspaceBinding]
  );

  const fetchAuditLog = useCallback(async () => {
    try {
      try {
        const data = await V8SyncApi.getAuditLog();
        setAuditLog((data.entries || []) as V8SyncAuditEntry[]);
        return;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
      }
      const res = await fetch(`${API_URL}/sync-hub/audit-log`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.entries || []);
      }
    } catch {
      /* */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      fetchIntegrations(),
      fetchCatalog(),
      fetchHealth(),
      fetchErrors(),
      fetchAuditLog(),
      fetchV8AuthHealth(),
      fetchV8AuthEscalations(),
      fetchV8Conflicts(),
      fetchV8RefreshPolicies(),
      fetchV8WorkspaceMapping(),
      fetchV8WorkspaceBinding(),
    ]);
    const workspaceBinding = results[10] as V8MultiplayerRoomBinding | null;
    await fetchV8WorkspacePresenceAndLocks(workspaceBinding);
    setLoading(false);
  }, [
    fetchIntegrations,
    fetchCatalog,
    fetchHealth,
    fetchErrors,
    fetchAuditLog,
    fetchV8AuthHealth,
    fetchV8AuthEscalations,
    fetchV8Conflicts,
    fetchV8RefreshPolicies,
    fetchV8WorkspaceMapping,
    fetchV8WorkspaceBinding,
    fetchV8WorkspacePresenceAndLocks,
  ]);

  useEffect(() => {
    loadAll();
    trackFunnelEvent('integration_sync_hub_viewed');
  }, [loadAll]);

  useEffect(() => {
    if (activeTab !== 'health') return;
    void fetchV8ConnectorHealth();
  }, [activeTab, fetchV8ConnectorHealth]);

  useEffect(() => {
    if (activeTab !== 'webhooks') return;
    void fetchV8RefreshPolicies();
  }, [activeTab, fetchV8RefreshPolicies]);

  // ── Actions ──────────────────────────────────────────────────

  const handleConnect = async (connectorId: string) => {
    try {
      let initiatedIntegration: V8SyncInitiatedIntegration | null = null;
      try {
        const data = await V8SyncApi.connectIntegration(connectorId);
        initiatedIntegration = data.integration;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }

        const res = await fetch(`${API_URL}/sync-hub/connect`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ connectorId, config: {} }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to connect');
          return;
        }

        const data = (await res.json()) as { integration?: { id: string; status?: string } };
        if (data.integration?.id) {
          initiatedIntegration = {
            id: data.integration.id,
            connectorId,
            name: connectorId,
            category: 'collaboration',
            status: (data.integration.status === 'pending' ? 'pending' : 'pending') as const,
            capabilities: [],
            authType: 'oauth2',
            configFields: [],
            scopes: [],
          };
        }
      }

      if (initiatedIntegration) {
        toast.success(
          t(
            'integrations.syncHub.connectInitiated',
            'Connection started. The integration is pending external auth or configuration.',
          ),
        );
        trackFunnelEvent('integration_connect_initiated', {
          connectorId,
          status: initiatedIntegration.status,
        });
        setShowConnectModal(false);
        await loadAll();
      }
    } catch {
      toast.error(t('integrations.syncHub.connectFailed', 'Connection failed'));
    }
  };

  const handlePendingConfigDraftChange = (
    integrationId: string,
    field: string,
    value: string,
  ) => {
    setPendingConfigDrafts((current) => ({
      ...current,
      [integrationId]: {
        ...(current[integrationId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSavePendingConfig = async (integration: IntegrationItem) => {
    const draft = pendingConfigDrafts[integration.id] || {};
    const config = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => value.trim().length > 0),
    );

    if (Object.keys(config).length === 0) {
      toast.error(
        t('integrations.syncHub.setupConfigMissing', 'Enter at least one provider configuration value.'),
      );
      return;
    }

    setSavingPendingConfigId(integration.id);
    try {
      let onboardingStatus = integration.onboardingStatus;
      try {
        const data = await V8SyncApi.configureIntegration(integration.id, { config });
        onboardingStatus = data.integration.onboardingStatus;
        if (data.externalAuth) {
          setExternalAuthSessions((current) => ({ ...current, [integration.id]: data.externalAuth }));
        }
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }

        const res = await fetch(`${API_URL}/integrations/${integration.id}/settings`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ settings: config }),
        });
        if (!res.ok) {
          throw new Error('Failed to save integration configuration');
        }
      }

      toast.success(
        onboardingStatus === 'pending_external_auth'
          ? t(
              'integrations.syncHub.setupConfigSavedAuthPending',
              'Configuration saved. External auth still needs to finish before sync controls become available.',
            )
          : t(
              'integrations.syncHub.setupConfigSaved',
              'Configuration saved. Finish the remaining onboarding steps before sync controls become available.',
            ),
      );
      trackFunnelEvent('integration_config_saved', {
        integrationId: integration.id,
        connectorId: integration.connectorId,
      });
      setEditingPendingConfigId(null);
      setPendingConfigDrafts((current) => ({ ...current, [integration.id]: {} }));
      await loadAll();
    } catch {
      toast.error(
        t('integrations.syncHub.setupConfigSaveFailed', 'Failed to save provider configuration.'),
      );
    } finally {
      setSavingPendingConfigId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      let res: Response | null = null;
      try {
        await V8SyncApi.disconnectIntegration(integrationId);
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
        res = await fetch(`${API_URL}/sync-hub/disconnect/${integrationId}`, {
          method: 'POST',
          headers: getHeaders(),
        });
      }
      if (!res || res.ok) {
        toast.success(t('integrations.syncHub.disconnected', 'Integration disconnected'));
        trackFunnelEvent('integration_disconnected', { integrationId });
        await loadAll();
      }
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleReauth = async (integrationId: string) => {
    try {
      try {
        const data = await V8SyncApi.reauthIntegration(integrationId);
        if (data.externalAuth) {
          setExternalAuthSessions((current) => ({ ...current, [integrationId]: data.externalAuth }));
        }
        toast.success(
          data.onboardingStatus === 'pending_external_auth'
            ? t(
                'integrations.syncHub.reauthPendingAuth',
                'Re-authorization started. External auth still needs to complete before sync resumes.',
              )
            : t('integrations.syncHub.reauthStarted', 'Re-authorization started'),
        );
        trackFunnelEvent('integration_reauth_started', { integrationId, onboardingStatus: data.onboardingStatus });
        await loadAll();
        return;
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
      }

      const res = await fetch(`${API_URL}/sync-hub/reauth/${integrationId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('integrations.syncHub.reauthStarted', 'Re-authorization started'));
        trackFunnelEvent('integration_reauth_started', { integrationId });
        await loadAll();
      }
    } catch {
      toast.error('Reauth failed');
    }
  };

  const handlePause = async (integrationId: string) => {
    try {
      try {
        await V8SyncApi.pauseIntegration(integrationId);
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
        await fetch(`${API_URL}/sync-hub/pause/${integrationId}`, {
          method: 'POST',
          headers: getHeaders(),
        });
      }
      toast.success(t('integrations.syncHub.paused', 'Sync paused'));
      await loadAll();
    } catch {
      /* */
    }
  };

  const handleResume = async (integrationId: string) => {
    try {
      try {
        await V8SyncApi.resumeIntegration(integrationId);
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
        await fetch(`${API_URL}/sync-hub/resume/${integrationId}`, {
          method: 'POST',
          headers: getHeaders(),
        });
      }
      toast.success(t('integrations.syncHub.resumed', 'Sync resumed'));
      await loadAll();
    } catch {
      /* */
    }
  };

  const handleSync = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
      try {
        const data = await V8SyncApi.runIntegrationSync(integrationId);
        toast.success(t('integrations.syncHub.syncComplete', 'Sync completed'));
        trackFunnelEvent('integration_sync_run_completed', { integrationId, status: 'success' });
        if (data.warnings?.length) {
          data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }));
        }
      } catch (error: any) {
        if (!shouldFallbackToLegacySync(error)) {
          if (Number(error?.status) === 429) {
            toast.error(error?.reason || error?.message || 'Rate limited');
            trackFunnelEvent('integration_sync_run_completed', {
              integrationId,
              status: 'rate_limited',
            });
          } else {
            toast.error(error?.error || error?.message || 'Sync failed');
            trackFunnelEvent('integration_sync_run_completed', { integrationId, status: 'failed' });
          }
          await loadAll();
          return;
        }

        const res = await fetch(`${API_URL}/sync-hub/sync/${integrationId}`, {
          method: 'POST',
          headers: getHeaders(),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(t('integrations.syncHub.syncComplete', 'Sync completed'));
          trackFunnelEvent('integration_sync_run_completed', { integrationId, status: 'success' });
          if (data.warnings?.length) {
            data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }));
          }
        } else if (res.status === 429) {
          toast.error(data.reason || 'Rate limited');
          trackFunnelEvent('integration_sync_run_completed', {
            integrationId,
            status: 'rate_limited',
          });
        } else {
          toast.error(data.error || 'Sync failed');
          trackFunnelEvent('integration_sync_run_completed', { integrationId, status: 'failed' });
        }
      }
      await loadAll();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleResolveError = async (errorId: string) => {
    try {
      try {
        await V8SyncApi.resolveError(errorId);
      } catch (error) {
        if (!shouldFallbackToLegacySync(error)) {
          throw error;
        }
        await fetch(`${API_URL}/sync-hub/errors/${errorId}/resolve`, {
          method: 'POST',
          headers: getHeaders(),
        });
      }
      toast.success('Error resolved');
      await fetchErrors();
    } catch {
      /* */
    }
  };

  const handleResolveV8Conflict = async (conflictId: string) => {
    setResolvingConflictId(conflictId);
    try {
      await V8SyncApi.resolveConflict(conflictId, 'dismiss');
      toast.success(t('integrations.syncHub.v8ConflictResolved', 'Governed conflict resolved'));
      await Promise.all([fetchV8Conflicts(), fetchV8ConnectorHealth(), fetchIntegrations()]);
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8ConflictResolveFailed',
          'Failed to resolve governed conflict',
        ),
      );
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleSetV8ConnectorAuthState = async (
    connectorId: string,
    targetState: V8SyncConnectorAuthState,
    reason?: string,
  ) => {
    setMutatingConnectorAuthId(`${connectorId}:${targetState}`);
    try {
      await V8SyncApi.setConnectorAuthState(connectorId, targetState, reason ?? null);
      toast.success(
        targetState === 'healthy'
          ? t('integrations.syncHub.v8AuthMarkedHealthy', 'Governed auth state marked healthy')
          : t(
              'integrations.syncHub.v8AuthMarkedNeedsReauth',
              'Governed auth state marked reauth needed',
            ),
      );
      await Promise.all([loadAll(), fetchV8ConnectorHealth(), fetchV8AuthHealth(), fetchV8AuthEscalations()]);
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8AuthStateUpdateFailed',
          'Failed to update governed auth state',
        ),
      );
    } finally {
      setMutatingConnectorAuthId(null);
    }
  };

  const handleMarkVerificationComplete = async (integration: IntegrationItem) => {
    await handleSetV8ConnectorAuthState(
      integration.connectorId,
      'healthy',
      'callback_verification_completed',
    );
  };

  const handleCredentialDraftChange = (
    integrationId: string,
    field: keyof CredentialDraft,
    value: string,
  ) => {
    setCredentialDrafts((current) => ({
      ...current,
      [integrationId]: {
        providerAccountId: current[integrationId]?.providerAccountId || '',
        workspaceOrTenantId: current[integrationId]?.workspaceOrTenantId || '',
        scopesGranted: current[integrationId]?.scopesGranted || '',
        tokenExpiresAt: current[integrationId]?.tokenExpiresAt || '',
        [field]: value,
      },
    }));
  };

  const handleSaveCredential = async (integration: IntegrationItem) => {
    const draft = credentialDrafts[integration.id] || {
      providerAccountId: '',
      workspaceOrTenantId: '',
      scopesGranted: '',
      tokenExpiresAt: '',
    };
    const scopesGranted = draft.scopesGranted
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!draft.providerAccountId.trim() || !draft.workspaceOrTenantId.trim() || scopesGranted.length === 0) {
      toast.error(
        t(
          'integrations.syncHub.credentialMaterializationFieldsRequired',
          'Provider account, workspace or tenant, and at least one scope are required.',
        ),
      );
      return;
    }

    setSavingCredentialId(integration.id);
    try {
      await V8SyncApi.materializeCredential(integration.id, {
        providerAccountId: draft.providerAccountId.trim(),
        workspaceOrTenantId: draft.workspaceOrTenantId.trim(),
        scopesGranted,
        tokenExpiresAt: draft.tokenExpiresAt.trim() || null,
      });
      toast.success(
        t(
          'integrations.syncHub.credentialMaterialized',
          'Governed credential baseline recorded',
        ),
      );
      setEditingCredentialId(null);
      await loadAll();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.credentialMaterializationFailed',
          'Failed to record governed credential baseline',
        ),
      );
    } finally {
      setSavingCredentialId(null);
    }
  };

  const handleRefreshResultDraftChange = (integrationId: string, value: RefreshResultDraft) => {
    setRefreshResultDrafts((current) => ({
      ...current,
      [integrationId]: value,
    }));
  };

  const handleSaveRefreshResult = async (integration: IntegrationItem) => {
    const result = refreshResultDrafts[integration.id] || 'success';
    setSavingRefreshResultId(integration.id);
    try {
      const data = await V8SyncApi.recordRefreshResult(integration.id, { result });
      toast.success(
        data.authTransition === 'degraded_reauth_needed'
          ? t(
              'integrations.syncHub.refreshResultRecordedNeedsReauth',
              'Governed refresh result recorded and reauthorization is now required',
            )
          : t(
              'integrations.syncHub.refreshResultRecorded',
              'Governed refresh result recorded',
            ),
      );
      setEditingRefreshResultId(null);
      await loadAll();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.refreshResultRecordFailed',
          'Failed to record governed refresh result',
        ),
      );
    } finally {
      setSavingRefreshResultId(null);
    }
  };

  const handleResolveV8AuthEscalation = async (escalationId: string) => {
    setResolvingAuthEscalationId(escalationId);
    try {
      await V8SyncApi.resolveAuthEscalation(escalationId);
      toast.success(
        t('integrations.syncHub.v8AuthEscalationResolved', 'Governed auth escalation resolved'),
      );
      await Promise.all([fetchV8AuthEscalations(), fetchV8AuthHealth()]);
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8AuthEscalationResolveFailed',
          'Failed to resolve governed auth escalation',
        ),
      );
    } finally {
      setResolvingAuthEscalationId(null);
    }
  };

  const handleRecoverV8AuthEscalation = async (connectorId: string) => {
    const recoveryTarget = integrations.find(
      (integration) =>
        integration.connectorId === connectorId &&
        integration.connector?.authType === 'oauth2' &&
        integration.status === 'requires_reauth',
    );

    if (!recoveryTarget) {
      toast.error(
        t(
          'integrations.syncHub.v8AuthEscalationRecoveryUnavailable',
          'No governed re-authorization target is available for this escalation yet',
        ),
      );
      return;
    }

    setRecoveringAuthEscalationConnectorId(connectorId);
    try {
      await handleReauth(recoveryTarget.id);
    } finally {
      setRecoveringAuthEscalationConnectorId(null);
    }
  };

  const handleApplyGovernedRefreshPolicy = async (providerFamily: V8SyncProviderFamily) => {
    setMutatingRefreshPolicyFamily(providerFamily);
    try {
      await V8SyncApi.setRefreshTimingPolicy(
        providerFamily,
        GOVERNED_REFRESH_POLICY_PRESETS[providerFamily],
      );
      toast.success(
        t(
          'integrations.syncHub.v8RefreshPolicyApplied',
          'Governed refresh timing policy applied',
        ),
      );
      await fetchV8RefreshPolicies();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8RefreshPolicyApplyFailed',
          'Failed to apply governed refresh timing policy',
        ),
      );
    } finally {
      setMutatingRefreshPolicyFamily(null);
    }
  };

  // ── Filtered data ────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!searchQuery) return integrations;
    const q = searchQuery.toLowerCase();
    return integrations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.connectorId.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [integrations, searchQuery]);

  const categorizedCatalog = useMemo(() => {
    const groups: Record<string, CatalogConnector[]> = {};
    catalog.forEach((c) => {
      const cat = c.category;
      if (!groups[cat]) groups[cat] = [];
      if (!selectedCategory || cat === selectedCategory) {
        groups[cat].push(c);
      }
    });
    return groups;
  }, [catalog, selectedCategory]);

  // ── Tab definitions ──────────────────────────────────────────

  const TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'apps',
      label: t('integrations.syncHub.tabs.apps', 'Connected Apps'),
      icon: <Zap size={16} />,
      badge: integrations.filter((i) => i.status === 'connected').length,
    },
    {
      id: 'health',
      label: t('integrations.syncHub.tabs.health', 'Sync Health'),
      icon: <Activity size={16} />,
      badge: errors.length > 0 ? errors.length : undefined,
    },
    {
      id: 'webhooks',
      label: t('integrations.syncHub.tabs.webhooks', 'Permissions & Scopes'),
      icon: <Shield size={16} />,
    },
    {
      id: 'audit',
      label: t('integrations.syncHub.tabs.audit', 'Audit Log'),
      icon: <Layers size={16} />,
    },
  ];

  // ── Renders ──────────────────────────────────────────────────

  const renderStatusChip = (status: IntegrationStatus) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  const renderHealthDot = (health: HealthStatus) => {
    const cfg = HEALTH_CONFIG[health];
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className={cfg.color}>{cfg.label}</span>
      </span>
    );
  };

  const renderIntegrationRow = (int: IntegrationItem) => {
    const isExpanded = expandedId === int.id;
    const isSyncing = syncing === int.id;
    const isPendingOnboarding = int.status === 'pending';
    const canRunSync =
      !isPendingOnboarding && int.status !== 'disconnected' && int.status !== 'requires_reauth';
    const canPause = !isPendingOnboarding && int.status !== 'disconnected';
    const canResume = !isPendingOnboarding;
    const configuredFieldSet = new Set(int.configuredFields || []);
    const missingConfigFields = (int.connector?.configFields || []).filter(
      (field) => !configuredFieldSet.has(field),
    );
    const isEditingPendingConfig = editingPendingConfigId === int.id;
    const isEditingCredential = editingCredentialId === int.id;
    const externalAuthSession = externalAuthSessions[int.id] || null;
    const providerFamily = getProviderFamily(int.connectorId);
    const canMaterializeCredential =
      int.status === 'connected' && int.connector?.authType === 'oauth2' && providerFamily !== null;
    const canRecordRefreshResult =
      int.credential !== null && int.connector?.authType === 'oauth2' && providerFamily !== null;
    const credentialDraft = credentialDrafts[int.id] || {
      providerAccountId: int.credential?.providerAccountId || '',
      workspaceOrTenantId: int.credential?.workspaceOrTenantId || '',
      scopesGranted: int.credential?.scopesGranted?.join(', ') || '',
      tokenExpiresAt: int.credential?.tokenExpiresAt || '',
    };
    const refreshResultDraft = refreshResultDrafts[int.id] || 'success';
    const pendingSetupDescription =
      int.onboardingStatus === 'pending_external_auth'
        ? t(
            'integrations.syncHub.setupPendingAuthOnlyDesc',
            'Required provider configuration is saved. Complete external auth before sync controls become available.',
          )
        : int.onboardingStatus === 'authorization_callback_received_pending_verification'
          ? t(
              'integrations.syncHub.setupCallbackReceivedDesc',
              'The external authorization callback was received. Verification is still pending before sync controls become available.',
            )
        : int.onboardingStatus === 'configuration_submitted_pending_validation'
          ? t(
              'integrations.syncHub.setupPendingValidationDesc',
              'Configuration is saved. Provider validation must finish before sync controls become available.',
            )
          : int.onboardingStatus === 'pending_configuration'
            ? t(
                'integrations.syncHub.setupPendingConfigOnlyDesc',
                'Finish provider configuration before sync controls become available.',
              )
            : t(
                'integrations.syncHub.setupPendingDesc',
                'Complete external auth or provider configuration before sync controls become available.',
              );

    return (
      <motion.div
        key={int.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border border-navy-700/50 rounded-lg bg-navy-900/40 hover:bg-navy-800/60 transition-colors"
      >
        <div
          className="flex items-center gap-4 px-4 py-3 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : int.id)}
        >
          {/* Icon */}
          <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center text-lg shrink-0">
            {CATEGORY_ICONS[int.category] || '🔌'}
          </div>

          {/* Name + category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{int.name}</span>
              {renderStatusChip(int.status)}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500">
                {CATEGORY_LABELS[int.category] || int.category}
              </span>
              {renderHealthDot(int.health)}
            </div>
          </div>

          {/* Last sync */}
          <div className="hidden md:block text-right shrink-0 w-28">
            <div className="text-xs text-slate-400">
              {t('integrations.syncHub.lastSync', 'Last sync')}
            </div>
            <div className="text-xs text-slate-300">{timeAgo(int.lastSyncAt)}</div>
          </div>

          {/* Last run status */}
          <div className="hidden lg:block text-right shrink-0 w-24">
            {int.lastRun && (
              <>
                <div className="text-xs text-slate-400">
                  {t('integrations.syncHub.lastResult', 'Last result')}
                </div>
                <div
                  className={`text-xs ${int.lastRun.status === 'completed' ? 'text-emerald-400' : int.lastRun.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}
                >
                  {int.lastRun.status} · {formatDuration(int.lastRun.duration_ms)}
                </div>
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSync(int.id);
              }}
              disabled={isSyncing || !canRunSync}
              className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
              title={t('integrations.syncHub.runNow', 'Run now')}
            >
              {isSyncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePause(int.id);
              }}
              disabled={!canPause}
              className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title={t('integrations.syncHub.pause', 'Pause')}
            >
              <Pause size={15} />
            </button>
            {isExpanded ? (
              <ChevronDown size={16} className="text-slate-500" />
            ) : (
              <ChevronRight size={16} className="text-slate-500" />
            )}
          </div>
        </div>

        {/* Expanded drawer */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-navy-700/50 space-y-3">
                {/* Error banner */}
                {int.status === 'error' && int.lastError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-400 text-xs">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {t('integrations.syncHub.errorOccurred', 'Error occurred')}
                      </div>
                      <div className="text-red-300/70 mt-0.5">{int.lastError}</div>
                    </div>
                  </div>
                )}
                {int.status === 'requires_reauth' && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-500/10 text-orange-400 text-xs">
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {t('integrations.syncHub.reauthRequired', 'Re-authorization required')}
                      </div>
                      <div className="text-orange-300/70 mt-0.5">
                        {t(
                          'integrations.syncHub.reauthDesc',
                          'Your access token has expired. Re-authorize to resume syncing.'
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {isPendingOnboarding && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-300 text-xs">
                    <Clock size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {t('integrations.syncHub.setupPending', 'Connection setup still pending')}
                      </div>
                      <div className="text-amber-200/80 mt-0.5">
                        {pendingSetupDescription}
                      </div>
                      {!!int.connector?.configFields?.length && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {int.connector.configFields.map((field) => {
                              const isConfigured = configuredFieldSet.has(field);
                              return (
                                <span
                                  key={field}
                                  className={`px-2 py-0.5 rounded-full border text-[11px] ${
                                    isConfigured
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                                      : 'bg-amber-500/10 border-amber-500/20 text-amber-100'
                                  }`}
                                >
                                  {formatConfigFieldLabel(field)}
                                  {isConfigured ? ` ${t('common.saved', 'saved')}` : ''}
                                </span>
                              );
                            })}
                          </div>
                          <div className="mt-2 text-[11px] text-amber-200/70">
                            {t(
                              'integrations.syncHub.setupProgress',
                              '{{configured}} of {{total}} required setup fields saved.',
                              {
                                configured: configuredFieldSet.size,
                                total: int.connector.configFields.length,
                              },
                            )}
                          </div>
                        </>
                      )}
                      {!!missingConfigFields.length && (
                        <div className="mt-3 space-y-2">
                          {!isEditingPendingConfig ? (
                            <button
                              onClick={() => setEditingPendingConfigId(int.id)}
                              className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 rounded-lg transition-colors"
                            >
                              {t('integrations.syncHub.addProviderConfig', 'Add provider config')}
                            </button>
                          ) : (
                            <div
                              className="space-y-2 rounded-lg border border-amber-500/20 bg-navy-950/30 p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {missingConfigFields.map((field) => (
                                <label key={field} className="block">
                                  <div className="mb-1 text-[11px] uppercase tracking-wide text-amber-100/80">
                                    {formatConfigFieldLabel(field)}
                                  </div>
                                  <input
                                    type={isSecretConfigField(field) ? 'password' : 'text'}
                                    value={pendingConfigDrafts[int.id]?.[field] || ''}
                                    onChange={(e) =>
                                      handlePendingConfigDraftChange(int.id, field, e.target.value)
                                    }
                                    placeholder={formatConfigFieldLabel(field)}
                                    className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500/40 focus:outline-none"
                                  />
                                </label>
                              ))}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void handleSavePendingConfig(int)}
                                  disabled={savingPendingConfigId === int.id}
                                  className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {savingPendingConfigId === int.id
                                    ? t('common.saving', 'Saving...')
                                    : t('integrations.syncHub.saveProviderConfig', 'Save provider config')}
                                </button>
                                <button
                                  onClick={() => setEditingPendingConfigId(null)}
                                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg transition-colors"
                                >
                                  {t('common.cancel', 'Cancel')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {externalAuthSession && int.onboardingStatus === 'pending_external_auth' && (
                        <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] text-sky-100">
                          <div className="font-medium text-sky-200">
                            {t(
                              'integrations.syncHub.externalAuthPrepared',
                              'Governed external auth return is prepared',
                            )}
                          </div>
                          <div className="mt-1 text-sky-100/80 break-all">
                            {externalAuthSession.callbackUrl}
                          </div>
                          <div className="mt-1 text-sky-100/60">
                            {t(
                              'integrations.syncHub.externalAuthPreparedDesc',
                              'Use this callback URL in the provider authorization flow. It expires automatically if left unused.',
                            )}
                          </div>
                        </div>
                      )}
                      {int.onboardingStatus === 'authorization_callback_received_pending_verification' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleMarkVerificationComplete(int)}
                            disabled={mutatingConnectorAuthId === `${int.connectorId}:healthy`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60 transition-colors"
                          >
                            {mutatingConnectorAuthId === `${int.connectorId}:healthy` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            {t(
                              'integrations.syncHub.markVerificationComplete',
                              'Mark verification complete',
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Capabilities / Scopes */}
                {int.connector?.capabilities && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      {t('integrations.syncHub.scopes', 'Permissions & Scopes')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {int.connector.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded-full bg-navy-800 text-xs text-slate-400 border border-navy-700"
                        >
                          read:{cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {canMaterializeCredential && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-violet-200">
                          {t(
                            'integrations.syncHub.governedCredentialBaseline',
                            'Governed credential baseline',
                          )}
                        </div>
                        <div className="mt-1 text-violet-100/70">
                          {int.credential
                            ? t(
                                'integrations.syncHub.governedCredentialBaselineSaved',
                                'Credential metadata is recorded for governed refresh and recovery readback.',
                              )
                            : t(
                                'integrations.syncHub.governedCredentialBaselineMissing',
                                'Record credential metadata here before broader governed refresh and recovery continuity can become real.',
                              )}
                        </div>
                      </div>
                      {!isEditingCredential && (
                        <button
                          type="button"
                          onClick={() => setEditingCredentialId(int.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-[11px] font-medium text-violet-200 hover:bg-violet-500/15 transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          {int.credential
                            ? t('integrations.syncHub.editGovernedCredential', 'Edit governed credential')
                            : t('integrations.syncHub.addGovernedCredential', 'Add governed credential')}
                        </button>
                      )}
                    </div>

                    {int.credential && !isEditingCredential && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-[11px] text-violet-100/80">
                        <div>
                          <div className="text-violet-200/60">
                            {t('integrations.syncHub.providerAccountId', 'Provider account')}
                          </div>
                          <div className="mt-1 break-all">{int.credential.providerAccountId}</div>
                        </div>
                        <div>
                          <div className="text-violet-200/60">
                            {t('integrations.syncHub.workspaceTenantId', 'Workspace or tenant')}
                          </div>
                          <div className="mt-1 break-all">{int.credential.workspaceOrTenantId}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-violet-200/60">
                            {t('integrations.syncHub.governedScopes', 'Governed scopes')}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {int.credential.scopesGranted.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/10 text-[11px] text-violet-100"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-violet-200/60">
                            {t('integrations.syncHub.lastRefreshResult', 'Last refresh result')}
                          </div>
                          <div className="mt-1 break-all">
                            {int.credential.lastRefreshResult ||
                              t('integrations.syncHub.refreshNeverRecorded', 'never recorded')}
                          </div>
                        </div>
                        <div>
                          <div className="text-violet-200/60">
                            {t('integrations.syncHub.lastRefreshAt', 'Last refresh at')}
                          </div>
                          <div className="mt-1 break-all">
                            {int.credential.lastRefreshAt || t('common.never', 'Never')}
                          </div>
                        </div>
                      </div>
                    )}

                    {isEditingCredential && (
                      <div className="mt-3 space-y-2 rounded-lg border border-violet-500/20 bg-navy-950/30 p-3">
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-violet-100/80">
                            {t('integrations.syncHub.providerAccountId', 'Provider account')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.providerAccountId}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'providerAccountId', e.target.value)
                            }
                            placeholder="acct-123"
                            className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-violet-100/80">
                            {t('integrations.syncHub.workspaceTenantId', 'Workspace or tenant')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.workspaceOrTenantId}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'workspaceOrTenantId', e.target.value)
                            }
                            placeholder="tenant-456"
                            className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-violet-100/80">
                            {t('integrations.syncHub.governedScopes', 'Governed scopes')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.scopesGranted}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'scopesGranted', e.target.value)
                            }
                            placeholder="read:jira-work, write:jira-work"
                            className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-violet-100/80">
                            {t('integrations.syncHub.tokenExpiresAt', 'Token expires at')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.tokenExpiresAt}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'tokenExpiresAt', e.target.value)
                            }
                            placeholder="2026-03-27T19:00:00.000Z"
                            className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                          />
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveCredential(int)}
                            disabled={savingCredentialId === int.id}
                            className="px-3 py-1.5 text-xs bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {savingCredentialId === int.id
                              ? t('common.saving', 'Saving...')
                              : t('integrations.syncHub.saveGovernedCredential', 'Save governed credential')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCredentialId(null)}
                            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg transition-colors"
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {canRecordRefreshResult && !isEditingCredential && (
                      <div className="mt-3 border-t border-violet-500/10 pt-3">
                        {!editingRefreshResultId || editingRefreshResultId !== int.id ? (
                          <button
                            type="button"
                            onClick={() => setEditingRefreshResultId(int.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-[11px] font-medium text-violet-200 hover:bg-violet-500/15 transition-colors"
                          >
                            <RefreshCw size={12} />
                            {t(
                              'integrations.syncHub.recordRefreshResult',
                              'Record refresh result',
                            )}
                          </button>
                        ) : (
                          <div className="space-y-2 rounded-lg border border-violet-500/20 bg-navy-950/30 p-3">
                            <label className="block">
                              <div className="mb-1 text-[11px] uppercase tracking-wide text-violet-100/80">
                                {t('integrations.syncHub.refreshResult', 'Refresh result')}
                              </div>
                              <select
                                value={refreshResultDraft}
                                onChange={(e) =>
                                  handleRefreshResultDraftChange(
                                    int.id,
                                    e.target.value as RefreshResultDraft,
                                  )
                                }
                                className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-white focus:border-violet-500/40 focus:outline-none"
                              >
                                <option value="success">success</option>
                                <option value="transient_failure">transient_failure</option>
                                <option value="credential_expired">credential_expired</option>
                                <option value="scope_revoked">scope_revoked</option>
                              </select>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveRefreshResult(int)}
                                disabled={savingRefreshResultId === int.id}
                                className="px-3 py-1.5 text-xs bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {savingRefreshResultId === int.id
                                  ? t('common.saving', 'Saving...')
                                  : t('integrations.syncHub.saveRefreshResult', 'Save refresh result')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRefreshResultId(null)}
                                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg transition-colors"
                              >
                                {t('common.cancel', 'Cancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Stats row */}
                {int.lastRun && (
                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500">
                        {t('integrations.syncHub.itemsProcessed', 'Items processed')}:
                      </span>{' '}
                      <span className="text-slate-300">{int.lastRun.items_processed}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        {t('integrations.syncHub.duration', 'Duration')}:
                      </span>{' '}
                      <span className="text-slate-300">
                        {formatDuration(int.lastRun.duration_ms)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        {t('integrations.syncHub.errorRateLabel', 'Error rate')}:
                      </span>{' '}
                      <span className={`${int.errorRate > 20 ? 'text-red-400' : 'text-slate-300'}`}>
                        {int.errorRate}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {int.status === 'requires_reauth' && (
                    <button
                      onClick={() => handleReauth(int.id)}
                      className="px-3 py-1.5 text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Shield size={13} />
                      {t('integrations.syncHub.reauth', 'Re-authorize')}
                    </button>
                  )}
                  <button
                    onClick={() => handleSync(int.id)}
                    disabled={syncing === int.id || !canRunSync}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-30"
                  >
                    <RefreshCw size={13} />
                    {t('integrations.syncHub.runNow', 'Run now')}
                  </button>
                  {canResume && (
                    <button
                      onClick={() => handleResume(int.id)}
                      className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Play size={13} />
                      {t('integrations.syncHub.resume', 'Resume')}
                    </button>
                  )}
                  {isPendingOnboarding && (
                    <span className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {int.onboardingStatus === 'authorization_callback_received_pending_verification'
                        ? t(
                            'integrations.syncHub.setupPendingControlsVerification',
                            'Verification still pending before sync controls unlock',
                          )
                        : int.onboardingStatus === 'pending_external_auth'
                        ? t(
                            'integrations.syncHub.setupPendingControlsAuthOnly',
                            'Finish external auth to enable sync controls',
                          )
                        : t(
                            'integrations.syncHub.setupPendingControls',
                            'Finish auth/config to enable sync controls',
                          )}
                    </span>
                  )}
                  <button
                    onClick={() => handleDisconnect(int.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Unplug size={13} />
                    {t('integrations.syncHub.disconnect', 'Disconnect')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ── Connected Apps tab ───────────────────────────────────────

  const renderAppsTab = () => (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('integrations.syncHub.search', 'Search integrations…')}
            className="w-full h-9 pl-9 pr-4 bg-navy-800 border border-navy-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg flex items-center gap-2 transition-colors shrink-0"
        >
          <Plus size={16} />
          {t('integrations.syncHub.connectNew', 'Connect')}
        </button>
      </div>

      {/* Integrations list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-violet-400" size={24} />
          <span className="ml-3 text-slate-400 text-sm">
            {t('integrations.syncHub.loading', 'Loading integrations…')}
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="mx-auto text-slate-600 mb-3" size={36} />
          <p className="text-slate-400 text-sm">
            {t('integrations.syncHub.noIntegrations', 'No integrations connected')}
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            className="mt-3 px-4 py-2 text-sm text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            {t('integrations.syncHub.connectFirst', 'Connect your first integration')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">{filtered.map(renderIntegrationRow)}</div>
      )}
    </div>
  );

  // ── Sync Health tab ──────────────────────────────────────────

  const renderHealthTab = () => (
    <div className="space-y-6">
      {/* Health summary cards */}
      {healthSummary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: t('integrations.syncHub.total', 'Total'),
              value: healthSummary.total,
              color: 'text-white',
            },
            {
              label: t('integrations.syncHub.healthy', 'Healthy'),
              value: healthSummary.healthy,
              color: 'text-emerald-400',
            },
            {
              label: t('integrations.syncHub.degraded', 'Degraded'),
              value: healthSummary.degraded,
              color: 'text-amber-400',
            },
            {
              label: t('integrations.syncHub.unhealthy', 'Unhealthy'),
              value: healthSummary.unhealthy,
              color: 'text-red-400',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-3 rounded-lg bg-navy-800/60 border border-navy-700/50"
            >
              <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-slate-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {v8AuthHealthSummary && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" />
            {t('integrations.syncHub.v8AuthHealth', 'V8 Auth Health')}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: t('integrations.syncHub.v8TotalCredentials', 'Governed credentials'),
                value: v8AuthHealthSummary.total,
                color: 'text-cyan-300',
              },
              {
                label: t('integrations.syncHub.v8HealthyCredentials', 'Healthy'),
                value: v8AuthHealthSummary.healthy,
                color: 'text-emerald-400',
              },
              {
                label: t('integrations.syncHub.v8FailingCredentials', 'Failing'),
                value: v8AuthHealthSummary.failing,
                color: 'text-amber-400',
              },
              {
                label: t('integrations.syncHub.v8EscalatedCredentials', 'Escalated'),
                value: v8AuthHealthSummary.escalated,
                color: 'text-red-400',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20"
              >
                <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-slate-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <ShieldAlert size={14} className="text-orange-400" />
          {t('integrations.syncHub.v8AuthEscalations', 'V8 Active Auth Escalations')}
          {v8AuthEscalations.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-orange-500/10 text-orange-400 rounded">
              {v8AuthEscalations.length}
            </span>
          )}
        </h3>
        {v8AuthEscalations.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            {t('integrations.syncHub.v8NoEscalations', 'No governed auth escalations are open.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8AuthEscalations.slice(0, 5).map((escalation) => {
              const recoveryTarget = integrations.find(
                (integration) =>
                  integration.connectorId === escalation.connectorId &&
                  integration.connector?.authType === 'oauth2' &&
                  integration.status === 'requires_reauth',
              );

              return (
                <div
                  key={escalation.escalationId}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20"
                >
                  <ShieldAlert size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">{escalation.connectorId}</span>
                      <span className="px-1.5 py-0.5 text-[11px] bg-orange-500/10 text-orange-300 rounded">
                        {t('integrations.syncHub.v8Escalated', 'escalated')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {escalation.reason || t('integrations.syncHub.v8NoEscalationReason', 'Auth health degraded')}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{timeAgo(escalation.escalatedAt)}</div>
                    {recoveryTarget ? (
                      <div className="mt-2 text-[11px] text-orange-200/70">
                        {t(
                          'integrations.syncHub.v8RecoveryTargetReady',
                          'Governed re-authorization can start directly from this recovery panel.',
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-orange-200/60">
                        {t(
                          'integrations.syncHub.v8RecoveryTargetMissing',
                          'No governed re-authorization target is currently available for this escalation.',
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    {recoveryTarget && (
                      <button
                        type="button"
                        onClick={() => void handleRecoverV8AuthEscalation(escalation.connectorId)}
                        disabled={recoveringAuthEscalationConnectorId === escalation.connectorId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 text-[11px] font-medium text-orange-200 hover:bg-orange-500/15 disabled:opacity-60 transition-colors"
                      >
                        {recoveringAuthEscalationConnectorId === escalation.connectorId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ArrowUpRight size={12} />
                        )}
                        {t('integrations.syncHub.v8StartRecovery', 'Start re-authorization')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleResolveV8AuthEscalation(escalation.escalationId)}
                      disabled={resolvingAuthEscalationId === escalation.escalationId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60 transition-colors"
                    >
                      {resolvingAuthEscalationId === escalation.escalationId ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {t('integrations.syncHub.v8ResolveEscalation', 'Resolve')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Zap size={14} className="text-blue-400" />
          {t('integrations.syncHub.v8ConnectorHealth', 'V8 Connector Health')}
          {Object.keys(v8ConnectorHealth).length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
              {Object.keys(v8ConnectorHealth).length}
            </span>
          )}
        </h3>
        {v8ConnectorHealthLoading ? (
          <div className="flex items-center justify-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            <Loader2 size={14} className="animate-spin mr-2" />
            {t('integrations.syncHub.v8ConnectorHealthLoading', 'Loading governed connector health...')}
          </div>
        ) : v8ConnectorHealthTargets.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            {t(
              'integrations.syncHub.v8NoConnectorTargets',
              'No governed connector targets are available for this workspace yet.',
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {v8ConnectorHealthTargets.map((target) => {
              const health = v8ConnectorHealth[target.connectorId];
              const showMarkHealthy =
                !health ||
                ['unknown', 'connecting', 'connected_pending_verification', 'degraded_reauth_needed', 'degraded_scope_limited', 'suspended'].includes(
                  health.authState,
                );
              const showMarkReauthNeeded =
                health && ['healthy', 'connected_pending_verification'].includes(health.authState);
              const tone = !health
                ? 'border-navy-700/40 bg-navy-900/30'
                : health.healthy
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : ['error', 'dead_letter', 'conflict'].includes(health.syncStatus)
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-amber-500/20 bg-amber-500/5';

              return (
                <div key={target.connectorId} className={`rounded-lg border p-3 ${tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">{target.name}</span>
                        <span className="px-1.5 py-0.5 text-[11px] bg-navy-800 text-slate-400 rounded">
                          {target.connectorId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {CATEGORY_LABELS[target.category] || target.category}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 text-[11px] rounded ${
                        !health
                          ? 'bg-slate-500/10 text-slate-400'
                          : health.healthy
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {!health
                        ? t('integrations.syncHub.v8Unavailable', 'unavailable')
                        : health.healthy
                          ? t('integrations.syncHub.v8Healthy', 'healthy')
                          : t('integrations.syncHub.v8NeedsAttention', 'needs attention')}
                    </span>
                  </div>
                  {health ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                        <div>
                          <div className="text-slate-500">
                            {t('integrations.syncHub.v8AuthState', 'Auth state')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.authState}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">
                            {t('integrations.syncHub.v8SyncStatus', 'Sync status')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.syncStatus}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">
                            {t('integrations.syncHub.v8OpenConflicts', 'Open conflicts')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.conflictCount}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">
                            {t('integrations.syncHub.v8LastGovernedSync', 'Last governed sync')}
                          </div>
                          <div className="text-slate-300 mt-1">{timeAgo(health.lastSyncAt)}</div>
                        </div>
                      </div>
                      {(showMarkHealthy || showMarkReauthNeeded) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {showMarkHealthy && (
                            <button
                              type="button"
                              onClick={() => void handleSetV8ConnectorAuthState(target.connectorId, 'healthy')}
                              disabled={mutatingConnectorAuthId === `${target.connectorId}:healthy`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60 transition-colors"
                            >
                              {mutatingConnectorAuthId === `${target.connectorId}:healthy` ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              {t('integrations.syncHub.v8MarkHealthy', 'Mark healthy')}
                            </button>
                          )}
                          {showMarkReauthNeeded && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSetV8ConnectorAuthState(target.connectorId, 'degraded_reauth_needed')
                              }
                              disabled={
                                mutatingConnectorAuthId === `${target.connectorId}:degraded_reauth_needed`
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-[11px] font-medium text-amber-300 hover:bg-amber-500/15 disabled:opacity-60 transition-colors"
                            >
                              {mutatingConnectorAuthId === `${target.connectorId}:degraded_reauth_needed` ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ShieldAlert size={12} />
                              )}
                              {t('integrations.syncHub.v8MarkNeedsReauth', 'Mark reauth needed')}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-slate-500 mt-3">
                        {t(
                          'integrations.syncHub.v8ConnectorHealthUnavailable',
                          'Governed connector health is not available for this connector yet.',
                        )}
                      </div>
                      {showMarkHealthy && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => void handleSetV8ConnectorAuthState(target.connectorId, 'healthy')}
                            disabled={mutatingConnectorAuthId === `${target.connectorId}:healthy`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60 transition-colors"
                          >
                            {mutatingConnectorAuthId === `${target.connectorId}:healthy` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            {t('integrations.syncHub.v8MarkHealthy', 'Mark healthy')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-rose-400" />
          {t('integrations.syncHub.v8Conflicts', 'V8 Unresolved Sync Conflicts')}
          {v8Conflicts.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-rose-500/10 text-rose-400 rounded">
              {v8Conflicts.length}
            </span>
          )}
        </h3>
        {v8Conflicts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            {t('integrations.syncHub.v8NoConflicts', 'No governed sync conflicts are open.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8Conflicts.slice(0, 5).map((conflict) => (
              <div
                key={conflict.conflictId}
                className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20"
              >
                <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">{conflict.conflictClass}</span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-rose-500/10 text-rose-300 rounded uppercase">
                      {conflict.severity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {conflict.resolutionPath || t('integrations.syncHub.v8ResolutionPending', 'Resolution pending')}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{timeAgo(conflict.createdAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResolveV8Conflict(conflict.conflictId)}
                  disabled={resolvingConflictId === conflict.conflictId}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60 transition-colors"
                >
                  {resolvingConflictId === conflict.conflictId ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {t('integrations.syncHub.v8DismissConflict', 'Dismiss')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {v8WorkspaceMapping && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Layers size={14} className="text-fuchsia-400" />
            {t('integrations.syncHub.v8CollaborationSubstrate', 'V8 Collaboration Substrate')}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: t('integrations.syncHub.v8ResourceType', 'Resource type'),
                value: v8WorkspaceMapping.resourceType,
                color: 'text-fuchsia-300',
              },
              {
                label: t('integrations.syncHub.v8RoomGranularity', 'Room granularity'),
                value: v8WorkspaceMapping.roomGranularity,
                color: 'text-sky-300',
              },
              {
                label: t('integrations.syncHub.v8SurfaceAware', 'Surface-aware'),
                value: v8WorkspaceMapping.surfaceAware ? 'yes' : 'no',
                color: v8WorkspaceMapping.surfaceAware ? 'text-emerald-400' : 'text-slate-300',
              },
              {
                label: t('integrations.syncHub.v8EmbeddedIn', 'Embedded in'),
                value: v8WorkspaceMapping.embeddedIn ?? 'standalone',
                color: 'text-slate-200',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/20"
              >
                <div className={`text-base font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-slate-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Activity size={14} className="text-sky-400" />
          {t('integrations.syncHub.v8WorkspacePresence', 'V8 Workspace Presence')}
          {v8WorkspacePresence.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-sky-500/10 text-sky-400 rounded">
              {v8WorkspacePresence.length}
            </span>
          )}
        </h3>
        {v8WorkspaceBinding ? (
          <div className="mb-3 text-xs text-slate-500">
            {t('integrations.syncHub.v8WorkspaceRoom', 'Workspace room')}: {v8WorkspaceBinding.roomResourceId}
          </div>
        ) : null}
        {v8WorkspacePresence.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            {v8WorkspaceBinding
              ? t('integrations.syncHub.v8NoWorkspacePresence', 'No governed workspace presence is active.')
              : t('integrations.syncHub.v8NoWorkspaceBinding', 'No governed workspace room binding is available.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8WorkspacePresence.slice(0, 5).map((presence) => (
              <div
                key={presence.surfacePresenceId}
                className="flex items-start gap-3 p-3 rounded-lg bg-sky-500/5 border border-sky-500/20"
              >
                <Activity size={14} className="text-sky-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">{presence.userId}</span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-sky-500/10 text-sky-300 rounded">
                      {presence.activeSurface}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{presence.presenceType}</div>
                  <div className="text-xs text-slate-600 mt-1">{timeAgo(presence.lastHeartbeat)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Shield size={14} className="text-violet-400" />
          {t('integrations.syncHub.v8ActiveLocks', 'V8 Active Locks')}
          {v8WorkspaceLocks.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-violet-500/10 text-violet-400 rounded">
              {v8WorkspaceLocks.length}
            </span>
          )}
        </h3>
        {v8WorkspaceLocks.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm rounded-lg bg-navy-900/30 border border-navy-700/40">
            {t('integrations.syncHub.v8NoLocks', 'No governed workspace locks are active.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8WorkspaceLocks.slice(0, 5).map((lock) => (
              <div
                key={lock.lockId}
                className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20"
              >
                <Shield size={14} className="text-violet-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">{lock.lockType}</span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-violet-500/10 text-violet-300 rounded">
                      {lock.lockScope}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{lock.holderId}</div>
                  <div className="text-xs text-slate-600 mt-1">{timeAgo(lock.acquiredAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Errors list */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          {t('integrations.syncHub.unresolvedErrors', 'Unresolved Errors')}
          {errors.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-400 rounded">
              {errors.length}
            </span>
          )}
        </h3>
        {errors.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-500/50" size={24} />
            {t('integrations.syncHub.noErrors', 'All systems operational')}
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err) => (
              <div
                key={err.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-navy-900/40 border border-navy-700/50"
              >
                <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">{err.errorType}</span>
                    {err.isRetryable && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
                        retryable
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {err.retryCount}/{err.maxRetries} retries
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{err.errorMessage}</div>
                  <div className="text-xs text-slate-600 mt-1">{timeAgo(err.createdAt)}</div>
                </div>
                <button
                  onClick={() => handleResolveError(err.id)}
                  className="px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors shrink-0"
                >
                  {t('integrations.syncHub.resolve', 'Resolve')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Permissions & Scopes tab ─────────────────────────────────

  const renderScopesTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        {t(
          'integrations.syncHub.scopesDesc',
          'Review what each integration can read and write in your workspace.'
        )}
      </p>
      {v8RefreshPolicyTargets.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Zap size={14} className="text-violet-400" />
              {t(
                'integrations.syncHub.v8RefreshPolicies',
                'Governed Refresh Timing Policies',
              )}
            </h3>
            <div className="space-y-2">
              {v8RefreshPolicyTargets.map((target) => {
                const policy = v8RefreshPolicies[target.providerFamily] ?? null;
                const preset = GOVERNED_REFRESH_POLICY_PRESETS[target.providerFamily];
                return (
                  <div
                    key={target.providerFamily}
                    className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-100">
                            {target.providerLabel}
                          </span>
                          <span className="px-1.5 py-0.5 text-[11px] bg-violet-500/10 text-violet-300 rounded">
                            {target.connectorId}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {target.integrationName}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span className="px-2 py-0.5 rounded-full bg-navy-800 border border-navy-700">
                            lifetime {policy?.typicalTokenLifetimeMinutes ?? 'none'}m
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-navy-800 border border-navy-700">
                            refresh window {policy?.refreshWindowMinutes ?? 'none'}m
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-navy-800 border border-navy-700">
                            retries {policy?.maxRetryAttempts ?? 'none'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleApplyGovernedRefreshPolicy(target.providerFamily)}
                        disabled={mutatingRefreshPolicyFamily === target.providerFamily}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-[11px] font-medium text-violet-300 hover:bg-violet-500/15 disabled:opacity-60 transition-colors"
                        title={`lifetime ${preset.typicalTokenLifetimeMinutes}m, window ${preset.refreshWindowMinutes}m, retries ${preset.maxRetryAttempts}`}
                      >
                        {mutatingRefreshPolicyFamily === target.providerFamily ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        {t(
                          'integrations.syncHub.v8ApplyGovernedPolicy',
                          'Apply governed policy',
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {integrations.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t('integrations.syncHub.noScopesData', 'No integrations connected yet.')}
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((int) => (
            <div key={int.id} className="p-3 rounded-lg bg-navy-900/40 border border-navy-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{CATEGORY_ICONS[int.category] || '🔌'}</span>
                <div>
                  <div className="text-sm font-medium text-white">{int.name}</div>
                  <div className="text-xs text-slate-500">
                    {int.connector?.authType || 'oauth2'}
                  </div>
                </div>
                {renderStatusChip(int.status)}
              </div>
              <div className="flex flex-wrap gap-1">
                {(int.connector?.capabilities || []).map((cap) => (
                  <span
                    key={cap}
                    className="px-2 py-0.5 rounded-full bg-navy-800 text-xs text-slate-400 border border-navy-700"
                  >
                    read:{cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Audit Log tab ────────────────────────────────────────────

  const renderAuditTab = () => (
    <div className="space-y-3">
      {auditLog.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {t('integrations.syncHub.noAuditData', 'No audit events yet')}
        </div>
      ) : (
        <div className="border border-navy-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-800/60 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2">
                  {t('integrations.syncHub.auditAction', 'Action')}
                </th>
                <th className="text-left px-4 py-2">
                  {t('integrations.syncHub.auditActor', 'Actor')}
                </th>
                <th className="text-left px-4 py-2">
                  {t('integrations.syncHub.auditTime', 'Time')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/40">
              {auditLog.map((entry) => (
                <tr
                  key={entry.id}
                  className="text-slate-300 hover:bg-navy-800/40 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs font-medium ${
                        entry.action.includes('connected')
                          ? 'text-emerald-400'
                          : entry.action.includes('disconnected')
                            ? 'text-red-400'
                            : entry.action.includes('reauth')
                              ? 'text-orange-400'
                              : entry.action.includes('sync')
                                ? 'text-blue-400'
                                : 'text-slate-400'
                      }`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{entry.actor_name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {timeAgo(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Connect modal ────────────────────────────────────────────

  const renderConnectModal = () => {
    if (!showConnectModal) return null;
    const connectedIds = new Set(integrations.map((i) => i.connectorId));
    const categories = Object.keys(categorizedCatalog);

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={() => setShowConnectModal(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-navy-700">
            <h3 className="text-base font-semibold text-white">
              {t('integrations.syncHub.connectNew', 'Connect Integration')}
            </h3>
            <button
              onClick={() => setShowConnectModal(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 p-4 pb-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-slate-400 hover:text-white border border-navy-700'
              }`}
            >
              {t('common.all', 'All')}
            </button>
            {Object.keys(CATEGORY_LABELS)
              .filter((cat) => catalog.some((c) => c.category === cat))
              .map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'text-slate-400 hover:text-white border border-navy-700'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                <div className="space-y-1.5">
                  {categorizedCatalog[cat].map((conn) => {
                    const isConnected = connectedIds.has(conn.id);
                    return (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-navy-800/40 border border-navy-700/40 hover:border-navy-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{CATEGORY_ICONS[conn.category] || '🔌'}</span>
                          <div>
                            <div className="text-sm text-white">{conn.name}</div>
                            <div className="text-xs text-slate-500">
                              {conn.capabilities.slice(0, 3).join(', ')}
                            </div>
                            {!!conn.configFields?.length && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {conn.configFields.slice(0, 3).map((field) => (
                                  <span
                                    key={field}
                                    className="px-1.5 py-0.5 rounded-full bg-navy-700/60 text-[10px] text-slate-300 border border-navy-600"
                                  >
                                    {formatConfigFieldLabel(field)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {isConnected ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} />{' '}
                            {t('integrations.syncHub.alreadyConnected', 'Connected')}
                          </span>
                        ) : conn.comingSoon ? (
                          <span className="text-xs text-slate-500 italic">
                            {t('integrations.syncHub.comingSoon', 'Coming soon')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConnect(conn.id)}
                            className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                          >
                            {t('integrations.syncHub.connect', 'Connect')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {t('integrations.syncHub.title', 'Integrations Hub')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {t(
              'integrations.syncHub.subtitle',
              'Connect, monitor, and manage all your external integrations'
            )}
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-navy-700/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-navy-800 rounded">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'apps' && renderAppsTab()}
          {activeTab === 'health' && renderHealthTab()}
          {activeTab === 'webhooks' && renderScopesTab()}
          {activeTab === 'audit' && renderAuditTab()}
        </motion.div>
      </AnimatePresence>

      {/* Connect modal */}
      {renderConnectModal()}
    </div>
  );
};

export default UnifiedSyncHub;
