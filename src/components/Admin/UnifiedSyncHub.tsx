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
  type V8MultiplayerResourceMapping,
} from '@/services/api/v8/multiplayer';
import { V8SyncApi, type V8SyncCredentialHealthSummary } from '@/services/api/v8/sync';

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
  connector: ConnectorInfo | null;
}

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
  const [v8AuthHealthSummary, setV8AuthHealthSummary] =
    useState<V8SyncCredentialHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/sync-hub/integrations`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch {
      /* handled below */
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
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

  const fetchV8WorkspaceMapping = useCallback(async () => {
    try {
      const data = await V8MultiplayerApi.getWorkspaceMapping();
      setV8WorkspaceMapping(data.mapping);
    } catch {
      setV8WorkspaceMapping(null);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    try {
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
    await Promise.all([
      fetchIntegrations(),
      fetchCatalog(),
      fetchHealth(),
      fetchErrors(),
      fetchAuditLog(),
      fetchV8AuthHealth(),
      fetchV8WorkspaceMapping(),
    ]);
    setLoading(false);
  }, [
    fetchIntegrations,
    fetchCatalog,
    fetchHealth,
    fetchErrors,
    fetchAuditLog,
    fetchV8AuthHealth,
    fetchV8WorkspaceMapping,
  ]);

  useEffect(() => {
    loadAll();
    trackFunnelEvent('integration_sync_hub_viewed');
  }, [loadAll]);

  // ── Actions ──────────────────────────────────────────────────

  const handleConnect = async (connectorId: string) => {
    try {
      const res = await fetch(`${API_URL}/sync-hub/connect`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ connectorId, config: {} }),
      });
      if (res.ok) {
        toast.success(t('integrations.syncHub.connected', 'Integration connected'));
        trackFunnelEvent('integration_connected', { connectorId });
        setShowConnectModal(false);
        await loadAll();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to connect');
      }
    } catch {
      toast.error(t('integrations.syncHub.connectFailed', 'Connection failed'));
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const res = await fetch(`${API_URL}/sync-hub/disconnect/${integrationId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
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
      const res = await fetch(`${API_URL}/sync-hub/reauth/${integrationId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('integrations.syncHub.reauthStarted', 'Re-authorization started'));
        trackFunnelEvent('integration_reauth_completed', { integrationId });
        setTimeout(() => loadAll(), 3000);
      }
    } catch {
      toast.error('Reauth failed');
    }
  };

  const handlePause = async (integrationId: string) => {
    try {
      await fetch(`${API_URL}/sync-hub/pause/${integrationId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      toast.success(t('integrations.syncHub.paused', 'Sync paused'));
      await loadAll();
    } catch {
      /* */
    }
  };

  const handleResume = async (integrationId: string) => {
    try {
      await fetch(`${API_URL}/sync-hub/resume/${integrationId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      toast.success(t('integrations.syncHub.resumed', 'Sync resumed'));
      await loadAll();
    } catch {
      /* */
    }
  };

  const handleSync = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
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
      await loadAll();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleResolveError = async (errorId: string) => {
    try {
      await fetch(`${API_URL}/sync-hub/errors/${errorId}/resolve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      toast.success('Error resolved');
      await fetchErrors();
    } catch {
      /* */
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
              disabled={isSyncing || int.status === 'disconnected'}
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
                    disabled={syncing === int.id || int.status === 'disconnected'}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-30"
                  >
                    <RefreshCw size={13} />
                    {t('integrations.syncHub.runNow', 'Run now')}
                  </button>
                  <button
                    onClick={() => handleResume(int.id)}
                    className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Play size={13} />
                    {t('integrations.syncHub.resume', 'Resume')}
                  </button>
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
