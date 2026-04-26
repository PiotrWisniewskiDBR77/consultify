/**
 * AuditEventsViewer — V4-ENT-03 unified audit events viewer.
 * Consumes GET /api/audit/events via Api.getAuditEvents().
 */
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';

interface AuditEvent {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  organization_id?: string;
}

const PAGE_SIZE = 50;

const AuditEventsViewer: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const [resourceType, setResourceType] = useState('');
  const [actorId, setActorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const res = await Api.getAuditEvents({
        resourceType: resourceType || undefined,
        actorId: actorId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setEvents(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err: any) {
      const message = err?.message || 'Failed to load audit events';
      setLoadError(message);
      setEvents([]);
      setTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [resourceType, actorId, fromDate, toDate, offset]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Audit Events</h2>
          <p className="text-sm text-slate-500">
            Unified V4 audit trail — all resource changes across the platform
          </p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200/60 dark:border-navy-700/60">
        <Filter size={14} className="text-slate-400" />
        <div className="flex items-center gap-1.5">
          <Search size={12} className="text-slate-400" />
          <input
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value);
              setOffset(0);
            }}
            placeholder="Resource type"
            disabled={!!loadError}
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 text-slate-800 dark:text-slate-200 outline-none w-32"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-slate-400" />
          <input
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setOffset(0);
            }}
            placeholder="Actor ID"
            disabled={!!loadError}
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 text-slate-800 dark:text-slate-200 outline-none w-32"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-slate-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setOffset(0);
            }}
            disabled={!!loadError}
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 text-slate-800 dark:text-slate-200 outline-none"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setOffset(0);
            }}
            disabled={!!loadError}
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60 text-slate-800 dark:text-slate-200 outline-none"
          />
        </div>
        <span className="text-[10px] text-slate-400 ml-auto">
          {loadError ? 'Events unavailable' : `${total} event${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200/40 dark:border-navy-700/40">
              <th className="text-left px-3 py-2 font-semibold text-slate-500">Timestamp</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500">Action</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500">Resource</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500">Actor</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr>
                <td colSpan={5} className="py-8">
                  <DegradedState title="Audit events unavailable" description={loadError} />
                </td>
              </tr>
            ) : loading && events.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                  Loading audit events...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">
                  <AlertTriangle size={20} className="mx-auto mb-2 opacity-40" />
                  No audit events found
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-slate-100 dark:border-navy-800 hover:bg-slate-50/50 dark:hover:bg-navy-900/30 transition-colors"
                >
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium">
                      {ev.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{ev.resource_type}</span>
                    {ev.resource_id && (
                      <span className="text-slate-400 ml-1 font-mono text-[10px]">
                        {ev.resource_id.slice(0, 12)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {ev.actor_type && (
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                        {ev.actor_type}
                      </span>
                    )}
                    <span className="font-mono text-[10px]">{ev.actor_id?.slice(0, 12)}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate">
                    {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditEventsViewer;
