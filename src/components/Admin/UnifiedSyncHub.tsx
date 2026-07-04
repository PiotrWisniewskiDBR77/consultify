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
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  FileText,
  GitMerge,
  History,
  Layers,
  Link2Off,
  List,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Unplug,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import {
  V8MultiplayerApi,
  type V8MultiplayerLockRecord,
  type V8MultiplayerResourceMapping,
  type V8MultiplayerRoomBinding,
  type V8MultiplayerSurfacePresence,
} from '@/services/api/v8/multiplayer';
import {
  shouldFallbackToLegacySync,
  V8SyncApi,
  type V8SyncAuditEntry,
  type V8SyncAuthEscalation,
  type V8SyncCatalogConnector,
  type V8SyncConflictRecord,
  type V8SyncConnectorAuthState,
  type V8SyncConnectorHealthSummary,
  type V8SyncCredentialHealthSummary,
  type V8SyncErrorItem,
  type V8SyncHealthSummary,
  type V8SyncInitiatedIntegration,
  type V8SyncIntegrationInventoryRow,
  type V8SyncProviderFamily,
  type V8SyncRefreshSecretRef,
  type V8SyncRefreshTimingPolicy,
  type V8SyncRunRecord,
  type V8SyncWorkflowPolicyData,
  type V8SyncWorkflowRecord,
} from '@/services/api/v8/sync';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { IntegrationHealthDashboard } from '../settings/integrations/IntegrationHealthDashboard';
import MappingDriftPanel from '../settings/integrations/MappingDriftPanel';

// ── Types ──────────────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'requires_reauth';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type TabId =
  | 'apps'
  | 'health'
  | 'runs'
  | 'workflows'
  | 'mappings'
  | 'users'
  | 'logs'
  | 'policies'
  | 'audit';

interface AdminIntegrationOwnershipItem {
  integrationId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  connectorId: string;
  integrationName: string;
  category: string;
  status: string;
  updatedAt: string | null;
}

interface AdminIntegrationConnectionLogItem {
  id: string;
  userId: string | null;
  integrationId: string;
  connectorId: string;
  eventType: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

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
    lastRefreshResult:
      | 'success'
      | 'transient_failure'
      | 'credential_expired'
      | 'scope_revoked'
      | null;
  } | null;
  connector: ConnectorInfo | null;
}

interface ExternalAuthSessionInfo {
  authUrl: string;
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

interface RefreshSecretDraft {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenEndpoint: string;
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

// ── Connector icons ─────────────────────────────────────────────

const SlackIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

const CONNECTOR_ICONS: Record<string, React.ElementType> = {
  slack: SlackIcon,
  teams: MessageSquare,
  jira: Database,
  clickup: CheckCircle2,
  hubspot: MessageSquare,
  monday: Calendar,
  asana: CheckCircle2,
  notion: FileText,
  trello: CheckCircle2,
  salesforce: Briefcase,
  zoho_crm: Briefcase,
};

function renderConnectorIcon(connectorId: string, name: string): React.ReactNode {
  const Icon = CONNECTOR_ICONS[connectorId];
  if (Icon) return <Icon />;
  const letter = (name || connectorId || '?').trim().slice(0, 1).toUpperCase();
  return <span className="text-xs font-semibold text-c-text-secondary">{letter}</span>;
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
    color: 'text-slate-400 dark:text-slate-500',
    bg: 'bg-slate-500/10',
    icon: <Link2Off size={14} />,
  },
  error: {
    label: 'Error',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
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
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: <ShieldAlert size={14} />,
  },
};

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; dot: string }> = {
  healthy: { label: 'Healthy', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  degraded: { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400' },
  unhealthy: { label: 'Unhealthy', color: 'text-rose-400', dot: 'bg-rose-400' },
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
  google_workspace: {
    typicalTokenLifetimeMinutes: 60,
    refreshWindowMinutes: 10,
    maxRetryAttempts: 3,
  },
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

function getReadableErrorMessage(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'code', 'type']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  return fallback;
}

function isSecretConfigField(field: string): boolean {
  return field.includes('secret') || field.includes('token');
}

function openExternalAuthSession(session: ExternalAuthSessionInfo | null | undefined): void {
  if (!session?.authUrl) return;
  window.open(session.authUrl, '_blank', 'noopener,noreferrer,width=900,height=780');
}

function getAuditDetailBoolean(details: Record<string, unknown> | undefined, key: string): boolean {
  return details?.[key] === true;
}

function getAuditDetailString(
  details: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = details?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// ── Component ──────────────────────────────────────────────────

export const UnifiedSyncHub: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization, currentUser } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabId>('apps');
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogConnector[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [errors, setErrors] = useState<SyncErrorItem[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [v8WorkspaceMapping, setV8WorkspaceMapping] = useState<V8MultiplayerResourceMapping | null>(
    null
  );
  const [v8WorkspaceBinding, setV8WorkspaceBinding] = useState<V8MultiplayerRoomBinding | null>(
    null
  );
  const [v8WorkspacePresenceFailed, setV8WorkspacePresenceFailed] = useState(false);
  const [v8WorkspacePresence, setV8WorkspacePresence] = useState<V8MultiplayerSurfacePresence[]>(
    []
  );
  const [v8WorkspaceLocks, setV8WorkspaceLocks] = useState<V8MultiplayerLockRecord[]>([]);
  const [v8AuthHealthSummary, setV8AuthHealthSummary] =
    useState<V8SyncCredentialHealthSummary | null>(null);
  const [v8AuthEscalations, setV8AuthEscalations] = useState<V8SyncAuthEscalation[]>([]);
  const [v8ConnectorHealth, setV8ConnectorHealth] = useState<
    Record<string, V8SyncConnectorHealthSummary>
  >({});
  const [v8ConnectorHealthLoading, setV8ConnectorHealthLoading] = useState(false);
  const [v8Conflicts, setV8Conflicts] = useState<V8SyncConflictRecord[]>([]);
  const [v8Runs, setV8Runs] = useState<V8SyncRunRecord[]>([]);
  const [v8RunsTotal, setV8RunsTotal] = useState(0);
  const [v8RunsLoading, setV8RunsLoading] = useState(false);
  const [v8RunsFilter, setV8RunsFilter] = useState<string>('');
  const [v8RunsStatusFilter, setV8RunsStatusFilter] = useState<string>('');
  const [v8Workflows, setV8Workflows] = useState<V8SyncWorkflowRecord[]>([]);
  const [v8WorkflowsLoading, setV8WorkflowsLoading] = useState(false);
  const [v8RefreshPolicies, setV8RefreshPolicies] = useState<
    Partial<Record<V8SyncProviderFamily, V8SyncRefreshTimingPolicy | null>>
  >({});
  const [mutatingConnectorAuthId, setMutatingConnectorAuthId] = useState<string | null>(null);
  const [resolvingAuthEscalationId, setResolvingAuthEscalationId] = useState<string | null>(null);
  const [recoveringAuthEscalationConnectorId, setRecoveringAuthEscalationConnectorId] = useState<
    string | null
  >(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [mutatingRefreshPolicyFamily, setMutatingRefreshPolicyFamily] =
    useState<V8SyncProviderFamily | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [ownershipItems, setOwnershipItems] = useState<AdminIntegrationOwnershipItem[]>([]);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [connectionLogItems, setConnectionLogItems] = useState<AdminIntegrationConnectionLogItem[]>(
    []
  );
  const [connectionLogTotal, setConnectionLogTotal] = useState(0);
  const [connectionLogLoading, setConnectionLogLoading] = useState(false);
  const [connectionLogError, setConnectionLogError] = useState<string | null>(null);
  const [connectionLogEventType, setConnectionLogEventType] = useState<string>('');
  const [connectionLogConnectorId, setConnectionLogConnectorId] = useState<string>('');
  const [connectionLogLimit, setConnectionLogLimit] = useState<number>(50);
  const [connectionLogOffset, setConnectionLogOffset] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [v8WorkflowPolicies, setV8WorkflowPolicies] = useState<
    Record<string, V8SyncWorkflowPolicyData>
  >({});
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showComingSoonCatalog, setShowComingSoonCatalog] = useState(false);
  const [editingPendingConfigId, setEditingPendingConfigId] = useState<string | null>(null);
  const [savingPendingConfigId, setSavingPendingConfigId] = useState<string | null>(null);
  const [pendingConfigDrafts, setPendingConfigDrafts] = useState<
    Record<string, Record<string, string>>
  >({});
  const [externalAuthSessions, setExternalAuthSessions] = useState<
    Record<string, ExternalAuthSessionInfo>
  >({});
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [savingCredentialId, setSavingCredentialId] = useState<string | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, CredentialDraft>>({});
  const [editingRefreshSecretId, setEditingRefreshSecretId] = useState<string | null>(null);
  const [savingRefreshSecretId, setSavingRefreshSecretId] = useState<string | null>(null);
  const [refreshSecretDrafts, setRefreshSecretDrafts] = useState<
    Record<string, RefreshSecretDraft>
  >({});
  const [storedRefreshSecrets, setStoredRefreshSecrets] = useState<
    Record<string, V8SyncRefreshSecretRef>
  >({});
  const [editingRefreshResultId, setEditingRefreshResultId] = useState<string | null>(null);
  const [savingRefreshResultId, setSavingRefreshResultId] = useState<string | null>(null);
  const [refreshResultDrafts, setRefreshResultDrafts] = useState<
    Record<string, RefreshResultDraft>
  >({});

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

    return Array.from(byConnectorId.values()).slice(0, 5);
  }, [integrations]);

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
      })
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
        })
      );

      setV8ConnectorHealth(
        Object.fromEntries(
          results.filter(
            (entry): entry is [string, V8SyncConnectorHealthSummary] => entry[1] !== null
          )
        )
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
        setV8WorkspacePresenceFailed(false);
      } catch {
        setV8WorkspacePresence([]);
        setV8WorkspaceLocks([]);
        setV8WorkspacePresenceFailed(true);
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

  const fetchRuns = useCallback(async (integrationId?: string, status?: string) => {
    setV8RunsLoading(true);
    try {
      const data = await V8SyncApi.getRuns({
        integrationId: integrationId || undefined,
        status: status || undefined,
        limit: 50,
      });
      setV8Runs(data.runs || []);
      setV8RunsTotal(data.total ?? 0);
    } catch {
      setV8Runs([]);
      setV8RunsTotal(0);
    } finally {
      setV8RunsLoading(false);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    setV8WorkflowsLoading(true);
    try {
      const data = await V8SyncApi.getWorkflows();
      setV8Workflows(data.workflows || []);
    } catch {
      setV8Workflows([]);
    } finally {
      setV8WorkflowsLoading(false);
    }
  }, []);

  const fetchAdminOwnership = useCallback(async () => {
    setOwnershipLoading(true);
    setOwnershipError(null);
    try {
      const res = await fetch(`${API_URL}/admin/integrations/users`, { headers: getHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getReadableErrorMessage(body, `HTTP ${res.status}`));
      }
      const data = (await res.json()) as { items?: AdminIntegrationOwnershipItem[] };
      setOwnershipItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setOwnershipItems([]);
      setOwnershipError(getReadableErrorMessage(e, 'Failed to load integrations ownership'));
    } finally {
      setOwnershipLoading(false);
    }
  }, []);

  const fetchAdminConnectionLogs = useCallback(async () => {
    setConnectionLogLoading(true);
    setConnectionLogError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(connectionLogLimit));
      params.set('offset', String(connectionLogOffset));
      if (connectionLogEventType.trim()) params.set('eventType', connectionLogEventType.trim());
      if (connectionLogConnectorId.trim())
        params.set('connectorId', connectionLogConnectorId.trim());

      const res = await fetch(`${API_URL}/admin/integrations/logs?${params.toString()}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getReadableErrorMessage(body, `HTTP ${res.status}`));
      }
      const data = (await res.json()) as {
        items?: AdminIntegrationConnectionLogItem[];
        total?: number;
      };
      setConnectionLogItems(Array.isArray(data.items) ? data.items : []);
      setConnectionLogTotal(Number(data.total || 0));
    } catch (e: any) {
      setConnectionLogItems([]);
      setConnectionLogTotal(0);
      setConnectionLogError(getReadableErrorMessage(e, 'Failed to load connection logs'));
    } finally {
      setConnectionLogLoading(false);
    }
  }, [connectionLogConnectorId, connectionLogEventType, connectionLogLimit, connectionLogOffset]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        fetchIntegrations(),
        fetchCatalog(),
        fetchHealth(),
        fetchErrors(),
        fetchAuditLog(),
        fetchV8AuthHealth(),
        fetchV8AuthEscalations(),
        fetchV8Conflicts(),
        fetchRuns(),
      ]);
    } finally {
      setLoading(false);
    }

    void fetchV8RefreshPolicies();
    void fetchV8WorkspaceMapping();
    void fetchV8WorkspaceBinding().then((workspaceBinding) => {
      void fetchV8WorkspacePresenceAndLocks(workspaceBinding);
    });
  }, [
    fetchIntegrations,
    fetchCatalog,
    fetchHealth,
    fetchErrors,
    fetchAuditLog,
    fetchV8AuthHealth,
    fetchV8AuthEscalations,
    fetchV8Conflicts,
    fetchRuns,
    fetchV8RefreshPolicies,
    fetchV8WorkspaceMapping,
    fetchV8WorkspaceBinding,
    fetchV8WorkspacePresenceAndLocks,
  ]);

  // Avoid reload loops caused by `loadAll` changing when derived sync targets change.
  // We want an initial load on mount, and then explicit refreshes on demand.
  const loadAllRef = useRef(loadAll);
  useEffect(() => {
    loadAllRef.current = loadAll;
  }, [loadAll]);

  useEffect(() => {
    loadAllRef.current();
    trackFunnelEvent('integration_sync_hub_viewed');
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    void (async () => {
      try {
        const policy = await V8SyncApi.getWorkflowPolicy(expandedId);
        setV8WorkflowPolicies((prev) => ({ ...prev, [expandedId]: policy }));
      } catch {
        // non-fatal — policy gate section stays hidden
      }
    })();
  }, [expandedId]);

  useEffect(() => {
    if (activeTab !== 'health') return;
    void fetchV8ConnectorHealth();
  }, [activeTab, fetchV8ConnectorHealth]);

  useEffect(() => {
    if (activeTab !== 'policies') return;
    void fetchV8RefreshPolicies();
  }, [activeTab, fetchV8RefreshPolicies]);

  useEffect(() => {
    if (activeTab !== 'workflows') return;
    void fetchWorkflows();
  }, [activeTab, fetchWorkflows]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    void fetchAdminOwnership();
  }, [activeTab, fetchAdminOwnership]);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    void fetchAdminConnectionLogs();
  }, [activeTab, fetchAdminConnectionLogs]);

  // ── Actions ──────────────────────────────────────────────────

  const handleConnect = async (connectorId: string) => {
    try {
      let initiatedIntegration: V8SyncInitiatedIntegration | null = null;
      try {
        const data = await V8SyncApi.connectIntegration(connectorId);
        initiatedIntegration = data.integration;
        if (data.externalAuth) {
          setExternalAuthSessions((current) => ({
            ...current,
            [data.integration.id]: data.externalAuth as ExternalAuthSessionInfo,
          }));
          openExternalAuthSession(data.externalAuth as ExternalAuthSessionInfo);
        }
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
          const err = await res.json().catch(() => ({}));
          toast.error(getReadableErrorMessage(err, 'Failed to connect'));
          return;
        }

        const data = (await res.json()) as { integration?: { id: string; status?: string } };
        if (data.integration?.id) {
          initiatedIntegration = {
            id: data.integration.id,
            connectorId,
            name: connectorId,
            category: 'collaboration',
            status: 'pending',
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
            'Connection started. The integration is pending external auth or configuration.'
          )
        );
        trackFunnelEvent('integration_connected', {
          connectorId,
          status: initiatedIntegration.status,
        });
        setShowConnectModal(false);
        await loadAll();
      }
    } catch (error) {
      toast.error(
        getReadableErrorMessage(error, t('integrations.syncHub.connectFailed', 'Connection failed'))
      );
    }
  };

  const handlePendingConfigDraftChange = (integrationId: string, field: string, value: string) => {
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
      Object.entries(draft).filter(([, value]) => value.trim().length > 0)
    );

    if (Object.keys(config).length === 0) {
      toast.error(
        t(
          'integrations.syncHub.setupConfigMissing',
          'Enter at least one provider configuration value.'
        )
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
          const externalAuthSession: ExternalAuthSessionInfo = data.externalAuth;
          setExternalAuthSessions((current) => ({
            ...current,
            [integration.id]: externalAuthSession,
          }));
          openExternalAuthSession(externalAuthSession);
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
              'Configuration saved. External auth still needs to finish before sync controls become available.'
            )
          : t(
              'integrations.syncHub.setupConfigSaved',
              'Configuration saved. Finish the remaining onboarding steps before sync controls become available.'
            )
      );
      setEditingPendingConfigId(null);
      setPendingConfigDrafts((current) => ({ ...current, [integration.id]: {} }));
      await loadAll();
    } catch {
      toast.error(
        t('integrations.syncHub.setupConfigSaveFailed', 'Failed to save provider configuration.')
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
          const externalAuthSession: ExternalAuthSessionInfo = data.externalAuth;
          setExternalAuthSessions((current) => ({
            ...current,
            [integrationId]: externalAuthSession,
          }));
          openExternalAuthSession(externalAuthSession);
        }
        toast.success(
          data.onboardingStatus === 'pending_external_auth'
            ? t(
                'integrations.syncHub.reauthPendingAuth',
                'Re-authorization started. External auth still needs to complete before sync resumes.'
              )
            : t('integrations.syncHub.reauthStarted', 'Re-authorization started')
        );
        trackFunnelEvent('integration_reauth_required', {
          integrationId,
          onboardingStatus: data.onboardingStatus,
        });
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
        trackFunnelEvent('integration_reauth_required', { integrationId });
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
        t('integrations.syncHub.v8ConflictResolveFailed', 'Failed to resolve governed conflict')
      );
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleSetV8ConnectorAuthState = async (
    connectorId: string,
    targetState: V8SyncConnectorAuthState,
    reason?: string
  ) => {
    setMutatingConnectorAuthId(`${connectorId}:${targetState}`);
    try {
      await V8SyncApi.setConnectorAuthState(connectorId, targetState, reason ?? null);
      toast.success(
        targetState === 'healthy'
          ? t('integrations.syncHub.v8AuthMarkedHealthy', 'Governed auth state marked healthy')
          : t(
              'integrations.syncHub.v8AuthMarkedNeedsReauth',
              'Governed auth state marked reauth needed'
            )
      );
      await Promise.all([
        loadAll(),
        fetchV8ConnectorHealth(),
        fetchV8AuthHealth(),
        fetchV8AuthEscalations(),
      ]);
    } catch {
      toast.error(
        t('integrations.syncHub.v8AuthStateUpdateFailed', 'Failed to update governed auth state')
      );
    } finally {
      setMutatingConnectorAuthId(null);
    }
  };

  const handleMarkVerificationComplete = async (integration: IntegrationItem) => {
    await handleSetV8ConnectorAuthState(
      integration.connectorId,
      'healthy',
      'callback_verification_completed'
    );
  };

  const handleCredentialDraftChange = (
    integrationId: string,
    field: keyof CredentialDraft,
    value: string
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

    if (
      !draft.providerAccountId.trim() ||
      !draft.workspaceOrTenantId.trim() ||
      scopesGranted.length === 0
    ) {
      toast.error(
        t(
          'integrations.syncHub.credentialMaterializationFieldsRequired',
          'Provider account, workspace or tenant, and at least one scope are required.'
        )
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
        t('integrations.syncHub.credentialMaterialized', 'Governed credential baseline recorded')
      );
      setEditingCredentialId(null);
      await loadAll();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.credentialMaterializationFailed',
          'Failed to record governed credential baseline'
        )
      );
    } finally {
      setSavingCredentialId(null);
    }
  };

  const handleRefreshSecretDraftChange = (
    integrationId: string,
    field: keyof RefreshSecretDraft,
    value: string
  ) => {
    setRefreshSecretDrafts((current) => ({
      ...current,
      [integrationId]: {
        clientId: current[integrationId]?.clientId || '',
        clientSecret: current[integrationId]?.clientSecret || '',
        refreshToken: current[integrationId]?.refreshToken || '',
        tokenEndpoint: current[integrationId]?.tokenEndpoint || '',
        [field]: value,
      },
    }));
  };

  const handleSaveRefreshSecret = async (integration: IntegrationItem) => {
    const draft = refreshSecretDrafts[integration.id] || {
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      tokenEndpoint: '',
    };

    if (!draft.clientId.trim() || !draft.clientSecret.trim() || !draft.refreshToken.trim()) {
      toast.error(
        t(
          'integrations.syncHub.refreshSecretFieldsRequired',
          'Client ID, client secret, and refresh token are required.'
        )
      );
      return;
    }

    setSavingRefreshSecretId(integration.id);
    try {
      const payload = {
        clientId: draft.clientId.trim(),
        clientSecret: draft.clientSecret.trim(),
        refreshToken: draft.refreshToken.trim(),
        ...(draft.tokenEndpoint.trim().length > 0
          ? { tokenEndpoint: draft.tokenEndpoint.trim() }
          : {}),
      };
      const data = await V8SyncApi.storeRefreshSecret(integration.id, payload);
      setStoredRefreshSecrets((current) => ({
        ...current,
        [integration.id]: data.refreshSecret,
      }));
      toast.success(
        t('integrations.syncHub.refreshSecretSaved', 'Governed refresh runtime secret materialized')
      );
      setEditingRefreshSecretId(null);
      setRefreshSecretDrafts((current) => ({
        ...current,
        [integration.id]: {
          clientId: '',
          clientSecret: '',
          refreshToken: '',
          tokenEndpoint: data.refreshSecret.tokenEndpoint || '',
        },
      }));
      await loadAll();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.refreshSecretSaveFailed',
          'Failed to materialize governed refresh runtime secret'
        )
      );
    } finally {
      setSavingRefreshSecretId(null);
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
              'Governed refresh result recorded and reauthorization is now required'
            )
          : t('integrations.syncHub.refreshResultRecorded', 'Governed refresh result recorded')
      );
      setEditingRefreshResultId(null);
      await loadAll();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.refreshResultRecordFailed',
          'Failed to record governed refresh result'
        )
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
        t('integrations.syncHub.v8AuthEscalationResolved', 'Governed auth escalation resolved')
      );
      await Promise.all([fetchV8AuthEscalations(), fetchV8AuthHealth()]);
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8AuthEscalationResolveFailed',
          'Failed to resolve governed auth escalation'
        )
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
        integration.status === 'requires_reauth'
    );

    if (!recoveryTarget) {
      toast.error(
        t(
          'integrations.syncHub.v8AuthEscalationRecoveryUnavailable',
          'No governed re-authorization target is available for this escalation yet'
        )
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
        GOVERNED_REFRESH_POLICY_PRESETS[providerFamily]
      );
      toast.success(
        t('integrations.syncHub.v8RefreshPolicyApplied', 'Governed refresh timing policy applied')
      );
      await fetchV8RefreshPolicies();
    } catch {
      toast.error(
        t(
          'integrations.syncHub.v8RefreshPolicyApplyFailed',
          'Failed to apply governed refresh timing policy'
        )
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
      groups[cat].push(c);
    });
    return groups;
  }, [catalog]);

  const renderCatalogTable = useCallback(
    (opts?: { inModal?: boolean }) => {
      const connectedIds = new Set(integrations.map((i) => i.connectorId));
      const categories = Object.keys(categorizedCatalog)
        .filter((cat) => {
          if (selectedCategory && !opts?.inModal) return true;
          if (selectedCategory && cat !== selectedCategory) return false;
          const rows = categorizedCatalog[cat] || [];
          return rows.some((c) => showComingSoonCatalog || !c.comingSoon);
        })
        .sort((a, b) => a.localeCompare(b));

      if (categories.length === 0) return null;

      return (
        <div className={opts?.inModal ? 'space-y-4' : 'space-y-5'}>
          {categories.map((cat) => {
            if (opts?.inModal && selectedCategory && cat !== selectedCategory) return null;
            const rows = (categorizedCatalog[cat] || []).filter(
              (c) => showComingSoonCatalog || !c.comingSoon
            );
            if (rows.length === 0) return null;

            return (
              <div key={cat}>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                <div className="rounded-xl border border-c-border/50 overflow-hidden bg-c-surface-raised/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-c-surface/40 text-slate-400 dark:text-slate-500">
                        <tr className="text-left text-xs">
                          <th className="px-3 py-2 w-10" />
                          <th className="px-3 py-2">
                            {t('integrations.syncHub.catalogApp', 'App')}
                          </th>
                          <th className="px-3 py-2 hidden md:table-cell">
                            {t('integrations.syncHub.catalogCapabilities', 'Capabilities')}
                          </th>
                          <th className="px-3 py-2 hidden lg:table-cell">
                            {t('integrations.syncHub.catalogSetup', 'Setup')}
                          </th>
                          <th className="px-3 py-2 w-28">
                            {t('integrations.syncHub.catalogStatus', 'Status')}
                          </th>
                          <th className="px-3 py-2 w-28" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-700/40">
                        {rows.map((conn) => {
                          const isConnected = connectedIds.has(conn.id);
                          const connectable = !conn.comingSoon && conn.isV2Ready !== false;
                          const status = isConnected
                            ? 'connected'
                            : conn.comingSoon
                              ? 'coming_soon'
                              : connectable
                                ? 'ready'
                                : 'not_ready';
                          return (
                            <tr key={conn.id} className="text-c-text-secondary hover:bg-c-surface-raised/40">
                              <td className="px-3 py-2.5">
                                <span className="w-8 h-8 rounded-lg bg-c-surface/40 border border-c-border/60 flex items-center justify-center text-c-text-secondary">
                                  {renderConnectorIcon(conn.id, conn.name)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="text-sm text-c-text">{conn.name}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">{conn.id}</div>
                              </td>
                              <td className="px-3 py-2.5 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {(conn.capabilities || []).slice(0, 4).map((cap) => (
                                    <span
                                      key={cap}
                                      className="px-1.5 py-0.5 rounded-full bg-c-surface-raised/60 text-[10px] text-slate-300 border border-c-border"
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                  {(conn.capabilities || []).length > 4 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-c-surface-raised/30 text-[10px] text-slate-400 dark:text-slate-500 border border-c-border">
                                      +{(conn.capabilities || []).length - 4}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 hidden lg:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {(conn.configFields || []).slice(0, 4).map((field) => (
                                    <span
                                      key={field}
                                      className="px-1.5 py-0.5 rounded-full bg-c-surface-raised/60 text-[10px] text-slate-300 border border-c-border"
                                    >
                                      {formatConfigFieldLabel(field)}
                                    </span>
                                  ))}
                                  {(conn.configFields || []).length > 4 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-c-surface-raised/30 text-[10px] text-slate-400 dark:text-slate-500 border border-c-border">
                                      +{(conn.configFields || []).length - 4}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {status === 'connected' ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                    <CheckCircle2 size={12} />{' '}
                                    {t('integrations.syncHub.alreadyConnected', 'Connected')}
                                  </span>
                                ) : status === 'coming_soon' ? (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                                    {t('integrations.syncHub.comingSoon', 'Coming soon')}
                                  </span>
                                ) : status === 'not_ready' ? (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                                    {t('integrations.syncHub.notReady', 'Not available')}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">
                                    {t('integrations.syncHub.ready', 'Ready')}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {isConnected ? null : connectable ? (
                                  <button
                                    onClick={() => handleConnect(conn.id)}
                                    className="px-3 py-1 text-xs bg-c-text text-c-bg hover:bg-c-text-secondary rounded-lg transition-colors"
                                  >
                                    {t('integrations.syncHub.connect', 'Connect')}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-600 dark:text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    },
    [
      categorizedCatalog,
      integrations,
      selectedCategory,
      showComingSoonCatalog,
      t,
      // functions used in render
      handleConnect,
    ]
  );

  const getRefreshRuntimeRef = useCallback(
    (integrationId: string): V8SyncRefreshSecretRef | null => {
      const sessionRef = storedRefreshSecrets[integrationId];
      if (sessionRef) {
        return sessionRef;
      }

      for (let index = auditLog.length - 1; index >= 0; index -= 1) {
        const entry = auditLog[index];
        if (entry.integration_id !== integrationId) {
          continue;
        }

        if (entry.action === 'refresh_secret_materialized') {
          return {
            connectorId: getAuditDetailString(entry.details, 'connectorId') || '',
            organizationId: currentOrganization?.id || '',
            clientIdPresent: getAuditDetailBoolean(entry.details, 'clientIdPresent'),
            refreshTokenPresent: getAuditDetailBoolean(entry.details, 'refreshTokenPresent'),
            tokenEndpoint: getAuditDetailString(entry.details, 'tokenEndpoint') || '',
          };
        }

        if (
          entry.action === 'external_auth_callback_received' &&
          getAuditDetailBoolean(entry.details, 'refreshSecretStored')
        ) {
          return {
            connectorId: getAuditDetailString(entry.details, 'connectorId') || '',
            organizationId: currentOrganization?.id || '',
            clientIdPresent: true,
            refreshTokenPresent: true,
            tokenEndpoint: getAuditDetailString(entry.details, 'tokenEndpoint') || '',
          };
        }
      }

      return null;
    },
    [auditLog, currentOrganization?.id, storedRefreshSecrets]
  );

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
      id: 'runs',
      label: t('integrations.syncHub.tabs.runs', 'Run History'),
      icon: <History size={16} />,
    },
    {
      id: 'workflows',
      label: t('integrations.syncHub.tabs.workflows', 'Workflows'),
      icon: <Activity size={16} />,
    },
    {
      id: 'mappings',
      label: t('integrations.syncHub.tabs.mappings', 'Mappings'),
      icon: <GitMerge size={16} />,
    },
    {
      id: 'users',
      label: t('integrations.syncHub.tabs.users', 'Users'),
      icon: <Users size={16} />,
      badge: ownershipItems.length > 0 ? ownershipItems.length : undefined,
    },
    {
      id: 'logs',
      label: t('integrations.syncHub.tabs.logs', 'Connection logs'),
      icon: <List size={16} />,
      badge: connectionLogTotal > 0 ? connectionLogTotal : undefined,
    },
    {
      id: 'policies',
      label: t('integrations.syncHub.tabs.policies', 'Policies & Scopes'),
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
      (field) => !configuredFieldSet.has(field)
    );
    const isEditingPendingConfig = editingPendingConfigId === int.id;
    const isEditingCredential = editingCredentialId === int.id;
    const externalAuthSession = externalAuthSessions[int.id] || null;
    const providerFamily = getProviderFamily(int.connectorId);
    const canMaterializeCredential =
      int.status === 'connected' && int.connector?.authType === 'oauth2' && providerFamily !== null;
    const refreshRuntimeRef = getRefreshRuntimeRef(int.id);
    const canStoreRefreshSecret =
      int.connector?.authType === 'oauth2' &&
      int.status !== 'pending' &&
      int.status !== 'disconnected' &&
      providerFamily !== null;
    const isEditingRefreshSecret = editingRefreshSecretId === int.id;
    const canRecordRefreshResult =
      int.credential !== null && int.connector?.authType === 'oauth2' && providerFamily !== null;
    const credentialDraft = credentialDrafts[int.id] || {
      providerAccountId: int.credential?.providerAccountId || '',
      workspaceOrTenantId: int.credential?.workspaceOrTenantId || '',
      scopesGranted: int.credential?.scopesGranted?.join(', ') || '',
      tokenExpiresAt: int.credential?.tokenExpiresAt || '',
    };
    const refreshSecretDraft = refreshSecretDrafts[int.id] || {
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      tokenEndpoint: refreshRuntimeRef?.tokenEndpoint || '',
    };
    const refreshResultDraft = refreshResultDrafts[int.id] || 'success';
    const pendingSetupDescription =
      int.onboardingStatus === 'pending_external_auth'
        ? t(
            'integrations.syncHub.setupPendingAuthOnlyDesc',
            'Required provider configuration is saved. Complete external auth before sync controls become available.'
          )
        : int.onboardingStatus === 'authorization_callback_received_pending_verification'
          ? t(
              'integrations.syncHub.setupCallbackReceivedDesc',
              'The external authorization callback was received. Verification is still pending before sync controls become available.'
            )
          : int.onboardingStatus === 'configuration_submitted_pending_validation'
            ? t(
                'integrations.syncHub.setupPendingValidationDesc',
                'Configuration is saved. Provider validation must finish before sync controls become available.'
              )
            : int.onboardingStatus === 'pending_configuration'
              ? t(
                  'integrations.syncHub.setupPendingConfigOnlyDesc',
                  'Finish provider configuration before sync controls become available.'
                )
              : t(
                  'integrations.syncHub.setupPendingDesc',
                  'Complete external auth or provider configuration before sync controls become available.'
                );
    const lifecycleSteps = [
      {
        key: 'connect',
        label: t('integrations.syncHub.lifecycleConnect', 'Connect'),
        state: 'done' as const,
        detail: t(
          'integrations.syncHub.lifecycleConnectDone',
          'Provider entry exists in governed sync.'
        ),
      },
      {
        key: 'configure',
        label: t('integrations.syncHub.lifecycleConfigure', 'Configure'),
        state: missingConfigFields.length === 0 ? ('done' as const) : ('active' as const),
        detail:
          missingConfigFields.length === 0
            ? t(
                'integrations.syncHub.lifecycleConfigureDone',
                'Required provider fields are saved on the governed path.'
              )
            : t(
                'integrations.syncHub.lifecycleConfigureActive',
                'Save the remaining provider fields before the lane can move forward.'
              ),
      },
      {
        key: 'authorize',
        label: t('integrations.syncHub.lifecycleAuthorize', 'Authorize'),
        state:
          int.connector?.authType !== 'oauth2'
            ? ('done' as const)
            : int.status === 'requires_reauth'
              ? ('active' as const)
              : int.onboardingStatus === 'pending_external_auth' ||
                  int.onboardingStatus === 'pending_external_auth_or_configuration'
                ? ('active' as const)
                : ('done' as const),
        detail:
          int.connector?.authType !== 'oauth2'
            ? t(
                'integrations.syncHub.lifecycleAuthorizeNotNeeded',
                'This provider does not require an OAuth authorization round-trip.'
              )
            : int.status === 'requires_reauth'
              ? t(
                  'integrations.syncHub.lifecycleAuthorizeReauth',
                  'Authorization must be renewed before sync can continue.'
                )
              : int.onboardingStatus === 'pending_external_auth' ||
                  int.onboardingStatus === 'pending_external_auth_or_configuration'
                ? t(
                    'integrations.syncHub.lifecycleAuthorizeActive',
                    'Finish the governed provider authorization round-trip.'
                  )
                : t(
                    'integrations.syncHub.lifecycleAuthorizeDone',
                    'Governed authorization has completed.'
                  ),
      },
      {
        key: 'verify',
        label: t('integrations.syncHub.lifecycleVerify', 'Verify'),
        state:
          int.onboardingStatus === 'authorization_callback_received_pending_verification'
            ? ('active' as const)
            : int.status === 'pending'
              ? ('todo' as const)
              : ('done' as const),
        detail:
          int.onboardingStatus === 'authorization_callback_received_pending_verification'
            ? t(
                'integrations.syncHub.lifecycleVerifyActive',
                'The callback returned, but governed verification still needs to complete.'
              )
            : int.status === 'pending'
              ? t(
                  'integrations.syncHub.lifecycleVerifyTodo',
                  'Verification unlocks after configuration and authorization are complete.'
                )
              : t(
                  'integrations.syncHub.lifecycleVerifyDone',
                  'Governed verification is no longer blocking this lane.'
                ),
      },
      {
        key: 'refresh',
        label: t('integrations.syncHub.lifecycleRefresh', 'Refresh runtime'),
        state:
          int.connector?.authType !== 'oauth2'
            ? ('done' as const)
            : refreshRuntimeRef
              ? ('done' as const)
              : canStoreRefreshSecret
                ? ('active' as const)
                : ('todo' as const),
        detail:
          int.connector?.authType !== 'oauth2'
            ? t(
                'integrations.syncHub.lifecycleRefreshNotNeeded',
                'This provider does not require OAuth refresh material.'
              )
            : refreshRuntimeRef
              ? t(
                  'integrations.syncHub.lifecycleRefreshDone',
                  'Governed refresh material is present for automatic recovery.'
                )
              : canStoreRefreshSecret
                ? t(
                    'integrations.syncHub.lifecycleRefreshActive',
                    'Materialize refresh secrets so expired auth can recover without split-brain behavior.'
                  )
                : t(
                    'integrations.syncHub.lifecycleRefreshTodo',
                    'Refresh runtime is available after the provider reaches an operating state.'
                  ),
      },
      {
        key: 'monitor',
        label: t('integrations.syncHub.lifecycleMonitor', 'Monitor'),
        state:
          int.lastRun || int.lastSyncAt || int.status === 'connected'
            ? ('done' as const)
            : ('todo' as const),
        detail:
          int.lastRun || int.lastSyncAt || int.status === 'connected'
            ? t(
                'integrations.syncHub.lifecycleMonitorDone',
                'The lane has enough runtime truth to monitor health, syncs, and recovery.'
              )
            : t(
                'integrations.syncHub.lifecycleMonitorTodo',
                'Monitoring becomes meaningful after the lifecycle reaches an operating state.'
              ),
      },
    ];

    return (
      <motion.div
        key={int.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border border-c-border/50 rounded-lg bg-c-surface/40 hover:bg-c-surface-raised/60 transition-colors"
      >
        <div
          className="flex items-center gap-4 px-4 py-3 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : int.id)}
        >
          {/* Icon */}
          <div className="w-9 h-9 rounded-lg bg-c-surface-raised flex items-center justify-center text-lg shrink-0">
            {CATEGORY_ICONS[int.category] || '🔌'}
          </div>

          {/* Name + category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-c-text truncate">{int.name}</span>
              {renderStatusChip(int.status)}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {CATEGORY_LABELS[int.category] || int.category}
              </span>
              {renderHealthDot(int.health)}
            </div>
          </div>

          {/* Last sync */}
          <div className="hidden md:block text-right shrink-0 w-28">
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {t('integrations.syncHub.lastSync', 'Last sync')}
            </div>
            <div className="text-xs text-slate-300">{timeAgo(int.lastSyncAt)}</div>
          </div>

          {/* Last run status */}
          <div className="hidden lg:block text-right shrink-0 w-24">
            {int.lastRun && (
              <>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {t('integrations.syncHub.lastResult', 'Last result')}
                </div>
                <div
                  className={`text-xs ${int.lastRun.status === 'completed' ? 'text-emerald-400' : int.lastRun.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}
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
              className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
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
              className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title={t('integrations.syncHub.pause', 'Pause')}
            >
              <Pause size={15} />
            </button>
            {isExpanded ? (
              <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />
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
              <div className="px-4 pb-4 pt-1 border-t border-c-border/50 space-y-3">
                {/* Error banner */}
                {int.status === 'error' && int.lastError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {t('integrations.syncHub.errorOccurred', 'Error occurred')}
                      </div>
                      <div className="text-rose-300/70 mt-0.5">{int.lastError}</div>
                    </div>
                  </div>
                )}
                {int.status === 'requires_reauth' && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {t('integrations.syncHub.reauthRequired', 'Re-authorization required')}
                      </div>
                      <div className="text-amber-300/70 mt-0.5">
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
                      <div className="text-amber-200/80 mt-0.5">{pendingSetupDescription}</div>
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
                              }
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
                              className="space-y-2 rounded-lg border border-amber-500/20 bg-c-bg/30 p-3"
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
                                    className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-amber-500/40 focus:outline-none"
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
                                    : t(
                                        'integrations.syncHub.saveProviderConfig',
                                        'Save provider config'
                                      )}
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
                              'Governed external authorization is ready'
                            )}
                          </div>
                          <div className="mt-2">
                            <a
                              href={externalAuthSession.authUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 font-medium text-sky-100 hover:bg-sky-500/15 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={12} />
                              {t(
                                'integrations.syncHub.openExternalAuth',
                                'Open provider authorization'
                              )}
                            </a>
                          </div>
                          <div className="mt-1 text-sky-100/80 break-all">
                            {externalAuthSession.authUrl}
                          </div>
                          <div className="mt-1 text-sky-100/60">
                            {t(
                              'integrations.syncHub.externalAuthPreparedDesc',
                              'Use this governed authorization URL to finish the provider round-trip. It expires automatically if left unused.'
                            )}
                          </div>
                          <div className="mt-2 text-sky-100/60 break-all">
                            {t(
                              'integrations.syncHub.externalAuthCallbackUrl',
                              'Registered callback URL:'
                            )}{' '}
                            {externalAuthSession.callbackUrl}
                          </div>
                        </div>
                      )}
                      {int.onboardingStatus ===
                        'authorization_callback_received_pending_verification' && (
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
                              'Mark verification complete'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-c-border/70 bg-c-bg/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-c-text">
                        {t('integrations.syncHub.lifecycleShell', 'Lifecycle shell')}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {t(
                          'integrations.syncHub.lifecycleShellDesc',
                          'One governed lane for connect, complete, recover, and operate.'
                        )}
                      </div>
                    </div>
                    {int.status === 'requires_reauth' ? (
                      <button
                        type="button"
                        onClick={() => handleReauth(int.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/15 transition-colors"
                      >
                        <Shield size={12} />
                        {t('integrations.syncHub.reauth', 'Re-authorize')}
                      </button>
                    ) : int.onboardingStatus === 'pending_external_auth' && externalAuthSession ? (
                      <button
                        type="button"
                        onClick={() => openExternalAuthSession(externalAuthSession)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/15 transition-colors"
                      >
                        <ExternalLink size={12} />
                        {t('integrations.syncHub.openExternalAuth', 'Open provider authorization')}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {lifecycleSteps.map((step) => {
                      const toneClasses =
                        step.state === 'done'
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
                          : step.state === 'active'
                            ? 'border-amber-500/20 bg-amber-500/5 text-amber-100'
                            : 'border-c-border bg-c-surface/30 text-slate-300';
                      const badgeClasses =
                        step.state === 'done'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : step.state === 'active'
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-c-surface-raised/60 text-slate-300';
                      const badgeLabel =
                        step.state === 'done'
                          ? t('integrations.syncHub.lifecycleDone', 'Done')
                          : step.state === 'active'
                            ? t('integrations.syncHub.lifecycleActive', 'Active')
                            : t('integrations.syncHub.lifecycleLater', 'Later');

                      return (
                        <div
                          key={step.key}
                          className={`rounded-lg border p-2.5 text-[11px] ${toneClasses}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{step.label}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] ${badgeClasses}`}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <div className="mt-1.5 text-current/80">{step.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Capabilities / Scopes */}
                {int.connector?.capabilities && (
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {t('integrations.syncHub.scopes', 'Permissions & Scopes')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {int.connector.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded-full bg-c-surface-raised text-xs text-slate-400 dark:text-slate-500 border border-c-border"
                        >
                          read:{cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {canMaterializeCredential && (
                  <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-primary-200">
                          {t(
                            'integrations.syncHub.governedCredentialBaseline',
                            'Governed credential baseline'
                          )}
                        </div>
                        <div className="mt-1 text-primary-100/70">
                          {int.credential
                            ? t(
                                'integrations.syncHub.governedCredentialBaselineSaved',
                                'Credential metadata is recorded for governed refresh and recovery readback.'
                              )
                            : t(
                                'integrations.syncHub.governedCredentialBaselineMissing',
                                'Record credential metadata here before broader governed refresh and recovery continuity can become real.'
                              )}
                        </div>
                      </div>
                      {!isEditingCredential && (
                        <button
                          type="button"
                          onClick={() => setEditingCredentialId(int.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary-500/20 bg-primary-500/10 text-[11px] font-medium text-primary-200 hover:bg-primary-500/15 transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          {int.credential
                            ? t(
                                'integrations.syncHub.editGovernedCredential',
                                'Edit governed credential'
                              )
                            : t(
                                'integrations.syncHub.addGovernedCredential',
                                'Add governed credential'
                              )}
                        </button>
                      )}
                    </div>

                    {int.credential && !isEditingCredential && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-[11px] text-primary-100/80">
                        <div>
                          <div className="text-primary-200/60">
                            {t('integrations.syncHub.providerAccountId', 'Provider account')}
                          </div>
                          <div className="mt-1 break-all">{int.credential.providerAccountId}</div>
                        </div>
                        <div>
                          <div className="text-primary-200/60">
                            {t('integrations.syncHub.workspaceTenantId', 'Workspace or tenant')}
                          </div>
                          <div className="mt-1 break-all">{int.credential.workspaceOrTenantId}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-primary-200/60">
                            {t('integrations.syncHub.governedScopes', 'Governed scopes')}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {int.credential.scopesGranted.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-0.5 rounded-full border border-primary-500/20 bg-primary-500/10 text-[11px] text-primary-100"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-primary-200/60">
                            {t('integrations.syncHub.lastRefreshResult', 'Last refresh result')}
                          </div>
                          <div className="mt-1 break-all">
                            {int.credential.lastRefreshResult ||
                              t('integrations.syncHub.refreshNeverRecorded', 'never recorded')}
                          </div>
                        </div>
                        <div>
                          <div className="text-primary-200/60">
                            {t('integrations.syncHub.lastRefreshAt', 'Last refresh at')}
                          </div>
                          <div className="mt-1 break-all">
                            {int.credential.lastRefreshAt || t('common.never', 'Never')}
                          </div>
                        </div>
                      </div>
                    )}

                    {isEditingCredential && (
                      <div className="mt-3 space-y-2 rounded-lg border border-primary-500/20 bg-c-bg/30 p-3">
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-primary-100/80">
                            {t('integrations.syncHub.providerAccountId', 'Provider account')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.providerAccountId}
                            onChange={(e) =>
                              handleCredentialDraftChange(
                                int.id,
                                'providerAccountId',
                                e.target.value
                              )
                            }
                            placeholder="acct-123"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-c-accent/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-primary-100/80">
                            {t('integrations.syncHub.workspaceTenantId', 'Workspace or tenant')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.workspaceOrTenantId}
                            onChange={(e) =>
                              handleCredentialDraftChange(
                                int.id,
                                'workspaceOrTenantId',
                                e.target.value
                              )
                            }
                            placeholder="tenant-456"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-c-accent/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-primary-100/80">
                            {t('integrations.syncHub.governedScopes', 'Governed scopes')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.scopesGranted}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'scopesGranted', e.target.value)
                            }
                            placeholder="read:jira-work, write:jira-work"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-c-accent/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-primary-100/80">
                            {t('integrations.syncHub.tokenExpiresAt', 'Token expires at')}
                          </div>
                          <input
                            type="text"
                            value={credentialDraft.tokenExpiresAt}
                            onChange={(e) =>
                              handleCredentialDraftChange(int.id, 'tokenExpiresAt', e.target.value)
                            }
                            placeholder="2026-03-27T19:00:00.000Z"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-c-accent/40 focus:outline-none"
                          />
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveCredential(int)}
                            disabled={savingCredentialId === int.id}
                            className="px-3 py-1.5 text-xs bg-primary-500/15 text-primary-100 hover:bg-primary-500/25 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {savingCredentialId === int.id
                              ? t('common.saving', 'Saving...')
                              : t(
                                  'integrations.syncHub.saveGovernedCredential',
                                  'Save governed credential'
                                )}
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
                      <div className="mt-3 border-t border-primary-500/10 pt-3">
                        {!editingRefreshResultId || editingRefreshResultId !== int.id ? (
                          <button
                            type="button"
                            onClick={() => setEditingRefreshResultId(int.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary-500/20 bg-primary-500/10 text-[11px] font-medium text-primary-200 hover:bg-primary-500/15 transition-colors"
                          >
                            <RefreshCw size={12} />
                            {t('integrations.syncHub.recordRefreshResult', 'Record refresh result')}
                          </button>
                        ) : (
                          <div className="space-y-2 rounded-lg border border-primary-500/20 bg-c-bg/30 p-3">
                            <label className="block">
                              <div className="mb-1 text-[11px] uppercase tracking-wide text-primary-100/80">
                                {t('integrations.syncHub.refreshResult', 'Refresh result')}
                              </div>
                              <select
                                value={refreshResultDraft}
                                onChange={(e) =>
                                  handleRefreshResultDraftChange(
                                    int.id,
                                    e.target.value as RefreshResultDraft
                                  )
                                }
                                className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs focus:border-c-accent/40 focus:outline-none"
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
                                className="px-3 py-1.5 text-xs bg-primary-500/15 text-primary-100 hover:bg-primary-500/25 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {savingRefreshResultId === int.id
                                  ? t('common.saving', 'Saving...')
                                  : t(
                                      'integrations.syncHub.saveRefreshResult',
                                      'Save refresh result'
                                    )}
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

                {canStoreRefreshSecret && (
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sky-100">
                          {t(
                            'integrations.syncHub.governedRefreshRuntime',
                            'Governed refresh runtime'
                          )}
                        </div>
                        <div className="mt-1 text-sky-100/70">
                          {refreshRuntimeRef
                            ? t(
                                'integrations.syncHub.governedRefreshRuntimeReady',
                                'Refresh secret material is already present for this connector.'
                              )
                            : t(
                                'integrations.syncHub.governedRefreshRuntimeMissing',
                                'Materialize refresh secret material so expired credentials can recover on the governed runtime path.'
                              )}
                        </div>
                      </div>
                      {!isEditingRefreshSecret && (
                        <button
                          type="button"
                          onClick={() => setEditingRefreshSecretId(int.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/15 transition-colors"
                        >
                          <Shield size={12} />
                          {refreshRuntimeRef
                            ? t(
                                'integrations.syncHub.editGovernedRefreshRuntime',
                                'Edit refresh runtime'
                              )
                            : t(
                                'integrations.syncHub.addGovernedRefreshRuntime',
                                'Add refresh runtime'
                              )}
                        </button>
                      )}
                    </div>

                    {refreshRuntimeRef && !isEditingRefreshSecret && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-[11px] text-sky-100/80">
                        <div>
                          <div className="text-sky-100/60">
                            {t('integrations.syncHub.refreshSecretStatus', 'Secret status')}
                          </div>
                          <div className="mt-1">
                            {refreshRuntimeRef.clientIdPresent &&
                            refreshRuntimeRef.refreshTokenPresent
                              ? t(
                                  'integrations.syncHub.refreshSecretStatusStored',
                                  'Stored for governed refresh execution'
                                )
                              : t(
                                  'integrations.syncHub.refreshSecretStatusIncomplete',
                                  'Materialization needs to be completed'
                                )}
                          </div>
                        </div>
                        <div>
                          <div className="text-sky-100/60">
                            {t('integrations.syncHub.tokenEndpoint', 'Token endpoint')}
                          </div>
                          <div className="mt-1 break-all">
                            {refreshRuntimeRef.tokenEndpoint ||
                              t('common.notAvailable', 'Not available')}
                          </div>
                        </div>
                      </div>
                    )}

                    {isEditingRefreshSecret && (
                      <div className="mt-3 space-y-2 rounded-lg border border-sky-500/20 bg-c-bg/30 p-3">
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-sky-100/80">
                            {t('integrations.syncHub.clientId', 'Client ID')}
                          </div>
                          <input
                            type="text"
                            value={refreshSecretDraft.clientId}
                            onChange={(e) =>
                              handleRefreshSecretDraftChange(int.id, 'clientId', e.target.value)
                            }
                            placeholder="client-id"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-sky-100/80">
                            {t('integrations.syncHub.clientSecret', 'Client secret')}
                          </div>
                          <input
                            type="password"
                            value={refreshSecretDraft.clientSecret}
                            onChange={(e) =>
                              handleRefreshSecretDraftChange(int.id, 'clientSecret', e.target.value)
                            }
                            placeholder="client-secret"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-sky-100/80">
                            {t('integrations.syncHub.refreshToken', 'Refresh token')}
                          </div>
                          <input
                            type="password"
                            value={refreshSecretDraft.refreshToken}
                            onChange={(e) =>
                              handleRefreshSecretDraftChange(int.id, 'refreshToken', e.target.value)
                            }
                            placeholder="refresh-token"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-sky-100/80">
                            {t('integrations.syncHub.tokenEndpoint', 'Token endpoint')}
                          </div>
                          <input
                            type="text"
                            value={refreshSecretDraft.tokenEndpoint}
                            onChange={(e) =>
                              handleRefreshSecretDraftChange(
                                int.id,
                                'tokenEndpoint',
                                e.target.value
                              )
                            }
                            placeholder="https://auth.atlassian.com/oauth/token"
                            className="w-full rounded-lg border border-c-border bg-c-text text-c-bg px-3 py-2 text-xs placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
                          />
                        </label>
                        <div className="text-[11px] text-sky-100/60">
                          {t(
                            'integrations.syncHub.governedRefreshRuntimeHint',
                            'Leave token endpoint empty when the connector has a governed default.'
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveRefreshSecret(int)}
                            disabled={savingRefreshSecretId === int.id}
                            className="px-3 py-1.5 text-xs rounded-lg bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
                          >
                            {savingRefreshSecretId === int.id
                              ? t('common.saving', 'Saving...')
                              : t(
                                  'integrations.syncHub.saveGovernedRefreshRuntime',
                                  'Save refresh runtime'
                                )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRefreshSecretId(null)}
                            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg transition-colors"
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats row */}
                {int.lastRun && (
                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('integrations.syncHub.itemsProcessed', 'Items processed')}:
                      </span>{' '}
                      <span className="text-slate-300">{int.lastRun.items_processed}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('integrations.syncHub.duration', 'Duration')}:
                      </span>{' '}
                      <span className="text-slate-300">
                        {formatDuration(int.lastRun.duration_ms)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('integrations.syncHub.errorRateLabel', 'Error rate')}:
                      </span>{' '}
                      <span
                        className={`${int.errorRate > 20 ? 'text-rose-400' : 'text-slate-300'}`}
                      >
                        {int.errorRate}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Workflow policy gate */}
                {v8WorkflowPolicies[int.id] && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
                    <div className="font-medium text-violet-200 mb-1">
                      {t('integrations.syncHub.workflowPolicyGate', 'Workflow policy gate')}
                    </div>
                    <div className="text-violet-100/70">
                      {t('integrations.syncHub.workflowPolicyLabel', 'Policy')}:{' '}
                      <span className="text-violet-100">
                        {v8WorkflowPolicies[int.id].workflowPolicy}
                      </span>
                      {v8WorkflowPolicies[int.id].isPaused && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                          {t('integrations.syncHub.workflowPolicyPaused', 'paused')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {int.status === 'requires_reauth' && (
                    <button
                      onClick={() => handleReauth(int.id)}
                      className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors flex items-center gap-1.5"
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
                      {int.onboardingStatus ===
                      'authorization_callback_received_pending_verification'
                        ? t(
                            'integrations.syncHub.setupPendingControlsVerification',
                            'Verification still pending before sync controls unlock'
                          )
                        : int.onboardingStatus === 'pending_external_auth'
                          ? t(
                              'integrations.syncHub.setupPendingControlsAuthOnly',
                              'Finish external auth to enable sync controls'
                            )
                          : t(
                              'integrations.syncHub.setupPendingControls',
                              'Finish auth/config to enable sync controls'
                            )}
                    </span>
                  )}
                  <button
                    onClick={() => handleDisconnect(int.id)}
                    className="px-3 py-1.5 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('integrations.syncHub.search', 'Search integrations…')}
            className="w-full h-9 pl-9 pr-4 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text placeholder-slate-500 focus:outline-none focus:border-c-focus-solid"
          />
        </div>
        <button
          onClick={() => window.location.assign('/settings/integrations')}
          className="h-9 px-4 bg-c-text text-c-bg hover:bg-c-text-secondary text-sm rounded-lg flex items-center gap-2 transition-colors shrink-0"
        >
          <Plus size={16} />
          {t('integrations.syncHub.manageInSettings', 'Manage in Settings')}
        </button>
      </div>

      {/* Integrations list */}
      {loading ? (
        <LoadingState template="list" rows={5} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="mx-auto text-slate-600 dark:text-slate-400 mb-3" size={36} />
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            {t('integrations.syncHub.noIntegrations', 'No integrations connected')}
          </p>
          <button
            onClick={() => window.location.assign('/settings/integrations')}
            className="mt-3 px-4 py-2 text-sm text-primary-400 border border-primary-500/30 hover:bg-primary-500/10 rounded-lg transition-colors"
          >
            {t('integrations.syncHub.manageInSettings', 'Manage in Settings')}
          </button>
          {catalog.length > 0 && (
            <div className="mt-10 text-left">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-medium text-c-text">
                    {t('integrations.syncHub.availableConnectors', 'Available connectors')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'integrations.syncHub.availableConnectorsHint',
                      'Browse what can be connected for this tenant.'
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowComingSoonCatalog(false)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                      !showComingSoonCatalog
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                        : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
                    }`}
                  >
                    {t('integrations.syncHub.readyOnly', 'Ready')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComingSoonCatalog(true)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                      showComingSoonCatalog
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                        : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
                    }`}
                  >
                    {t('integrations.syncHub.showAll', 'All')}
                  </button>
                </div>
              </div>
              {renderCatalogTable()}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">{filtered.map(renderIntegrationRow)}</div>
      )}
    </div>
  );

  // ── Sync Health tab ──────────────────────────────────────────

  const renderHealthTab = () => (
    <div className="space-y-6">
      {!loading && integrations.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
          <Zap size={16} className="text-primary-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-c-text">
              {t('integrations.syncHub.healthEmptyTitle', 'No integrations connected yet')}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t(
                'integrations.syncHub.healthEmptyBody',
                'Connect your first integration to unlock sync health, auth escalations, and governed conflict visibility.'
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('apps');
              window.location.assign('/settings/integrations');
            }}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors"
          >
            <Plus size={14} />
            {t('integrations.syncHub.manageInSettings', 'Manage in Settings')}
          </button>
        </div>
      )}

      {/* Health summary cards */}
      {healthSummary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: t('integrations.syncHub.total', 'Total'),
              value: healthSummary.total,
              color: 'text-c-text',
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
              color: 'text-rose-400',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-3 rounded-lg bg-c-surface-raised/60 border border-c-border/50"
            >
              <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {v8AuthHealthSummary && (
        <div>
          <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
            <Shield size={14} className="text-blue-400" />
            {t('integrations.syncHub.v8AuthHealth', 'V8 Auth Health')}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: t('integrations.syncHub.v8TotalCredentials', 'Governed credentials'),
                value: v8AuthHealthSummary.total,
                color: 'text-blue-300',
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
                color: 'text-rose-400',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
              >
                <div className={`text-2xl font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <ShieldAlert size={14} className="text-amber-400" />
          {t('integrations.syncHub.v8AuthEscalations', 'V8 Active Auth Escalations')}
          {v8AuthEscalations.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded">
              {v8AuthEscalations.length}
            </span>
          )}
        </h3>
        {v8AuthEscalations.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
            {t('integrations.syncHub.v8NoEscalations', 'No governed auth escalations are open.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8AuthEscalations.slice(0, 5).map((escalation) => {
              const recoveryTarget = integrations.find(
                (integration) =>
                  integration.connectorId === escalation.connectorId &&
                  integration.connector?.authType === 'oauth2' &&
                  integration.status === 'requires_reauth'
              );

              return (
                <div
                  key={escalation.escalationId}
                  className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                >
                  <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-c-text-secondary">
                        {escalation.connectorId}
                      </span>
                      <span className="px-1.5 py-0.5 text-[11px] bg-amber-500/10 text-amber-300 rounded">
                        {t('integrations.syncHub.v8Escalated', 'escalated')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {escalation.reason ||
                        t('integrations.syncHub.v8NoEscalationReason', 'Auth health degraded')}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {timeAgo(escalation.escalatedAt)}
                    </div>
                    {recoveryTarget ? (
                      <div className="mt-2 text-[11px] text-amber-200/70">
                        {t(
                          'integrations.syncHub.v8RecoveryTargetReady',
                          'Governed re-authorization can start directly from this recovery panel.'
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-amber-200/60">
                        {t(
                          'integrations.syncHub.v8RecoveryTargetMissing',
                          'No governed re-authorization target is currently available for this escalation.'
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 disabled:opacity-60 transition-colors"
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
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <Zap size={14} className="text-blue-400" />
          {t('integrations.syncHub.v8ConnectorHealth', 'V8 Connector Health')}
          {Object.keys(v8ConnectorHealth).length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
              {Object.keys(v8ConnectorHealth).length}
            </span>
          )}
        </h3>
        {v8ConnectorHealthLoading ? (
          <div className="flex items-center justify-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
            <Loader2 size={14} className="animate-spin mr-2" />
            {t(
              'integrations.syncHub.v8ConnectorHealthLoading',
              'Loading governed connector health...'
            )}
          </div>
        ) : v8ConnectorHealthTargets.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
            {t(
              'integrations.syncHub.v8NoConnectorTargets',
              'No governed connector targets are available for this workspace yet.'
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {v8ConnectorHealthTargets.map((target) => {
              const health = v8ConnectorHealth[target.connectorId];
              const showMarkHealthy =
                !health ||
                [
                  'unknown',
                  'connecting',
                  'connected_pending_verification',
                  'degraded_reauth_needed',
                  'degraded_scope_limited',
                  'suspended',
                ].includes(health.authState);
              const showMarkReauthNeeded =
                health && ['healthy', 'connected_pending_verification'].includes(health.authState);
              const tone = !health
                ? 'border-c-border/40 bg-c-surface/30'
                : health.healthy
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : ['error', 'dead_letter', 'conflict'].includes(health.syncStatus)
                    ? 'border-rose-500/20 bg-rose-500/5'
                    : 'border-amber-500/20 bg-amber-500/5';

              return (
                <div key={target.connectorId} className={`rounded-lg border p-3 ${tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-c-text-secondary">{target.name}</span>
                        <span className="px-1.5 py-0.5 text-[11px] bg-c-surface-raised text-slate-400 dark:text-slate-500 rounded">
                          {target.connectorId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {CATEGORY_LABELS[target.category] || target.category}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 text-[11px] rounded ${
                        !health
                          ? 'bg-slate-500/10 text-slate-400 dark:text-slate-500'
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
                          <div className="text-slate-500 dark:text-slate-400">
                            {t('integrations.syncHub.v8AuthState', 'Auth state')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.authState}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {t('integrations.syncHub.v8SyncStatus', 'Sync status')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.syncStatus}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {t('integrations.syncHub.v8OpenConflicts', 'Open conflicts')}
                          </div>
                          <div className="text-slate-300 mt-1">{health.conflictCount}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">
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
                              onClick={() =>
                                void handleSetV8ConnectorAuthState(target.connectorId, 'healthy')
                              }
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
                                void handleSetV8ConnectorAuthState(
                                  target.connectorId,
                                  'degraded_reauth_needed'
                                )
                              }
                              disabled={
                                mutatingConnectorAuthId ===
                                `${target.connectorId}:degraded_reauth_needed`
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-[11px] font-medium text-amber-300 hover:bg-amber-500/15 disabled:opacity-60 transition-colors"
                            >
                              {mutatingConnectorAuthId ===
                              `${target.connectorId}:degraded_reauth_needed` ? (
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
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                        {t(
                          'integrations.syncHub.v8ConnectorHealthUnavailable',
                          'Governed connector health is not available for this connector yet.'
                        )}
                      </div>
                      {showMarkHealthy && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              void handleSetV8ConnectorAuthState(target.connectorId, 'healthy')
                            }
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
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-rose-400" />
          {t('integrations.syncHub.v8Conflicts', 'V8 Unresolved Sync Conflicts')}
          {v8Conflicts.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-rose-500/10 text-rose-400 rounded">
              {v8Conflicts.length}
            </span>
          )}
        </h3>
        {v8Conflicts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
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
                    <span className="text-xs font-medium text-c-text-secondary">
                      {conflict.conflictClass}
                    </span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-rose-500/10 text-rose-300 rounded uppercase">
                      {conflict.severity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {conflict.resolutionPath ||
                      t('integrations.syncHub.v8ResolutionPending', 'Resolution pending')}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{timeAgo(conflict.createdAt)}</div>
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
          <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
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
                color: 'text-c-text-secondary',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/20"
              >
                <div className={`text-base font-semibold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <Activity size={14} className="text-sky-400" />
          {t('integrations.syncHub.v8WorkspacePresence', 'V8 Workspace Presence')}
          {v8WorkspacePresence.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-sky-500/10 text-sky-400 rounded">
              {v8WorkspacePresence.length}
            </span>
          )}
        </h3>
        {v8WorkspaceBinding ? (
          <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {t('integrations.syncHub.v8WorkspaceRoom', 'Workspace room')}:{' '}
            {v8WorkspaceBinding.roomResourceId}
          </div>
        ) : null}
        {v8WorkspacePresence.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
            {v8WorkspacePresenceFailed
              ? t(
                  'integrations.syncHub.v8WorkspacePresenceFailed',
                  'Workspace presence unavailable. Presence bridge read failed.'
                )
              : v8WorkspaceBinding
                ? t(
                    'integrations.syncHub.v8NoWorkspacePresence',
                    'No governed workspace presence is active.'
                  )
                : t(
                    'integrations.syncHub.v8NoWorkspaceBinding',
                    'No governed workspace room binding is available.'
                  )}
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
                    <span className="text-xs font-medium text-c-text-secondary">{presence.userId}</span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-sky-500/10 text-sky-300 rounded">
                      {presence.activeSurface}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{presence.presenceType}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {timeAgo(presence.lastHeartbeat)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <Shield size={14} className="text-primary-400" />
          {t('integrations.syncHub.v8ActiveLocks', 'V8 Active Locks')}
          {v8WorkspaceLocks.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary-500/10 text-primary-400 rounded">
              {v8WorkspaceLocks.length}
            </span>
          )}
        </h3>
        {v8WorkspaceLocks.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm rounded-lg bg-c-surface/30 border border-c-border/40">
            {t('integrations.syncHub.v8NoLocks', 'No governed workspace locks are active.')}
          </div>
        ) : (
          <div className="space-y-2">
            {v8WorkspaceLocks.slice(0, 5).map((lock) => (
              <div
                key={lock.lockId}
                className="flex items-start gap-3 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20"
              >
                <Shield size={14} className="text-primary-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-c-text-secondary">{lock.lockType}</span>
                    <span className="px-1.5 py-0.5 text-[11px] bg-primary-500/10 text-primary-300 rounded">
                      {lock.lockScope}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{lock.holderId}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{timeAgo(lock.acquiredAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Errors list */}
      <div>
        <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          {t('integrations.syncHub.unresolvedErrors', 'Unresolved Errors')}
          {errors.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-rose-500/10 text-rose-400 rounded">
              {errors.length}
            </span>
          )}
        </h3>
        {errors.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-500/50" size={24} />
            {t('integrations.syncHub.noErrors', 'All systems operational')}
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err) => (
              <div
                key={err.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-c-surface/40 border border-c-border/50"
              >
                <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">{err.errorType}</span>
                    {err.isRetryable && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
                        retryable
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {err.retryCount}/{err.maxRetries} retries
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{err.errorMessage}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{timeAgo(err.createdAt)}</div>
                </div>
                <button
                  onClick={() => handleResolveError(err.id)}
                  className="px-2 py-1 text-xs text-brand hover:bg-brand/10 rounded transition-colors shrink-0"
                >
                  {t('integrations.syncHub.resolve', 'Resolve')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentUser && <IntegrationHealthDashboard currentUser={currentUser} />}
    </div>
  );

  // ── Users tab (monitoring) ────────────────────────────────────

  const filteredOwnershipItems = useMemo(() => {
    const q = usersSearchQuery.trim().toLowerCase();
    if (!q) return ownershipItems;
    return ownershipItems.filter((item) => {
      const name = `${item.firstName || ''} ${item.lastName || ''}`.trim().toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const connector = String(item.connectorId || '').toLowerCase();
      const status = String(item.status || '').toLowerCase();
      const integrationName = String(item.integrationName || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        connector.includes(q) ||
        status.includes(q) ||
        integrationName.includes(q)
      );
    });
  }, [ownershipItems, usersSearchQuery]);

  const renderUsersTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            value={usersSearchQuery}
            onChange={(e) => setUsersSearchQuery(e.target.value)}
            placeholder={t('integrations.syncHub.usersSearch', 'Search users, connectors, status…')}
            className="w-full h-9 pl-9 pr-4 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text placeholder-slate-500 focus:outline-none focus:border-c-focus-solid"
          />
        </div>
        <button
          onClick={() => void fetchAdminOwnership()}
          disabled={ownershipLoading}
          className="h-9 px-4 bg-c-surface-raised hover:bg-c-surface-raised text-c-text-secondary text-sm rounded-lg flex items-center gap-2 transition-colors shrink-0 disabled:opacity-60"
        >
          <RefreshCw size={16} className={ownershipLoading ? 'animate-spin' : ''} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {ownershipError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {ownershipError}
        </div>
      )}

      <div className="rounded-xl border border-c-border/50 bg-c-surface/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-c-surface/40 text-slate-500 dark:text-slate-400">
              <tr className="text-left text-xs">
                <th className="px-3 py-2">{t('integrations.syncHub.user', 'User')}</th>
                <th className="px-3 py-2">{t('integrations.syncHub.connector', 'Connector')}</th>
                <th className="px-3 py-2">
                  {t('integrations.syncHub.integration', 'Integration')}
                </th>
                <th className="px-3 py-2">{t('integrations.syncHub.status', 'Status')}</th>
                <th className="px-3 py-2">{t('integrations.syncHub.updated', 'Updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/40">
              {ownershipLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="inline-block mr-2 animate-spin" size={16} />
                    {t('integrations.syncHub.loading', 'Loading integrations…')}
                  </td>
                </tr>
              ) : filteredOwnershipItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                    {t('integrations.syncHub.noOwnership', 'No user integrations tracked yet')}
                  </td>
                </tr>
              ) : (
                filteredOwnershipItems.map((item) => {
                  const userLabel =
                    `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
                    item.email ||
                    item.userId;
                  return (
                    <tr key={`${item.integrationId}:${item.userId}`} className="text-c-text-secondary">
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-c-text">{userLabel}</div>
                        {item.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.email}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-c-surface-raised border border-c-border text-slate-300">
                          {item.connectorId}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm text-c-text-secondary">{item.integrationName}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{item.integrationId}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {renderStatusChip(item.status as IntegrationStatus)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                        {item.updatedAt ? timeAgo(item.updatedAt) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── Connection logs tab (monitoring) ──────────────────────────

  const renderLogsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('integrations.syncHub.filter', 'Filter')}
          </span>
          <select
            value={connectionLogEventType}
            onChange={(e) => {
              setConnectionLogOffset(0);
              setConnectionLogEventType(e.target.value);
            }}
            className="h-9 px-3 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text-secondary"
          >
            <option value="">{t('integrations.syncHub.eventAll', 'All events')}</option>
            <option value="connect_initiated">connect_initiated</option>
            <option value="configuration_submitted">configuration_submitted</option>
            <option value="external_auth_prepared">external_auth_prepared</option>
            <option value="external_auth_callback_received">external_auth_callback_received</option>
            <option value="disconnect_requested">disconnect_requested</option>
            <option value="reauth_started">reauth_started</option>
            <option value="error">error</option>
          </select>
          <input
            value={connectionLogConnectorId}
            onChange={(e) => {
              setConnectionLogOffset(0);
              setConnectionLogConnectorId(e.target.value);
            }}
            placeholder={t('integrations.syncHub.connectorId', 'connectorId')}
            className="h-9 px-3 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text-secondary placeholder-slate-500"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void fetchAdminConnectionLogs()}
            disabled={connectionLogLoading}
            className="h-9 px-4 bg-c-surface-raised hover:bg-c-surface-raised text-c-text-secondary text-sm rounded-lg flex items-center gap-2 transition-colors shrink-0 disabled:opacity-60"
          >
            <RefreshCw size={16} className={connectionLogLoading ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {connectionLogError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {connectionLogError}
        </div>
      )}

      <div className="rounded-xl border border-c-border/50 bg-c-surface/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-c-surface/40 text-slate-500 dark:text-slate-400">
              <tr className="text-left text-xs">
                <th className="px-3 py-2">{t('integrations.syncHub.time', 'Time')}</th>
                <th className="px-3 py-2">{t('integrations.syncHub.connector', 'Connector')}</th>
                <th className="px-3 py-2">{t('integrations.syncHub.event', 'Event')}</th>
                <th className="px-3 py-2">
                  {t('integrations.syncHub.integration', 'Integration')}
                </th>
                <th className="px-3 py-2">{t('integrations.syncHub.user', 'User')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/40">
              {connectionLogLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="inline-block mr-2 animate-spin" size={16} />
                    {t('integrations.syncHub.loading', 'Loading integrations…')}
                  </td>
                </tr>
              ) : connectionLogItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                    {t('integrations.syncHub.noLogs', 'No connection events recorded yet')}
                  </td>
                </tr>
              ) : (
                connectionLogItems.map((row) => (
                  <tr key={row.id} className="text-c-text-secondary">
                    <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {timeAgo(row.createdAt)}
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-c-surface-raised border border-c-border text-slate-300">
                        {row.connectorId}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm font-medium text-c-text">{row.eventType}</div>
                      {row.metadata && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate max-w-[520px]">
                          {JSON.stringify(row.metadata)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{row.integrationId}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{row.userId || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          {t('integrations.syncHub.showing', 'Showing')} {connectionLogItems.length} /{' '}
          {connectionLogTotal}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setConnectionLogOffset(Math.max(0, connectionLogOffset - connectionLogLimit))
            }
            disabled={connectionLogOffset === 0}
            className="px-3 py-2 rounded-lg border border-c-border bg-c-surface-raised/50 hover:bg-c-surface-raised text-c-text-secondary disabled:opacity-40 transition-colors"
          >
            {t('common.prev', 'Prev')}
          </button>
          <button
            onClick={() => setConnectionLogOffset(connectionLogOffset + connectionLogLimit)}
            disabled={connectionLogOffset + connectionLogLimit >= connectionLogTotal}
            className="px-3 py-2 rounded-lg border border-c-border bg-c-surface-raised/50 hover:bg-c-surface-raised text-c-text-secondary disabled:opacity-40 transition-colors"
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Workflows tab ────────────────────────────────────────────

  const renderWorkflowsTab = () => {
    if (v8WorkflowsLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-brand" />
        </div>
      );
    }

    if (v8Workflows.length === 0) {
      return (
        <div className="text-center py-12">
          <Activity className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('integrations.syncHub.noWorkflows', 'No workflows configured yet.')}
          </p>
        </div>
      );
    }

    const stateColor = (s: string) => {
      if (s === 'connected' || s === 'recovered') return 'text-green-500';
      if (s === 'degraded' || s === 'requires_action') return 'text-amber-500';
      if (s === 'blocked') return 'text-rose-500';
      return 'text-slate-400 dark:text-slate-500';
    };

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-c-border-subtle">
                <th className="text-left pb-2 pr-4">{t('integrations.syncHub.wfName', 'Name')}</th>
                <th className="text-left pb-2 pr-4">
                  {t('integrations.syncHub.wfConnector', 'Connector')}
                </th>
                <th className="text-left pb-2 pr-4">
                  {t('integrations.syncHub.wfState', 'State')}
                </th>
                <th className="text-left pb-2 pr-4">{t('integrations.syncHub.wfMode', 'Mode')}</th>
                <th className="text-left pb-2 pr-4">
                  {t('integrations.syncHub.wfPaused', 'Paused')}
                </th>
                <th className="text-left pb-2">
                  {t('integrations.syncHub.wfLastSync', 'Last Sync')}
                </th>
              </tr>
            </thead>
            <tbody>
              {v8Workflows.map((wf) => (
                <tr key={wf.workflowId} className="border-b border-c-border-subtle">
                  <td className="py-2 pr-4 font-medium">{wf.name || wf.connectorId}</td>
                  <td className="py-2 pr-4 text-slate-400 dark:text-slate-500">{wf.connectorId}</td>
                  <td className="py-2 pr-4">
                    <span className={`font-medium ${stateColor(wf.lifecycleState)}`}>
                      {wf.lifecycleState}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-400 dark:text-slate-500">{wf.mode}</td>
                  <td className="py-2 pr-4">
                    {wf.isPaused ? (
                      <span className="text-amber-400">Yes</span>
                    ) : (
                      <span className="text-green-400">No</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">
                    {wf.lastSyncAt ? new Date(wf.lastSyncAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Permissions & Scopes tab ─────────────────────────────────

  const renderScopesTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-400 dark:text-slate-500">
        {t(
          'integrations.syncHub.scopesDesc',
          'Review what each integration can read and write in your workspace.'
        )}
      </p>
      {v8RefreshPolicyTargets.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-c-text mb-3 flex items-center gap-2">
              <Zap size={14} className="text-primary-400" />
              {t('integrations.syncHub.v8RefreshPolicies', 'Governed Refresh Timing Policies')}
            </h3>
            <div className="space-y-2">
              {v8RefreshPolicyTargets.map((target) => {
                const policy = v8RefreshPolicies[target.providerFamily] ?? null;
                const preset = GOVERNED_REFRESH_POLICY_PRESETS[target.providerFamily];
                return (
                  <div
                    key={target.providerFamily}
                    className="p-3 rounded-lg bg-primary-500/5 border border-primary-500/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-c-text-secondary">
                            {target.providerLabel}
                          </span>
                          <span className="px-1.5 py-0.5 text-[11px] bg-primary-500/10 text-primary-300 rounded">
                            {target.connectorId}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {target.integrationName}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                          <span className="px-2 py-0.5 rounded-full bg-c-surface-raised border border-c-border">
                            lifetime {policy?.typicalTokenLifetimeMinutes ?? 'none'}m
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-c-surface-raised border border-c-border">
                            refresh window {policy?.refreshWindowMinutes ?? 'none'}m
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-c-surface-raised border border-c-border">
                            retries {policy?.maxRetryAttempts ?? 'none'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleApplyGovernedRefreshPolicy(target.providerFamily)}
                        disabled={mutatingRefreshPolicyFamily === target.providerFamily}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary-500/20 bg-primary-500/10 text-[11px] font-medium text-primary-300 hover:bg-primary-500/15 disabled:opacity-60 transition-colors"
                        title={`lifetime ${preset.typicalTokenLifetimeMinutes}m, window ${preset.refreshWindowMinutes}m, retries ${preset.maxRetryAttempts}`}
                      >
                        {mutatingRefreshPolicyFamily === target.providerFamily ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        {t('integrations.syncHub.v8ApplyGovernedPolicy', 'Apply governed policy')}
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
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
          {t('integrations.syncHub.noScopesData', 'No integrations connected yet.')}
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((int) => (
            <div key={int.id} className="p-3 rounded-lg bg-c-surface/40 border border-c-border/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{CATEGORY_ICONS[int.category] || '🔌'}</span>
                <div>
                  <div className="text-sm font-medium text-c-text">{int.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {int.connector?.authType || 'oauth2'}
                  </div>
                </div>
                {renderStatusChip(int.status)}
              </div>
              <div className="flex flex-wrap gap-1">
                {(int.connector?.capabilities || []).map((cap) => (
                  <span
                    key={cap}
                    className="px-2 py-0.5 rounded-full bg-c-surface-raised text-xs text-slate-400 dark:text-slate-500 border border-c-border"
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

  // ── Run History tab ──────────────────────────────────────────

  const renderRunsTab = () => {
    const statusColors: Record<string, string> = {
      running: 'text-blue-400 bg-blue-500/10',
      completed: 'text-emerald-400 bg-emerald-500/10',
      failed: 'text-rose-400 bg-rose-500/10',
    };

    const formatDuration = (ms: number | null) => {
      if (!ms) return '—';
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            className="bg-c-surface-raised border border-c-border rounded-lg px-3 py-1.5 text-sm text-slate-300"
            value={v8RunsFilter}
            onChange={(e) => {
              setV8RunsFilter(e.target.value);
              void fetchRuns(e.target.value || undefined, v8RunsStatusFilter || undefined);
            }}
          >
            <option value="">
              {t('integrations.syncHub.runsAllIntegrations', 'All integrations')}
            </option>
            {integrations
              .filter((i) => i.status === 'connected')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
          <select
            className="bg-c-surface-raised border border-c-border rounded-lg px-3 py-1.5 text-sm text-slate-300"
            value={v8RunsStatusFilter}
            onChange={(e) => {
              setV8RunsStatusFilter(e.target.value);
              void fetchRuns(v8RunsFilter || undefined, e.target.value || undefined);
            }}
          >
            <option value="">{t('integrations.syncHub.runsAllStatuses', 'All statuses')}</option>
            <option value="running">{t('integrations.syncHub.runsRunning', 'Running')}</option>
            <option value="completed">
              {t('integrations.syncHub.runsCompleted', 'Completed')}
            </option>
            <option value="failed">{t('integrations.syncHub.runsFailed', 'Failed')}</option>
          </select>
          <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {t('integrations.syncHub.runsTotal', '{{count}} total', { count: v8RunsTotal })}
          </div>
        </div>

        {v8RunsLoading ? (
          <LoadingState template="list" rows={4} />
        ) : v8Runs.length === 0 ? (
          <EmptyState
            variant="new"
            compact
            icon={Activity}
            title={t('integrations.syncHub.noRuns', 'No sync runs recorded yet')}
            description={t(
              'integrations.syncHub.noRunsDesc',
              'Trigger a sync to see run history here.',
            )}
          />
        ) : (
          <div className="border border-c-border/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-c-surface-raised/60 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsStatus', 'Status')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsProvider', 'Provider')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsDirection', 'Direction')}
                  </th>
                  <th className="text-right px-4 py-2">
                    {t('integrations.syncHub.runsItems', 'Items')}
                  </th>
                  <th className="text-right px-4 py-2">
                    {t('integrations.syncHub.runsDuration', 'Duration')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsTriggeredBy', 'Trigger')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsStarted', 'Started')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('integrations.syncHub.runsLifecycle', 'Lifecycle')}
                  </th>
                  <th className="text-center px-4 py-2">
                    {t('integrations.syncHub.runsActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {v8Runs.map((run) => {
                  const lifecycleColors: Record<string, string> = {
                    connected: 'text-emerald-400',
                    degraded: 'text-amber-400',
                    requires_action: 'text-rose-400',
                    draft: 'text-slate-400 dark:text-slate-500',
                  };
                  return (
                    <React.Fragment key={run.id}>
                      <tr className="border-t border-c-border/30 hover:bg-c-surface-raised/30">
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[run.status] || 'text-slate-400 dark:text-slate-500 bg-slate-500/10'}`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-300">{run.provider || '—'}</td>
                        <td className="px-4 py-2 text-slate-400 dark:text-slate-500">{run.direction || '—'}</td>
                        <td className="px-4 py-2 text-right text-slate-300">
                          {run.itemsProcessed ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-400 dark:text-slate-500">
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className="px-4 py-2 text-slate-400 dark:text-slate-500">{run.triggeredBy || '—'}</td>
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                          {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`text-xs font-medium ${lifecycleColors[run.lifecycleState] || 'text-slate-400 dark:text-slate-500'}`}
                          >
                            {run.lifecycleState}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {run.canReplay && (
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded bg-primary-600/20 text-primary-400 hover:bg-primary-600/40 transition-colors"
                              onClick={async () => {
                                try {
                                  await V8SyncApi.replayRun(run.id);
                                  toast.success(
                                    t('integrations.syncHub.replayInitiated', 'Replay initiated')
                                  );
                                  void fetchRuns(
                                    v8RunsFilter || undefined,
                                    v8RunsStatusFilter || undefined
                                  );
                                } catch {
                                  toast.error(
                                    t('integrations.syncHub.replayFailed', 'Replay failed')
                                  );
                                }
                              }}
                            >
                              <RefreshCw size={12} className="inline mr-1" />
                              {t('integrations.syncHub.replay', 'Replay')}
                            </button>
                          )}
                        </td>
                      </tr>
                      {run.errorSummary && (
                        <tr className="bg-rose-500/5">
                          <td colSpan={9} className="px-4 py-1.5 text-xs text-rose-400/80">
                            <span className="text-slate-500 dark:text-slate-400 mr-2">
                              {t('integrations.syncHub.traceId', 'Trace:')} {run.id}
                            </span>
                            {run.errorSummary}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Audit Log tab ────────────────────────────────────────────

  const renderAuditTab = () => (
    <div className="space-y-3">
      {auditLog.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
          {t('integrations.syncHub.noAuditData', 'No audit events yet')}
        </div>
      ) : (
        <div className="border border-c-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-c-surface-raised/60 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                  className="text-slate-300 hover:bg-c-surface-raised/40 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs font-medium ${
                        entry.action.includes('connected')
                          ? 'text-emerald-400'
                          : entry.action.includes('disconnected')
                            ? 'text-rose-400'
                            : entry.action.includes('reauth')
                              ? 'text-amber-400'
                              : entry.action.includes('sync')
                                ? 'text-blue-400'
                                : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">{entry.actor_name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
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

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={() => setShowConnectModal(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-c-surface border border-c-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-c-border">
            <h3 className="text-base font-semibold text-c-text">
              {t('integrations.syncHub.connectNew', 'Connect Integration')}
            </h3>
            <button
              onClick={() => setShowConnectModal(false)}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-white rounded-lg hover:bg-c-surface-raised"
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
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
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
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pb-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('integrations.syncHub.catalogHint', 'Pick an app to connect for this tenant.')}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowComingSoonCatalog(false)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  !showComingSoonCatalog
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
                }`}
              >
                {t('integrations.syncHub.readyOnly', 'Ready')}
              </button>
              <button
                type="button"
                onClick={() => setShowComingSoonCatalog(true)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  showComingSoonCatalog
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white border border-c-border'
                }`}
              >
                {t('integrations.syncHub.showAll', 'All')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">{renderCatalogTable({ inModal: true })}</div>
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
          <h2 className="text-xl font-semibold text-c-text">
            {t('integrations.syncHub.title', 'Integrations Hub')}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {t(
              'integrations.syncHub.subtitle',
              'Connect, monitor, and manage all your external integrations'
            )}
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors disabled:opacity-50"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-c-border/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-c-surface-raised rounded">{tab.badge}</span>
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
          {activeTab === 'runs' && renderRunsTab()}
          {activeTab === 'mappings' && <MappingDriftPanel />}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'logs' && renderLogsTab()}
          {activeTab === 'policies' && renderScopesTab()}
          {activeTab === 'workflows' && renderWorkflowsTab()}
          {activeTab === 'audit' && renderAuditTab()}
        </motion.div>
      </AnimatePresence>

      {/* Connect modal */}
      {renderConnectModal()}
    </div>
  );
};

export default UnifiedSyncHub;
