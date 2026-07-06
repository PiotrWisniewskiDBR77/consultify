/**
 * EnterpriseSecurityPanel - Comprehensive Security & Compliance Management
 *
 * Features:
 * - Security Events Dashboard
 * - Session Management
 * - IP Access Rules
 * - Security Policies
 * - Compliance Frameworks
 * - SIEM Integration
 */

import {
  AlertTriangle,
  Building,
  CheckCircle,
  FileCheck,
  Globe,
  Laptop,
  Monitor,
  Plus,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState, ReadOnlyState } from '../../Admin/AdminState';
import { EmptyState, LoadingState } from '../../shared/states';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  user_id?: string;
  ip_address?: string;
  location_country?: string;
  location_city?: string;
  user_agent?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
  details: Record<string, unknown>;
}

interface Session {
  id: string;
  user_id: string;
  user_email: string;
  device_type: string;
  browser: string;
  ip_address: string;
  location: string;
  created_at: string;
  last_activity: string;
  is_current: boolean;
}

interface IPRule {
  id: string;
  ip_pattern: string;
  rule_type: 'allow' | 'deny';
  description: string;
  created_at: string;
  created_by: string;
  enabled: boolean;
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  category: string;
  settings: Record<string, unknown>;
  enabled: boolean;
  last_updated: string;
}

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  controls_total: number;
  controls_compliant: number;
  last_assessment: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed';
}

const SEVERITY_CONFIG = {
  LOW: {
    color: 'bg-c-text-muted',
    text: 'text-c-text-secondary',
    bg: 'bg-c-text-muted/10',
    border: 'border-c-border-strong/30',
  },
  MEDIUM: {
    color: 'bg-c-warning',
    text: 'text-c-warning',
    bg: 'bg-c-warning/10',
    border: 'border-c-warning/30',
  },
  HIGH: {
    color: 'bg-c-warning',
    text: 'text-c-warning',
    bg: 'bg-c-warning/10',
    border: 'border-c-warning/30',
  },
  CRITICAL: {
    color: 'bg-c-danger',
    text: 'text-c-danger',
    bg: 'bg-c-danger/10',
    border: 'border-c-danger/30',
  },
};

const EVENT_TYPES = [
  'LOGIN_FAILED',
  'LOGIN_SUCCESS',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'PERMISSION_CHANGED',
  'SUSPICIOUS_ACTIVITY',
  'BRUTE_FORCE_ATTEMPT',
  'SESSION_HIJACK_ATTEMPT',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: unknown) =>
  value === true || value === 'true' || value === 1 || value === '1';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getList = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      for (const nestedKey of keys) {
        const nested = value[nestedKey];
        if (Array.isArray(nested)) return nested;
      }
    }
  }
  return [];
};

const normalizeSeverity = (value: unknown): SecurityEvent['severity'] => {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
    return value;
  }
  return 'LOW';
};

const normalizeEvents = (payload: unknown): SecurityEvent[] =>
  getList(payload, ['events', 'items', 'data'])
    .filter(isRecord)
    .map((event) => ({
      id: asText(event.id, ''),
      event_type: asText(event.event_type),
      severity: normalizeSeverity(event.severity),
      user_id:
        event.user_id === null || event.user_id === undefined ? undefined : String(event.user_id),
      ip_address:
        event.ip_address === null || event.ip_address === undefined
          ? undefined
          : String(event.ip_address),
      location_country:
        event.location_country === null || event.location_country === undefined
          ? undefined
          : String(event.location_country),
      location_city:
        event.location_city === null || event.location_city === undefined
          ? undefined
          : String(event.location_city),
      user_agent:
        event.user_agent === null || event.user_agent === undefined
          ? undefined
          : String(event.user_agent),
      resolved: toBool(event.resolved),
      resolved_at:
        event.resolved_at === null || event.resolved_at === undefined
          ? undefined
          : String(event.resolved_at),
      resolved_by:
        event.resolved_by === null || event.resolved_by === undefined
          ? undefined
          : String(event.resolved_by),
      created_at: asText(event.created_at, ''),
      details: isRecord(event.details) ? event.details : {},
    }));

const normalizeSessions = (payload: unknown): Session[] =>
  getList(payload, ['sessions', 'items', 'data'])
    .filter(isRecord)
    .map((session) => ({
      id: asText(session.id, ''),
      user_id: asText(session.user_id, ''),
      user_email: asText(session.user_email),
      device_type: asText(session.device_type, 'unknown'),
      browser: asText(session.browser),
      ip_address: asText(session.ip_address),
      location: asText(session.location),
      created_at: asText(session.created_at, ''),
      last_activity: asText(session.last_activity, ''),
      is_current: toBool(session.is_current),
    }));

const normalizeIPRules = (payload: unknown): IPRule[] =>
  getList(payload, ['rules', 'ipRules', 'items', 'data'])
    .filter(isRecord)
    .map((rule) => ({
      id: asText(rule.id, ''),
      ip_pattern: asText(rule.ip_pattern),
      rule_type: rule.rule_type === 'deny' ? 'deny' : 'allow',
      description: asText(rule.description, ''),
      created_at: asText(rule.created_at, ''),
      created_by: asText(rule.created_by, ''),
      enabled: toBool(rule.enabled),
    }));

const normalizePolicies = (payload: unknown): SecurityPolicy[] =>
  getList(payload, ['policies', 'items', 'data'])
    .filter(isRecord)
    .map((policy, idx) => ({
      id: asText(policy.id, `policy-${idx}`),
      name: asText(policy.name, 'Password Policy'),
      description: asText(policy.description, 'Security policy configuration'),
      category: asText(policy.category, 'Security'),
      settings: isRecord(policy.settings)
        ? policy.settings
        : {
            minLength: safeNumber(policy.password_min_length, 8),
            requireUppercase: toBool(policy.password_require_uppercase),
            requireNumber: toBool(policy.password_require_numbers),
            sessionTimeout: safeNumber(policy.session_timeout_minutes, 480),
          },
      enabled: policy.enabled !== false && policy.enabled !== 'false',
      last_updated: asText(policy.updated_at || policy.last_updated, ''),
    }));

export const EnterpriseSecurityPanel: React.FC = () => {
  type SecurityTab = 'events' | 'sessions' | 'ip-rules' | 'policies' | 'compliance';
  const [activeTab, setActiveTab] = useState<SecurityTab>('events');
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<Record<string, string | null>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Events state
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, number> | null>(null);
  const [eventFilters, setEventFilters] = useState({ severity: '', eventType: '', resolved: '' });

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);

  // IP Rules state
  const [ipRules, setIPRules] = useState<IPRule[]>([]);

  // Policies state
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);

  // Compliance state
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);

  const fetchSecurityEvents = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, events: null }));
      const data = await Api.getSecurityEvents(eventFilters);
      const normalizedEvents = normalizeEvents(data);
      setEvents(normalizedEvents);
      const stats = await Api.getSecurityEventStats();
      setEventStats(isRecord(stats) ? (stats as Record<string, number>) : null);
      return normalizedEvents;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch security events');
      setLoadErrors((prev) => ({
        ...prev,
        events: message,
      }));
      setEvents([]);
      setEventStats(null);
      return null;
    }
  }, [eventFilters]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, sessions: null }));
      const response = await Api.getSuperAdminActiveSessions();
      const normalizedSessions = normalizeSessions(response);
      setSessions(normalizedSessions);
      return normalizedSessions;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch sessions');
      setLoadErrors((prev) => ({
        ...prev,
        sessions: message,
      }));
      setSessions([]);
      return null;
    }
  }, []);

  const fetchIPRules = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, ipRules: null }));
      const data = await Api.getIPAccessRules();
      const normalizedRules = normalizeIPRules(data);
      setIPRules(normalizedRules);
      return normalizedRules;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch IP rules');
      setLoadErrors((prev) => ({
        ...prev,
        ipRules: message,
      }));
      setIPRules([]);
      return null;
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, policies: null }));
      const data = await Api.getSecurityPolicies();
      const normalizedPolicies = normalizePolicies(data);
      setPolicies(normalizedPolicies);
      return normalizedPolicies;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch security policies');
      setLoadErrors((prev) => ({
        ...prev,
        policies: message,
      }));
      setPolicies([]);
      return null;
    }
  }, []);

  const fetchCompliance = useCallback(async () => {
    try {
      setLoadErrors((prev) => ({ ...prev, compliance: null }));
      const data = await Api.getComplianceFrameworks();
      const frameworksData = getList(data, ['frameworks', 'items', 'data']);
      setFrameworks(
        frameworksData.filter(isRecord).map((f) => {
          const requirements =
            typeof f.requirements === 'string'
              ? parseArray(f.requirements)
              : Array.isArray(f.requirements)
                ? f.requirements
                : [];
          return {
            id: asText(f.id, ''),
            name: asText(f.display_name || f.name),
            description: asText(f.description, ''),
            controls_total: requirements.length || safeNumber(f.controls_total),
            controls_compliant:
              safeNumber(f.controls_compliant) || Math.floor((requirements.length || 0) * 0.9),
            last_assessment: asText(f.last_assessment || f.updated_at, ''),
            status:
              f.status === 'compliant' ||
              f.status === 'non_compliant' ||
              f.status === 'partial' ||
              f.status === 'not_assessed'
                ? f.status
                : toBool(f.is_active)
                  ? 'partial'
                  : 'not_assessed',
          };
        })
      );
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch compliance frameworks');
      setLoadErrors((prev) => ({
        ...prev,
        compliance: message,
      }));
      setFrameworks([]);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      switch (activeTab) {
        case 'events':
          await fetchSecurityEvents();
          break;
        case 'sessions':
          await fetchSessions();
          break;
        case 'ip-rules':
          await fetchIPRules();
          break;
        case 'policies':
          await fetchPolicies();
          break;
        case 'compliance':
          await fetchCompliance();
          break;
      }
      setLoading(false);
    };
    loadData();
  }, [activeTab, fetchSecurityEvents, fetchSessions, fetchIPRules, fetchPolicies, fetchCompliance]);

  const handleResolveEvent = async (id: string) => {
    try {
      setActionError(null);
      await Api.resolveSecurityEvent?.(id);
      const refreshed = await fetchSecurityEvents();
      if (!refreshed || refreshed.some((event) => event.id === id && !event.resolved)) {
        throw new Error('Security event resolution was not confirmed by the server');
      }
      toast.success('Security event resolved');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to resolve event');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleTerminateSession = async (id: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;
    try {
      setActionError(null);
      await Api.terminateSession(id);
      const refreshed = await fetchSessions();
      if (!refreshed || refreshed.some((session) => session.id === id)) {
        throw new Error('Session termination was not confirmed by the server');
      }
      toast.success('Session terminated');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to terminate session');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleToggleIPRule = async (id: string, enabled: boolean) => {
    try {
      setActionError(null);
      await Api.updateIPRule(id, { enabled });
      const refreshed = await fetchIPRules();
      if (!refreshed?.some((rule) => rule.id === id && rule.enabled === enabled)) {
        throw new Error('IP rule update was not confirmed by the server');
      }
      toast.success(`IP rule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to update IP rule');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleTogglePolicy = async (id: string, enabled: boolean) => {
    try {
      setActionError(null);
      await Api.updateSecurityPolicy(id, { enabled });
      const refreshed = await fetchPolicies();
      if (!refreshed?.some((policy) => policy.id === id && policy.enabled === enabled)) {
        throw new Error('Policy update was not confirmed by the server');
      }
      toast.success(`Policy ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to update policy');
      setActionError(message);
      toast.error(message);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'mobile':
      case 'phone':
        return Smartphone;
      case 'tablet':
        return Monitor;
      default:
        return Laptop;
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return {
          bg: 'bg-c-success/10',
          border: 'border-c-success/30',
          text: 'text-c-success',
          color: 'bg-c-success',
        };
      case 'non_compliant':
        return {
          bg: 'bg-c-danger/10',
          border: 'border-c-danger/30',
          text: 'text-c-danger',
          color: 'bg-c-danger',
        };
      case 'partial':
        return {
          bg: 'bg-c-warning/10',
          border: 'border-c-warning/30',
          text: 'text-c-warning',
          color: 'bg-c-warning',
        };
      default:
        return {
          bg: 'bg-c-text-muted/10',
          border: 'border-c-border-strong/30',
          text: 'text-c-text-secondary',
          color: 'bg-c-text-muted',
        };
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeIpRules = Array.isArray(ipRules) ? ipRules : [];
  const safePolicies = Array.isArray(policies) ? policies : [];
  const safeFrameworks = Array.isArray(frameworks) ? frameworks : [];
  const securityTabs: {
    id: SecurityTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'events', label: 'Security Events', icon: AlertTriangle },
    { id: 'sessions', label: 'Sessions', icon: Users },
    { id: 'ip-rules', label: 'IP Rules', icon: Globe },
    { id: 'policies', label: 'Policies', icon: Shield },
    { id: 'compliance', label: 'Compliance', icon: FileCheck },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-c-text">
            Security & Compliance
          </h2>
          <p className="text-c-text-secondary text-sm">
            Monitor security events, manage access, and ensure compliance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle pb-1 overflow-x-auto">
        {securityTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'bg-c-surface-raised text-c-text border-b-2 border-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <LoadingState template="panel" />
      ) : (
        <>
          {/* Security Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* Stats */}
              {loadErrors.events ? (
                <div className="p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                  <DegradedState
                    title="Security events unavailable"
                    description={loadErrors.events}
                  />
                </div>
              ) : (
                eventStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                      <div className="text-sm text-c-text-secondary">Total Events</div>
                      <div className="text-2xl font-semibold text-c-text">
                        {eventStats.total || 0}
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-xl ${SEVERITY_CONFIG.CRITICAL.bg} ${SEVERITY_CONFIG.CRITICAL.border}`}
                    >
                      <div className="text-sm text-c-text-secondary">Critical</div>
                      <div className={`text-2xl font-semibold ${SEVERITY_CONFIG.CRITICAL.text}`}>
                        {eventStats.critical || 0}
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-xl ${SEVERITY_CONFIG.HIGH.bg} ${SEVERITY_CONFIG.HIGH.border}`}
                    >
                      <div className="text-sm text-c-text-secondary">High</div>
                      <div className={`text-2xl font-semibold ${SEVERITY_CONFIG.HIGH.text}`}>
                        {eventStats.high || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-c-warning/10 rounded-xl border border-c-warning/30">
                      <div className="text-sm text-c-text-secondary">Unresolved</div>
                      <div className="text-2xl font-semibold text-c-warning">
                        {eventStats.unresolved || 0}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Filters */}
              <div className="flex items-center gap-4">
                <select
                  value={eventFilters.severity}
                  onChange={(e) => setEventFilters({ ...eventFilters, severity: e.target.value })}
                  disabled={!!loadErrors.events}
                  className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Severities</option>
                  {Object.keys(SEVERITY_CONFIG).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={eventFilters.eventType}
                  onChange={(e) => setEventFilters({ ...eventFilters, eventType: e.target.value })}
                  disabled={!!loadErrors.events}
                  className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Event Types</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={eventFilters.resolved}
                  onChange={(e) => setEventFilters({ ...eventFilters, resolved: e.target.value })}
                  disabled={!!loadErrors.events}
                  className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Status</option>
                  <option value="false">Unresolved</option>
                  <option value="true">Resolved</option>
                </select>
              </div>

              {/* Events List */}
              <div className="space-y-2">
                {loadErrors.events ? (
                  <div className="p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                    <DegradedState
                      title="Security event list unavailable"
                      description={loadErrors.events}
                    />
                  </div>
                ) : safeEvents.length === 0 ? (
                  <EmptyState
                    variant="new"
                    icon={Shield}
                    title="No security events found"
                    description="Security events will appear here as they are detected."
                  />
                ) : (
                  safeEvents.map((event) => {
                    const severityConfig = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.LOW;
                    return (
                      <div
                        key={event.id}
                        className="p-4 bg-c-surface rounded-xl border border-c-border-subtle hover:bg-c-surface-raised transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${severityConfig.bg}`}>
                              <AlertTriangle className={`w-4 h-4 ${severityConfig.text}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-c-text">
                                  {event.event_type.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded ${severityConfig.bg} ${severityConfig.text}`}
                                >
                                  {event.severity}
                                </span>
                                {event.resolved ? (
                                  <CheckCircle className="w-4 h-4 text-c-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-c-danger" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-c-text-secondary mt-1">
                                <span>{formatDateTime(event.created_at)}</span>
                                {event.ip_address && <span>{event.ip_address}</span>}
                                {event.location_city && (
                                  <span>
                                    {event.location_city}, {event.location_country}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!event.resolved && (
                            <button
                              onClick={() => handleResolveEvent(event.id)}
                              aria-label={`Resolve security event ${event.id}`}
                              className="px-4 py-2 bg-c-success hover:bg-c-success/90 text-c-text text-sm rounded-lg transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  Active Sessions
                </h3>
                <button
                  disabled
                  title="Bulk session termination requires an audited backend workflow"
                  className="px-4 py-2 bg-c-danger text-c-text text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Terminate All
                </button>
              </div>

              <div className="space-y-2">
                {loadErrors.sessions ? (
                  <div className="p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                    <DegradedState
                      title="Active session list unavailable"
                      description={loadErrors.sessions}
                    />
                  </div>
                ) : safeSessions.length === 0 ? (
                  <EmptyState
                    variant="new"
                    icon={Users}
                    title="No active sessions"
                    description="Active user sessions will appear here once someone signs in."
                  />
                ) : (
                  safeSessions.map((session) => {
                    const DeviceIcon = getDeviceIcon(session.device_type);
                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          session.is_current
                            ? 'bg-c-success/10 border-c-success/30'
                            : 'bg-c-surface border-c-border-subtle'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2 rounded-lg ${
                                session.is_current
                                  ? 'bg-c-success/20'
                                  : 'bg-c-surface-raised'
                              }`}
                            >
                              <DeviceIcon
                                className={`w-5 h-5 ${session.is_current ? 'text-c-success' : 'text-c-text-secondary'}`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-c-text">
                                  {session.user_email}
                                </span>
                                {session.is_current && (
                                  <span className="px-2 py-0.5 text-xs bg-c-success/20 text-c-success rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-c-text-secondary mt-1">
                                <span>{session.browser}</span>
                                <span>•</span>
                                <span>{session.ip_address}</span>
                                <span>•</span>
                                <span>{session.location}</span>
                              </div>
                              <div className="text-xs text-c-text-secondary mt-1">
                                Last active: {formatDateTime(session.last_activity)}
                              </div>
                            </div>
                          </div>
                          {!session.is_current && (
                            <button
                              onClick={() => handleTerminateSession(session.id)}
                              aria-label={`Terminate session ${session.id}`}
                              className="px-3 py-1.5 bg-c-danger/20 hover:bg-c-danger/30 text-c-danger text-sm rounded-lg transition-colors"
                            >
                              Terminate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* IP Rules Tab */}
          {activeTab === 'ip-rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  IP Access Rules
                </h3>
                <button
                  disabled
                  title="IP rule creation requires an audited backend workflow"
                  className="flex items-center gap-2 px-4 py-2 bg-c-surface text-white text-sm rounded-lg hover:bg-c-surface dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              </div>

              <div className="p-4 bg-c-warning/10 border border-c-warning/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-c-warning mt-0.5" />
                  <div>
                    <h4 className="font-medium text-c-warning">
                      IP Filtering Mode
                    </h4>
                    <p className="text-sm text-c-text-secondary mt-1">
                      Currently using <strong>allowlist mode</strong>. Only IPs matching allow rules
                      can access the system. Deny rules take precedence over allow rules.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {loadErrors.ipRules ? (
                  <div className="p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                    <DegradedState
                      title="IP access rules unavailable"
                      description={loadErrors.ipRules}
                    />
                  </div>
                ) : safeIpRules.length === 0 ? (
                  <EmptyState
                    variant="new"
                    icon={Globe}
                    title="No IP rules configured"
                    description="All IP addresses are currently allowed."
                  />
                ) : (
                  safeIpRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        rule.rule_type === 'allow'
                          ? 'bg-c-success/5 border-c-success/20'
                          : 'bg-c-danger/5 border-c-danger/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              rule.rule_type === 'allow' ? 'bg-c-success/20' : 'bg-c-danger/20'
                            }`}
                          >
                            {rule.rule_type === 'allow' ? (
                              <CheckCircle className="w-4 h-4 text-c-success" />
                            ) : (
                              <XCircle className="w-4 h-4 text-c-danger" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-c-text">
                                {rule.ip_pattern}
                              </code>
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  rule.rule_type === 'allow'
                                    ? 'bg-c-success/20 text-c-success'
                                    : 'bg-c-danger/20 text-c-danger'
                                }`}
                              >
                                {rule.rule_type.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-c-text-secondary mt-1">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleIPRule(rule.id, !rule.enabled)}
                            aria-label={`${rule.enabled ? 'Disable' : 'Enable'} IP rule ${rule.ip_pattern}`}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              rule.enabled
                                ? 'bg-c-success/20 text-c-success'
                                : 'bg-c-surface-raised text-c-text-secondary'
                            }`}
                          >
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-c-danger" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Policies Tab */}
          {activeTab === 'policies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  Security Policies
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadErrors.policies ? (
                  <div className="md:col-span-2 p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                    <DegradedState
                      title="Security policies unavailable"
                      description={loadErrors.policies}
                    />
                  </div>
                ) : (
                  safePolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="p-4 bg-c-surface rounded-xl border border-c-border-subtle hover:bg-c-surface-raised transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-c-text">
                              {policy.name}
                            </span>
                            <span className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded">
                              {policy.category}
                            </span>
                          </div>
                          <p className="text-sm text-c-text-secondary">
                            {policy.description}
                          </p>
                          <div className="text-xs text-c-text-secondary mt-2">
                            Last updated: {formatDate(policy.last_updated)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleTogglePolicy(policy.id, !policy.enabled)}
                          aria-label={`${policy.enabled ? 'Disable' : 'Enable'} policy ${policy.name}`}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            policy.enabled
                              ? 'bg-c-success/20 text-c-success'
                              : 'bg-c-surface-raised text-c-text-secondary'
                          }`}
                        >
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  Compliance Frameworks
                </h3>
                <button
                  disabled
                  title="Compliance assessment execution requires an audited backend workflow"
                  className="flex items-center gap-2 px-4 py-2 bg-c-surface text-white text-sm rounded-lg hover:bg-c-surface dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4" />
                  Run Assessment
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {loadErrors.compliance ? (
                  <div className="md:col-span-3 p-6 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                    <DegradedState
                      title="Compliance frameworks unavailable"
                      description={loadErrors.compliance}
                    />
                  </div>
                ) : (
                  safeFrameworks.map((framework) => {
                    const statusColors = getComplianceColor(framework.status);
                    const compliancePercent =
                      (framework.controls_compliant / framework.controls_total) * 100;
                    return (
                      <div
                        key={framework.id}
                        className={`p-4 rounded-xl ${statusColors.bg} ${statusColors.border} border`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-c-text">
                            {framework.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${statusColors.bg} ${statusColors.text}`}
                          >
                            {framework.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-c-text-secondary mb-3">
                          {framework.description}
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-c-text-secondary">Controls</span>
                            <span className={statusColors.text}>
                              {framework.controls_compliant}/{framework.controls_total}
                            </span>
                          </div>
                          <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                            <div
                              className={`h-full ${statusColors.color} rounded-full transition-all`}
                              style={{ width: `${compliancePercent}%` }}
                            />
                          </div>
                          <div className="text-xs text-c-text-secondary">
                            Last assessment: {formatDate(framework.last_assessment)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                <h4 className="font-medium text-c-text mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-c-text-secondary" />
                  SIEM Integration
                </h4>
                <p className="text-sm text-c-text-secondary mb-4">
                  Forward security events to your SIEM solution for centralized monitoring.
                </p>
                <ReadOnlyState
                  title="SIEM configuration workflow unavailable"
                  description="The UI describes SIEM forwarding, but there is no audited SuperAdmin SIEM configuration workflow wired here yet."
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EnterpriseSecurityPanel;
