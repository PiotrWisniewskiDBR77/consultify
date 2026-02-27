/**
 * PricingRegistryTab - Analytics > Pricing Registry (enterprise)
 *
 * Minimal UI:
 * - list ai_price_snapshots
 * - create snapshot (manual)
 */
import { DollarSign, Plus, RefreshCw, Save } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

type SnapshotRow = {
  id: string;
  provider: string;
  model_id: string;
  currency: string;
  source: string;
  effective_from?: string | null;
  effective_to?: string | null;
  units?: any;
  notes?: string | null;
  created_at?: string | null;
};

export const PricingRegistryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [rows, setRows] = useState<SnapshotRow[]>([]);

  const [form, setForm] = useState<{
    provider: string;
    model_id: string;
    currency: string;
    source: string;
    unitsRaw: string;
    notes: string;
  }>({
    provider: 'openrouter',
    model_id: 'openai/gpt-4o-mini',
    currency: 'USD',
    source: 'manual',
    unitsRaw: '{\n  "input_per_1m_tokens": 0,\n  "output_per_1m_tokens": 0\n}',
    notes: '',
  });

  const parsedUnits = useMemo(() => {
    try {
      return JSON.parse(form.unitsRaw);
    } catch {
      return null;
    }
  }, [form.unitsRaw]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (providerFilter.trim()) qs.set('provider', providerFilter.trim());
      if (modelFilter.trim()) qs.set('model_id', modelFilter.trim());
      const res = await fetch(`/api/llm/pricing/snapshots?${qs.toString()}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load snapshots');
      setRows(Array.isArray(json?.snapshots) ? json.snapshots : []);
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async (): Promise<void> => {
    if (!form.provider.trim() || !form.model_id.trim()) {
      toast.error('provider and model_id required');
      return;
    }
    if (!parsedUnits) {
      toast.error('Units must be valid JSON');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/llm/pricing/snapshots', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider: form.provider.trim(),
          model_id: form.model_id.trim(),
          currency: form.currency.trim() || 'USD',
          source: form.source.trim() || 'manual',
          units: parsedUnits,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      toast.success('Snapshot created');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign size={22} className="text-indigo-500" />
            Pricing Registry
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Versioned price snapshots used for cost estimation and historical consistency.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            placeholder="filter provider"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <input
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder="filter model_id"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Apply filters
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Snapshots</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{rows.length} rows</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-navy-900/60">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Effective</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="text-indigo-500 animate-spin" />
                      Loading snapshots…
                    </span>
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-navy-700">
                  <td className="px-4 py-3">{r.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.model_id}</td>
                  <td className="px-4 py-3">{r.source}</td>
                  <td className="px-4 py-3">{r.currency}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {r.effective_from || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {r.created_at || '—'}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No snapshots.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Create snapshot
          </div>
          <button
            onClick={createSnapshot}
            disabled={saving || !parsedUnits}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            Create
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.provider}
            onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
            placeholder="provider"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <input
            value={form.model_id}
            onChange={(e) => setForm((p) => ({ ...p, model_id: e.target.value }))}
            placeholder="model_id"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <input
            value={form.currency}
            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            placeholder="currency"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <input
            value={form.source}
            onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
            placeholder="source"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <textarea
          value={form.unitsRaw}
          onChange={(e) => setForm((p) => ({ ...p, unitsRaw: e.target.value }))}
          spellCheck={false}
          className="w-full h-[180px] p-3 font-mono text-xs bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-navy-700 rounded-lg outline-none"
        />
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Units JSON: {parsedUnits ? 'valid' : 'invalid'}
        </div>

        <div className="flex items-center gap-2">
          <Plus size={16} className="text-slate-400" />
          <input
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="notes (optional)"
            className="flex-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default PricingRegistryTab;
