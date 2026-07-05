/**
 * Threat Intelligence View
 * Manages threat intelligence including IP reputation and domain blocking
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Filter,
  Globe,
  Loader2,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Unlock,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface Threat {
  id: string;
  threatType: string;
  source: string;
  ipAddress: string | null;
  domain: string | null;
  reputationScore: number;
  threatLevel: string;
  description: string;
  firstSeen: string;
  lastSeen: string;
  isBlocked: boolean;
  createdAt: string;
}

interface ThreatStats {
  totalThreats: number;
  blockedCount: number;
  byThreatLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  ipCount: number;
  domainCount: number;
  avgReputation: number;
}

interface ThreatDataSnapshot {
  threats: Threat[];
  stats: ThreatStats;
}

interface ThreatFilters {
  threatType?: string;
  threatLevel?: string;
  isBlocked?: boolean;
  ipAddress?: string;
  domain?: string;
}

const THREAT_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const THREAT_TYPES = [
  { value: 'malicious_ip', label: 'Malicious IP' },
  { value: 'spam_source', label: 'Spam Source' },
  { value: 'botnet', label: 'Botnet' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'malware', label: 'Malware' },
  { value: 'brute_force', label: 'Brute Force' },
  { value: 'tor_exit_node', label: 'TOR Exit Node' },
  { value: 'vpn_proxy', label: 'VPN/Proxy' },
  { value: 'compromised_host', label: 'Compromised Host' },
  { value: 'suspicious_domain', label: 'Suspicious Domain' },
  { value: 'other', label: 'Other' },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const normalizeStats = (value: unknown): ThreatStats => {
  const payload = getObjectPayload(value);
  const statsValue = isRecord(payload) ? (payload as Partial<ThreatStats>) : {};
  return {
    totalThreats: safeNumber(statsValue.totalThreats),
    blockedCount: safeNumber(statsValue.blockedCount),
    byThreatLevel: {
      critical: safeNumber(statsValue.byThreatLevel?.critical),
      high: safeNumber(statsValue.byThreatLevel?.high),
      medium: safeNumber(statsValue.byThreatLevel?.medium),
      low: safeNumber(statsValue.byThreatLevel?.low),
    },
    ipCount: safeNumber(statsValue.ipCount),
    domainCount: safeNumber(statsValue.domainCount),
    avgReputation: safeNumber(statsValue.avgReputation),
  };
};

const getCreatedThreatId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const threat = isRecord(result.threat) ? result.threat : null;
  return String(
    result.id ||
      threat?.id ||
      data?.id ||
      (isRecord(data?.threat) ? data.threat.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.threat) ? nestedData.threat.id : '') ||
      ''
  );
};

const ThreatIntelligenceView: React.FC = () => {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    threatType: '',
    threatLevel: '',
    isBlocked: '',
    ipAddress: '',
    domain: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkType, setCheckType] = useState<'ip' | 'domain'>('ip');
  const [checkValue, setCheckValue] = useState('');
  const [checkResult, setCheckResult] = useState<{
    found?: boolean;
    threatLevel: string;
    reputationScore: number;
    isBlocked?: boolean;
    description?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    threatType: 'malicious_ip',
    source: '',
    ipAddress: '',
    domain: '',
    reputationScore: 50,
    threatLevel: 'MEDIUM',
    description: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);

      const params: ThreatFilters = {};
      if (filters.threatType) params.threatType = filters.threatType;
      if (filters.threatLevel) params.threatLevel = filters.threatLevel;
      if (filters.isBlocked) params.isBlocked = filters.isBlocked === 'true';
      if (filters.ipAddress) params.ipAddress = filters.ipAddress;
      if (filters.domain) params.domain = filters.domain;

      const [threatsData, statsData] = await Promise.all([
        Api.getThreats(params),
        Api.getThreatStats(),
      ]);

      if (!hasListShape(threatsData, ['threats', 'items'])) {
        throw new Error('Threat intelligence response was not a list');
      }
      const threatsSnapshot = getListPayload<Threat>(threatsData, ['threats', 'items']);
      const statsSnapshot = normalizeStats(statsData);
      setThreats(threatsSnapshot);
      setStats(statsSnapshot);
      return {
        threats: threatsSnapshot,
        stats: statsSnapshot,
      } satisfies ThreatDataSnapshot;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load threats');
      setLoadError(message);
      setThreats([]);
      setStats(null);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [
    filters.domain,
    filters.ipAddress,
    filters.isBlocked,
    filters.threatLevel,
    filters.threatType,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await Api.addThreat({
        threatType: formData.threatType,
        ipAddress: formData.ipAddress || undefined,
        domain: formData.domain || undefined,
        threatLevel: formData.threatLevel,
        source: formData.source,
        reputationScore: formData.reputationScore,
        description: formData.description,
      });
      const createdId = getCreatedThreatId(result);
      if (!createdId) {
        throw new Error('Threat creation response was incomplete');
      }
      const refreshed = await loadData();
      if (!refreshed?.threats.some((threat) => threat.id === createdId)) {
        throw new Error('Threat creation was not confirmed by the server');
      }
      toast.success('Threat added successfully');
      setShowCreateModal(false);
      setFormData({
        threatType: 'malicious_ip',
        source: '',
        ipAddress: '',
        domain: '',
        reputationScore: 50,
        threatLevel: 'MEDIUM',
        description: '',
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to add threat');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async (threatId: string) => {
    try {
      setError(null);
      await Api.blockThreat(threatId);
      const refreshed = await loadData();
      if (!refreshed?.threats.some((threat) => threat.id === threatId && threat.isBlocked)) {
        throw new Error('Threat block was not confirmed by the server');
      }
      toast.success('Threat blocked successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to block threat');
      setError(message);
      toast.error(message);
    }
  };

  const handleUnblock = async (threatId: string) => {
    try {
      setError(null);
      await Api.unblockThreat(threatId);
      const refreshed = await loadData();
      if (!refreshed?.threats.some((threat) => threat.id === threatId && !threat.isBlocked)) {
        throw new Error('Threat unblock was not confirmed by the server');
      }
      toast.success('Threat unblocked successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to unblock threat');
      setError(message);
      toast.error(message);
    }
  };

  const handleDelete = async (threatId: string) => {
    if (!confirm('Are you sure you want to delete this threat?')) return;
    try {
      setError(null);
      await Api.deleteThreat(threatId);
      const refreshed = await loadData();
      if (!refreshed || refreshed.threats.some((threat) => threat.id === threatId)) {
        throw new Error('Threat deletion was not confirmed by the server');
      }
      toast.success('Threat deleted successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete threat');
      setError(message);
      toast.error(message);
    }
  };

  const handleCheck = async () => {
    if (!checkValue) return;
    try {
      setChecking(true);
      setCheckResult(null);
      const result =
        checkType === 'ip'
          ? await Api.checkIPReputation(checkValue)
          : await Api.checkDomainReputation(checkValue);
      setCheckResult(result);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to check reputation');
      setError(message);
      toast.error(message);
    } finally {
      setChecking(false);
    }
  };

  const getThreatLevelBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-danger-600/20 text-danger-400 rounded text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            MEDIUM
          </span>
        );
      case 'CLEAN':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            CLEAN
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  const getReputationColor = (score: number) => {
    const safeScore = safeNumber(score);
    if (safeScore >= 80) return 'text-emerald-400';
    if (safeScore >= 50) return 'text-amber-400';
    if (safeScore >= 20) return 'text-amber-400';
    return 'text-danger-400';
  };

  const getThreatTypeLabel = (type: string) => {
    return THREAT_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (loading && threats.length === 0) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Threat intelligence unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Threats</p>
                <p className="text-xl font-semibold">{stats?.totalThreats || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <Lock className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Blocked</p>
                <p className="text-xl font-semibold">{stats?.blockedCount || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-600/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-danger-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Critical</p>
                <p className="text-xl font-semibold">{stats?.byThreatLevel.critical || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">High</p>
                <p className="text-xl font-semibold">{stats?.byThreatLevel.high || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <Monitor className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">IPs</p>
                <p className="text-xl font-semibold">{stats?.ipCount || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Domains</p>
                <p className="text-xl font-semibold">{stats?.domainCount || 0}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-danger-500/30 bg-danger-500/5">
          <div role="alert" className="flex items-center gap-2 text-danger-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-sm hover:text-danger-300">
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Threat Intelligence</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            disabled={!!loadError}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => setShowCheckModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" />
            Check Reputation
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-danger-500 hover:bg-danger-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Threat
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card variant="bordered" className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Threat Type
              </label>
              <select
                value={filters.threatType}
                onChange={(e) => setFilters({ ...filters, threatType: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All Types</option>
                {THREAT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Threat Level
              </label>
              <select
                value={filters.threatLevel}
                onChange={(e) => setFilters({ ...filters, threatLevel: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All Levels</option>
                {THREAT_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Blocked Status
              </label>
              <select
                value={filters.isBlocked}
                onChange={(e) => setFilters({ ...filters, isBlocked: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All</option>
                <option value="true">Blocked</option>
                <option value="false">Not Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                IP Address
              </label>
              <input
                type="text"
                value={filters.ipAddress}
                onChange={(e) => setFilters({ ...filters, ipAddress: e.target.value })}
                placeholder="Search IP..."
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Domain
              </label>
              <input
                type="text"
                value={filters.domain}
                onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
                placeholder="Search domain..."
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Threats Table */}
      <CardWithHeader title="Threats" subtitle={`${threats.length} threats`}>
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Threat list unavailable" description={loadError} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    IP / Domain
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Level
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Reputation
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Last Seen
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {threats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No threats found
                    </td>
                  </tr>
                ) : (
                  threats.map((threat) => (
                    <tr
                      key={threat.id}
                      className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-c-surface-raised rounded text-xs font-mono">
                          {getThreatTypeLabel(threat.threatType)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {threat.ipAddress && (
                            <span className="flex items-center gap-1 text-sm">
                              <Monitor className="w-3 h-3 text-slate-500 dark:text-slate-500" />
                              {threat.ipAddress}
                            </span>
                          )}
                          {threat.domain && (
                            <span className="flex items-center gap-1 text-sm">
                              <Globe className="w-3 h-3 text-slate-500 dark:text-slate-500" />
                              {threat.domain}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getThreatLevelBadge(threat.threatLevel)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${getReputationColor(threat.reputationScore)}`}
                        >
                          {safeNumber(threat.reputationScore)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {threat.isBlocked ? (
                          <span className="px-2 py-1 bg-danger-500/10 text-danger-400 rounded text-xs">
                            Blocked
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDateTime(threat.lastSeen)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {threat.isBlocked ? (
                            <button
                              onClick={() => handleUnblock(threat.id)}
                              aria-label={`Unblock threat ${threat.id}`}
                              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Unblock"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlock(threat.id)}
                              aria-label={`Block threat ${threat.id}`}
                              className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                              title="Block"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(threat.id)}
                            aria-label={`Delete threat ${threat.id}`}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardWithHeader>

      {/* Create Threat Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Add Threat</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Threat Type
                </label>
                <select
                  value={formData.threatType}
                  onChange={(e) => setFormData({ ...formData, threatType: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                >
                  {THREAT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    IP Address
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="malicious.com"
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    Threat Level
                  </label>
                  <select
                    value={formData.threatLevel}
                    onChange={(e) => setFormData({ ...formData, threatLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  >
                    {THREAT_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    Reputation Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.reputationScore}
                    onChange={(e) =>
                      setFormData({ ...formData, reputationScore: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Source
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="e.g., Internal detection, AbuseIPDB"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the threat..."
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm h-20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || (!formData.ipAddress && !formData.domain)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-danger-500 hover:bg-danger-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Threat
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Check Reputation Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Check Reputation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Check Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCheckType('ip');
                      setCheckResult(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      checkType === 'ip' ? 'bg-indigo-500' : 'bg-c-surface-raised'
                    }`}
                  >
                    IP Address
                  </button>
                  <button
                    onClick={() => {
                      setCheckType('domain');
                      setCheckResult(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      checkType === 'domain' ? 'bg-indigo-500' : 'bg-c-surface-raised'
                    }`}
                  >
                    Domain
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  {checkType === 'ip' ? 'IP Address' : 'Domain'}
                </label>
                <input
                  type="text"
                  value={checkValue}
                  onChange={(e) => setCheckValue(e.target.value)}
                  placeholder={checkType === 'ip' ? '192.168.1.1' : 'example.com'}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                />
              </div>
              {checkResult && (
                <Card variant="bordered" className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-500">Status</span>
                      {getThreatLevelBadge(checkResult.threatLevel)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-500">
                        Reputation Score
                      </span>
                      <span
                        className={`font-semibold ${getReputationColor(checkResult.reputationScore)}`}
                      >
                        {safeNumber(checkResult.reputationScore)}
                      </span>
                    </div>
                    {checkResult.found && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-500">
                            Blocked
                          </span>
                          <span>{checkResult.isBlocked ? 'Yes' : 'No'}</span>
                        </div>
                        {checkResult.description && (
                          <div>
                            <span className="text-sm text-slate-600 dark:text-slate-500">
                              Description
                            </span>
                            <p className="text-sm mt-1">{checkResult.description}</p>
                          </div>
                        )}
                      </>
                    )}
                    {!checkResult.found && (
                      <p className="text-sm text-emerald-400">
                        ✓ No threats found for this {checkType === 'ip' ? 'IP address' : 'domain'}
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCheckModal(false);
                  setCheckValue('');
                  setCheckResult(null);
                }}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleCheck}
                disabled={checking || !checkValue}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50"
              >
                {checking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Check
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ThreatIntelligenceView;
