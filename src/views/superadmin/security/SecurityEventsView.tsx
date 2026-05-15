/**
 * Security Events View
 * Displays and manages security events and alerts
 */

import { CheckCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';

const SECURITY_EVENTS_COPY = {
  loadFailedTitle: 'Security events unavailable',
  malformedPayload: 'Security events response was not a list',
  resolveNotConfirmed: 'Security event resolution was not confirmed by the server',
  resolveFailed: 'Failed to resolve event',
};

const LEAKY_DETAILS = ['sqlstate', '/var/', 'internal:', 'secret', 'stack', 'trace', 'token'];

function safeErrorDetail(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = message.trim();
  if (!detail) return null;
  const lowered = detail.toLowerCase();
  if (LEAKY_DETAILS.some((token) => lowered.includes(token))) return null;
  return detail;
}

function isResolvedValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return false;
}

function formatEventDate(input: unknown): string {
  const parsed = new Date(typeof input === 'string' ? input : '');
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleString();
}

export const SecurityEventsView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErrorTitle, setLoadErrorTitle] = useState<string | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    organizationId: '',
    userId: '',
    eventType: '',
    severity: '',
    resolved: '',
  });

  useEffect(() => {
    void fetchEvents();
  }, [filters]);

  const normalizeEvents = (payload: unknown): any[] | null => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return null;

    const anyPayload = payload as any;
    const candidates: unknown[] = [
      anyPayload.events,
      anyPayload.data,
      anyPayload.items,
      anyPayload?.data?.events,
      anyPayload?.data?.data?.events,
      anyPayload?.data?.data?.items,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return null;
  };

  const fetchEvents = async (): Promise<any[] | null> => {
    setLoading(true);
    setLoadErrorTitle(null);
    setLoadErrorDetail(null);
    try {
      const eventList = await Api.getSecurityEvents(filters);
      const normalized = normalizeEvents(eventList);
      if (!normalized) {
        setEvents([]);
        setLoadErrorTitle(SECURITY_EVENTS_COPY.loadFailedTitle);
        setLoadErrorDetail(SECURITY_EVENTS_COPY.malformedPayload);
        return null;
      }
      setEvents(normalized);
      return normalized;
    } catch (err) {
      setEvents([]);
      setLoadErrorTitle(SECURITY_EVENTS_COPY.loadFailedTitle);
      setLoadErrorDetail(safeErrorDetail(err) || SECURITY_EVENTS_COPY.resolveFailed);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (eventId: string) => {
    setLoadErrorTitle(null);
    setLoadErrorDetail(null);
    try {
      await Api.resolveSecurityEvent(eventId);
      const refreshed = await fetchEvents();
      const confirmed =
        !!refreshed &&
        (refreshed.some((event) => String(event?.id || '') === eventId && isResolvedValue(event?.resolved)) ||
          refreshed.every((event) => String(event?.id || '') !== eventId));

      if (!confirmed) {
        setLoadErrorTitle(SECURITY_EVENTS_COPY.loadFailedTitle);
        setLoadErrorDetail(SECURITY_EVENTS_COPY.resolveNotConfirmed);
        return;
      }

      toast.success('Event resolved');
    } catch (err) {
      setLoadErrorTitle(SECURITY_EVENTS_COPY.loadFailedTitle);
      setLoadErrorDetail(safeErrorDetail(err) || SECURITY_EVENTS_COPY.resolveFailed);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/30';
    }
  };

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

      {loadErrorTitle ? (
        <DegradedState title={loadErrorTitle} description={loadErrorDetail || undefined} />
      ) : null}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Time
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Event Type
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Severity
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  IP Address
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Location
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loadErrorTitle ? null : events.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No security events found
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50">
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {formatEventDate(event.created_at)}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white">
                      {String(event.event_type || '').trim() || 'Unknown event'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs border ${getSeverityColor(
                          String(event.severity || 'unknown').toLowerCase()
                        )}`}
                      >
                        {String(event.severity || 'unknown').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {event.ip_address || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {event.location_city
                        ? `${event.location_city}, ${event.location_country}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {isResolvedValue(event.resolved) ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                          Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isResolvedValue(event.resolved) && (
                        <button
                          onClick={() => handleResolve(event.id)}
                          className="text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                          aria-label={`Resolve security event ${event.id}`}
                          title="Resolve event"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
