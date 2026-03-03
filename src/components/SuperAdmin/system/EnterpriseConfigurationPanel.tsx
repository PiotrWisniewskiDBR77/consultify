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
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit,
  Eye,
  EyeOff,
  GitCompare,
  History,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

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

export const EnterpriseConfigurationPanel: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState('development');
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyConfig, setHistoryConfig] = useState<ConfigItem | null>(null);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'general',
    'security',
    'ai',
  ]);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const handleRollback = async (version: ConfigVersion) => {
    if (!historyConfig) return;
    const reason = window.prompt('Rollback reason (optional):') || undefined;
    try {
      await Api.rollbackSystemConfig(historyConfig.id, version.id, reason);
      toast.success('Rollback completed');
      // Refresh both the configs list and the versions list
      await Promise.allSettled([fetchConfigs(), (async () => {
        const data = await Api.getSystemConfigVersions(historyConfig.id);
        setVersions((data as any)?.versions || []);
      })()]);
    } catch (e) {
      console.error('Rollback failed:', e);
      toast.error('Failed to rollback configuration');
    }
  };

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Api.getSystemConfigs(selectedEnvironment);
      setConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[Config] Failed to fetch from API:', error);
      toast.error('Failed to load system configuration');
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs, selectedEnvironment]);

  const handleSaveConfig = async (config: ConfigItem, newValue: string) => {
    try {
      await Api.updateSystemConfig(config.id, { value: newValue });
      toast.success(`Configuration "${config.key}" updated`);
      setUnsavedChanges((prev) => {
        const next = { ...prev };
        delete next[config.id];
        return next;
      });
      fetchConfigs();
      setEditingConfig(null);
    } catch (error) {
      toast.error('Failed to update configuration');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    try {
      await Api.deleteSystemConfig(id);
      toast.success('Configuration deleted');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to delete configuration');
    }
  };

  const handleViewHistory = async (config: ConfigItem) => {
    setHistoryConfig(config);
    setShowHistoryModal(true);
    try {
      const data = await Api.getSystemConfigVersions(config.id);
      setVersions((data as any)?.versions || []);
    } catch (error) {
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Configuration Management
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Manage system settings and environment configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportConfig}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-navy-950/20 hover:bg-slate-50 dark:hover:bg-navy-800/40 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Config
          </button>
        </div>
      </div>

      {/* Environment Selector */}
      <div className="flex items-center gap-2 p-2 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 w-fit">
        {ENVIRONMENTS.map((env) => (
          <button
            key={env}
            onClick={() => setSelectedEnvironment(env)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedEnvironment === env
                ? env === 'production'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : env === 'staging'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20'
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
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search configurations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-1 p-1 bg-slate-50 dark:bg-white/5 rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/20'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Config Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Configs</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{configs.length}</div>
        </div>
        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
          <div className="text-sm text-slate-600 dark:text-slate-400">Sensitive</div>
          <div className="text-2xl font-bold text-amber-400">
            {configs.filter((c) => c.is_sensitive).length}
          </div>
        </div>
        <div className="p-4 bg-primary-600/10 rounded-xl border border-primary-500/30">
          <div className="text-sm text-slate-600 dark:text-slate-400">Categories</div>
          <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
            {new Set(configs.map((c) => c.category)).size}
          </div>
        </div>
        <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
          <div className="text-sm text-slate-600 dark:text-slate-400">Unsaved Changes</div>
          <div className="text-2xl font-bold text-purple-400">
            {Object.keys(unsavedChanges).length}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
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
                className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{catInfo.icon}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {catInfo.label}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                      {items.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-white/10">
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
          onSave={() => {
            fetchConfigs();
            setShowAddModal(false);
          }}
          categories={CATEGORIES.filter((c) => c.id !== 'all')}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && historyConfig && (
        <ConfigHistoryModal
          config={historyConfig}
          versions={versions}
          onRollback={handleRollback}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryConfig(null);
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
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors border-b border-slate-200 dark:border-white/5 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm text-primary-600 dark:text-primary-400 font-mono">{config.key}</code>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {TYPE_ICONS[config.type]}
          </span>
          {config.is_sensitive && <Lock className="w-3 h-3 text-amber-400" />}
          {config.is_locked && <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
        </div>
        {config.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{config.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <code
            className={`text-sm ${
              config.type === 'boolean'
                ? config.value === 'true'
                  ? 'text-emerald-400'
                  : 'text-red-400'
                : 'text-slate-700 dark:text-slate-300'
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
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
            title={isRevealed ? 'Hide' : 'Reveal'}
          >
            {isRevealed ? (
              <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            ) : (
              <Eye className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            )}
          </button>
        )}
        <button
          onClick={onHistory}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          title="History"
        >
          <History className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </button>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          title="Edit"
          disabled={config.is_locked}
        >
          <Edit className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
          title="Delete"
          disabled={config.is_locked}
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
};

// Edit Modal
const ConfigEditModal: React.FC<{
  config: ConfigItem;
  onClose: () => void;
  onSave: (value: string) => void;
}> = ({ config, onClose, onSave }) => {
  const [value, setValue] = useState(config.value);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(value);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Configuration</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Key
            </label>
            <code className="block w-full px-3 py-2 bg-slate-200 dark:bg-slate-800 text-cyan-400 rounded-lg font-mono">
              {config.key}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Value ({config.type})
            </label>
            {config.type === 'boolean' ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : config.type === 'json' ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
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
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              />
            )}
          </div>

          {config.description && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
              <p className="text-sm text-slate-400 dark:text-slate-500">{config.description}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
  onSave: () => void;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Api.createSystemConfig({
        key: formData.key,
        value: formData.value,
        description: formData.description || undefined,
        category: formData.category || undefined,
        is_sensitive: !!formData.is_sensitive,
      });
      toast.success('Configuration created');
      onSave();
    } catch (error) {
      toast.error('Failed to create configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Configuration</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Key *
            </label>
            <input
              type="text"
              required
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-mono"
              placeholder="my_config_key"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as ConfigItem['type'] })
                }
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
                <option value="secret">Secret</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Value *
            </label>
            {formData.type === 'boolean' ? (
              <select
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
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
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
              placeholder="Optional description"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_sensitive}
              onChange={(e) => setFormData({ ...formData, is_sensitive: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Sensitive value (will be masked)
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
  onRollback: (version: ConfigVersion) => void;
  onClose: () => void;
}> = ({ config, versions, onRollback, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Version History</h3>
          <code className="text-sm text-primary-600 dark:text-primary-400">{config.key}</code>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
        >
          <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No version history available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-lg border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                      index === 0
                        ? 'bg-primary-600/10 text-primary-700 dark:text-primary-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {versions.length - index}
                  </span>
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    {version.changed_by}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(version.changed_at).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Previous:</span>
                  <code className="block mt-1 text-red-400 bg-red-500/10 px-2 py-1 rounded">
                    {version.old_value}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">New:</span>
                  <code className="block mt-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    {version.new_value}
                  </code>
                </div>
              </div>
              {version.reason && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Reason: {version.reason}
                </p>
              )}
              {index > 0 && (
                <button
                  onClick={() => onRollback(version)}
                  className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
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
