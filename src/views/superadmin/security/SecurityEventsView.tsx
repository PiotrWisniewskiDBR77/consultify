/**
 * Security Events View
 * Displays and manages security events and alerts
 */

import { AlertTriangle, CheckCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const SecurityEventsView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    organizationId: '',
    userId: '',
    eventType: '',
    severity: '',
    resolved: '',
  });

  useEffect(() => {
    fetchEvents();
  }, [filters]);

  const normalizeEvents = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const anyPayload = payload as any;
      if (Array.isArray(anyPayload.events)) return anyPayload.events;
      if (Array.isArray(anyPayload.data)) return anyPayload.data;
      if (Array.isArray(anyPayload.items)) return anyPayload.items;
    }
    return [];
  };

  const fetchEvents = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const eventList = await Api.getSecurityEvents(filters);
      setEvents(normalizeEvents(eventList));
    } catch (err) {
      toast.error('Failed to fetch security events');
      setLoadError('Failed to fetch security events.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      await Api.resolveSecurityEvent(eventId);
      toast.success('Event resolved');
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve event');
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
              {loadError ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20"
                  >
                    {loadError}
                  </td>
                </tr>
              ) : events.length === 0 ? (
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
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white">{event.event_type}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs border ${getSeverityColor(event.severity)}`}
                      >
                        {event.severity}
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
                      {event.resolved ? (
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
                      {!event.resolved && (
                        <button
                          onClick={() => handleResolve(event.id)}
                          className="text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
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
