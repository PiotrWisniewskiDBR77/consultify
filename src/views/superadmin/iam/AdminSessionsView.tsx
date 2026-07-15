/**
 * Admin Sessions View
 *
 * Manages SuperAdmin sessions with MFA tracking, IP logging,
 * and session revocation capabilities.
 */

import {
  AlertTriangle,
  Clock,
  Globe,
  Loader2,
  LogOut,
  Monitor,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldX,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { DegradedState } from '../../../components/Admin/AdminState';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Card, CardWithHeader } from '../components/shared/Card';

interface AdminSession {
  id: string;
  adminId: string;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  sessionType?: 'standard' | 'jit' | 'break_glass' | string;
  requestedCapability?: string | null;
  justification?: string | null;
  breakGlassReason?: string | null;
  admin: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  mfaVerifiedSessions: number;
  uniqueAdmins: number;
  jitActive: number;
  breakGlassActive: number;
}

interface SessionsSnapshot {
  sessions: AdminSession[];
  stats: SessionStats;
}

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

const normalizeSessions = (value: unknown): AdminSession[] => {
  if (Array.isArray(value)) return value as AdminSession[];
  if (isRecord(value)) {
    const data = isRecord(value.data) ? value.data : null;
    const nestedData = data && isRecord(data.data) ? data.data : null;
    const candidates = [value, data, nestedData].filter(isRecord);
    for (const candidate of candidates) {
      if (Array.isArray(candidate.sessions)) return candidate.sessions as AdminSession[];
      if (Array.isArray(candidate.items)) return candidate.items as AdminSession[];
      if (Array.isArray(candidate.data)) return candidate.data as AdminSession[];
    }
  }
  throw new Error('Admin sessions response was not a list');
};

const normalizeStats = (value: unknown): SessionStats => {
  const payload = getObjectPayload(value);
  const statsValue = isRecord(payload) ? payload : {};
  return {
    totalSessions: safeNumber(statsValue.total ?? statsValue.totalSessions),
    activeSessions: safeNumber(statsValue.active ?? statsValue.activeSessions),
    mfaVerifiedSessions: safeNumber(statsValue.mfaVerified ?? statsValue.mfaVerifiedSessions),
    uniqueAdmins: safeNumber(statsValue.uniqueAdmins),
    jitActive: safeNumber(statsValue.jitActive),
    breakGlassActive: safeNumber(statsValue.breakGlassActive),
  };
};

// canon TRIADA §27 — StandardTable columns. Kebab (actions) is auto-appended
// by StandardTable itself; it is intentionally NOT declared here.
const buildColumns = (
  getDeviceIcon: (userAgent: string) => React.ReactNode,
  formatDate: (dateString: string) => string,
  isExpired: (expiresAt: string) => boolean
): TableColumn[] => [
  {
    id: 'admin',
    label: 'Admin',
    sortable: true,
    sortAccessor: (row: TableRow) => (row as unknown as AdminSession).admin?.email || '',
    render: (row: TableRow) => {
      const session = row as unknown as AdminSession;
      return (
        <div>
          <p className="font-medium">
            {session.admin?.firstName || 'Unknown'} {session.admin?.lastName || ''}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {session.admin?.email || 'Unknown admin'}
          </p>
        </div>
      );
    },
  },
  {
    id: 'userAgent',
    label: 'Device',
    render: (row: TableRow) => {
      const session = row as unknown as AdminSession;
      return (
        <div className="flex items-center gap-2">
          {getDeviceIcon(session.userAgent)}
          <span className="text-sm text-slate-600 truncate max-w-[200px]">
            {String(session.userAgent || 'Unknown device').split(' ')[0]}
          </span>
        </div>
      );
    },
  },
  {
    id: 'ipAddress',
    label: 'IP Address',
    render: (row: TableRow) => (
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-500 dark:text-slate-500" />
        <span className="text-sm">{(row as unknown as AdminSession).ipAddress || 'Unknown'}</span>
      </div>
    ),
  },
  {
    id: 'mfaVerified',
    label: 'MFA',
    render: (row: TableRow) =>
      (row as unknown as AdminSession).mfaVerified ? (
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          Verified
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-400">
          <ShieldX className="w-4 h-4" />
          Not Verified
        </span>
      ),
  },
  {
    id: 'createdAt',
    label: 'Created',
    sortable: true,
    sortAccessor: (row: TableRow) => (row as unknown as AdminSession).createdAt || '',
    render: (row: TableRow) => (
      <div className="flex items-center gap-1 text-sm text-slate-600">
        <Clock className="w-4 h-4 text-slate-500 dark:text-slate-500" />
        {formatDate((row as unknown as AdminSession).createdAt)}
      </div>
    ),
  },
  {
    id: 'expiresAt',
    label: 'Expires',
    sortable: true,
    sortAccessor: (row: TableRow) => (row as unknown as AdminSession).expiresAt || '',
    render: (row: TableRow) => {
      const session = row as unknown as AdminSession;
      return (
        <span
          className={`text-sm ${isExpired(session.expiresAt) ? 'text-danger-400' : 'text-slate-600'}`}
        >
          {formatDate(session.expiresAt)}
        </span>
      );
    },
  },
];

const AdminSessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);
      const [sessionsData, statsData] = await Promise.all([
        Api.getAdminSessions(),
        Api.getAdminSessionStats(),
      ]);
      if (!hasListShape(sessionsData, ['sessions', 'items'])) {
        throw new Error('Admin sessions response was not a list');
      }
      const nextSessions = normalizeSessions(sessionsData);
      const nextStats = normalizeStats(statsData);
      setSessions(nextSessions);
      setStats(nextStats);
      return { sessions: nextSessions, stats: nextStats } satisfies SessionsSnapshot;
    } catch (err: unknown) {
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load sessions'));
      setSessions([]);
      setStats(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);
      setError(null);
      await Api.revokeAdminSession(sessionId);
      const refreshed = await loadData();
      if (!refreshed || refreshed.sessions.some((session) => session.id === sessionId)) {
        throw new Error('Admin session revocation was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to revoke session'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAll = async () => {
    if (
      !confirm('Are you sure you want to revoke all admin sessions? This will log out all admins.')
    ) {
      return;
    }

    try {
      setActionLoading('all');
      setError(null);
      await Api.revokeAllAdminSessions(undefined, 'bulk_revoke');
      const refreshed = await loadData();
      if (!refreshed || refreshed.sessions.length > 0) {
        throw new Error('Bulk admin session revocation was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to revoke all sessions'));
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    const safeUserAgent = String(userAgent || '');
    const ua = safeUserAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  const isExpired = (expiresAt: string) => {
    const date = new Date(expiresAt);
    return !Number.isNaN(date.getTime()) && date < new Date();
  };

  const columns = useMemo(() => buildColumns(getDeviceIcon, formatDate, isExpired), []);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Admin sessions unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Sessions</p>
                <p className="text-xl font-semibold">{stats?.totalSessions || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Sessions</p>
                <p className="text-xl font-semibold">{stats?.activeSessions || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">MFA Verified</p>
                <p className="text-xl font-semibold">{stats?.mfaVerifiedSessions || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unique Admins</p>
                <p className="text-xl font-semibold">{stats?.uniqueAdmins || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-sky-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">JIT Active</p>
                <p className="text-xl font-semibold">{stats?.jitActive || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <ShieldX className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Break-glass</p>
                <p className="text-xl font-semibold">{stats?.breakGlassActive || 0}</p>
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

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleRevokeAll}
            disabled={!!loadError || actionLoading === 'all' || sessions.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'all' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Revoke All Sessions
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <CardWithHeader title="Admin Sessions" subtitle={`${sessions.length} active sessions`}>
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Active admin sessions unavailable" description={loadError} />
          </div>
        ) : (
          <StandardTable
            columns={columns}
            data={sessions as unknown as TableRow[]}
            empty={{ title: 'No active sessions found' }}
            rowMenu={(row) => {
              const session = row as unknown as AdminSession;
              return {
                destructive: {
                  label: 'Revoke Session',
                  icon: Trash2,
                  onClick: () => {
                    if (actionLoading === session.id) return;
                    void handleRevokeSession(session.id);
                  },
                },
              };
            }}
          />
        )}
      </CardWithHeader>
    </div>
  );
};

export default AdminSessionsView;
