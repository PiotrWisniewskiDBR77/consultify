/**
 * SuperAdminStatusIndicators
 *
 * Compact status indicators with expandable detail panels for SuperAdmin header.
 * Groups: Infrastructure, Users, Business, Security, Performance
 */

import {
  AlertTriangle,
  Bot,
  Building2,
  ChevronDown,
  Clock,
  CreditCard,
  Database,
  MessageSquareWarning,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Api } from '../../services/api';

// Types
interface PlatformStats {
  timestamp: string;
  infrastructure: {
    dbSizeMB: number;
  };
  users: {
    activeNow: number;
    totalUsers: number;
    totalOrgs: number;
    todaySignups: number;
    todayLogins: number;
    recentSignups: Array<{ email: string; created_at: string; org_name: string | null }>;
  };
  business: {
    trialsExpiring: number;
    trialsExpiringSoonList: Array<{ name: string; trial_ends_at: string }>;
    overdueInvoices: number;
    overdueInvoicesList: Array<{ org_name: string; amount: number; due_date: string }>;
    pendingFeedback: number;
    recentFeedback: Array<{
      type: string;
      message: string;
      created_at: string;
      user_email: string | null;
    }>;
  };
  security: {
    failedLoginsLastHour: number;
    failedLoginsList: Array<{
      email: string;
      ip_address: string;
      created_at: string;
      failure_reason: string | null;
    }>;
    suspiciousIPs: number;
    apiErrors15Min: number;
    recentErrors: Array<{
      endpoint: string;
      status_code: number;
      error_message: string | null;
      created_at: string;
    }>;
  };
  performance: {
    avgApiLatencyMs: number;
    slowQueries: number;
    slowQueriesList: Array<{ endpoint: string; response_time_ms: number; created_at: string }>;
    aiRequestsToday: number;
    aiTokensToday: number;
    aiErrorsToday: number;
  };
}

interface LLMHealth {
  status: 'online' | 'offline' | 'degraded' | 'loading';
  healthy: number;
  total: number;
  providers?: Array<{ name: string; status: string; latency?: number }>;
}

interface DBHealth {
  status: 'online' | 'offline' | 'degraded' | 'loading';
  latency?: number;
}

// Indicator Group Component
interface IndicatorGroupProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  status: 'ok' | 'warning' | 'critical' | 'loading';
  badge?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const IndicatorGroup: React.FC<IndicatorGroupProps> = ({
  icon: Icon,
  label,
  value,
  status,
  badge,
  isOpen,
  onToggle,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const getStatusColor = () => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-500 dark:text-slate-400 animate-pulse';
    }
  };

  const getDotColor = () => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500 animate-pulse';
      case 'critical':
        return 'bg-red-500 animate-pulse';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${getStatusColor()}`}
      >
        <Icon size={14} />
        <div className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`} />
        <span className="font-bold tabular-nums">{value}</span>
        <span className="hidden lg:inline text-[10px] opacity-75">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-2xl z-[100] animate-in slide-in-from-top-2 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
            <div className="flex items-center gap-2">
              <Icon
                size={16}
                className={
                  status === 'critical'
                    ? 'text-red-500'
                    : status === 'warning'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }
              />
              <span className="font-semibold text-sm text-navy-900 dark:text-white">{label}</span>
            </div>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded"
            >
              <X size={14} className="text-slate-400 dark:text-slate-500" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto p-3">{children}</div>
        </div>
      )}
    </div>
  );
};

// Detail Row Component
const DetailRow: React.FC<{
  label: string;
  value: string | number;
  status?: 'ok' | 'warning' | 'critical';
}> = ({ label, value, status }) => (
  <div className="flex items-center justify-between py-1.5 text-xs">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span
      className={`font-medium ${
        status === 'critical'
          ? 'text-red-500'
          : status === 'warning'
            ? 'text-amber-500'
            : 'text-navy-900 dark:text-white'
      }`}
    >
      {value}
    </span>
  </div>
);

// List Item Component
const ListItem: React.FC<{
  primary: string;
  secondary?: string;
  timestamp?: string;
  status?: 'ok' | 'warning' | 'critical';
}> = ({ primary, secondary, timestamp, status }) => (
  <div
    className={`py-2 px-2 rounded-lg mb-1 ${
      status === 'critical'
        ? 'bg-red-50 dark:bg-red-500/10'
        : status === 'warning'
          ? 'bg-amber-50 dark:bg-amber-500/10'
          : 'bg-slate-50 dark:bg-white/5'
    }`}
  >
    <div className="text-xs font-medium text-navy-900 dark:text-white truncate">{primary}</div>
    {secondary && (
      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{secondary}</div>
    )}
    {timestamp && (
      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
        {new Date(timestamp).toLocaleString()}
      </div>
    )}
  </div>
);

// Main Component
export const SuperAdminStatusIndicators: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [dbHealth, setDbHealth] = useState<DBHealth>({ status: 'loading' });
  const [llmHealth, setLlmHealth] = useState<LLMHealth>({
    status: 'loading',
    healthy: 0,
    total: 0,
  });
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      const [statsRes, sysRes, llmRes] = await Promise.allSettled([
        Api.getSuperAdminPlatformStats(),
        Api.getSystemHealth(),
        Api.getLLMHealthDetailed(),
      ]);

      // Platform stats
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value as any);
      }

      // DB Health
      if (sysRes.status === 'fulfilled') {
        const data: any = sysRes.value;
        const connected =
          typeof data?.database?.connected === 'boolean'
            ? data.database.connected
            : String(data?.database?.status || '').toLowerCase() === 'healthy';

        const latency =
          data?.database?.latency ??
          data?.database?.latencyMs ??
          data?.database?.responseTime ??
          data?.latency ??
          undefined;

        setDbHealth({
          status: connected ? 'online' : 'offline',
          latency: typeof latency === 'number' ? latency : undefined,
        });
      } else {
        setDbHealth({ status: 'offline' });
      }

      // LLM Health
      if (llmRes.status === 'fulfilled') {
        const data: any = llmRes.value;
        const summary = data?.summary || {};
        const healthy = summary.healthy || 0;
        const total = summary.total || 0;
        setLlmHealth({
          status:
            total === 0
              ? 'offline'
              : healthy === total
                ? 'online'
                : healthy > 0
                  ? 'degraded'
                  : 'offline',
          healthy,
          total,
          providers: data?.providers,
        });
      }

      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const togglePanel = (panel: string) => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  // Calculate statuses
  const getInfraStatus = (): 'ok' | 'warning' | 'critical' | 'loading' => {
    if (loading) return 'loading';
    // DB offline is critical — it's the core infrastructure
    if (dbHealth.status === 'offline') return 'critical';
    if (dbHealth.status === 'degraded') return 'warning';
    // LLM: only warning (not critical) — system can degrade gracefully
    // If total=0 (no configured providers) → warning, not critical
    if (llmHealth.total > 0 && llmHealth.healthy === 0) return 'warning';
    return 'ok';
  };

  const getUsersStatus = (): 'ok' | 'warning' | 'critical' | 'loading' => {
    if (loading || !stats) return 'loading';
    return 'ok';
  };

  const getBusinessStatus = (): 'ok' | 'warning' | 'critical' | 'loading' => {
    if (loading || !stats) return 'loading';
    if (stats.business.overdueInvoices > 0) return 'critical';
    if (stats.business.trialsExpiring > 0 || stats.business.pendingFeedback > 5) return 'warning';
    return 'ok';
  };

  const getSecurityStatus = (): 'ok' | 'warning' | 'critical' | 'loading' => {
    if (loading || !stats) return 'loading';
    if (stats.security.suspiciousIPs > 0 || stats.security.apiErrors15Min > 10) return 'critical';
    if (stats.security.failedLoginsLastHour > 10) return 'warning';
    return 'ok';
  };

  const getPerfStatus = (): 'ok' | 'warning' | 'critical' | 'loading' => {
    if (loading || !stats) return 'loading';
    if (stats.performance.avgApiLatencyMs > 1000 || stats.performance.slowQueries > 10)
      return 'critical';
    if (stats.performance.avgApiLatencyMs > 500 || stats.performance.slowQueries > 5)
      return 'warning';
    return 'ok';
  };

  const businessAlerts =
    (stats?.business.trialsExpiring || 0) +
    (stats?.business.overdueInvoices || 0) +
    (stats?.business.pendingFeedback || 0);
  const securityAlerts =
    (stats?.security.failedLoginsLastHour || 0) + (stats?.security.apiErrors15Min || 0);

  return (
    <div className="flex items-center gap-1.5" ref={containerRef}>
      {/* Infrastructure */}
      <IndicatorGroup
        icon={Server}
        label="Infra"
        value={dbHealth.latency ? `${dbHealth.latency}ms` : 'DB'}
        status={getInfraStatus()}
        isOpen={openPanel === 'infra'}
        onToggle={() => togglePanel('infra')}
      >
        <DetailRow
          label="Database"
          value={dbHealth.status === 'online' ? `Online (${dbHealth.latency}ms)` : 'Offline'}
          status={dbHealth.status === 'online' ? 'ok' : 'critical'}
        />
        <DetailRow
          label="LLM Providers"
          value={`${llmHealth.healthy}/${llmHealth.total} healthy`}
          status={
            llmHealth.status === 'online'
              ? 'ok'
              : llmHealth.status === 'degraded'
                ? 'warning'
                : 'critical'
          }
        />
        <DetailRow label="DB Size" value={`${stats?.infrastructure.dbSizeMB || 0} MB`} />
        {llmHealth.providers && llmHealth.providers.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              LLM Providers
            </div>
            {llmHealth.providers.map((p, i) => (
              <ListItem
                key={i}
                primary={p.name}
                secondary={`${p.status} ${p.latency ? `• ${p.latency}ms` : ''}`}
                status={p.status === 'healthy' ? 'ok' : 'warning'}
              />
            ))}
          </div>
        )}
      </IndicatorGroup>

      {/* Users */}
      <IndicatorGroup
        icon={Users}
        label="Users"
        value={stats?.users.activeNow || 0}
        status={getUsersStatus()}
        isOpen={openPanel === 'users'}
        onToggle={() => togglePanel('users')}
      >
        <DetailRow label="Active Now" value={stats?.users.activeNow || 0} />
        <DetailRow label="Total Users" value={stats?.users.totalUsers || 0} />
        <DetailRow label="Organizations" value={stats?.users.totalOrgs || 0} />
        <DetailRow label="Today's Logins" value={stats?.users.todayLogins || 0} />
        <DetailRow label="New Signups Today" value={stats?.users.todaySignups || 0} />
        {stats?.users.recentSignups && stats.users.recentSignups.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Recent Signups
            </div>
            {stats.users.recentSignups.map((s, i) => (
              <ListItem
                key={i}
                primary={s.email}
                secondary={s.org_name || 'No org'}
                timestamp={s.created_at}
              />
            ))}
          </div>
        )}
      </IndicatorGroup>

      {/* Business */}
      <IndicatorGroup
        icon={TrendingUp}
        label="Business"
        value={businessAlerts || '✓'}
        status={getBusinessStatus()}
        badge={businessAlerts > 0 ? businessAlerts : undefined}
        isOpen={openPanel === 'business'}
        onToggle={() => togglePanel('business')}
      >
        <DetailRow
          label="Trials Expiring (7d)"
          value={stats?.business.trialsExpiring || 0}
          status={stats?.business.trialsExpiring ? 'warning' : 'ok'}
        />
        <DetailRow
          label="Overdue Invoices"
          value={stats?.business.overdueInvoices || 0}
          status={stats?.business.overdueInvoices ? 'critical' : 'ok'}
        />
        <DetailRow
          label="Pending Feedback"
          value={stats?.business.pendingFeedback || 0}
          status={(stats?.business.pendingFeedback || 0) > 5 ? 'warning' : 'ok'}
        />

        {stats?.business.trialsExpiringSoonList &&
          stats.business.trialsExpiringSoonList.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
                Expiring Trials
              </div>
              {stats.business.trialsExpiringSoonList.map((t, i) => (
                <ListItem
                  key={i}
                  primary={t.name}
                  secondary={`Expires: ${new Date(t.trial_ends_at).toLocaleDateString()}`}
                  status="warning"
                />
              ))}
            </div>
          )}

        {stats?.business.overdueInvoicesList && stats.business.overdueInvoicesList.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Overdue Invoices
            </div>
            {stats.business.overdueInvoicesList.map((inv, i) => (
              <ListItem
                key={i}
                primary={inv.org_name}
                secondary={`$${inv.amount} • Due: ${new Date(inv.due_date).toLocaleDateString()}`}
                status="critical"
              />
            ))}
          </div>
        )}

        {stats?.business.recentFeedback && stats.business.recentFeedback.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Recent Feedback
            </div>
            {stats.business.recentFeedback.slice(0, 5).map((f, i) => (
              <ListItem
                key={i}
                primary={f.message}
                secondary={`${f.type} • ${f.user_email || 'Anonymous'}`}
                timestamp={f.created_at}
              />
            ))}
          </div>
        )}
      </IndicatorGroup>

      {/* Security */}
      <IndicatorGroup
        icon={Shield}
        label="Security"
        value={securityAlerts || '✓'}
        status={getSecurityStatus()}
        badge={securityAlerts > 0 ? securityAlerts : undefined}
        isOpen={openPanel === 'security'}
        onToggle={() => togglePanel('security')}
      >
        <DetailRow
          label="Failed Logins (1h)"
          value={stats?.security.failedLoginsLastHour || 0}
          status={(stats?.security.failedLoginsLastHour || 0) > 10 ? 'warning' : 'ok'}
        />
        <DetailRow
          label="Suspicious IPs"
          value={stats?.security.suspiciousIPs || 0}
          status={stats?.security.suspiciousIPs ? 'critical' : 'ok'}
        />
        <DetailRow
          label="API Errors (15m)"
          value={stats?.security.apiErrors15Min || 0}
          status={(stats?.security.apiErrors15Min || 0) > 5 ? 'critical' : 'ok'}
        />

        {stats?.security.failedLoginsList && stats.security.failedLoginsList.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Failed Logins
            </div>
            {stats.security.failedLoginsList.slice(0, 5).map((l, i) => (
              <ListItem
                key={i}
                primary={l.email || 'Unknown'}
                secondary={`IP: ${l.ip_address} ${l.failure_reason ? `• ${l.failure_reason}` : ''}`}
                timestamp={l.created_at}
                status="warning"
              />
            ))}
          </div>
        )}

        {stats?.security.recentErrors && stats.security.recentErrors.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              API Errors
            </div>
            {stats.security.recentErrors.slice(0, 5).map((e, i) => (
              <ListItem
                key={i}
                primary={`${e.status_code}: ${e.endpoint}`}
                secondary={e.error_message || ''}
                timestamp={e.created_at}
                status="critical"
              />
            ))}
          </div>
        )}
      </IndicatorGroup>

      {/* Performance */}
      <IndicatorGroup
        icon={Zap}
        label="Perf"
        value={`${stats?.performance.avgApiLatencyMs || 0}ms`}
        status={getPerfStatus()}
        isOpen={openPanel === 'perf'}
        onToggle={() => togglePanel('perf')}
      >
        <DetailRow
          label="Avg API Latency"
          value={`${stats?.performance.avgApiLatencyMs || 0}ms`}
          status={(stats?.performance.avgApiLatencyMs || 0) > 500 ? 'warning' : 'ok'}
        />
        <DetailRow
          label="Slow Queries (1h)"
          value={stats?.performance.slowQueries || 0}
          status={(stats?.performance.slowQueries || 0) > 5 ? 'warning' : 'ok'}
        />
        <DetailRow label="AI Requests Today" value={stats?.performance.aiRequestsToday || 0} />
        <DetailRow
          label="AI Tokens Today"
          value={(stats?.performance.aiTokensToday || 0).toLocaleString()}
        />
        <DetailRow
          label="AI Errors Today"
          value={stats?.performance.aiErrorsToday || 0}
          status={(stats?.performance.aiErrorsToday || 0) > 0 ? 'warning' : 'ok'}
        />

        {stats?.performance.slowQueriesList && stats.performance.slowQueriesList.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Slow Queries
            </div>
            {stats.performance.slowQueriesList.slice(0, 5).map((q, i) => (
              <ListItem
                key={i}
                primary={q.endpoint}
                secondary={`${q.response_time_ms}ms`}
                timestamp={q.created_at}
                status="warning"
              />
            ))}
          </div>
        )}
      </IndicatorGroup>
    </div>
  );
};

export default SuperAdminStatusIndicators;
