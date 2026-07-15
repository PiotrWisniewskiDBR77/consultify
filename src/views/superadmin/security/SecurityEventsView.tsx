/**
 * Security Events View
 * Displays and manages security events and alerts
 */

import { CheckCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type SecurityEventRow = {
  id: string;
  created_at?: unknown;
  event_type?: unknown;
  severity?: unknown;
  ip_address?: unknown;
  location_city?: unknown;
  location_country?: unknown;
  resolved?: boolean;
};

const formatSecurityEventDate = (value?: unknown) => {
  if (!value) return 'Unknown date';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const asText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const normalizeEvent = (event: SecurityEventRow): SecurityEventRow => ({
  ...event,
  resolved: toBool(event.resolved, false),
});

export const SecurityEventsView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    organizationId: '',
    userId: '',
    eventType: '',
    severity: '',
    resolved: '',
  });

  const normalizeEvents = (payload: unknown): SecurityEventRow[] => {
    if (Array.isArray(payload)) return payload.map(normalizeEvent);
    if (isRecord(payload)) {
      const data = isRecord(payload.data) ? payload.data : null;
      const nestedData = data && isRecord(data.data) ? data.data : null;
      const candidates = [payload, data, nestedData].filter(isRecord);
      for (const candidate of candidates) {
        if (Array.isArray(candidate.events)) {
          return (candidate.events as SecurityEventRow[]).map(normalizeEvent);
        }
        if (Array.isArray(candidate.data)) {
          return (candidate.data as SecurityEventRow[]).map(normalizeEvent);
        }
        if (Array.isArray(candidate.items)) {
          return (candidate.items as SecurityEventRow[]).map(normalizeEvent);
        }
      }
    }
    throw new Error('Security events response was not a list');
  };

  const fetchEvents = useCallback(async (): Promise<SecurityEventRow[] | null> => {
    setLoading(true);
    setLoadError(null);
    try {
      const eventList = await Api.getSecurityEvents(filters);
      const normalized = normalizeEvents(eventList);
      setEvents(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch security events');
      toast.error(message);
      setEvents([]);
      setLoadError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const handleResolve = async (eventId: string) => {
    try {
      setActionError(null);
      await Api.resolveSecurityEvent(eventId);
      const refreshed = await fetchEvents();
      if (!refreshed || refreshed.some((event) => event.id === eventId && !event.resolved)) {
        throw new Error('Security event resolution was not confirmed by the server');
      }
      toast.success('Event resolved');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to resolve event');
      setActionError(message);
      toast.error(message);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-danger-500/10 text-danger-700 dark:bg-danger-500/20 dark:text-danger-400 border-danger-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/30';
    }
  };

  // canon TRIADA §27 — StandardTable columns. Kebab (actions) is auto-appended
  // by StandardTable itself; it is intentionally NOT declared here.
  const buildColumns = useCallback((): TableColumn[] => {
    return [
      {
        id: 'created_at',
        label: 'Time',
        sortable: true,
        sortAccessor: (row: TableRow) => String((row as unknown as SecurityEventRow).created_at || ''),
        render: (row: TableRow) => (
          <span className="text-slate-700 dark:text-slate-300">
            {formatSecurityEventDate((row as unknown as SecurityEventRow).created_at)}
          </span>
        ),
      },
      {
        id: 'event_type',
        label: 'Event Type',
        render: (row: TableRow) => (
          <span className="text-slate-900 dark:text-white">
            {asText((row as unknown as SecurityEventRow).event_type, 'Unknown event')}
          </span>
        ),
      },
      {
        id: 'severity',
        label: 'Severity',
        render: (row: TableRow) => {
          const severity = asText((row as unknown as SecurityEventRow).severity, 'unknown');
          return (
            <span
              className={`px-2 py-1 rounded text-xs border ${getSeverityColor(severity)}`}
            >
              {severity}
            </span>
          );
        },
      },
      {
        id: 'ip_address',
        label: 'IP Address',
        render: (row: TableRow) => (
          <span className="text-slate-700 dark:text-slate-300">
            {asText((row as unknown as SecurityEventRow).ip_address, '-')}
          </span>
        ),
      },
      {
        id: 'location',
        label: 'Location',
        render: (row: TableRow) => {
          const event = row as unknown as SecurityEventRow;
          return (
            <span className="text-slate-700 dark:text-slate-300">
              {event.location_city
                ? `${asText(event.location_city, '-')}, ${asText(event.location_country, '-')}`
                : '-'}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) =>
          (row as unknown as SecurityEventRow).resolved ? (
            <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400">
              Resolved
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400">
              Open
            </span>
          ),
      },
    ];
  }, []);

  const columns = useMemo(() => buildColumns(), [buildColumns]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security Events</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Monitor and manage security events
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-4">
        <select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.eventType}
          onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
          className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">All Event Types</option>
          <option value="LOGIN_FAILED">Failed Login</option>
          <option value="LOGIN_SUCCESS">Login Success</option>
          <option value="DATA_EXPORT">Data Export</option>
          <option value="PERMISSION_CHANGE">Permission Change</option>
        </select>
        <select
          value={filters.resolved}
          onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
          className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">All Status</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      {loadError && <DegradedState title="Security events unavailable" description={loadError} />}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <StandardTable
            columns={columns}
            data={events as unknown as TableRow[]}
            loading={loading}
            empty={{ title: 'No security events found' }}
            rowMenu={(row) => {
              const event = row as unknown as SecurityEventRow;
              return {
                primary: event.resolved
                  ? []
                  : [
                      {
                        id: 'resolve',
                        label: 'Resolve event',
                        icon: CheckCircle,
                        onClick: () => void handleResolve(event.id),
                      },
                    ],
              };
            }}
          />
        </div>
      )}
    </div>
  );
};
