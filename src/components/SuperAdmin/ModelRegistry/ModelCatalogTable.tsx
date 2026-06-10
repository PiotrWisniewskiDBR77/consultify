import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Database,
  Edit,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Trash2,
  Wifi,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import { useAppStore } from '../../../store/useAppStore';
import { AppView } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import type {
  DataClass,
  ErrorCategory,
  HealthStatus,
  ModelKind,
  ProviderType,
  RegistryModel,
} from './types';
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
      ? 'bg-amber-500/10 text-amber-400'
      : category === 'auth' || category === 'missing_key'
        ? 'bg-rose-500/10 text-rose-400'
        : category === 'rate_limit'
          ? 'bg-yellow-500/10 text-yellow-400'
          : 'bg-slate-500/10 text-slate-600';
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
      {kind}
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
        <span title="Vision" className="p-1 rounded bg-blue-500/10 text-blue-400">
          <Eye size={12} />
        </span>
      )}
      {caps.tools && (
        <span title="Tools" className="p-1 rounded bg-amber-500/10 text-amber-400">
          <Wrench size={12} />
        </span>
      )}
      {caps.streaming && (
        <span title="Streaming" className="p-1 rounded bg-emerald-500/10 text-emerald-400">
          <Wifi size={12} />
        </span>
      )}
      {caps.jsonMode && (
        <span title="JSON mode" className="p-1 rounded bg-primary-500/10 text-primary-400">
          <Server size={12} />
        </span>
      )}
    </div>
  );
}

interface ActionsMenuProps {
  model: RegistryModel;
  disabled?: boolean;
  onToggleActive: (model: RegistryModel) => void;
  onEdit: (model: RegistryModel) => void;
  onTestConnection: (model: RegistryModel) => void;
  onDelete: (model: RegistryModel) => void;
}

function ActionsMenu({
  model,
  disabled = false,
  onToggleActive,
  onEdit,
  onTestConnection,
  onDelete,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-label={`Actions for ${model.name}`}
        title={disabled ? 'Model catalog is unavailable' : undefined}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
      >
        <MoreVertical size={16} className="text-slate-600" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-20 py-1">
          <button
            onClick={() => {
              onEdit(model);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
          >
            <Edit size={14} /> Edit
          </button>
          <button
            onClick={() => {
              onToggleActive(model);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
          >
            {model.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
            {model.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => {
              onTestConnection(model);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
          >
            <Wifi size={14} /> Test Connection
          </button>
          <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
          <button
            onClick={() => {
              onDelete(model);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
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
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Model</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Update provider configuration for {model.name}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Provider
              </label>
              <input
                type="text"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Model ID
              </label>
              <input
                type="text"
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tier
              </label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
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
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-indigo-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              placeholder="Optional description..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Edit size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export const ModelCatalogTable: React.FC = () => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKind, setFilterKind] = useState<ModelKind | ''>('');
  const [filterProviderType, setFilterProviderType] = useState<ProviderType | ''>('');
  const [filterHealth, setFilterHealth] = useState<HealthStatus | ''>('');
  const [filterActive, setFilterActive] = useState<'' | 'active' | 'inactive'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingModel, setEditingModel] = useState<RegistryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      await loadModels();
    } catch (e: unknown) {
      toast.error(normalizeApiErrorMessage(e, 'Failed to delete provider'));
    }
  };

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch =
        !searchTerm ||
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.modelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.originVendor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesKind = !filterKind || m.kind === filterKind;
      const matchesProviderType = !filterProviderType || m.providerType === filterProviderType;
      const matchesHealth = !filterHealth || m.healthStatus === filterHealth;
      const matchesActive =
        !filterActive ||
        (filterActive === 'active' && m.isActive) ||
        (filterActive === 'inactive' && !m.isActive);
      return matchesSearch && matchesKind && matchesProviderType && matchesHealth && matchesActive;
    });
  }, [models, searchTerm, filterKind, filterProviderType, filterHealth, filterActive]);

  const formatContextWindow = (tokens: number) => {
    if (!tokens) return '—';
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    return `${(tokens / 1_000).toFixed(0)}K`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={24} className="text-indigo-500" />
            {t('modelRegistry.catalog.title', 'Model Catalog')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'modelRegistry.catalog.description',
              'All registered models across TEXT_LLM, IMAGE_MODEL, and BUSINESS_MODEL kinds'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadModels}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => {
              // Model catalog is backed by LLM providers. For full creation flow reuse the canonical LLM Management UI.
              setCurrentView(AppView.SUPERADMIN_LLM_MANAGEMENT);
              toast('Go to LLM Providers to add a model/provider');
            }}
            disabled={!!loadError}
            title={loadError || undefined}
            className="flex items-center gap-2 px-4 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {t('modelRegistry.catalog.addModel', 'Add Model')}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="Model catalog unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">Total</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">Active</div>
              <div className="text-2xl font-bold text-emerald-500">
                {models.filter((m) => m.isActive).length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="text-sm text-blue-400">TEXT_LLM</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.filter((m) => m.kind === 'TEXT_LLM').length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="text-sm text-primary-400">IMAGE_MODEL</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.filter((m) => m.kind === 'IMAGE_MODEL').length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="text-sm text-amber-400">BUSINESS_MODEL</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.filter((m) => m.kind === 'BUSINESS_MODEL').length}
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t(
                  'modelRegistry.catalog.searchPlaceholder',
                  'Search by name, model ID, provider...'
                )}
                disabled={!!loadError}
                className="w-full pl-10 pr-4 h-9 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400"
              />
            </div>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as ModelKind | '')}
              disabled={!!loadError}
              className="h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
            >
              <option value="">All Kinds</option>
              <option value="TEXT_LLM">TEXT_LLM</option>
              <option value="IMAGE_MODEL">IMAGE_MODEL</option>
              <option value="BUSINESS_MODEL">BUSINESS_MODEL</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              disabled={!!loadError}
              className={`flex items-center gap-2 px-3 h-9 border rounded-lg text-sm transition-colors ${
                showFilters
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Provider Type
                </label>
                <select
                  value={filterProviderType}
                  onChange={(e) => setFilterProviderType(e.target.value as ProviderType | '')}
                  className="w-full h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                >
                  <option value="">All</option>
                  <option value="direct">Direct</option>
                  <option value="aggregator">Aggregator</option>
                  <option value="local">Local</option>
                  <option value="customer_managed">Customer Managed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Health Status
                </label>
                <select
                  value={filterHealth}
                  onChange={(e) => setFilterHealth(e.target.value as HealthStatus | '')}
                  className="w-full h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                >
                  <option value="">All</option>
                  <option value="healthy">Healthy</option>
                  <option value="degraded">Degraded</option>
                  <option value="unhealthy">Unhealthy</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as '' | 'active' | 'inactive')}
                  className="w-full h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Provider
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Kind
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Health
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Capabilities
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Regions
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Cost/1k
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Latency
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                  {filteredModels.map((model) => (
                    <tr
                      key={model.id}
                      className={`hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors ${
                        !model.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white text-sm">
                            {model.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {model.modelId}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm text-slate-700 dark:text-slate-300">
                            {model.originVendor}
                          </div>
                          <ProviderTypeBadge type={model.providerType} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <KindBadge kind={model.kind} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            model.isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-slate-500/10 text-slate-500'
                          }`}
                        >
                          {model.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <HealthBadge status={model.healthStatus} />
                          <ErrorCategoryBadge
                            category={model.lastErrorCategory}
                            httpStatus={model.lastErrorHttpStatus}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CapabilityIcons caps={model.capabilities} />
                        {model.capabilities.contextWindow > 0 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatContextWindow(model.capabilities.contextWindow)} ctx
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {model.executionRegions.map((region) => (
                            <span
                              key={region}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 rounded text-xs text-slate-600 dark:text-slate-400"
                            >
                              <Globe size={10} />
                              {region}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {model.costPer1k ? `$${model.costPer1k.toFixed(4)}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {model.avgLatencyMs
                            ? model.avgLatencyMs < 1000
                              ? `${model.avgLatencyMs}ms`
                              : `${(model.avgLatencyMs / 1000).toFixed(1)}s`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionsMenu
                          model={model}
                          disabled={!!loadError}
                          onToggleActive={handleToggleActive}
                          onEdit={handleEdit}
                          onTestConnection={handleTestConnection}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredModels.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                      >
                        <Database size={32} className="mx-auto mb-3 opacity-40" />
                        <p>No models match your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
