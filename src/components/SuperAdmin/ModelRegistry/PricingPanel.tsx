import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Edit,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tag,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PriceSnapshot, PriceSource } from './types';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const SOURCE_BADGE_STYLES: Record<PriceSource, { bg: string; text: string }> = {
  api_sync: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  manual: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  contract: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
};

function SourceBadge({ source }: { source: PriceSource }) {
  const style = SOURCE_BADGE_STYLES[source];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      <Tag size={10} />
      {source.replace('_', ' ')}
    </span>
  );
}

export const PricingPanel: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState({
    modelId: '',
    provider: '',
    inputPer1MTokens: '',
    outputPer1MTokens: '',
    perImage: '',
    perRequest: '',
    source: 'manual' as PriceSource,
    currency: 'USD',
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/llm/pricing/snapshots', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json?.snapshots) ? json.snapshots : [];
        setSnapshots(
          rows.map((r: any) => ({
            id: String(r.id || ''),
            modelId: String(r.model_id || ''),
            provider: String(r.provider || ''),
            inputPer1MTokens: r.units?.input_per_1m_tokens ?? undefined,
            outputPer1MTokens: r.units?.output_per_1m_tokens ?? undefined,
            perImage: r.units?.per_image ?? undefined,
            perRequest: r.units?.per_request ?? undefined,
            source: (r.source as PriceSource) || 'manual',
            currency: r.currency || 'USD',
            effectiveFrom: r.effective_from || '',
            effectiveTo: r.effective_to || undefined,
            notes: r.notes || undefined,
            createdAt: r.created_at || '',
          }))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Failed to load pricing snapshots');
        setSnapshots([]);
      }
    } catch {
      toast.error('Failed to load pricing snapshots');
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleCreateSnapshot = async () => {
    if (!form.modelId.trim() || !form.provider.trim()) {
      toast.error('Model ID and provider are required');
      return;
    }

    const units: Record<string, number> = {};
    if (form.inputPer1MTokens) units.input_per_1m_tokens = Number(form.inputPer1MTokens);
    if (form.outputPer1MTokens) units.output_per_1m_tokens = Number(form.outputPer1MTokens);
    if (form.perImage) units.per_image = Number(form.perImage);
    if (form.perRequest) units.per_request = Number(form.perRequest);

    try {
      const res = await fetch('/api/llm/pricing/snapshots', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider: form.provider.trim(),
          model_id: form.modelId.trim(),
          currency: form.currency,
          source: form.source,
          units,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Create failed');
      }
      toast.success('Price snapshot created');
      setShowAddForm(false);
      setForm({
        modelId: '',
        provider: '',
        inputPer1MTokens: '',
        outputPer1MTokens: '',
        perImage: '',
        perRequest: '',
        source: 'manual',
        currency: 'USD',
        effectiveFrom: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await loadSnapshots();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create snapshot');
    }
  };

  const filteredSnapshots = useMemo(() => {
    if (!searchTerm) return snapshots;
    const term = searchTerm.toLowerCase();
    return snapshots.filter(
      (s) =>
        s.modelId.toLowerCase().includes(term) ||
        s.provider.toLowerCase().includes(term) ||
        s.source.toLowerCase().includes(term)
    );
  }, [snapshots, searchTerm]);

  const groupedByModel = useMemo(() => {
    const map = new Map<string, PriceSnapshot[]>();
    for (const s of filteredSnapshots) {
      const key = `${s.provider}/${s.modelId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [filteredSnapshots]);

  const formatPrice = (val: number | undefined) => {
    if (val === undefined || val === null) return '—';
    return `$${val.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign size={24} className="text-indigo-500" />
            {t('modelRegistry.pricing.title', 'Model Pricing')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'modelRegistry.pricing.description',
              'View and manage model pricing with versioned snapshots'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSnapshots}
            className="p-2 text-slate-600 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Price Snapshot
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">Total Snapshots</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {snapshots.length}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">Models Priced</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {new Set(snapshots.map((s) => s.modelId)).size}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">Sources</div>
          <div className="flex items-center gap-2 mt-1">
            {(['api_sync', 'manual', 'contract'] as PriceSource[]).map((s) => {
              const count = snapshots.filter((snap) => snap.source === s).length;
              if (!count) return null;
              return <SourceBadge key={s} source={s} />;
            })}
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              New Price Snapshot
            </h3>
            <button
              onClick={handleCreateSnapshot}
              className="flex items-center gap-2 px-4 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save size={16} />
              Create
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Provider
              </label>
              <input
                value={form.provider}
                onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                placeholder="openrouter"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Model ID
              </label>
              <input
                value={form.modelId}
                onChange={(e) => setForm((p) => ({ ...p, modelId: e.target.value }))}
                placeholder="openai/gpt-4o"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Source
              </label>
              <select
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value as PriceSource }))}
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              >
                <option value="manual">Manual</option>
                <option value="api_sync">API Sync</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Effective From
              </label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Input / 1M tokens ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.inputPer1MTokens}
                onChange={(e) => setForm((p) => ({ ...p, inputPer1MTokens: e.target.value }))}
                placeholder="0.00"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Output / 1M tokens ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.outputPer1MTokens}
                onChange={(e) => setForm((p) => ({ ...p, outputPer1MTokens: e.target.value }))}
                placeholder="0.00"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Per Image ($)
              </label>
              <input
                type="number"
                step="0.001"
                value={form.perImage}
                onChange={(e) => setForm((p) => ({ ...p, perImage: e.target.value }))}
                placeholder="0.000"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Per Request ($)
              </label>
              <input
                type="number"
                step="0.0001"
                value={form.perRequest}
                onChange={(e) => setForm((p) => ({ ...p, perRequest: e.target.value }))}
                placeholder="0.0000"
                className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes about this price entry"
              className="w-full h-9 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by model or provider..."
          className="w-full pl-10 pr-4 h-9 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400"
        />
      </div>

      {/* Pricing table grouped by model */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Model
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Provider
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Input/1M
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Output/1M
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Per Image
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Per Request
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Effective
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {filteredSnapshots.map((snap) => (
              <tr
                key={snap.id}
                className="hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors cursor-pointer"
                onClick={() => setExpandedId(expandedId === snap.id ? null : snap.id)}
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-mono text-slate-900 dark:text-white">
                    {snap.modelId}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {snap.provider}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {formatPrice(snap.inputPer1MTokens)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {formatPrice(snap.outputPer1MTokens)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {formatPrice(snap.perImage)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {formatPrice(snap.perRequest)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={snap.source} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {snap.effectiveFrom || '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredSnapshots.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  <DollarSign size={32} className="mx-auto mb-3 opacity-40" />
                  <p>No pricing snapshots found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PricingPanel;
