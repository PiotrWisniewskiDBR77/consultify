/**
 * LLM Health Panel Component
 *
 * Displays detailed health status of all LLM providers with
 * error diagnosis and recommended actions.
 */

import {
    Activity,
    AlertOctagon,
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    Info,
    RefreshCw,
    XCircle,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface HealthError {
    title: string;
    description: string;
    action: string;
    code: string;
}

interface ProviderHealth {
    id: string;
    name: string;
    providerId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    statusLabel: {
        text: string;
        textEn: string;
        color: string;
        icon: string;
    };
    isHealthy: boolean;
    isDegraded: boolean;
    isUnhealthy: boolean;
    errorCategory: string | null;
    error: HealthError | null;
    rawError: string | null;
    statusCode: number | null;
    responseTime: number;
    lastCheck: string;
}

interface HealthAlert {
    severity: 'error' | 'warning' | 'info';
    provider: string;
    providerId: string;
    title: string;
    description: string;
    action: string;
    code: string;
    timestamp: string;
}

interface HealthSummary {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    lastCheck: string;
}

interface LLMHealthPanelProps {
    onProviderAction?: (providerId: string, action: string) => void;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export const LLMHealthPanel: React.FC<LLMHealthPanelProps> = ({
    onProviderAction,
    autoRefresh = true,
    refreshInterval = 60000, // 1 minute
}) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [providers, setProviders] = useState<ProviderHealth[]>([]);
    const [alerts, setAlerts] = useState<HealthAlert[]>([]);
    const [summary, setSummary] = useState<HealthSummary | null>(null);
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchHealthData = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/llm/health/detailed', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) throw new Error('Failed to fetch health data');

            const data = await response.json();

            if (data.success) {
                setProviders(data.providers || []);
                setAlerts(data.alerts || []);
                setSummary(data.summary || null);
                setError(null);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            console.error('[LLMHealthPanel] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load health data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void fetchHealthData();

        if (autoRefresh) {
            const interval = setInterval(() => void fetchHealthData(false), refreshInterval);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [fetchHealthData, autoRefresh, refreshInterval]);

    const handleRefresh = () => {
        fetchHealthData(true);
    };

    const handleTestProvider = async (providerId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/llm/health/test-provider', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ providerId }),
            });

            const data = await response.json();

            // Update provider in list
            if (data.provider) {
                setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, ...data.provider } : p)));
            }

            // Refresh full data
            await fetchHealthData(false);
        } catch (err) {
            console.error('[LLMHealthPanel] Test error:', err);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'degraded':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'unhealthy':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Info className="w-5 h-5 text-gray-500" />;
        }
    };

    const getAlertIcon = (severity: string) => {
        switch (severity) {
            case 'error':
                return <AlertOctagon className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
                <span className="ml-2 text-slate-400">Sprawdzanie stanu LLM...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <XCircle className="w-5 h-5" />
                    <span>Błąd: {error}</span>
                </div>
                <button
                    onClick={handleRefresh}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                >
                    Spróbuj ponownie
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-100 dark:bg-navy-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <Activity className="w-4 h-4" />
                        Łącznie
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary?.total || 0}</div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Zdrowe
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {summary?.healthyCount || 0}
                    </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Spowolnione
                    </div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                        {summary?.degradedCount || 0}
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                        <XCircle className="w-4 h-4" />
                        Niedostępne
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {summary?.unhealthyCount || 0}
                    </div>
                </div>
            </div>

            {/* Alerts Section */}
            {alerts.length > 0 && (
                <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-white/10">
                        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <AlertOctagon className="w-5 h-5 text-red-500" />
                            Alerty ({alerts.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-white/10">
                        {alerts.map((alert, index) => (
                            <div
                                key={index}
                                className={`p-4 ${
                                    alert.severity === 'error'
                                        ? 'bg-red-50 dark:bg-red-900/10'
                                        : 'bg-yellow-50 dark:bg-yellow-900/10'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {getAlertIcon(alert.severity)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {alert.provider}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 text-xs rounded-full ${
                                                    alert.severity === 'error'
                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                }`}
                                            >
                                                {alert.code}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300 font-medium mt-1">
                                            {alert.title}
                                        </p>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                                            {alert.description}
                                        </p>
                                        <div className="mt-2 p-2 bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-white/10">
                                            <p className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1">
                                                <Zap className="w-4 h-4" />
                                                <strong>Działanie:</strong> {alert.action}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Providers List */}
            <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Status Providerów
                    </h3>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Sprawdzanie...' : 'Odśwież'}
                    </button>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {providers.map((provider) => (
                        <div key={provider.id} className="p-4">
                            <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() =>
                                    setExpandedProvider(expandedProvider === provider.id ? null : provider.id)
                                }
                            >
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(provider.status)}
                                    <div>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            {provider.name}
                                        </span>
                                        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                                            ({provider.providerId})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {provider.responseTime > 0 && (
                                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {provider.responseTime}ms
                                        </span>
                                    )}
                                    <span
                                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            provider.status === 'healthy'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                : provider.status === 'degraded'
                                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                        }`}
                                    >
                                        {provider.statusLabel.text}
                                    </span>
                                    {expandedProvider === provider.id ? (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedProvider === provider.id && (
                                <div className="mt-4 pl-8 space-y-3">
                                    {provider.error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            <p className="font-medium text-red-700 dark:text-red-300">
                                                {provider.error.title}
                                            </p>
                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                {provider.error.description}
                                            </p>
                                            <div className="mt-2 p-2 bg-white dark:bg-navy-800 rounded">
                                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                                    <strong>Zalecane działanie:</strong> {provider.error.action}
                                                </p>
                                            </div>
                                            {provider.rawError && (
                                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 font-mono">
                                                    Raw: {provider.rawError}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                        <Clock className="w-4 h-4" />
                                        Ostatnie sprawdzenie: {new Date(provider.lastCheck).toLocaleString('pl-PL')}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleTestProvider(provider.id)}
                                            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Testuj ponownie
                                        </button>
                                        {onProviderAction && (
                                            <button
                                                onClick={() => onProviderAction(provider.id, 'edit')}
                                                className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Edytuj konfigurację
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Last Update Info */}
            {summary?.lastCheck && (
                <p className="text-sm text-center text-slate-400 dark:text-slate-500">
                    Ostatnia aktualizacja: {new Date(summary.lastCheck).toLocaleString('pl-PL')}
                </p>
            )}
        </div>
    );
};

export default LLMHealthPanel;
