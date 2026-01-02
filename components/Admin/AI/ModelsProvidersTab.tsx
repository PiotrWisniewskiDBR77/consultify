/**
 * ModelsProvidersTab - AI Models & Providers Management
 * 
 * Tab 1 of the reorganized AI & Intelligence section
 * Includes: Provider Status Grid, Model Access Control, Fallback Config, Default Model
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Server, 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    RefreshCw, 
    Wifi, 
    ArrowRight, 
    Eye, 
    EyeOff, 
    Check,
    Star,
    Zap,
    Clock
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

export const ModelsProvidersTab: React.FC = () => {
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [refreshingHealth, setRefreshingHealth] = useState(false);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        loadProviders();
        loadLLMStatus();
    }, []);

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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={16} className="text-green-400" />;
            case 'degraded': return <AlertTriangle size={16} className="text-yellow-400" />;
            case 'unhealthy': return <XCircle size={16} className="text-red-400" />;
            default: return <Server size={16} className="text-slate-400" />;
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'degraded': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'unhealthy': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const toggleOrgAccess = async (providerId: string, currentStatus: boolean) => {
        try {
            await Api.toggleOrganizationLLM(providerId, !currentStatus);
            setProviders(prev => prev.map(p => 
                p.id === providerId ? { ...p, is_enabled_for_org: !currentStatus } : p
            ));
            toast.success(!currentStatus ? 'Enabled for Organization' : 'Disabled for Organization');
        } catch (e) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-8">
            {/* Header with Summary Cards - Clean minimal */}
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

            {/* Provider Status Grid - Clean minimal */}
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
                            <span className={`admin-status ${
                                p.healthStatus === 'healthy' ? 'admin-status-healthy' :
                                p.healthStatus === 'degraded' ? 'admin-status-warning' : 'admin-status-error'
                            }`}>
                                <span className="admin-status-dot" />
                                {p.healthStatus}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                                p.isDefault ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'
                            }`}>
                                {p.isDefault ? '★ Default' : p.tier}
                            </span>
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

            {/* Model Access Control Table - Clean minimal */}
            <div className="admin-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--admin-border)]">
                    <h3 className="text-sm font-medium text-white">Model Access Control</h3>
                    <p className="text-xs text-slate-500 mt-1">Enable or disable specific AI models for your organization</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Provider</th>
                                <th>Model ID</th>
                                <th>Org Access</th>
                                <th>Global Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center">Loading...</td></tr>
                            ) : providers
                                .filter(p => showInactive || p.is_active)
                                .map(p => (
                                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{p.name}</div>
                                    </td>
                                    <td className="px-6 py-4 capitalize">{p.provider}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{p.model_id}</td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleOrgAccess(p.id, p.is_enabled_for_org !== false)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                p.is_enabled_for_org !== false ? 'bg-violet-600' : 'bg-slate-700'
                                            }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                p.is_enabled_for_org !== false ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {p.is_active ? (
                                            <span className="text-green-400 flex items-center gap-1">
                                                <Check size={14} /> Active
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">Inactive</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Fallback Chains - Clean minimal */}
            {llmStatus?.fallbackChains && Object.keys(llmStatus.fallbackChains).length > 0 && (
                <div className="admin-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <ArrowRight size={14} className="text-slate-500" />
                        Fallback Chains
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(llmStatus.fallbackChains).map(([tier, chain]) => (
                            <div key={tier} className="bg-white/[0.02] rounded-lg p-3">
                                <span className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">{tier}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(chain as string[]).map((provider, idx) => (
                                        <React.Fragment key={provider}>
                                            {idx > 0 && <ArrowRight size={12} className="text-slate-600" />}
                                            <span className={`text-sm px-2 py-0.5 rounded ${
                                                llmStatus.providers.find(p => p.provider === provider)?.healthStatus === 'healthy'
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-white/5 text-slate-400'
                                            }`}>
                                                {provider}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelsProvidersTab;

