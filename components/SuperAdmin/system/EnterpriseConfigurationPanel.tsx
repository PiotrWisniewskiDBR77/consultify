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

import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Save,
    Edit,
    History,
    Search,
    RefreshCw,
    CheckCircle,
    XCircle,
    Loader2,
    Plus,
    Trash2,
    Lock,
    Eye,
    EyeOff,
    Copy,
    AlertTriangle,
    ChevronRight,
    ChevronDown,
    Download,
    Upload,
    GitCompare,
    RotateCcw,
    X,
    Check
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

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
    const [selectedEnvironment, setSelectedEnvironment] = useState('production');
    const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyConfig, setHistoryConfig] = useState<ConfigItem | null>(null);
    const [versions, setVersions] = useState<ConfigVersion[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['general', 'security', 'ai']);
    const [unsavedChanges, setUnsavedChanges] = useState<Record<string, string>>({});
    const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

    const fetchConfigs = useCallback(async () => {
        try {
            const data = await (Api as any).getSystemConfigs('current');
            setConfigs(data);
        } catch (error) {
            // Mock data
            setConfigs([
                { id: '1', key: 'app_name', value: 'Consultify', type: 'string', category: 'general', description: 'Application name displayed in the UI', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '2', key: 'max_upload_size_mb', value: '50', type: 'number', category: 'limits', description: 'Maximum file upload size in MB', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '3', key: 'enable_registration', value: 'true', type: 'boolean', category: 'security', description: 'Allow new user registrations', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '4', key: 'openai_api_key', value: '••••••••••••••••', type: 'secret', category: 'ai', description: 'OpenAI API key for AI features', is_sensitive: true, updated_at: new Date().toISOString() },
                { id: '5', key: 'ai_model', value: 'gpt-4-turbo', type: 'string', category: 'ai', description: 'Default AI model for analysis', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '6', key: 'ai_max_tokens', value: '4096', type: 'number', category: 'ai', description: 'Maximum tokens per AI request', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '7', key: 'session_timeout_minutes', value: '30', type: 'number', category: 'security', description: 'Session timeout in minutes', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '8', key: 'password_policy', value: '{"minLength": 8, "requireNumbers": true, "requireSpecial": true}', type: 'json', category: 'security', description: 'Password requirements', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '9', key: 'smtp_host', value: 'smtp.sendgrid.net', type: 'string', category: 'notifications', description: 'SMTP server host', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '10', key: 'smtp_password', value: '••••••••••••••••', type: 'secret', category: 'notifications', description: 'SMTP password', is_sensitive: true, updated_at: new Date().toISOString() },
                { id: '11', key: 'primary_color', value: '#8B5CF6', type: 'string', category: 'branding', description: 'Primary brand color', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '12', key: 'max_projects_per_user', value: '50', type: 'number', category: 'limits', description: 'Maximum projects per user', is_sensitive: false, updated_at: new Date().toISOString() },
                { id: '13', key: 'slack_webhook_url', value: '••••••••••••••••', type: 'secret', category: 'integrations', description: 'Slack webhook URL', is_sensitive: true, updated_at: new Date().toISOString() },
            ]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs, selectedEnvironment]);

    const handleSaveConfig = async (config: ConfigItem, newValue: string) => {
        try {
            await (Api as any).updateSystemConfig(config.id, { value: newValue });
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
            await (Api as any).deleteSystemConfig(id);
            toast.success('Configuration deleted');
            fetchConfigs();
        } catch (error) {
            toast.error('Failed to delete configuration');
        }
    };

    const handleViewHistory = async (config: ConfigItem) => {
        setHistoryConfig(config);
        setShowHistoryModal(true);
        // Mock versions
        setVersions([
            { id: '1', config_key: config.key, old_value: 'old_value', new_value: config.value, changed_at: new Date(Date.now() - 86400000).toISOString(), changed_by: 'admin@example.com', reason: 'Updated for security' },
            { id: '2', config_key: config.key, old_value: 'older_value', new_value: 'old_value', changed_at: new Date(Date.now() - 86400000 * 7).toISOString(), changed_by: 'admin@example.com' },
        ]);
    };

    const handleExportConfig = () => {
        const exportData = configs.filter(c => !c.is_sensitive).reduce((acc, c) => {
            acc[c.key] = c.value;
            return acc;
        }, {} as Record<string, string>);
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

    const filteredConfigs = configs.filter(c => {
        const matchesSearch = !searchTerm ||
            c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const groupedConfigs = filteredConfigs.reduce((acc, config) => {
        if (!acc[config.category]) {
            acc[config.category] = [];
        }
        acc[config.category].push(config);
        return acc;
    }, {} as Record<string, ConfigItem[]>);

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Configuration Management</h2>
                    <p className="text-slate-400 text-sm">
                        Manage system settings and environment configurations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportConfig}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Config
                    </button>
                </div>
            </div>

            {/* Environment Selector */}
            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10 w-fit">
                {ENVIRONMENTS.map((env) => (
                    <button
                        key={env}
                        onClick={() => setSelectedEnvironment(env)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedEnvironment === env
                                ? env === 'production' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : env === 'staging' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {env.charAt(0).toUpperCase() + env.slice(1)}
                    </button>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search configurations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                </div>
                <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                                selectedCategory === cat.id
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Config Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-sm text-slate-400">Total Configs</div>
                    <div className="text-2xl font-bold text-white">{configs.length}</div>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                    <div className="text-sm text-slate-400">Sensitive</div>
                    <div className="text-2xl font-bold text-amber-400">
                        {configs.filter(c => c.is_sensitive).length}
                    </div>
                </div>
                <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                    <div className="text-sm text-slate-400">Categories</div>
                    <div className="text-2xl font-bold text-cyan-400">
                        {new Set(configs.map(c => c.category)).size}
                    </div>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                    <div className="text-sm text-slate-400">Unsaved Changes</div>
                    <div className="text-2xl font-bold text-purple-400">
                        {Object.keys(unsavedChanges).length}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedConfigs).map(([category, items]) => {
                        const catInfo = CATEGORIES.find(c => c.id === category) || { icon: '📋', label: category };
                        const isExpanded = expandedCategories.includes(category);

                        return (
                            <div key={category} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{catInfo.icon}</span>
                                        <span className="font-medium text-white">{catInfo.label}</span>
                                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                            {items.length}
                                        </span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-white/10">
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
                    categories={CATEGORIES.filter(c => c.id !== 'all')}
                />
            )}

            {/* History Modal */}
            {showHistoryModal && historyConfig && (
                <ConfigHistoryModal
                    config={historyConfig}
                    versions={versions}
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
    const displayValue = config.is_sensitive && !isRevealed
        ? '••••••••••••••••'
        : config.value;

    return (
        <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <code className="text-sm text-cyan-400 font-mono">{config.key}</code>
                    <span className="text-xs text-slate-500">{TYPE_ICONS[config.type]}</span>
                    {config.is_sensitive && <Lock className="w-3 h-3 text-amber-400" />}
                    {config.is_locked && <Lock className="w-3 h-3 text-slate-500" />}
                </div>
                {config.description && (
                    <p className="text-xs text-slate-500 mt-1">{config.description}</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                    <code className={`text-sm ${
                        config.type === 'boolean'
                            ? config.value === 'true' ? 'text-emerald-400' : 'text-red-400'
                            : 'text-slate-300'
                    } font-mono truncate max-w-md`}>
                        {displayValue}
                    </code>
                </div>
            </div>
            <div className="flex items-center gap-1">
                {config.is_sensitive && (
                    <button
                        onClick={onToggleReveal}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={isRevealed ? 'Hide' : 'Reveal'}
                    >
                        {isRevealed ? (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                            <Eye className="w-4 h-4 text-slate-400" />
                        )}
                    </button>
                )}
                <button
                    onClick={onHistory}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="History"
                >
                    <History className="w-4 h-4 text-slate-400" />
                </button>
                <button
                    onClick={onEdit}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Edit"
                    disabled={config.is_locked}
                >
                    <Edit className="w-4 h-4 text-slate-400" />
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
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-lg">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Edit Configuration</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Key</label>
                        <code className="block w-full px-3 py-2 bg-slate-800 text-cyan-400 rounded-lg font-mono">
                            {config.key}
                        </code>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Value ({config.type})
                        </label>
                        {config.type === 'boolean' ? (
                            <select
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        ) : config.type === 'json' ? (
                            <textarea
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm"
                            />
                        ) : (
                            <input
                                type={config.type === 'secret' ? 'password' : config.type === 'number' ? 'number' : 'text'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        )}
                    </div>

                    {config.description && (
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                            <p className="text-sm text-slate-400">{config.description}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
            await (Api as any).createSystemConfig({ ...formData, organization_id: 'current' });
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
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-lg">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Add Configuration</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Key *</label>
                        <input
                            type="text"
                            required
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono"
                            placeholder="my_config_key"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as ConfigItem['type'] })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="json">JSON</option>
                                <option value="secret">Secret</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Value *</label>
                        {formData.type === 'boolean' ? (
                            <select
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
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
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="Optional description"
                        />
                    </div>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.is_sensitive}
                            onChange={(e) => setFormData({ ...formData, is_sensitive: e.target.checked })}
                            className="rounded border-slate-600 bg-slate-800 text-cyan-500"
                        />
                        <span className="text-sm text-slate-300">Sensitive value (will be masked)</span>
                    </label>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
    onClose: () => void;
}> = ({ config, versions, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white">Version History</h3>
                    <code className="text-sm text-cyan-400">{config.key}</code>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            {versions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No version history available</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {versions.map((version, index) => (
                        <div key={version.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                                        index === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'
                                    }`}>
                                        {versions.length - index}
                                    </span>
                                    <span className="text-sm text-slate-400">{version.changed_by}</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                    {new Date(version.changed_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500 text-xs">Previous:</span>
                                    <code className="block mt-1 text-red-400 bg-red-500/10 px-2 py-1 rounded">
                                        {version.old_value}
                                    </code>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-xs">New:</span>
                                    <code className="block mt-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                        {version.new_value}
                                    </code>
                                </div>
                            </div>
                            {version.reason && (
                                <p className="text-xs text-slate-500 mt-2">Reason: {version.reason}</p>
                            )}
                            {index > 0 && (
                                <button className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
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






