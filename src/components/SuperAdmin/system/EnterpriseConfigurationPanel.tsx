/**
 * EnterpriseConfigurationPanel - System Configuration Management
 *
 * Features:
 * - Configuration categories
 * - Key-value management with types
 * - Version history & rollback
 * - Environment sync (dev/staging/prod)
 * - Configuration validation
 */

import {
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { LoadingState } from '../../shared/states';

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'secret';
  category: string;
  description?: string;
  is_sensitive: boolean;
  is_locked?: boolean;
  environment?: string;
  updated_at: string;
  updated_by?: string;
}

interface ConfigVersion {
  id: string;
  config_key: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by: string;
  reason?: string;
}

type ConfigCreatePayload = Pick<
  ConfigItem,
  'key' | 'value' | 'type' | 'category' | 'description' | 'is_sensitive'
>;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'ai', label: 'AI & LLM', icon: '🤖' },
  { id: 'integrations', label: 'Integrations', icon: '🔗' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'limits', label: 'Limits & Quotas', icon: '📊' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
];

const ENVIRONMENTS = ['development', 'staging', 'production'];

const TYPE_ICONS = {
  string: '📝',
  number: '#️⃣',
  boolean: '✅',
  json: '{ }',
  secret: '🔐',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const toBool = (value: unknown) =>
  value === true || value === 'true' || value === 1 || value === '1';

const normalizeConfigType = (value: unknown): ConfigItem['type'] => {
  if (
    value === 'string' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'json' ||
    value === 'secret'
  ) {
    return value;
  }
  return 'string';
};

const normalizeConfigItem = (value: unknown): ConfigItem | null => {
  if (!isRecord(value)) return null;
  return {
    id: asText(value.id, ''),
    key: asText(value.key),
    value: asText(value.value, ''),
    type: normalizeConfigType(value.type),
    category: asText(value.category, 'general'),
    description:
      value.description === null || value.description === undefined
        ? undefined
        : String(value.description),
    is_sensitive: toBool(value.is_sensitive),
    is_locked: toBool(value.is_locked),
    environment:
      value.environment === null || value.environment === undefined
        ? undefined
        : String(value.environment),
    updated_at: asText(value.updated_at, ''),
    updated_by:
      value.updated_by === null || value.updated_by === undefined
        ? undefined
        : String(value.updated_by),
  };
};

const normalizeConfigs = (data: unknown): ConfigItem[] => {
  const candidate = Array.isArray(data)
    ? data
    : isRecord(data)
      ? data.configs || data.items || data.data
      : null;
  if (!Array.isArray(candidate)) {
    throw new Error('System configuration response was not a list');
  }
  return candidate.map(normalizeConfigItem).filter((config): config is ConfigItem => !!config);
};

const getCreatedConfigId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const config = isRecord(result.config) ? result.config : null;
  return String(
    result.id || config?.id || data?.id || (isRecord(data?.config) ? data.config.id : '') || ''
  );
};

const configMatchesCreate = (
  config: ConfigItem,
  expected: ConfigCreatePayload,
  expectedId: string
) =>
  config.id === expectedId &&
  config.key === expected.key &&
  config.value === expected.value &&
  config.category === expected.category &&
  config.is_sensitive === expected.is_sensitive;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const normalizeVersions = (data: unknown): ConfigVersion[] => {
  const candidate = Array.isArray(data)
    ? data
    : isRecord(data)
      ? data.versions || data.items || data.data
      : null;
  if (Array.isArray(candidate)) {
    return candidate.filter(isRecord).map((version) => ({
      id: asText(version.id, ''),
      config_key: asText(version.config_key, ''),
      old_value: asText(version.old_value, ''),
      new_value: asText(version.new_value, ''),
      changed_at: asText(version.changed_at, ''),
      changed_by: asText(version.changed_by),
      reason:
        version.reason === null || version.reason === undefined
          ? undefined
          : String(version.reason),
    }));
  }
  return [];
};

export const EnterpriseConfigurationPanel: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState('development');
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyConfig, setHistoryConfig] = useState<ConfigItem | null>(null);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'general',
    'security',
    'ai',
  ]);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRollback = async (version: ConfigVersion) => {
    if (!historyConfig) return;
    const reason = window.prompt('Rollback reason (optional):') || undefined;
    try {
      await Api.rollbackSystemConfig(historyConfig.id, version.id, reason);
      const refreshed = await fetchConfigs();
      if (
        !refreshed?.some(
          (config) => config.id === historyConfig.id && config.value === version.new_value
        )
      ) {
        throw new Error('Configuration rollback was not confirmed by the server');
      }
      const data = await Api.getSystemConfigVersions(historyConfig.id);
      setVersions(normalizeVersions(data));
      toast.success('Rollback completed');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to rollback configuration');
      setActionError(message);
      toast.error(message);
    }
  };

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await Api.getSystemConfigs(selectedEnvironment);
      const configsData = normalizeConfigs(data);
      setConfigs(configsData);
      return configsData;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to load system configuration');
      setLoadError(message);
      toast.error(message);
      setConfigs([]);
      setUnsavedChanges({});
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs, selectedEnvironment]);

  const handleSaveConfig = async (config: ConfigItem, newValue: string) => {
    setActionError(null);
    try {
      await Api.updateSystemConfig(config.id, { value: newValue });
      const refreshed = await fetchConfigs();
      if (!refreshed?.some((item) => item.id === config.id && item.value === newValue)) {
        throw new Error('Configuration update was not confirmed by the server');
      }
      setUnsavedChanges((prev) => {
        const next = { ...prev };
        delete next[config.id];
        return next;
      });
      setEditingConfig(null);
      toast.success(`Configuration "${config.key}" updated`);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to update configuration');
      setActionError(message);
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    setActionError(null);
    try {
      await Api.deleteSystemConfig(id);
      const refreshed = await fetchConfigs();
      if (!refreshed || refreshed.some((config) => config.id === id)) {
        throw new Error('Configuration deletion was not confirmed by the server');
      }
      toast.success('Configuration deleted');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete configuration');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleAddConfigSaved = async (expected: ConfigCreatePayload, createdId: string) => {
    setActionError(null);
    if (!createdId) {
      const message = 'Configuration creation response was incomplete';
      setActionError(message);
      throw new Error(message);
    }
    const refreshed = await fetchConfigs();
    if (!refreshed?.some((config) => configMatchesCreate(config, expected, createdId))) {
      const message = 'Configuration creation was not confirmed by the server';
      setActionError(message);
      throw new Error(message);
    }
    setShowAddModal(false);
  };

  const handleViewHistory = async (config: ConfigItem) => {
    setHistoryConfig(config);
    setShowHistoryModal(true);
    setHistoryLoadError(null);
    try {
      const data = await Api.getSystemConfigVersions(config.id);
      setVersions(normalizeVersions(data));
    } catch (error) {
      setHistoryLoadError(
        error instanceof Error ? error.message : 'Failed to load configuration version history'
      );
      setVersions([]);
    }
  };

  const handleExportConfig = () => {
    const exportData = configs
      .filter((c) => !c.is_sensitive)
      .reduce(
        (acc, c) => {
          acc[c.key] = c.value;
          return acc;
        },
        {} as Record<string, string>
      );
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${selectedEnvironment}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuration exported');
  };

  const toggleRevealSecret = (id: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredConfigs = configs.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedConfigs = filteredConfigs.reduce(
    (acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = [];
      }
      acc[config.category].push(config);
      return acc;
    },
    {} as Record<string, ConfigItem[]>
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">
            Configuration Management
          </h2>
          <p className="text-c-text-secondary text-sm">
            Manage system settings and environment configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportConfig}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 bg-c-surface hover:bg-c-surface-raised border border-c-border text-c-text-secondary rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Config
          </button>
        </div>
      </div>

      {/* Environment Selector */}
      <div className="flex items-center gap-2 p-2 bg-c-surface-raised rounded-xl border border-c-border w-fit">
        {ENVIRONMENTS.map((env) => (
          <button
            key={env}
            onClick={() => setSelectedEnvironment(env)}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedEnvironment === env
                ? env === 'production'
                  ? 'bg-c-danger/20 text-c-danger border border-c-danger/30'
                  : env === 'staging'
                    ? 'bg-c-warning/20 text-c-warning border border-c-warning/30'
                    : 'bg-c-success/20 text-c-success border border-c-success/30'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            {env.charAt(0).toUpperCase() + env.slice(1)}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-c-text-muted"
            size={16}
          />
          <input
            type="text"
            placeholder="Search configurations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!!loadError}
            className="w-full pl-10 pr-4 py-2 bg-c-surface border border-c-border rounded-lg text-c-text placeholder:text-c-text-muted"
          />
        </div>
        <div className="flex gap-1 p-1 bg-c-surface-raised rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              disabled={!!loadError}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-c-surface text-white'
                  : 'text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Config Stats */}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {loadError ? (
        <div className="rounded-xl border border-c-border bg-c-surface p-6">
          <DegradedState title="Configuration overview unavailable" description={loadError} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
            <div className="text-sm text-c-text-secondary">Total Configs</div>
            <div className="text-2xl font-bold text-c-text">
              {configs.length}
            </div>
          </div>
          <div className="p-4 bg-c-warning/10 rounded-xl border border-c-warning/30">
            <div className="text-sm text-c-text-secondary">Sensitive</div>
            <div className="text-2xl font-bold text-c-warning">
              {configs.filter((c) => c.is_sensitive).length}
            </div>
          </div>
          <div className="p-4 bg-c-accent-soft rounded-xl border border-c-accent/30">
            <div className="text-sm text-c-text-secondary">Categories</div>
            <div className="text-2xl font-bold text-c-accent">
              {new Set(configs.map((c) => c.category)).size}
            </div>
          </div>
          <div className="p-4 bg-c-accent-soft rounded-xl border border-c-accent/30">
            <div className="text-sm text-c-text-secondary">Unsaved Changes</div>
            <div className="text-2xl font-bold text-c-accent">
              {Object.keys(unsavedChanges).length}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState template="list" />
      ) : loadError ? (
        <div className="rounded-xl border border-c-border bg-c-surface p-6">
          <DegradedState title="System configuration unavailable" description={loadError} />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedConfigs).map(([category, items]) => {
            const catInfo = CATEGORIES.find((c) => c.id === category) || {
              icon: '📋',
              label: category,
            };
            const isExpanded = expandedCategories.includes(category);

            return (
              <div
                key={category}
                className="bg-c-surface-raised rounded-xl border border-c-border overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-c-surface-raised transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{catInfo.icon}</span>
                    <span className="font-medium text-c-text">
                      {catInfo.label}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded">
                      {items.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-c-text-secondary" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-c-text-secondary" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-c-border-subtle">
                    {items.map((config) => (
                      <ConfigRow
                        key={config.id}
                        config={config}
                        isRevealed={revealedSecrets.has(config.id)}
                        onToggleReveal={() => toggleRevealSecret(config.id)}
                        onEdit={() => setEditingConfig(config)}
                        onDelete={() => handleDeleteConfig(config.id)}
                        onHistory={() => handleViewHistory(config)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <ConfigEditModal
          config={editingConfig}
          onClose={() => setEditingConfig(null)}
          onSave={(newValue) => handleSaveConfig(editingConfig, newValue)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <ConfigAddModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddConfigSaved}
          categories={CATEGORIES.filter((c) => c.id !== 'all')}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && historyConfig && (
        <ConfigHistoryModal
          config={historyConfig}
          versions={versions}
          loadError={historyLoadError}
          onRollback={handleRollback}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryConfig(null);
            setHistoryLoadError(null);
            setVersions([]);
          }}
        />
      )}
    </div>
  );
};

// Config Row Component
const ConfigRow: React.FC<{
  config: ConfigItem;
  isRevealed: boolean;
  onToggleReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}> = ({ config, isRevealed, onToggleReveal, onEdit, onDelete, onHistory }) => {
  const displayValue = config.is_sensitive && !isRevealed ? '••••••••••••••••' : config.value;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-c-surface-raised transition-colors border-b border-c-border-subtle last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm text-c-accent font-mono">
            {config.key}
          </code>
          <span className="text-xs text-c-text-muted">
            {TYPE_ICONS[config.type]}
          </span>
          {config.is_sensitive && <Lock className="w-3 h-3 text-c-warning" />}
          {config.is_locked && <Lock className="w-3 h-3 text-c-text-muted" />}
        </div>
        {config.description && (
          <p className="text-xs text-c-text-muted mt-1">{config.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <code
            className={`text-sm ${
              config.type === 'boolean'
                ? config.value === 'true'
                  ? 'text-c-success'
                  : 'text-c-danger'
                : 'text-c-text-secondary'
            } font-mono truncate max-w-md`}
          >
            {displayValue}
          </code>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {config.is_sensitive && (
          <button
            onClick={onToggleReveal}
            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
            title={isRevealed ? 'Hide' : 'Reveal'}
          >
            {isRevealed ? (
              <EyeOff className="w-4 h-4 text-c-text-secondary" />
            ) : (
              <Eye className="w-4 h-4 text-c-text-secondary" />
            )}
          </button>
        )}
        <button
          onClick={onHistory}
          className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
          title="History"
        >
          <History className="w-4 h-4 text-c-text-secondary" />
        </button>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
          title="Edit"
          disabled={config.is_locked}
        >
          <Edit className="w-4 h-4 text-c-text-secondary" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-c-danger/20 rounded-lg transition-colors"
          title="Delete"
          disabled={config.is_locked}
        >
          <Trash2 className="w-4 h-4 text-c-danger" />
        </button>
      </div>
    </div>
  );
};

// Edit Modal
const ConfigEditModal: React.FC<{
  config: ConfigItem;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}> = ({ config, onClose, onSave }) => {
  const [value, setValue] = useState(config.value);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(value);
    } catch (error) {
      setSaveError(normalizeApiErrorMessage(error, 'Failed to update configuration'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
      <div className="bg-c-surface rounded-xl border border-c-border p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-c-text">Edit Configuration</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface-raised rounded-lg"
          >
            <X className="w-5 h-5 text-c-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div
              role="alert"
              className="rounded-lg border border-c-danger/30 bg-c-danger/5 p-3 text-sm text-c-danger"
            >
              {saveError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Key
            </label>
            <code className="block w-full px-3 py-2 bg-c-surface-raised text-c-info rounded-lg font-mono">
              {config.key}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Value ({config.type})
            </label>
            {config.type === 'boolean' ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : config.type === 'json' ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text font-mono text-sm"
              />
            ) : (
              <input
                type={
                  config.type === 'secret'
                    ? 'password'
                    : config.type === 'number'
                      ? 'number'
                      : 'text'
                }
                value={value}
                aria-label="Configuration Value"
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              />
            )}
          </div>

          {config.description && (
            <div className="p-3 bg-c-surface-raised rounded-lg">
              <p className="text-sm text-c-text-secondary">{config.description}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-c-text-secondary hover:text-c-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Modal
const ConfigAddModal: React.FC<{
  onClose: () => void;
  onSave: (expected: ConfigCreatePayload, createdId: string) => Promise<void>;
  categories: { id: string; label: string }[];
}> = ({ onClose, onSave, categories }) => {
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'string' as ConfigItem['type'],
    category: 'general',
    description: '',
    is_sensitive: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const result = await Api.createSystemConfig({
        key: formData.key,
        value: formData.value,
        description: formData.description || undefined,
        category: formData.category || undefined,
        is_sensitive: !!formData.is_sensitive,
      });
      await onSave(formData, getCreatedConfigId(result));
      toast.success('Configuration created');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to create configuration');
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
      <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-white/10 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-c-text-secondary dark:text-white">Add Configuration</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface dark:hover:bg-c-surface/40 rounded-lg"
          >
            <X className="w-5 h-5 text-c-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-3 text-sm text-danger-600 dark:text-danger-300"
            >
              {saveError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Key *
            </label>
            <input
              type="text"
              required
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white font-mono"
              placeholder="my_config_key"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as ConfigItem['type'] })
                }
                className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
                <option value="secret">Secret</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Value *
            </label>
            {formData.type === 'boolean' ? (
              <select
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white"
              >
                <option value="">Select...</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                type={formData.type === 'number' ? 'number' : 'text'}
                required
                value={formData.value}
                aria-label="Configuration Value"
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface/30 border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text-secondary dark:text-white"
              placeholder="Optional description"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_sensitive}
              onChange={(e) => setFormData({ ...formData, is_sensitive: e.target.checked })}
              className="rounded border-c-border-subtle bg-c-surface text-c-accent dark:text-c-accent"
            />
            <span className="text-sm text-c-text-secondary">
              Sensitive value (will be masked)
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-c-text-secondary hover:text-c-text-secondary dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// History Modal
const ConfigHistoryModal: React.FC<{
  config: ConfigItem;
  versions: ConfigVersion[];
  loadError?: string | null;
  onRollback: (version: ConfigVersion) => void;
  onClose: () => void;
}> = ({ config, versions, loadError, onRollback, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
    <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-white/10 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-c-text-secondary dark:text-white">Version History</h3>
          <code className="text-sm text-c-accent dark:text-c-accent">{config.key}</code>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-c-surface dark:hover:bg-c-surface/40 rounded-lg"
        >
          <X className="w-5 h-5 text-c-text-secondary" />
        </button>
      </div>

      {loadError ? (
        <DegradedState title="Version history unavailable" description={loadError} />
      ) : versions.length === 0 ? (
        <div className="text-center py-8 text-c-text-secondary">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No version history available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className="p-4 bg-c-surface/30 rounded-lg border border-c-border-subtle dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                      index === 0
                        ? 'bg-c-accent/10 text-c-accent dark:text-c-accent'
                        : 'bg-c-surface  text-c-text-secondary '
                    }`}
                  >
                    {versions.length - index}
                  </span>
                  <span className="text-sm text-c-text-secondary">
                    {version.changed_by}
                  </span>
                </div>
                <span className="text-xs text-c-text-muted">
                  {formatDateTime(version.changed_at)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-c-text-muted text-xs">Previous:</span>
                  <code className="block mt-1 text-danger-400 bg-danger-500/10 px-2 py-1 rounded">
                    {version.old_value}
                  </code>
                </div>
                <div>
                  <span className="text-c-text-muted text-xs">New:</span>
                  <code className="block mt-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    {version.new_value}
                  </code>
                </div>
              </div>
              {version.reason && (
                <p className="text-xs text-c-text-muted mt-2">
                  Reason: {version.reason}
                </p>
              )}
              {index > 0 && (
                <button
                  onClick={() => onRollback(version)}
                  className="mt-2 text-xs text-c-accent dark:text-c-accent hover:text-c-accent dark:hover:text-c-accent flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Rollback to this version
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default EnterpriseConfigurationPanel;
