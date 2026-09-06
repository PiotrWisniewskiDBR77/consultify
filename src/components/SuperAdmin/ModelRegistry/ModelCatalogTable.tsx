import {
  Database,
  Edit,
  Eye,
  EyeOff,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  Wifi,
  Wrench,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import { useAppStore } from '../../../store/useAppStore';
import { AppView } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { LoadingState } from '../../shared/states';
import type { ErrorCategory, HealthStatus, ModelKind, ProviderType, RegistryModel } from './types';
import { HEALTH_STYLES, KIND_BADGE_STYLES, PROVIDER_TYPE_STYLES } from './types';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

function HealthBadge({ status }: { status: HealthStatus }) {
  const style = HEALTH_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

function ErrorCategoryBadge({
  category,
  httpStatus,
}: {
  category?: ErrorCategory;
  httpStatus?: number;
}) {
  if (!category || category === 'unknown') return null;
  const label =
    category === 'billing'
      ? 'Billing'
      : category === 'auth'
        ? 'Auth'
        : category === 'missing_key'
          ? 'Missing key'
          : category === 'rate_limit'
            ? 'Rate limit'
            : category === 'network'
              ? 'Network'
              : 'Unknown';
  const cls =
    category === 'billing'
      ? 'bg-c-warning/10 text-c-warning'
      : category === 'auth' || category === 'missing_key'
        ? 'bg-c-danger/10 text-c-danger'
        : category === 'rate_limit'
          ? 'bg-c-warning/10 text-c-warning'
          : 'bg-c-surface-raised text-c-text-secondary';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
      title={httpStatus ? `${label} (HTTP ${httpStatus})` : label}
    >
      {label}
      {httpStatus ? ` ${httpStatus}` : ''}
    </span>
  );
}

function KindBadge({ kind }: { kind: ModelKind }) {
  const style = KIND_BADGE_STYLES[kind];
  const Icon = kind === 'TEXT_LLM' ? MessageSquare : kind === 'IMAGE_MODEL' ? ImageIcon : Sparkles;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      <Icon size={12} />
      {KIND_LABELS[kind]}
    </span>
  );
}

function ProviderTypeBadge({ type }: { type: ProviderType }) {
  const style = PROVIDER_TYPE_STYLES[type];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${style.bg} ${style.text}`}
    >
      {type.replace('_', ' ')}
    </span>
  );
}

function CapabilityIcons({ caps }: { caps: RegistryModel['capabilities'] }) {
  return (
    <div className="flex items-center gap-1">
      {caps.vision && (
        <span title="Vision" className="p-1 rounded bg-c-info/10 text-c-info">
          <Eye size={12} />
        </span>
      )}
      {caps.tools && (
        <span title="Tools" className="p-1 rounded bg-c-warning/10 text-c-warning">
          <Wrench size={12} />
        </span>
      )}
      {caps.streaming && (
        <span title="Streaming" className="p-1 rounded bg-c-success/10 text-c-success">
          <Wifi size={12} />
        </span>
      )}
      {caps.jsonMode && (
        // kanon TRIADA pułapka #1: c-accent = crimson; capability identity dot
        // → purple (spójne z KIND_BADGE_STYLES.IMAGE_MODEL), nie primary/crimson.
        <span title="JSON mode" className="p-1 rounded bg-purple-500/10 text-purple-400">
          <Server size={12} />
        </span>
      )}
    </div>
  );
}

interface EditModelModalProps {
  model: RegistryModel;
  onClose: () => void;
  onSaved: () => void;
}

function EditModelModal({ model, onClose, onSaved }: EditModelModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: model.name,
    provider: model.provider,
    model_id: model.modelId,
    is_active: model.isActive,
    tier: (model as any).tier || '',
    description: (model as any).description || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/llm/providers/${encodeURIComponent(model.id)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Update failed');
      }
      toast.success(`${form.name} updated`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-c-surface rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-c-border-subtle">
          <h2 className="text-xl font-bold text-c-text">Edit Model</h2>
          <p className="text-sm text-c-text-muted mt-1">
            Update provider configuration for {model.name}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Provider
              </label>
              <input
                type="text"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Model ID
              </label>
              <input
                type="text"
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">Tier</label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
              >
                <option value="">No tier</option>
                <option value="primary">Primary</option>
                <option value="fallback">Fallback</option>
                <option value="economy">Economy</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-c-border-strong text-c-accent"
                />
                <span className="text-sm text-c-text-secondary">Active</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
              placeholder="Optional description..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-c-border-subtle rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name}
            className="px-4 py-2.5 bg-c-text hover:brightness-95 disabled:opacity-50 text-c-surface rounded-lg font-medium flex items-center gap-2"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Edit size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Odbiór grafiki 07-realizacja (2026-08-30): rodzaj modelu renderował się
// wprost jako surowy enum backendu (TEXT_LLM/IMAGE_MODEL/BUSINESS_MODEL) —
// znany defekt "surowe enumy zamiast etykiet" z kanonu grafiki. Etykieta
// tłumaczy WYŁĄCZNIE tekst wyświetlany; wartość filtra/klucz danych zostaje
// bez zmian (kind === 'TEXT_LLM' itd. nadal działa).
const KIND_LABELS: Record<'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL', string> = {
  TEXT_LLM: 'Model tekstowy',
  IMAGE_MODEL: 'Model obrazu',
  BUSINESS_MODEL: 'Model biznesowy',
};

// ── Filter options (kolumny StandardTable) ─────────────────────────────────
const KIND_FILTER_OPTIONS = [
  { value: 'TEXT_LLM', label: KIND_LABELS.TEXT_LLM },
  { value: 'IMAGE_MODEL', label: KIND_LABELS.IMAGE_MODEL },
  { value: 'BUSINESS_MODEL', label: KIND_LABELS.BUSINESS_MODEL },
];

const PROVIDER_TYPE_FILTER_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'aggregator', label: 'Aggregator' },
  { value: 'local', label: 'Local' },
  { value: 'customer_managed', label: 'Customer Managed' },
];

const HEALTH_FILTER_OPTIONS = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'unhealthy', label: 'Unhealthy' },
  { value: 'unknown', label: 'Unknown' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const formatContextWindow = (tokens: number) => {
  if (!tokens) return '—';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return `${(tokens / 1_000).toFixed(0)}K`;
};

const formatLatency = (ms?: number) => {
  if (!ms) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

export const ModelCatalogTable: React.FC = () => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [kindTab, setKindTab] = useState<'all' | ModelKind>('all');
  const [editingModel, setEditingModel] = useState<RegistryModel | null>(null);
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<
    { id: string; column: string; value: string; label: string }[]
  >([]);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/llm/providers', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const providers: any[] = Array.isArray(data) ? data : [];
        const mapped: RegistryModel[] = providers.map((p) => ({
          id: String(p.id || ''),
          name: String(p.name || p.model_id || ''),
          provider: String(p.provider || ''),
          providerType: (p.provider_type as ProviderType) || 'direct',
          originVendor: String(p.origin_vendor || p.provider || ''),
          modelId: String(p.model_id || ''),
          kind: (p.kind as ModelKind) || 'TEXT_LLM',
          isActive: p.is_active === 1 || p.is_active === true,
          healthStatus: (p.health_status as HealthStatus) || 'unknown',
          lastHealthCheck: p.last_health_check || undefined,
          lastErrorCategory: (p.last_error_category as ErrorCategory) || undefined,
          lastErrorHttpStatus:
            typeof p.last_error_http_status === 'number'
              ? p.last_error_http_status
              : p.last_error_http_status
                ? Number(p.last_error_http_status)
                : undefined,
          lastErrorMessage: p.last_error_message || undefined,
          lastErrorAt: p.last_error_at || undefined,
          avgLatencyMs: Number(p.avg_latency_ms || 0) || undefined,
          costPer1k: Number(p.cost_per_1k || 0) || undefined,
          capabilities: {
            vision: !!p.vision,
            tools: !!p.tools,
            streaming: !!p.streaming,
            jsonMode: !!p.json_mode,
            contextWindow: Number(p.context_window || 0),
          },
          executionRegions: Array.isArray(p.execution_regions)
            ? p.execution_regions
            : typeof p.execution_regions === 'string'
              ? p.execution_regions.split(',').map((s: string) => s.trim())
              : [],
          allowedDataClasses: Array.isArray(p.allowed_data_classes) ? p.allowed_data_classes : [],
          createdAt: p.created_at || '',
          updatedAt: p.updated_at || '',
        }));
        setModels(mapped);
      } else {
        const err = await res.json().catch(() => ({}));
        const message = normalizeApiErrorMessage(err?.error || err, 'Failed to load providers');
        setLoadError(message);
        toast.error(message);
        setModels([]);
      }
      trackFunnelEvent('model_registry_viewed');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load providers');
      setLoadError(message);
      toast.error(message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (model: RegistryModel) => {
    if (loadError) {
      toast.error('Model catalog is unavailable');
      return;
    }
    const nextActive = !model.isActive;
    try {
      const res = await fetch(`/api/llm/providers/${encodeURIComponent(model.id)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Update failed');
      }
      toast.success(`${model.name} ${nextActive ? 'activated' : 'deactivated'}`);
      await loadModels();
    } catch (e: unknown) {
      toast.error(normalizeApiErrorMessage(e, 'Failed to update model'));
    }
  };

  const handleEdit = (model: RegistryModel) => {
    setEditingModel(model);
  };

  const handleTestConnection = async (model: RegistryModel) => {
    toast.loading(`Testing ${model.name}...`, { id: 'test-conn' });
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ providerId: model.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Connection failed');
      }
      toast.success(json?.message || `${model.name} connection OK`, { id: 'test-conn' });
    } catch (e: any) {
      toast.error(e?.message || 'Connection failed', { id: 'test-conn' });
    }
  };

  const handleDelete = async (model: RegistryModel) => {
    if (loadError) {
      toast.error('Model catalog is unavailable');
      return;
    }
    if (!confirm(`Delete ${model.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/llm/providers/${encodeURIComponent(model.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('Provider deleted');
      setPreviewId((prev) => (prev === model.id ? null : prev));
      await loadModels();
    } catch (e: unknown) {
      toast.error(normalizeApiErrorMessage(e, 'Failed to delete provider'));
    }
  };

  // ── Filtrowanie: chip Kind (Menu 3) + lupa (Menu 2) ───────────────────────
  // Kolumnowe filtry (Kind/Provider Type/Health/Status) sa aplikowane przez
  // StandardTable/FilterableTable automatycznie na polach wiersza.
  const filteredModels = useMemo(() => {
    let result = models;
    if (kindTab !== 'all') result = result.filter((m) => m.kind === kindTab);
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.modelId.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query) ||
          m.originVendor.toLowerCase().includes(query)
      );
    }
    return result;
  }, [models, kindTab, searchTerm]);

  const rows = useMemo<TableRow[]>(
    () =>
      filteredModels.map((m) => ({
        ...m,
        id: m.id,
        status: m.isActive ? 'active' : 'inactive',
      })),
    [filteredModels]
  );

  const previewModel = previewId ? (models.find((m) => m.id === previewId) ?? null) : null;

  const kindCounts = useMemo(
    () => ({
      TEXT_LLM: models.filter((m) => m.kind === 'TEXT_LLM').length,
      IMAGE_MODEL: models.filter((m) => m.kind === 'IMAGE_MODEL').length,
      BUSINESS_MODEL: models.filter((m) => m.kind === 'BUSINESS_MODEL').length,
    }),
    [models]
  );

  // ── Kolumny StandardTable ─────────────────────────────────────────────────
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: 'Name',
        sortable: true,
        render: (row: TableRow) => (
          <div>
            <div className="font-medium text-c-text text-sm">{row.name as string}</div>
            <div className="text-xs text-c-text-muted font-mono">{row.modelId as string}</div>
          </div>
        ),
      },
      {
        id: 'providerType',
        label: 'Provider',
        width: '150px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.originVendor || ''),
        filterable: true,
        filterOptions: PROVIDER_TYPE_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <div>
            <div className="text-sm text-c-text-secondary">{row.originVendor as string}</div>
            <ProviderTypeBadge type={row.providerType as ProviderType} />
          </div>
        ),
      },
      {
        id: 'kind',
        label: 'Kind',
        width: '140px',
        sortable: true,
        filterable: true,
        filterOptions: KIND_FILTER_OPTIONS,
        render: (row: TableRow) => <KindBadge kind={row.kind as ModelKind} />,
      },
      {
        id: 'status',
        label: 'Status',
        width: '100px',
        sortable: true,
        filterable: true,
        filterOptions: STATUS_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              row.status === 'active'
                ? 'bg-c-success/10 text-c-success'
                : 'bg-c-text-muted/10 text-c-text-secondary'
            }`}
          >
            {row.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        id: 'healthStatus',
        label: 'Health',
        width: '150px',
        sortable: true,
        filterable: true,
        filterOptions: HEALTH_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <div className="flex flex-col gap-1">
            <HealthBadge status={row.healthStatus as HealthStatus} />
            <ErrorCategoryBadge
              category={row.lastErrorCategory as ErrorCategory | undefined}
              httpStatus={row.lastErrorHttpStatus as number | undefined}
            />
          </div>
        ),
      },
      {
        id: 'capabilities',
        label: 'Capabilities',
        width: '140px',
        render: (row: TableRow) => {
          const caps = row.capabilities as RegistryModel['capabilities'];
          return (
            <div>
              <CapabilityIcons caps={caps} />
              {caps.contextWindow > 0 && (
                <div className="text-xs text-c-text-muted mt-0.5">
                  {formatContextWindow(caps.contextWindow)} ctx
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'executionRegions',
        label: 'Regions',
        width: '160px',
        render: (row: TableRow) => {
          const regions = (row.executionRegions as string[]) || [];
          return (
            <div className="flex flex-wrap gap-1">
              {regions.map((region) => (
                <span
                  key={region}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-c-surface-raised rounded text-xs text-c-text-secondary"
                >
                  <Globe size={10} />
                  {region}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: 'costPer1k',
        label: 'Cost/1k',
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">
            {row.costPer1k ? `$${(row.costPer1k as number).toFixed(4)}` : '—'}
          </span>
        ),
      },
      {
        id: 'avgLatencyMs',
        label: 'Latency',
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">
            {formatLatency(row.avgLatencyMs as number | undefined)}
          </span>
        ),
      },
    ],
    []
  );

  // ── Kebab — kontrakt 5 blokow (modul deklaruje TYLKO bloki 1-3) ──────────
  const rowMenu = useMemo(
    () =>
      (row: TableRow): StandardRowMenu => {
        const model = row as unknown as RegistryModel;
        return {
          primary: [
            { id: 'edit', label: 'Edit', icon: Edit, onClick: () => handleEdit(model) },
            {
              id: 'toggle-active',
              label: model.isActive ? 'Deactivate' : 'Activate',
              icon: model.isActive ? EyeOff : Eye,
              onClick: () => handleToggleActive(model),
            },
            {
              id: 'test-connection',
              label: 'Test Connection',
              icon: Wifi,
              onClick: () => handleTestConnection(model),
            },
          ],
          universalHandlers: {
            preview: () => {
              jedenPanel.otworz();
              setPreviewId(model.id);
            },
            edit: () => handleEdit(model),
          },
          destructive: { label: 'Delete', icon: Trash2, onClick: () => handleDelete(model) },
        };
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadError]
  );

  // ── Preview actions (StandardPreview) ────────────────────────────────────
  const previewActions: StandardPreviewActions | undefined = previewModel
    ? {
        // canon §7.3 — "Edit" usunięte z resolutions: dublowało onOpenFull
        // przekazywane do StandardPreview w tym samym renderze (header ma już Open/Edit).
        resolutions: [
          {
            id: 'toggle-active',
            variant: previewModel.isActive ? 'warning' : 'positive',
            label: previewModel.isActive ? 'Deactivate' : 'Activate',
            icon: previewModel.isActive ? EyeOff : Eye,
            onClick: () => handleToggleActive(previewModel),
          },
          {
            id: 'test-connection',
            variant: 'neutral',
            label: 'Test Connection',
            icon: Wifi,
            onClick: () => handleTestConnection(previewModel),
          },
          {
            id: 'delete',
            variant: 'destructive',
            label: 'Delete',
            icon: Trash2,
            onClick: () => handleDelete(previewModel),
          },
        ],
      }
    : undefined;

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState template="list" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-c-text flex items-center gap-2">
            <Database size={24} className="text-c-info" />
            {t('modelRegistry.catalog.title', 'Model Catalog')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'modelRegistry.catalog.description',
              'All registered text, image, and business models'
            )}
          </p>
        </div>
        <button
          onClick={loadModels}
          disabled={loading}
          className="p-2 text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loadError ? (
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-6">
          <DegradedState title="Model catalog unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              <div className="text-sm text-c-text-muted">Total</div>
              <div className="text-2xl font-bold text-c-text">{models.length}</div>
            </div>
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              <div className="text-sm text-c-text-muted">Active</div>
              <div className="text-2xl font-bold text-c-success">
                {models.filter((m) => m.isActive).length}
              </div>
            </div>
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              <div className="text-sm text-c-info">{KIND_LABELS.TEXT_LLM}</div>
              <div className="text-2xl font-bold text-c-text">{kindCounts.TEXT_LLM}</div>
            </div>
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              {/* kanon TRIADA pułapka #1: c-accent = crimson; spójne z badge purple. */}
              <div className="text-sm text-purple-600 dark:text-purple-400">{KIND_LABELS.IMAGE_MODEL}</div>
              <div className="text-2xl font-bold text-c-text">{kindCounts.IMAGE_MODEL}</div>
            </div>
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              <div className="text-sm text-c-warning">{KIND_LABELS.BUSINESS_MODEL}</div>
              <div className="text-2xl font-bold text-c-text">{kindCounts.BUSINESS_MODEL}</div>
            </div>
          </div>

          {/* MENU 2/3 — wylacznie przez fasade */}
          <StandardModuleBar
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            primaryCta={{
              label: t('modelRegistry.catalog.addModel', 'Add Model'),
              icon: Plus,
              onClick: () => {
                // Model catalog is backed by LLM providers. For full creation flow reuse the canonical LLM Management UI.
                setCurrentView(AppView.SUPERADMIN_LLM_MANAGEMENT);
                toast('Go to LLM Providers to add a model/provider');
              },
            }}
            chips={[
              { id: 'all', label: 'Wszystkie', count: models.length },
              { id: 'TEXT_LLM', label: KIND_LABELS.TEXT_LLM, count: kindCounts.TEXT_LLM },
              { id: 'IMAGE_MODEL', label: KIND_LABELS.IMAGE_MODEL, count: kindCounts.IMAGE_MODEL },
              {
                id: 'BUSINESS_MODEL',
                label: KIND_LABELS.BUSINESS_MODEL,
                count: kindCounts.BUSINESS_MODEL,
              },
            ]}
            activeChip={kindTab}
            onChipChange={(id) => setKindTab(id as typeof kindTab)}
            activeFilters={activeFilters}
            onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((f) => f.id !== id))}
            onClearFilters={() => setActiveFilters([])}
          />

          {/* TABELA + PREVIEW */}
          <div className="flex min-h-0 overflow-hidden -mx-6 -mb-6">
            <div className="flex-1 min-w-0 overflow-auto">
              <StandardTable
                columns={columns}
                data={rows}
                empty={{
                  icon: Database,
                  title: 'No models match your filters',
                  description: 'Try a different search term or clear the active filters.',
                }}
                selectedRowId={previewId}
                onRowClick={(row) => {
                  jedenPanel.otworz();
                  setPreviewId(String(row.id));
                }}
                onRowDoubleClick={(row) => handleEdit(row as unknown as RegistryModel)}
                rowMenu={rowMenu}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                persistKey="superadmin.modelCatalog"
              />
            </div>

            <JedenPrawyPanel rekord={previewModel ? (
                <StandardPreview
                  title={previewModel.name}
                  onClose={() => setPreviewId(null)}
                  onOpenFull={() => handleEdit(previewModel)}
                  meta={{
                    pills: [
                      { label: previewModel.kind, tone: 'neutral' },
                      { label: previewModel.providerType, tone: 'neutral' },
                      {
                        label: previewModel.isActive ? 'Active' : 'Inactive',
                        tone: previewModel.isActive ? 'success' : 'neutral',
                      },
                    ],
                    trailing: <HealthBadge status={previewModel.healthStatus} />,
                  }}
                  details={{
                    text: [
                      `Model ID: ${previewModel.modelId}`,
                      `Provider: ${previewModel.originVendor}`,
                      previewModel.costPer1k
                        ? `Cost/1k: $${previewModel.costPer1k.toFixed(4)}`
                        : '',
                      previewModel.avgLatencyMs
                        ? `Latency: ${formatLatency(previewModel.avgLatencyMs)}`
                        : '',
                      previewModel.capabilities.contextWindow
                        ? `Context window: ${formatContextWindow(previewModel.capabilities.contextWindow)}`
                        : '',
                      previewModel.executionRegions.length
                        ? `Regions: ${previewModel.executionRegions.join(', ')}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                    onCopy: () => {
                      void navigator.clipboard?.writeText(previewModel.modelId);
                    },
                  }}
                  actions={previewActions}
                />
            ) : null} />
          </div>

          {editingModel && (
            <EditModelModal
              model={editingModel}
              onClose={() => setEditingModel(null)}
              onSaved={() => {
                setEditingModel(null);
                loadModels();
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ModelCatalogTable;
