/**
 * Security Incidents View
 * Manages security incidents in the IAM module
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Eye,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Card, CardWithHeader } from '../components/shared/Card';

interface SecurityIncident {
  id: string;
  incidentType: string;
  severity: string;
  status: string;
  description: string;
  affectedResources: string[];
  detectedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface IncidentStats {
  totalIncidents: number;
  byStatus: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface IncidentDataSnapshot {
  incidents: SecurityIncident[];
  stats: IncidentStats;
}

interface IncidentFilters {
  severity?: string;
  status?: string;
  incidentType?: string;
}

const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const INCIDENT_TYPES = [
  { value: 'unauthorized_access', label: 'Unauthorized Access' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'malware', label: 'Malware' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'dos_attack', label: 'DoS Attack' },
  { value: 'brute_force', label: 'Brute Force' },
  { value: 'privilege_escalation', label: 'Privilege Escalation' },
  { value: 'data_exfiltration', label: 'Data Exfiltration' },
  { value: 'insider_threat', label: 'Insider Threat' },
  { value: 'configuration_error', label: 'Configuration Error' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'other', label: 'Other' },
];

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const parseListValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => asText(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated legacy values.
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseResolvedBy = (value: unknown): SecurityIncident['resolvedBy'] => {
  let payload = value;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!isRecord(payload)) return null;

  return {
    id: asText(payload.id),
    email: asText(payload.email),
    firstName: asText(payload.firstName ?? payload.first_name),
    lastName: asText(payload.lastName ?? payload.last_name),
  };
};

const normalizeIncident = (value: unknown, index: number): SecurityIncident => {
  const row = isRecord(value) ? value : {};
  const detectedAt = asText(row.detectedAt ?? row.detected_at);
  const createdAt = asText(row.createdAt ?? row.created_at ?? detectedAt);
  const fallbackId = createdAt || detectedAt || String(index);

  return {
    id: asText(row.id ?? row.incidentId ?? row.incident_id, `incident-${fallbackId}`),
    incidentType: asText(row.incidentType ?? row.incident_type, 'other'),
    severity: asText(row.severity, 'LOW').toUpperCase(),
    status: asText(row.status, 'open'),
    description: asText(row.description, 'No description provided'),
    affectedResources: parseListValue(row.affectedResources ?? row.affected_resources),
    detectedAt,
    resolvedAt: asText(row.resolvedAt ?? row.resolved_at) || null,
    resolutionNotes: asText(row.resolutionNotes ?? row.resolution_notes) || null,
    createdAt,
    resolvedBy: parseResolvedBy(row.resolvedBy ?? row.resolved_by),
  };
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

const normalizeStats = (value: unknown): IncidentStats => {
  const payload = getObjectPayload(value);
  const statsValue = isRecord(payload) ? (payload as Partial<IncidentStats>) : {};
  return {
    totalIncidents: safeNumber(statsValue.totalIncidents),
    byStatus: {
      open: safeNumber(statsValue.byStatus?.open),
      inProgress: safeNumber(statsValue.byStatus?.inProgress),
      resolved: safeNumber(statsValue.byStatus?.resolved),
      closed: safeNumber(statsValue.byStatus?.closed),
    },
    bySeverity: {
      critical: safeNumber(statsValue.bySeverity?.critical),
      high: safeNumber(statsValue.bySeverity?.high),
      medium: safeNumber(statsValue.bySeverity?.medium),
      low: safeNumber(statsValue.bySeverity?.low),
    },
  };
};

const getCreatedIncidentId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const incident = isRecord(result.incident) ? result.incident : null;
  return String(
    result.id ||
      incident?.id ||
      data?.id ||
      (isRecord(data?.incident) ? data.incident.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.incident) ? nestedData.incident.id : '') ||
      ''
  );
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const SecurityIncidentsView: React.FC = () => {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    incidentType: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<SecurityIncident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    incidentType: 'suspicious_activity',
    severity: 'MEDIUM',
    description: '',
    affectedResources: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);

      const params: IncidentFilters = {};
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      if (filters.incidentType) params.incidentType = filters.incidentType;

      const [incidentsData, statsData] = await Promise.all([
        Api.getSecurityIncidents(params),
        Api.getSecurityIncidentStats(),
      ]);

      if (!hasListShape(incidentsData, ['incidents', 'items'])) {
        throw new Error('Security incidents response was not a list');
      }
      const incidentsSnapshot = getListPayload<unknown>(incidentsData, ['incidents', 'items']).map(
        normalizeIncident
      );
      const statsSnapshot = normalizeStats(statsData);
      setIncidents(incidentsSnapshot);
      setStats(statsSnapshot);
      return {
        incidents: incidentsSnapshot,
        stats: statsSnapshot,
      } satisfies IncidentDataSnapshot;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load security incidents');
      setLoadError(message);
      setIncidents([]);
      setStats(null);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters.incidentType, filters.severity, filters.status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await Api.createSecurityIncident({
        incidentType: formData.incidentType,
        severity: formData.severity,
        description: formData.description,
        affectedResources: formData.affectedResources
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
      });
      const createdId = getCreatedIncidentId(result);
      if (!createdId) {
        throw new Error('Security incident creation response was incomplete');
      }
      const refreshed = await loadData();
      if (!refreshed?.incidents.some((incident) => incident.id === createdId)) {
        throw new Error('Security incident creation was not confirmed by the server');
      }
      toast.success('Security incident created successfully');
      setShowCreateModal(false);
      setFormData({
        incidentType: 'suspicious_activity',
        severity: 'MEDIUM',
        description: '',
        affectedResources: '',
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to create security incident');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (incidentId: string) => {
    try {
      setSaving(true);
      setError(null);
      await Api.resolveSecurityIncident(incidentId, resolutionNotes);
      const refreshed = await loadData();
      if (
        !refreshed ||
        refreshed.incidents.some(
          (incident) =>
            incident.id === incidentId &&
            incident.status !== 'resolved' &&
            incident.status !== 'closed'
        )
      ) {
        throw new Error('Security incident resolution was not confirmed by the server');
      }
      toast.success('Incident resolved successfully');
      setShowResolveModal(null);
      setResolutionNotes('');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to resolve incident');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (incidentId: string) => {
    if (!confirm('Are you sure you want to delete this incident?')) return;
    try {
      setError(null);
      await Api.deleteSecurityIncident(incidentId);
      const refreshed = await loadData();
      if (!refreshed || refreshed.incidents.some((incident) => incident.id === incidentId)) {
        throw new Error('Security incident deletion was not confirmed by the server');
      }
      toast.success('Incident deleted successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete incident');
      setError(message);
      toast.error(message);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
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
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            LOW
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2 py-1 bg-danger-500/10 text-danger-400 rounded text-xs">Open</span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">
            In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs">
            Closed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs">
            {status}
          </span>
        );
    }
  };

  const getIncidentTypeLabel = (type: string) => {
    return INCIDENT_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (loading && incidents.length === 0) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Security incidents unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Incidents</p>
                <p className="text-xl font-semibold">{stats?.totalIncidents || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Open</p>
                <p className="text-xl font-semibold">{stats?.byStatus.open || 0}</p>
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
                <p className="text-xl font-semibold">{stats?.bySeverity.critical || 0}</p>
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
                <p className="text-xl font-semibold">{stats?.bySeverity.high || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Resolved</p>
                <p className="text-xl font-semibold">{stats?.byStatus.resolved || 0}</p>
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
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm hover:text-danger-300"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Security Incidents</h2>
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
            Report Incident
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card variant="bordered" className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All Severities</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                Incident Type
              </label>
              <select
                value={filters.incidentType}
                onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">All Types</option>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Incidents Table */}
      <CardWithHeader title="Incidents" subtitle={`${incidents.length} incidents`}>
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Security incident list unavailable" description={loadError} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
            >
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Severity
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Detected
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No security incidents found
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-c-surface-raised rounded text-xs font-mono">
                          {getIncidentTypeLabel(incident.incidentType)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm max-w-xs truncate">{incident.description}</p>
                      </td>
                      <td className="py-3 px-4">{getSeverityBadge(incident.severity)}</td>
                      <td className="py-3 px-4">{getStatusBadge(incident.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Clock className="w-4 h-4 text-slate-500 dark:text-slate-500" />
                          {formatDateTime(incident.detectedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowDetailModal(incident)}
                            aria-label={`View incident ${incident.id}`}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {incident.status !== 'resolved' && incident.status !== 'closed' && (
                            <button
                              onClick={() => setShowResolveModal(incident.id)}
                              aria-label={`Resolve incident ${incident.id}`}
                              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Resolve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(incident.id)}
                            aria-label={`Delete incident ${incident.id}`}
                            className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
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

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Report Security Incident</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Incident Type
                </label>
                <select
                  value={formData.incidentType}
                  onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the security incident..."
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm h-24 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Affected Resources (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.affectedResources}
                  onChange={(e) => setFormData({ ...formData, affectedResources: e.target.value })}
                  placeholder="e.g., server-1, database-prod, user-accounts"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    incidentType: 'suspicious_activity',
                    severity: 'MEDIUM',
                    description: '',
                    affectedResources: '',
                  });
                }}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.description}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-danger-500 hover:bg-danger-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Report Incident
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Resolve Incident</h3>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Resolution notes..."
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm mb-4 h-24 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowResolveModal(null);
                  setResolutionNotes('');
                }}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(showResolveModal)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Resolve
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-2xl p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Incident Details</h3>
              <button
                onClick={() => setShowDetailModal(null)}
                className="p-1 text-slate-600 dark:text-slate-500 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-500">Incident Type</p>
                  <p className="font-medium">
                    {getIncidentTypeLabel(showDetailModal.incidentType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-500">Severity</p>
                  {getSeverityBadge(showDetailModal.severity)}
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-500">Status</p>
                  {getStatusBadge(showDetailModal.status)}
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-500">Detected At</p>
                  <p>{formatDateTime(showDetailModal.detectedAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-500">Description</p>
                <p className="mt-1 text-slate-900 dark:text-slate-200">
                  {showDetailModal.description}
                </p>
              </div>
              {showDetailModal.affectedResources &&
                showDetailModal.affectedResources.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-500">Affected Resources</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {showDetailModal.affectedResources.map((r, i) => (
                        <span key={i} className="px-2 py-1 bg-c-surface-raised rounded text-xs">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {showDetailModal.resolvedAt && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-c-border">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-500">Resolved At</p>
                    <p>{formatDateTime(showDetailModal.resolvedAt)}</p>
                  </div>
                  {showDetailModal.resolvedBy && (
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-500">Resolved By</p>
                      <p>
                        {showDetailModal.resolvedBy.firstName} {showDetailModal.resolvedBy.lastName}
                      </p>
                    </div>
                  )}
                  {showDetailModal.resolutionNotes && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-600 dark:text-slate-500">Resolution Notes</p>
                      <p className="mt-1">{showDetailModal.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SecurityIncidentsView;
