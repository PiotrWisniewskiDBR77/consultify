/**
 * MarketInboxTab - Operations > Market Inbox (enterprise)
 *
 * Minimal UI for:
 * - trigger OpenRouter market sync
 * - review diffs in ai_market_inbox
 * - mark items approved/ignored/applied
 */
import { Check, RefreshCw, Server, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

type InboxRow = {
  id: string;
  source: string;
  change_type: string;
  model_id: string;
  provider_type?: string | null;
  origin_vendor?: string | null;
  before?: any;
  after?: any;
  status: string;
  created_at?: string | null;
  reviewed_at?: string | null;
};

export const MarketInboxTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [statusFilter, setStatusFilter] = useState('new');
  const [rows, setRows] = useState<InboxRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      qs.set('source', 'openrouter');
      const res = await fetch(`/api/llm/market/inbox?${qs.toString()}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load inbox');
      setRows(Array.isArray(json?.inbox) ? json.inbox : []);
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/llm/market/openrouter/sync', {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Sync failed');
      toast.success('Market sync completed');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/llm/market/inbox/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
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
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          >
            <option value="new">new</option>
            <option value="approved">approved</option>
            <option value="ignored">ignored</option>
            <option value="applied">applied</option>
          </select>
          <button
            onClick={sync}
            disabled={syncing}
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

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Inbox items</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{rows.length} items</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
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
                        onClick={() => setStatus(r.id, 'approved')}
                        disabled={updating}
                        className="p-2 rounded-lg hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 transition-colors"
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'ignored')}
                        disabled={updating}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                        title="Ignore"
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
    </div>
  );
};

export default MarketInboxTab;
