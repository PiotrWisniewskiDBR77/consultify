/**
 * MarketInboxTab - Operations > Market Inbox (enterprise)
 *
 * Minimal UI for:
 * - trigger OpenRouter market sync
 * - review diffs in ai_market_inbox
 * - mark items approved/ignored/applied
 */
import { Check, RefreshCw, Server, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { LoadingState } from '../../../../components/ui/primitives';

type InboxRow = {
  id: string;
  source: string;
  change_type: string;
  model_id: string;
  provider_type?: string | null;
  origin_vendor?: string | null;
  before?: unknown;
  after?: unknown;
  status: string;
  created_at?: string | null;
  reviewed_at?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const normalizeInboxRows = (value: unknown): InboxRow[] => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.inbox)) {
    throw new Error('Market inbox response was not a list');
  }

  return payload.inbox.map((item) => {
    if (!isRecord(item) || !item.id || !item.model_id || !item.status) {
      throw new Error('Market inbox row was incomplete');
    }

    return {
      id: asText(item.id, ''),
      source: asText(item.source, 'unknown'),
      change_type: asText(item.change_type, 'unknown'),
      model_id: asText(item.model_id, 'unknown'),
      provider_type:
        item.provider_type === null || item.provider_type === undefined
          ? null
          : asText(item.provider_type, ''),
      origin_vendor:
        item.origin_vendor === null || item.origin_vendor === undefined
          ? null
          : asText(item.origin_vendor, ''),
      before: item.before,
      after: item.after,
      status: asText(item.status, 'unknown'),
      created_at:
        item.created_at === null || item.created_at === undefined
          ? null
          : asText(item.created_at, ''),
      reviewed_at:
        item.reviewed_at === null || item.reviewed_at === undefined
          ? null
          : asText(item.reviewed_at, ''),
    };
  });
};

export const MarketInboxTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [statusFilter, setStatusFilter] = useState('new');
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const json = await Api.getLLMMarketInbox({ status: statusFilter, source: 'openrouter' });
      const nextRows = normalizeInboxRows(json);
      setRows(nextRows);
      return nextRows;
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Load failed');
      setLoadError(message);
      setRows([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const sync = async () => {
    if (loadError) {
      toast.error('Market inbox is unavailable');
      return;
    }
    setSyncing(true);
    setActionError(null);
    try {
      await Api.syncOpenRouterMarket();
      const nextRows = await load();
      if (!nextRows) {
        throw new Error('Market sync was not confirmed after reload');
      }
      toast.success('Market sync completed');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Sync failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    if (loadError) {
      toast.error('Market inbox is unavailable');
      return;
    }
    setUpdating(true);
    setActionError(null);
    try {
      await Api.updateMarketInboxItem(id, { status });
      const nextRows = await load();
      if (!nextRows) {
        throw new Error('Market inbox update was not confirmed after reload');
      }
      const updatedRow = nextRows.find((row) => row.id === id);
      if (updatedRow && updatedRow.status !== status) {
        throw new Error('Market inbox update was not confirmed by the server');
      }
      toast.success('Inbox item updated');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Update failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const applyItem = async (id: string) => {
    if (loadError) {
      toast.error('Market inbox is unavailable');
      return;
    }
    setUpdating(true);
    setActionError(null);
    try {
      await Api.applyMarketInboxItem(id);
      const nextRows = await load();
      if (!nextRows) {
        throw new Error('Market inbox apply was not confirmed after reload');
      }
      const appliedRow = nextRows.find((row) => row.id === id);
      if (appliedRow && appliedRow.status !== 'applied') {
        throw new Error('Market inbox apply was not confirmed by the server');
      }
      toast.success('Applied');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Apply failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server size={22} className="text-indigo-500" />
            Market Inbox (OpenRouter)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review vendor catalog changes before applying them to your curated registry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={!!loadError}
            title={loadError || undefined}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          >
            <option value="new">new</option>
            <option value="approved">approved</option>
            <option value="ignored">ignored</option>
            <option value="applied">applied</option>
          </select>
          <button
            onClick={sync}
            disabled={syncing || !!loadError}
            title={loadError || undefined}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            Sync now
          </button>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <DegradedState title="Market inbox unavailable" description={loadError} />
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          {actionError ? (
            <div
              role="alert"
              className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            >
              {actionError}
            </div>
          ) : null}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Inbox items</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{rows.length} items</div>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="min-w-full text-sm"
            >
              <thead className="bg-slate-50 dark:bg-navy-900/60">
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Origin</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 dark:border-navy-700">
                    <td className="px-4 py-3">{r.change_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.model_id}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {r.origin_vendor || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {r.created_at || '—'}
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => applyItem(r.id)}
                          disabled={updating || r.status !== 'approved'}
                          className="p-2 rounded-lg hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-500 transition-colors disabled:opacity-40"
                          title="Apply (requires approved)"
                          aria-label={`Apply ${r.model_id}`}
                        >
                          <Zap size={16} />
                        </button>
                        <button
                          onClick={() => setStatus(r.id, 'approved')}
                          disabled={updating}
                          className="p-2 rounded-lg hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 transition-colors"
                          title="Approve"
                          aria-label={`Approve ${r.model_id}`}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setStatus(r.id, 'ignored')}
                          disabled={updating}
                          className="p-2 rounded-lg hover:bg-danger-500/10 text-slate-500 hover:text-danger-400 transition-colors"
                          title="Ignore"
                          aria-label={`Ignore ${r.model_id}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Inbox is empty.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketInboxTab;
