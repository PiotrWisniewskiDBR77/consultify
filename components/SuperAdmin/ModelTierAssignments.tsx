/**
 * ModelTierAssignments - SuperAdmin UI for Model-to-Tier Configuration
 * 
 * Features:
 * - Assign models to multiple tiers (many-to-many)
 * - Drag & drop priority ordering within tiers
 * - Visual representation of tier hierarchy
 * - Real-time health status display
 */

import React, { useState, useEffect } from 'react';
import {
    Layers,
    Server,
    Plus,
    Trash2,
    GripVertical,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Save,
    ChevronDown,
    ChevronUp,
    Zap,
    Crown,
    Sparkles,
    Brain
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface LLMProvider {
    id: string;
    name: string;
    provider: string;
    model_id: string;
    is_active: boolean;
    health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

interface TierAssignment {
    id: string;
    tier: string;
    priority: number;
    is_active: boolean;
    provider_id: string;
    name: string;
    provider: string;
    model_id: string;
    health_status: string;
}

interface TierData {
    [tier: string]: TierAssignment[];
}

const TIER_CONFIG = {
    BUDGET: {
        icon: Zap,
        color: 'emerald',
        description: 'Fast, cost-effective models for simple tasks',
        bgClass: 'bg-emerald-500/10 border-emerald-500/30',
        textClass: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/20 text-emerald-300'
    },
    STANDARD: {
        icon: Server,
        color: 'blue',
        description: 'Balanced performance for most use cases',
        bgClass: 'bg-blue-500/10 border-blue-500/30',
        textClass: 'text-blue-400',
        badgeClass: 'bg-blue-500/20 text-blue-300'
    },
    PREMIUM: {
        icon: Crown,
        color: 'violet',
        description: 'High-quality output for complex tasks',
        bgClass: 'bg-violet-500/10 border-violet-500/30',
        textClass: 'text-violet-400',
        badgeClass: 'bg-violet-500/20 text-violet-300'
    },
    REASONING: {
        icon: Brain,
        color: 'amber',
        description: 'Advanced reasoning for deep analysis',
        bgClass: 'bg-amber-500/10 border-amber-500/30',
        textClass: 'text-amber-400',
        badgeClass: 'bg-amber-500/20 text-amber-300'
    }
};

export const ModelTierAssignments: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [assignments, setAssignments] = useState<TierData>({});
    const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING']));
    const [hasChanges, setHasChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<{
        additions: { providerId: string; tier: string; priority: number }[];
        deletions: { providerId: string; tier: string }[];
        priorityUpdates: { providerId: string; tier: string; priority: number }[];
    }>({ additions: [], deletions: [], priorityUpdates: [] });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [assignmentsRes, providersRes] = await Promise.all([
                fetch('/api/llm/tiers/assignments', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
                fetch('/api/llm/providers', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
            ]);

            if (assignmentsRes.ok) {
                const data = await assignmentsRes.json();
                setAssignments(data.assignments || {});
            }

            if (providersRes.ok) {
                const data = await providersRes.json();
                setProviders(data.filter((p: LLMProvider) => p.is_active));
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            toast.error('Failed to load tier assignments');
        } finally {
            setLoading(false);
        }
    };

    const getUnassignedProviders = (tier: string) => {
        const assignedIds = new Set((assignments[tier] || []).map(a => a.provider_id));
        return providers.filter(p => !assignedIds.has(p.id));
    };

    const handleAddToTier = async (providerId: string, tier: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        const currentAssignments = assignments[tier] || [];
        const newPriority = currentAssignments.length;

        // Optimistic update
        const newAssignment: TierAssignment = {
            id: `${providerId}-${tier}`,
            tier,
            priority: newPriority,
            is_active: true,
            provider_id: providerId,
            name: provider.name,
            provider: provider.provider,
            model_id: provider.model_id,
            health_status: provider.health_status || 'unknown'
        };

        setAssignments(prev => ({
            ...prev,
            [tier]: [...(prev[tier] || []), newAssignment]
        }));

        // Save immediately
        try {
            const res = await fetch('/api/llm/tiers/assign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ providerId, tier, priority: newPriority })
            });

            if (!res.ok) throw new Error('Failed to assign');
            toast.success(`Added ${provider.name} to ${tier}`);
        } catch (err) {
            // Revert optimistic update
            setAssignments(prev => ({
                ...prev,
                [tier]: (prev[tier] || []).filter(a => a.provider_id !== providerId)
            }));
            toast.error('Failed to add model to tier');
        }
    };

    const handleRemoveFromTier = async (providerId: string, tier: string) => {
        const assignment = (assignments[tier] || []).find(a => a.provider_id === providerId);
        if (!assignment) return;

        // Optimistic update
        setAssignments(prev => ({
            ...prev,
            [tier]: (prev[tier] || []).filter(a => a.provider_id !== providerId)
        }));

        try {
            const res = await fetch('/api/llm/tiers/assign', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ providerId, tier })
            });

            if (!res.ok) throw new Error('Failed to remove');
            toast.success(`Removed ${assignment.name} from ${tier}`);
        } catch (err) {
            // Revert
            setAssignments(prev => ({
                ...prev,
                [tier]: [...(prev[tier] || []), assignment]
            }));
            toast.error('Failed to remove model from tier');
        }
    };

    const handleReorder = async (tier: string, newOrder: TierAssignment[]) => {
        // Update local state immediately
        setAssignments(prev => ({
            ...prev,
            [tier]: newOrder.map((item, idx) => ({ ...item, priority: idx }))
        }));

        // Save priority changes
        try {
            for (let i = 0; i < newOrder.length; i++) {
                await fetch('/api/llm/tiers/priority', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        providerId: newOrder[i].provider_id,
                        tier,
                        priority: i
                    })
                });
            }
        } catch (err) {
            toast.error('Failed to update priorities');
        }
    };

    const toggleTier = (tier: string) => {
        setExpandedTiers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tier)) {
                newSet.delete(tier);
            } else {
                newSet.add(tier);
            }
            return newSet;
        });
    };

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={14} className="text-emerald-400" />;
            case 'degraded': return <AlertTriangle size={14} className="text-amber-400" />;
            case 'unhealthy': return <XCircle size={14} className="text-red-400" />;
            default: return <Server size={14} className="text-slate-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw size={32} className="animate-spin text-violet-400" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10">
                            <Layers size={24} className="text-violet-400" />
                        </div>
                        Model Tier Assignments
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Assign models to performance tiers. Models can belong to multiple tiers.
                        Drag to reorder priority within each tier.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Sparkles size={20} className="text-blue-400 mt-0.5" />
                    <div>
                        <h4 className="text-blue-300 font-medium">How It Works</h4>
                        <p className="text-sm text-slate-400 mt-1">
                            When a user selects a tier, the system automatically picks the best available model 
                            using round-robin selection. If all models in a tier fail, the system falls back 
                            to lower tiers automatically.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tier Sections */}
            <div className="space-y-4">
                {Object.entries(TIER_CONFIG).map(([tier, config]) => {
                    const TierIcon = config.icon;
                    const tierAssignments = assignments[tier] || [];
                    const isExpanded = expandedTiers.has(tier);
                    const unassignedProviders = getUnassignedProviders(tier);

                    return (
                        <div 
                            key={tier}
                            className={`rounded-2xl border ${config.bgClass} overflow-hidden`}
                        >
                            {/* Tier Header */}
                            <button
                                onClick={() => toggleTier(tier)}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${config.badgeClass}`}>
                                        <TierIcon size={20} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className={`font-semibold ${config.textClass}`}>{tier}</h3>
                                        <p className="text-sm text-slate-400">{config.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-sm ${config.badgeClass}`}>
                                        {tierAssignments.length} models
                                    </span>
                                    {isExpanded ? (
                                        <ChevronUp size={20} className="text-slate-400" />
                                    ) : (
                                        <ChevronDown size={20} className="text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {/* Tier Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-white/10"
                                    >
                                        <div className="p-4 space-y-3">
                                            {/* Assigned Models (Reorderable) */}
                                            {tierAssignments.length > 0 ? (
                                                <Reorder.Group
                                                    axis="y"
                                                    values={tierAssignments}
                                                    onReorder={(newOrder) => handleReorder(tier, newOrder)}
                                                    className="space-y-2"
                                                >
                                                    {tierAssignments.map((assignment, index) => (
                                                        <Reorder.Item
                                                            key={assignment.id}
                                                            value={assignment}
                                                            className="flex items-center gap-3 px-4 py-3 bg-navy-800/50 border border-white/10 rounded-xl cursor-grab active:cursor-grabbing"
                                                        >
                                                            <GripVertical size={16} className="text-slate-500" />
                                                            <span className="text-xs font-mono text-slate-500 w-6">
                                                                #{index + 1}
                                                            </span>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white font-medium">
                                                                        {assignment.name}
                                                                    </span>
                                                                    {getHealthIcon(assignment.health_status)}
                                                                </div>
                                                                <span className="text-xs text-slate-500">
                                                                    {assignment.provider} • {assignment.model_id}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveFromTier(assignment.provider_id, tier);
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </Reorder.Item>
                                                    ))}
                                                </Reorder.Group>
                                            ) : (
                                                <div className="text-center py-6 text-slate-500">
                                                    No models assigned to this tier
                                                </div>
                                            )}

                                            {/* Add Model Dropdown */}
                                            {unassignedProviders.length > 0 && (
                                                <div className="pt-2">
                                                    <select
                                                        value=""
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleAddToTier(e.target.value, tier);
                                                            }
                                                        }}
                                                        className="w-full px-4 py-3 bg-navy-900/30 border border-dashed border-white/20 rounded-xl text-slate-400 text-sm cursor-pointer hover:border-white/30 transition-colors"
                                                    >
                                                        <option value="">+ Add model to {tier}</option>
                                                        {unassignedProviders.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} ({p.provider} - {p.model_id})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Available Providers Reference */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Server size={20} className="text-slate-400" />
                    Available Providers ({providers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {providers.map(p => {
                        const assignedTiers = Object.entries(assignments)
                            .filter(([, items]) => items.some(a => a.provider_id === p.id))
                            .map(([tier]) => tier);

                        return (
                            <div 
                                key={p.id}
                                className="flex items-center justify-between p-3 bg-navy-900/30 rounded-lg border border-white/5"
                            >
                                <div className="flex items-center gap-2">
                                    {getHealthIcon(p.health_status)}
                                    <div>
                                        <div className="text-sm text-white">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.model_id}</div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {assignedTiers.map(tier => (
                                        <span 
                                            key={tier}
                                            className={`px-2 py-0.5 rounded text-xs ${TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.badgeClass || 'bg-slate-500/20 text-slate-300'}`}
                                        >
                                            {tier.charAt(0)}
                                        </span>
                                    ))}
                                    {assignedTiers.length === 0 && (
                                        <span className="text-xs text-slate-500">Not assigned</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ModelTierAssignments;






