/**
 * PricingRegistryTab - Analytics > Pricing Registry (enterprise)
 *
 * Minimal UI:
 * - list ai_price_snapshots
 * - create snapshot (manual)
 */
import { DollarSign, Plus, RefreshCw, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

type SnapshotRow = {
  id: string;
  provider: string;
  model_id: string;
  currency: string;
  source: string;
  effective_from?: string | null;
  effective_to?: string | null;
  units?: unknown;
  notes?: string | null;
  created_at?: string | null;
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

const normalizeSnapshots = (value: unknown): SnapshotRow[] => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.snapshots)) {
    throw new Error('Pricing snapshots response was not a list');
  }

  return payload.snapshots.map((item) => {
    if (!isRecord(item) || !item.id || !item.provider || !item.model_id) {
      throw new Error('Pricing snapshot row was incomplete');
    }

    return {
      id: asText(item.id, ''),
      provider: asText(item.provider, ''),
      model_id: asText(item.model_id, ''),
      currency: asText(item.currency, 'USD'),
      source: asText(item.source, 'unknown'),
      effective_from:
        item.effective_from === null || item.effective_from === undefined
          ? null
          : asText(item.effective_from, ''),
      effective_to:
        item.effective_to === null || item.effective_to === undefined
          ? null
          : asText(item.effective_to, ''),
      units: item.units,
      notes: item.notes === null || item.notes === undefined ? null : asText(item.notes, ''),
      created_at:
        item.created_at === null || item.created_at === undefined
          ? null
          : asText(item.created_at, ''),
    };
  });
};

const getCreatedSnapshotId = (value: unknown): string | null => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) return null;
  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : payload;
  return snapshot.id === null || snapshot.id === undefined ? null : asText(snapshot.id, '');
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

export const PricingRegistryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const json = await Api.getLLMPricingSnapshots({
        provider: providerFilter.trim() || undefined,
        model_id: modelFilter.trim() || undefined,
      });
      const nextRows = normalizeSnapshots(json);
      setRows(nextRows);
      return nextRows;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load pricing snapshots');
      setRows([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [modelFilter, providerFilter]);

  const createSnapshot = async (): Promise<void> => {
    if (loadError) {
      toast.error('Load pricing snapshots before creating a new snapshot');
      return;
    }
    if (!form.provider.trim() || !form.model_id.trim()) {
      toast.error('provider and model_id required');
      return;
    }
    if (!parsedUnits) {
      toast.error('Units must be valid JSON');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const previousRows = rows;
      const result = await Api.createLLMPricingSnapshot({
        provider: form.provider.trim(),
        model_id: form.model_id.trim(),
        currency: form.currency.trim() || 'USD',
        source: form.source.trim() || 'manual',
        units: parsedUnits,
        notes: form.notes || null,
      });
      const createdId = getCreatedSnapshotId(result);
      const nextRows = await load();
      if (!nextRows) {
        throw new Error('Pricing snapshot create was not confirmed after reload');
      }
      const existedBefore = createdId ? previousRows.some((row) => row.id === createdId) : false;
      const createdIsVisible =
        createdId && nextRows.some((row) => row.id === createdId) && !existedBefore;
      const rowCountIncreased = nextRows.length > previousRows.length;
      if (!createdIsVisible && !rowCountIncreased) {
        throw new Error('Pricing snapshot create was not confirmed by the server');
      }
      toast.success('Snapshot created');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Create failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const controlsDisabled = !!loadError;

  const snapshotColumns: TableColumn[] = useMemo(
    () => [
      { id: 'provider', label: 'Provider', render: (row: TableRow) => row.provider },
      {
        id: 'model_id',
        label: 'Model',
        render: (row: TableRow) => <span className="font-mono text-xs">{row.model_id}</span>,
      },
      { id: 'source', label: 'Source', render: (row: TableRow) => row.source },
      { id: 'currency', label: 'Currency', render: (row: TableRow) => row.currency },
      {
        id: 'effective_from',
        label: 'Effective',
        render: (row: TableRow) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatDateTime(row.effective_from)}
          </span>
        ),
      },
      {
        id: 'created_at',
        label: 'Created',
        render: (row: TableRow) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatDateTime(row.created_at)}
          </span>
        ),
      },
    ],
    []
  );

  const snapshotRows: TableRow[] = useMemo(() => rows.map((row) => ({ ...row })), [rows]);

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
            disabled={controlsDisabled}
            title={loadError || undefined}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <input
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder="filter model_id"
            disabled={controlsDisabled}
            title={loadError || undefined}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <button
            onClick={load}
            disabled={loading || controlsDisabled}
            title={loadError || undefined}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        {loadError ? (
          <div className="p-4">
            <DegradedState title="Pricing snapshots unavailable" description={loadError} />
          </div>
        ) : (
          <StandardTable
            columns={snapshotColumns}
            data={snapshotRows}
            loading={loading && rows.length === 0}
            empty={{ title: 'No snapshots.' }}
            persistKey="superadmin.aiPlatform.pricingRegistry"
            canvasClassName="p-0"
          />
        )}
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
        {actionError ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          >
            {actionError}
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Create snapshot
          </div>
          <button
            onClick={createSnapshot}
            disabled={saving || !parsedUnits || !!loadError}
            title={loadError || (!parsedUnits ? 'Units must be valid JSON' : undefined)}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
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
          <Plus size={16} className="text-slate-600" />
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
