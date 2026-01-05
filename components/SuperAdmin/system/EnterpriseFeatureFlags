/**
 * EnterpriseFeatureFlags - Advanced Feature Flag Management
 *
 * Features:
 * - Boolean, percentage rollout, and targeting rules
 * - A/B testing with variants
 * - User targeting by segments
 * - Environment management
 * - Audit history
 * - Real-time evaluation preview
 */

import {
    Beaker,
    Building,
    Check,
    ChevronDown,
    ChevronRight,
    Code,
    Copy,
    Edit,
    Eye,
    Filter,
    Flag,
    Globe,
    Hash,
    History,
    Loader2,
    Mail,
    Percent,
    Plus,
    RefreshCw,
    Search,
    Settings,
    Target,
    ToggleLeft,
    ToggleRight,
    Trash2,
    User,
    Users,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface FeatureFlag {
    id: string;
    flag_key: string;
    name: string;
    description?: string;
    enabled: boolean;
    flag_type: 'boolean' | 'percentage' | 'targeting' | 'ab_test';
    targeting_rules: TargetingRule[];
    rollout_percentage: number;
    environment: string;
    organization_id?: string;
    variants?: Variant[];
    created_at: string;
    updated_at: string;
}

interface TargetingRule {
    id: string;
    type: 'email_domain' | 'org_id' | 'user_id' | 'role' | 'percentage' | 'attribute';
    attribute?: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'gt' | 'lt';
    values: string[];
    enabled: boolean;
}

interface Variant {
    id: string;
    name: string;
    weight: number;
    value: any;
}

interface FlagHistory {
    id: string;
    change_type: string;
    old_value: any;
    new_value: any;
    changed_by: string;
    changed_at: string;
}

const FLAG_TYPE_CONFIG = {
    boolean: { icon: ToggleRight, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Boolean' },
    percentage: { icon: Percent, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Percentage' },
    targeting: { icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Targeting' },
    ab_test: { icon: Beaker, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'A/B Test' },
};

const ENVIRONMENTS = ['development', 'staging', 'production'];

export const EnterpriseFeatureFlags: React.FC = () => {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
    const [selectedFlagHistory, setSelectedFlagHistory] = useState<string | null>(null);
    const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
    const [testContext, setTestContext] = useState({ userId: '', email: '', orgId: '', role: '' });

    const fetchFlags = useCallback(async () => {
        setLoading(true);
        try {
            const filters: any = {};
            if (filterEnvironment !== 'all') {
                filters.environment = filterEnvironment;
            }
            const data = await Api.getFeatureFlags(filters);
            setFlags(data);
        } catch (error) {
            console.error('Failed to fetch feature flags:', error);
            toast.error('Failed to load feature flags');
        } finally {
            setLoading(false);
        }
    }, [filterEnvironment]);

    useEffect(() => {
        fetchFlags();
    }, [fetchFlags]);

    const handleToggle = async (flag: FeatureFlag) => {
        try {
            await Api.toggleFeatureFlag(flag.id, !flag.enabled);
            toast.success(`Feature flag ${!flag.enabled ? 'enabled' : 'disabled'}`);
            fetchFlags();
        } catch (error) {
            toast.error('Failed to toggle feature flag');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this feature flag?')) return;

        try {
            await Api.deleteFeatureFlag(id);
            toast.success('Feature flag deleted');
            fetchFlags();
        } catch (error) {
            toast.error('Failed to delete feature flag');
        }
    };

    const handleCopyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        toast.success('Flag key copied');
    };

    const evaluateFlag = (flag: FeatureFlag): { enabled: boolean; variant?: string; reason: string } => {
        if (!flag.enabled) {
            return { enabled: false, reason: 'Flag is disabled globally' };
        }

        if (flag.flag_type === 'boolean') {
            return { enabled: true, reason: 'Boolean flag enabled' };
        }

        if (flag.flag_type === 'percentage') {
            // Simple hash-based percentage
            if (testContext.userId) {
                const hash = hashCode(testContext.userId + flag.flag_key);
                const bucket = Math.abs(hash % 100);
                if (bucket < flag.rollout_percentage) {
                    return { enabled: true, reason: `User in rollout (${bucket}% < ${flag.rollout_percentage}%)` };
                }
                return { enabled: false, reason: `User not in rollout (${bucket}% >= ${flag.rollout_percentage}%)` };
            }
            return { enabled: false, reason: 'No user context for percentage evaluation' };
        }

        if (flag.flag_type === 'targeting') {
            for (const rule of flag.targeting_rules || []) {
                if (!rule.enabled) continue;
                if (evaluateRule(rule, testContext)) {
                    return { enabled: true, reason: `Matched rule: ${rule.type}` };
                }
            }
            return { enabled: false, reason: 'No targeting rules matched' };
        }

        if (flag.flag_type === 'ab_test' && flag.variants) {
            if (testContext.userId) {
                const hash = hashCode(testContext.userId + flag.flag_key);
                const totalWeight = flag.variants.reduce((acc, v) => acc + v.weight, 0);
                let bucket = Math.abs(hash % totalWeight);
                for (const variant of flag.variants) {
                    bucket -= variant.weight;
                    if (bucket < 0) {
                        return { enabled: true, variant: variant.name, reason: `A/B test variant: ${variant.name}` };
                    }
                }
            }
            return { enabled: false, reason: 'No user context for A/B evaluation' };
        }

        return { enabled: false, reason: 'Unknown flag type' };
    };

    const evaluateRule = (rule: TargetingRule, context: typeof testContext): boolean => {
        let value = '';
        switch (rule.type) {
            case 'email_domain':
                value = context.email.split('@')[1] || '';
                break;
            case 'org_id':
                value = context.orgId;
                break;
            case 'user_id':
                value = context.userId;
                break;
            case 'role':
                value = context.role;
                break;
            default:
                return false;
        }

        switch (rule.operator) {
            case 'equals':
                return rule.values.includes(value);
            case 'in':
                return rule.values.includes(value);
            case 'not_in':
                return !rule.values.includes(value);
            case 'contains':
                return rule.values.some((v) => value.includes(v));
            case 'starts_with':
                return rule.values.some((v) => value.startsWith(v));
            case 'ends_with':
                return rule.values.some((v) => value.endsWith(v));
            default:
                return false;
        }
    };

    const hashCode = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return hash;
    };

    const filteredFlags = flags.filter((flag) => {
        const matchesSearch =
            !searchTerm ||
            flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            flag.flag_key.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || flag.flag_type === filterType;
        return matchesSearch && matchesType;
    });

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Feature Flags</h2>
                    <p className="text-slate-400 text-sm">
                        Control feature availability with targeting, A/B testing, and percentage rollouts
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={16} />
                    Create Flag
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-sm text-slate-400">Total Flags</div>
                    <div className="text-2xl font-bold text-white">{flags.length}</div>
                </div>
                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                    <div className="text-sm text-slate-400">Enabled</div>
                    <div className="text-2xl font-bold text-emerald-400">{flags.filter((f) => f.enabled).length}</div>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                    <div className="text-sm text-slate-400">Rollouts</div>
                    <div className="text-2xl font-bold text-blue-400">
                        {flags.filter((f) => f.flag_type === 'percentage').length}
                    </div>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                    <div className="text-sm text-slate-400">A/B Tests</div>
                    <div className="text-2xl font-bold text-amber-400">
                        {flags.filter((f) => f.flag_type === 'ab_test').length}
                    </div>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                    <div className="text-sm text-slate-400">Production</div>
                    <div className="text-2xl font-bold text-purple-400">
                        {flags.filter((f) => f.environment === 'production' && f.enabled).length}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-64 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search flags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <select
                    value={filterEnvironment}
                    onChange={(e) => setFilterEnvironment(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All Environments</option>
                    {ENVIRONMENTS.map((env) => (
                        <option key={env} value={env}>
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                        </option>
                    ))}
                </select>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All Types</option>
                    {Object.entries(FLAG_TYPE_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                            {config.label}
                        </option>
                    ))}
                </select>
                <button
                    onClick={fetchFlags}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg"
                >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Test Context Panel */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Test Evaluation Context</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">User ID</label>
                        <input
                            type="text"
                            value={testContext.userId}
                            onChange={(e) => setTestContext({ ...testContext, userId: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-white/10 rounded text-sm text-white"
                            placeholder="user-123"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Email</label>
                        <input
                            type="text"
                            value={testContext.email}
                            onChange={(e) => setTestContext({ ...testContext, email: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-white/10 rounded text-sm text-white"
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Organization ID</label>
                        <input
                            type="text"
                            value={testContext.orgId}
                            onChange={(e) => setTestContext({ ...testContext, orgId: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-white/10 rounded text-sm text-white"
                            placeholder="org-abc"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Role</label>
                        <input
                            type="text"
                            value={testContext.role}
                            onChange={(e) => setTestContext({ ...testContext, role: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-white/10 rounded text-sm text-white"
                            placeholder="admin"
                        />
                    </div>
                </div>
            </div>

            {/* Flags List */}
            <div className="space-y-2">
                {filteredFlags.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Flag size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No feature flags found</p>
                    </div>
                ) : (
                    filteredFlags.map((flag) => {
                        const typeConfig = FLAG_TYPE_CONFIG[flag.flag_type];
                        const TypeIcon = typeConfig.icon;
                        const isExpanded = expandedFlag === flag.id;
                        const evaluation = evaluateFlag(flag);

                        return (
                            <div
                                key={flag.id}
                                className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
                            >
                                <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                                                <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-white font-medium">{flag.name}</h3>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyKey(flag.flag_key);
                                                        }}
                                                        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded hover:bg-slate-700"
                                                    >
                                                        <Code className="w-3 h-3" />
                                                        {flag.flag_key}
                                                    </button>
                                                    <span
                                                        className={`px-2 py-0.5 text-xs rounded ${typeConfig.bg} ${typeConfig.color}`}
                                                    >
                                                        {typeConfig.label}
                                                    </span>
                                                    <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                                        {flag.environment}
                                                    </span>
                                                </div>
                                                {flag.description && (
                                                    <p className="text-sm text-slate-500">{flag.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Evaluation Preview */}
                                            <div
                                                className={`px-3 py-1 text-xs rounded-full ${
                                                    evaluation.enabled
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}
                                            >
                                                {evaluation.enabled ? evaluation.variant || 'ON' : 'OFF'}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggle(flag);
                                                }}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    flag.enabled
                                                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                }`}
                                            >
                                                {flag.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFlag(flag);
                                                    setShowCreateModal(true);
                                                }}
                                                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFlagHistory(flag.id);
                                                }}
                                                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                                            >
                                                <History size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(flag.id);
                                                }}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-white/5">
                                        <div className="pt-4 space-y-4">
                                            {/* Evaluation Reason */}
                                            <div className="p-3 bg-slate-800/50 rounded-lg">
                                                <div className="text-xs text-slate-500 mb-1">Evaluation Reason</div>
                                                <div className="text-sm text-slate-300">{evaluation.reason}</div>
                                            </div>

                                            {/* Percentage Rollout */}
                                            {flag.flag_type === 'percentage' && (
                                                <div>
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="text-slate-400">Rollout Progress</span>
                                                        <span className="text-white">{flag.rollout_percentage}%</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                                                            style={{ width: `${flag.rollout_percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Targeting Rules */}
                                            {flag.flag_type === 'targeting' && flag.targeting_rules?.length > 0 && (
                                                <div>
                                                    <div className="text-sm text-slate-400 mb-2">Targeting Rules</div>
                                                    <div className="space-y-2">
                                                        {flag.targeting_rules.map((rule, i) => (
                                                            <div
                                                                key={rule.id || i}
                                                                className={`p-2 rounded-lg ${
                                                                    rule.enabled
                                                                        ? 'bg-purple-500/10 border border-purple-500/30'
                                                                        : 'bg-slate-800/50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span
                                                                        className={
                                                                            rule.enabled
                                                                                ? 'text-purple-400'
                                                                                : 'text-slate-500'
                                                                        }
                                                                    >
                                                                        {rule.type}
                                                                    </span>
                                                                    <span className="text-slate-500">
                                                                        {rule.operator}
                                                                    </span>
                                                                    <code className="text-xs bg-slate-800 px-1 rounded text-slate-300">
                                                                        {rule.values.join(', ')}
                                                                    </code>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* A/B Test Variants */}
                                            {flag.flag_type === 'ab_test' && flag.variants && (
                                                <div>
                                                    <div className="text-sm text-slate-400 mb-2">Variants</div>
                                                    <div className="space-y-2">
                                                        {flag.variants.map((variant) => (
                                                            <div
                                                                key={variant.id}
                                                                className={`p-3 rounded-lg ${
                                                                    evaluation.variant === variant.name
                                                                        ? 'bg-amber-500/20 border border-amber-500/30'
                                                                        : 'bg-slate-800/50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span
                                                                        className={`font-medium ${
                                                                            evaluation.variant === variant.name
                                                                                ? 'text-amber-400'
                                                                                : 'text-white'
                                                                        }`}
                                                                    >
                                                                        {variant.name}
                                                                    </span>
                                                                    <span className="text-sm text-slate-400">
                                                                        {variant.weight}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metadata */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                <div>
                                                    <span className="text-slate-500">Created</span>
                                                    <div className="text-slate-300">
                                                        {new Date(flag.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Updated</span>
                                                    <div className="text-slate-300">
                                                        {new Date(flag.updated_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                {flag.organization_id && (
                                                    <div>
                                                        <span className="text-slate-500">Org-specific</span>
                                                        <div className="text-slate-300">
                                                            {flag.organization_id.slice(0, 8)}...
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <FeatureFlagModal
                    flag={editingFlag}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingFlag(null);
                    }}
                    onSave={() => {
                        fetchFlags();
                        setShowCreateModal(false);
                        setEditingFlag(null);
                    }}
                />
            )}

            {/* History Modal */}
            {selectedFlagHistory && (
                <FlagHistoryModal flagId={selectedFlagHistory} onClose={() => setSelectedFlagHistory(null)} />
            )}
        </div>
    );
};

// Feature Flag Modal Component
const FeatureFlagModal: React.FC<{
    flag?: FeatureFlag | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ flag, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        flag_key: flag?.flag_key || '',
        name: flag?.name || '',
        description: flag?.description || '',
        enabled: flag?.enabled || false,
        flag_type: flag?.flag_type || 'boolean',
        rollout_percentage: flag?.rollout_percentage || 0,
        environment: flag?.environment || 'production',
        targeting_rules: flag?.targeting_rules || [],
        variants: flag?.variants || [
            { id: '1', name: 'control', weight: 50, value: null },
            { id: '2', name: 'variant_a', weight: 50, value: null },
        ],
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (flag) {
                await Api.updateFeatureFlag(flag.id, formData);
                toast.success('Feature flag updated');
            } else {
                await Api.createFeatureFlag(formData);
                toast.success('Feature flag created');
            }
            onSave();
        } catch (error) {
            toast.error('Failed to save feature flag');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {flag ? 'Edit Feature Flag' : 'Create Feature Flag'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Flag Key *</label>
                            <input
                                type="text"
                                required
                                value={formData.flag_key}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        flag_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                                    })
                                }
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                                placeholder="new_feature"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Type *</label>
                            <select
                                value={formData.flag_type}
                                onChange={(e) => setFormData({ ...formData, flag_type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                {Object.entries(FLAG_TYPE_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>
                                        {config.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Environment *</label>
                            <select
                                value={formData.environment}
                                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                {ENVIRONMENTS.map((env) => (
                                    <option key={env} value={env}>
                                        {env.charAt(0).toUpperCase() + env.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {formData.flag_type === 'percentage' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Rollout Percentage: {formData.rollout_percentage}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={formData.rollout_percentage}
                                onChange={(e) =>
                                    setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })
                                }
                                className="w-full"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="enabled"
                            checked={formData.enabled}
                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            className="w-4 h-4 text-purple-600 bg-white/5 border-white/10 rounded"
                        />
                        <label htmlFor="enabled" className="text-sm text-slate-300">
                            Enable flag immediately
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            {flag ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Flag History Modal Component
const FlagHistoryModal: React.FC<{
    flagId: string;
    onClose: () => void;
}> = ({ flagId, onClose }) => {
    const [history, setHistory] = useState<FlagHistory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const data = await Api.getFeatureFlagHistory(flagId);
                setHistory(data);
            } catch (error) {
                toast.error('Failed to load flag history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [flagId]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Feature Flag History</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">No history available</p>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-white">{item.change_type}</span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(item.changed_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {item.changed_by && (
                                        <p className="text-xs text-slate-400">Changed by: {item.changed_by}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnterpriseFeatureFlags;




