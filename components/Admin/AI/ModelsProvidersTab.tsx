/**
 * ModelsProvidersTab - AI Models & Providers Management
 * 
 * Tab 1 of the reorganized AI & Intelligence section
 * Unified view: Provider Status Grid + Single Table with Tier Assignments
 * 
 * v2.0 - Removed Fallback Chains, integrated tier assignments directly
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Server, 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    RefreshCw, 
    Wifi, 
    Eye, 
    EyeOff, 
    Check,
    Star,
    Clock,
    Zap,
    Crown,
    Brain,
    Info,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Api } from '../../../services/api';
import { LLMProvider } from '../../../types';

interface ProviderStatus {
    id: string;
    provider: string;
    name: string;
    model: string;
    endpoint: string;
    isConfigured: boolean;
    isActive: boolean;
    isDefault: boolean;
    tier: string;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastHealthCheck: string | null;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsTools: boolean;
    priority: number;
    costPer1k: number;
}

interface HealthSummary {
    total: number;
    configured: number;
    active: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
}

interface LLMStatus {
    success: boolean;
    timestamp: string;
    providers: ProviderStatus[];
    defaultProvider: { provider: string; model: string; name: string } | null;
    fallbackChains: Record<string, string[]>;
    circuitBreakers: Record<string, { state: string; failures: number; lastFailure?: number; lastSuccess?: number }>;
    summary: HealthSummary;
    startupValidation: {
        timestamp: string;
        duration: number;
        healthy: number;
        criticalErrors: string[];
    } | null;
}

interface AvailableModels {
    [tier: string]: {
        id: string;
        name: string;
        provider: string;
        model_id: string;
        health_status: string;
    }[];
}

interface ModelsProvidersTabProps {
    organizationId?: string;
}

const TIER_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    BUDGET: { icon: Zap, color: 'emerald', label: 'Budget' },
    STANDARD: { icon: Server, color: 'blue', label: 'Standard' },
    PREMIUM: { icon: Crown, color: 'violet', label: 'Premium' },
    REASONING: { icon: Brain, color: 'amber', label: 'Reasoning' }
};

export const ModelsProvidersTab: React.FC<ModelsProvidersTabProps> = ({ organizationId }) => {
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
    const [availableModels, setAvailableModels] = useState<AvailableModels>({});
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [refreshingHealth, setRefreshingHealth] = useState(false);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [savingProvider, setSavingProvider] = useState<string | null>(null);
    const [showTierPreview, setShowTierPreview] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(organizationId || null);

    // Fetch organization ID from /api/auth/me if not provided
    useEffect(() => {
        if (!organizationId) {
            const fetchOrgId = async () => {
                try {
                    const res = await fetch('/api/auth/me', {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        // API returns { user: { organizationId: "..." } }
                        const fetchedOrgId = data.user?.organizationId || data.user?.organization_id || data.organizationId;
                        if (fetchedOrgId) {
                            setOrgId(fetchedOrgId);
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch organization ID:', e);
                }
            };
            fetchOrgId();
        }
    }, [organizationId]);

    useEffect(() => {
        loadProviders();
        loadLLMStatus();
        if (orgId) {
            loadAvailableModels();
        }
    }, [orgId]);

    const loadProviders = async () => {
        try {
            const data = await Api.getLLMProviders(true);
            setProviders(data);
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load providers');
            setLoading(false);
        }
    };

    const loadLLMStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const response = await fetch('/api/llm/status', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (data.success) {
                setLLMStatus(data);
            }
        } catch (e) {
            console.error('Failed to load LLM status:', e);
        }
        setLoadingStatus(false);
    }, []);

    const loadAvailableModels = async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/llm/org/${orgId}/available-models`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableModels(data.tiers || {});
            }
        } catch (e) {
            console.error('Failed to load available models:', e);
        }
    };

    const refreshAllHealth = async () => {
        setRefreshingHealth(true);
        try {
            const response = await fetch('/api/llm/status/refresh', { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`Health check complete: ${data.summary?.healthy || 0} healthy providers`);
                await loadLLMStatus();
            } else {
                toast.error(data.error || 'Health check failed');
            }
        } catch (e) {
            toast.error('Failed to refresh health');
        }
        setRefreshingHealth(false);
    };

    const testSingleProvider = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const response = await fetch(`/api/llm/status/test/${provider}`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (data.success && data.reachable) {
                toast.success(`${provider} is healthy (${data.latency}ms)`);
            } else {
                toast.error(`${provider}: ${data.error || 'Connection failed'}`);
            }
            await loadLLMStatus();
        } catch (e) {
            toast.error(`Test failed for ${provider}`);
        }
        setTestingProvider(null);
    };

    const toggleOrgAccess = async (providerId: string, currentStatus: boolean) => {
        if (!orgId) return;
        
        setSavingProvider(providerId);
        
        // Optimistic update
        setProviders(prev => prev.map(p => 
            p.id === providerId ? { ...p, is_enabled_for_org: !currentStatus } : p
        ));

        try {
            const res = await fetch(`/api/llm/org/${orgId}/providers/${providerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ isEnabled: !currentStatus })
            });

            if (!res.ok) throw new Error('Failed to update');
            
            toast.success(!currentStatus ? 'Provider enabled' : 'Provider disabled');
            await loadAvailableModels();
        } catch (e) {
            // Revert on error
            setProviders(prev => prev.map(p => 
                p.id === providerId ? { ...p, is_enabled_for_org: currentStatus } : p
            ));
            toast.error('Failed to update provider');
        }
        setSavingProvider(null);
    };

    // Get tiers for a provider - check by provider ID or name
    const getProviderTiers = (provider: LLMProvider): string[] => {
        const tiers: string[] = [];
        for (const [tier, models] of Object.entries(availableModels)) {
            if (models.some(m => 
                m.id === provider.id || 
                m.provider === provider.provider ||
                m.model_id === provider.model_id
            )) {
                tiers.push(tier);
            }
        }
        return tiers;
    };

    // Find provider status
    const getProviderStatusInfo = (provider: LLMProvider) => {
        return llmStatus?.providers.find(p => p.id === provider.id || p.provider === provider.provider);
    };

    const getHealthIcon = (status: string | undefined) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={14} className="text-emerald-400" />;
            case 'degraded': return <AlertTriangle size={14} className="text-amber-400" />;
            case 'unhealthy': return <XCircle size={14} className="text-red-400" />;
            default: return <Server size={14} className="text-slate-400" />;
        }
    };

    const getHealthBadge = (status: string | undefined) => {
        switch (status) {
            case 'healthy': 
                return <span className="admin-status admin-status-healthy"><span className="admin-status-dot" />healthy</span>;
            case 'degraded': 
                return <span className="admin-status admin-status-warning"><span className="admin-status-dot" />degraded</span>;
            case 'unhealthy': 
                return <span className="admin-status admin-status-error"><span className="admin-status-dot" />unhealthy</span>;
            default: 
                return <span className="admin-status"><span className="admin-status-dot" />unknown</span>;
        }
    };

    const filteredProviders = providers.filter(p => showInactive || p.is_active);

    return (
        <div className="space-y-8">
            {/* Header with Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-slate-500" />
                        <span className="admin-metric-label">Healthy</span>
                    </div>
                    <p className="admin-metric-value">{llmStatus?.summary.healthy || 0}</p>
                </div>
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-slate-500" />
                        <span className="admin-metric-label">Degraded</span>
                    </div>
                    <p className="admin-metric-value">{llmStatus?.summary.degraded || 0}</p>
                </div>
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-slate-500" />
                        <span className="admin-metric-label">Unhealthy</span>
                    </div>
                    <p className="admin-metric-value">{llmStatus?.summary.unhealthy || 0}</p>
                </div>
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <Server size={14} className="text-slate-500" />
                        <span className="admin-metric-label">Total</span>
                    </div>
                    <p className="admin-metric-value">
                        {llmStatus?.summary.configured || 0}
                        <span className="text-sm text-slate-500 font-normal">/{llmStatus?.summary.total || 0}</span>
                    </p>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {llmStatus?.defaultProvider && (
                        <div className="flex items-center gap-2 text-sm">
                            <Star size={14} className="text-amber-400" />
                            <span className="text-slate-400">Default:</span>
                            <span className="text-white font-medium">{llmStatus.defaultProvider.name}</span>
                            <span className="text-slate-500">({llmStatus.defaultProvider.model})</span>
                        </div>
                    )}
                    {llmStatus?.startupValidation && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock size={12} />
                            Last check: {new Date(llmStatus.startupValidation.timestamp).toLocaleTimeString()}
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                            showInactive 
                                ? 'bg-white/10 border-white/20 text-white' 
                                : 'border-white/10 text-slate-400 hover:text-white'
                        }`}
                    >
                        {showInactive ? <Eye size={16} /> : <EyeOff size={16} />}
                        {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                    </button>
                    <button
                        onClick={refreshAllHealth}
                        disabled={refreshingHealth}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={16} className={refreshingHealth ? 'animate-spin' : ''} />
                        {refreshingHealth ? 'Refreshing...' : 'Refresh All'}
                    </button>
                </div>
            </div>

            {/* Provider Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {llmStatus?.providers
                    .filter(p => showInactive || p.isActive)
                    .map((p) => (
                    <div
                        key={p.id || p.provider}
                        className="admin-card p-4"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="text-sm font-medium text-white">{p.name || p.provider}</h4>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{p.model}</p>
                            </div>
                            {getHealthBadge(p.healthStatus)}
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                            {p.isDefault && (
                                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    ★ Default
                                </span>
                            )}
                            {p.tier && (
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                    TIER_CONFIG[p.tier]?.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                                    TIER_CONFIG[p.tier]?.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                                    TIER_CONFIG[p.tier]?.color === 'violet' ? 'bg-violet-500/10 text-violet-400' :
                                    TIER_CONFIG[p.tier]?.color === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-white/5 text-slate-400'
                                }`}>
                                    {p.tier}
                                </span>
                            )}
                            {p.supportsVision && (
                                <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-slate-400">Vision</span>
                            )}
                            {p.supportsTools && (
                                <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-slate-400">Tools</span>
                            )}
                            {!p.isConfigured && (
                                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400">No API Key</span>
                            )}
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">
                                Priority: {p.priority} | ${p.costPer1k}/1k
                            </span>
                            <button
                                onClick={() => testSingleProvider(p.provider)}
                                disabled={testingProvider === p.provider || !p.isConfigured}
                                className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded flex items-center gap-1 transition-colors text-slate-400"
                            >
                                {testingProvider === p.provider ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                    <Wifi size={12} />
                                )}
                                Test
                            </button>
                        </div>

                        {/* Circuit Breaker Status */}
                        {llmStatus.circuitBreakers[p.provider] && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        llmStatus.circuitBreakers[p.provider].state === 'CLOSED' ? 'bg-emerald-400' :
                                        llmStatus.circuitBreakers[p.provider].state === 'OPEN' ? 'bg-red-400' :
                                        'bg-amber-400'
                                    }`} />
                                    <span className="text-slate-500">
                                        Circuit: {llmStatus.circuitBreakers[p.provider].state}
                                    </span>
                                    {llmStatus.circuitBreakers[p.provider].failures > 0 && (
                                        <span className="text-red-400">
                                            ({llmStatus.circuitBreakers[p.provider].failures} failures)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Unified Provider Table */}
            <div className="admin-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--admin-border)]">
                    <h3 className="text-sm font-medium text-white">AI Providers Management</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Configure providers for your organization. Enable/disable to control which models are available.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Model</th>
                                <th>Tiers</th>
                                <th>Health</th>
                                <th className="text-center">Org Access</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center">
                                    <RefreshCw size={20} className="animate-spin mx-auto text-violet-400" />
                                </td></tr>
                            ) : filteredProviders.map(p => {
                                const statusInfo = getProviderStatusInfo(p);
                                const tiers = getProviderTiers(p);
                                
                                return (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {statusInfo?.isDefault && <Star size={14} className="text-amber-400" />}
                                                <div>
                                                    <div className="font-medium text-white">{p.name}</div>
                                                    <div className="text-xs text-slate-500 capitalize">{p.provider}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs text-slate-400">{p.model_id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {tiers.length > 0 ? tiers.map(tier => {
                                                    const config = TIER_CONFIG[tier];
                                                    const Icon = config?.icon || Server;
                                                    return (
                                                        <span 
                                                            key={tier}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                                                config?.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                config?.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                                                                config?.color === 'violet' ? 'bg-violet-500/10 text-violet-400' :
                                                                config?.color === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                                                                'bg-white/5 text-slate-400'
                                                            }`}
                                                        >
                                                            <Icon size={10} />
                                                            {tier}
                                                        </span>
                                                    );
                                                }) : (
                                                    <span className="text-xs text-slate-600">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getHealthIcon(statusInfo?.healthStatus)}
                                                <span className={`text-xs capitalize ${
                                                    statusInfo?.healthStatus === 'healthy' ? 'text-emerald-400' :
                                                    statusInfo?.healthStatus === 'degraded' ? 'text-amber-400' :
                                                    statusInfo?.healthStatus === 'unhealthy' ? 'text-red-400' :
                                                    'text-slate-500'
                                                }`}>
                                                    {statusInfo?.healthStatus || 'unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleOrgAccess(p.id, p.is_enabled_for_org !== false)}
                                                disabled={savingProvider === p.id}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    p.is_enabled_for_org !== false ? 'bg-violet-600' : 'bg-slate-700'
                                                } ${savingProvider === p.id ? 'opacity-50' : ''}`}
                                            >
                                                {savingProvider === p.id ? (
                                                    <RefreshCw size={12} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" />
                                                ) : (
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        p.is_enabled_for_org !== false ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {p.is_active ? (
                                                <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                                    <Check size={12} /> Active
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 text-xs">Inactive</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => testSingleProvider(p.provider)}
                                                disabled={testingProvider === p.provider || !statusInfo?.isConfigured}
                                                className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded flex items-center gap-1 transition-colors text-slate-400"
                                            >
                                                {testingProvider === p.provider ? (
                                                    <RefreshCw size={12} className="animate-spin" />
                                                ) : (
                                                    <Wifi size={12} />
                                                )}
                                                Test
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tier Preview (Collapsible) */}
            <div className="admin-card overflow-hidden">
                <button
                    onClick={() => setShowTierPreview(!showTierPreview)}
                    className="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--admin-border)] hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Info size={16} className="text-blue-400" />
                        <span className="text-sm font-medium text-white">Models Available per Tier</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>
                            {Object.values(availableModels).reduce((sum, models) => sum + models.length, 0)} models in {Object.keys(availableModels).length} tiers
                        </span>
                        {showTierPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </button>
                
                {showTierPreview && (
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
                                const Icon = config.icon;
                                const models = availableModels[tier] || [];

                                return (
                                    <div 
                                        key={tier}
                                        className={`rounded-xl p-4 border ${
                                            config.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                            config.color === 'blue' ? 'bg-blue-500/5 border-blue-500/20' :
                                            config.color === 'violet' ? 'bg-violet-500/5 border-violet-500/20' :
                                            config.color === 'amber' ? 'bg-amber-500/5 border-amber-500/20' :
                                            'bg-white/5 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <Icon size={16} className={
                                                config.color === 'emerald' ? 'text-emerald-400' :
                                                config.color === 'blue' ? 'text-blue-400' :
                                                config.color === 'violet' ? 'text-violet-400' :
                                                config.color === 'amber' ? 'text-amber-400' :
                                                'text-slate-400'
                                            } />
                                            <span className={`font-medium ${
                                                config.color === 'emerald' ? 'text-emerald-400' :
                                                config.color === 'blue' ? 'text-blue-400' :
                                                config.color === 'violet' ? 'text-violet-400' :
                                                config.color === 'amber' ? 'text-amber-400' :
                                                'text-slate-400'
                                            }`}>
                                                {tier}
                                            </span>
                                            <span className="text-xs text-slate-500">({models.length})</span>
                                        </div>

                                        {models.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {models.map((model, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className="flex items-center gap-2 text-xs"
                                                    >
                                                        {getHealthIcon(model.health_status)}
                                                        <span className="text-slate-300 truncate">{model.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-600 italic">
                                                No models available
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelsProvidersTab;
