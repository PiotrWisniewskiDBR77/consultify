/**
 * AI Performance Dashboard Component
 * 
 * Comprehensive dashboard for monitoring AI system performance metrics.
 * Features:
 * - Response time trends and distribution
 * - Token usage analytics per capability
 * - Cache hit rates and efficiency
 * - Model comparison metrics
 * - Cost per capability breakdown
 * - Real-time health indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Activity,
    Clock,
    Zap,
    Database,
    DollarSign,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    RefreshCw,
    Download,
    AlertTriangle,
    CheckCircle,
    Cpu,
    Layers,
    Target,
    Gauge,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface PerformanceMetrics {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    successRate: number;
    errorRate: number;
    avgTokensPerRequest: number;
    totalTokensUsed: number;
    cacheHitRate: number;
    totalCostUsd: number;
}

interface CapabilityMetrics {
    capability: string;
    requests: number;
    avgResponseTime: number;
    avgTokens: number;
    totalCost: number;
    successRate: number;
}

interface ModelMetrics {
    model: string;
    requests: number;
    avgResponseTime: number;
    avgQuality: number;
    totalCost: number;
    successRate: number;
}

interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

type TimeRange = '1h' | '24h' | '7d' | '30d';

export function AIPerformanceDashboard() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        successRate: 0,
        errorRate: 0,
        avgTokensPerRequest: 0,
        totalTokensUsed: 0,
        cacheHitRate: 0,
        totalCostUsd: 0
    });
    const [capabilityMetrics, setCapabilityMetrics] = useState<CapabilityMetrics[]>([]);
    const [modelMetrics, setModelMetrics] = useState<ModelMetrics[]>([]);
    const [responseTimeTrend, setResponseTimeTrend] = useState<TimeSeriesPoint[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const loadMetrics = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch performance metrics
            const response = await api.get(`/ai-analytics/performance?range=${timeRange}`);
            if (response.data.success || response.data.metrics) {
                setMetrics(response.data.metrics || generateMockMetrics());
                setCapabilityMetrics(response.data.capabilities || generateMockCapabilities());
                setModelMetrics(response.data.models || generateMockModels());
                setResponseTimeTrend(response.data.responseTimeTrend || generateMockTrend());
            } else {
                // Use mock data for demo
                setMetrics(generateMockMetrics());
                setCapabilityMetrics(generateMockCapabilities());
                setModelMetrics(generateMockModels());
                setResponseTimeTrend(generateMockTrend());
            }
        } catch (err) {
            console.error('Failed to load performance metrics:', err);
            // Set demo data on error
            setMetrics(generateMockMetrics());
            setCapabilityMetrics(generateMockCapabilities());
            setModelMetrics(generateMockModels());
            setResponseTimeTrend(generateMockTrend());
        }
        setLoading(false);
    }, [timeRange]);

    useEffect(() => {
        loadMetrics();
    }, [loadMetrics]);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(loadMetrics, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
    }, [autoRefresh, loadMetrics]);

    const generateMockMetrics = (): PerformanceMetrics => ({
        avgResponseTime: 1.2 + Math.random() * 0.5,
        p50ResponseTime: 0.8 + Math.random() * 0.3,
        p95ResponseTime: 2.5 + Math.random() * 1,
        p99ResponseTime: 4.0 + Math.random() * 2,
        totalRequests: Math.floor(5000 + Math.random() * 10000),
        successRate: 94 + Math.random() * 5,
        errorRate: 1 + Math.random() * 3,
        avgTokensPerRequest: Math.floor(800 + Math.random() * 400),
        totalTokensUsed: Math.floor(2000000 + Math.random() * 1000000),
        cacheHitRate: 20 + Math.random() * 15,
        totalCostUsd: 150 + Math.random() * 100
    });

    const generateMockCapabilities = (): CapabilityMetrics[] => [
        { capability: 'chat', requests: 3500, avgResponseTime: 0.9, avgTokens: 650, totalCost: 45.20, successRate: 98.2 },
        { capability: 'report', requests: 850, avgResponseTime: 3.2, avgTokens: 2100, totalCost: 62.50, successRate: 95.1 },
        { capability: 'initiative', requests: 420, avgResponseTime: 2.8, avgTokens: 1800, totalCost: 38.30, successRate: 93.5 },
        { capability: 'diagnose', requests: 680, avgResponseTime: 1.5, avgTokens: 1200, totalCost: 28.40, successRate: 96.8 },
        { capability: 'task', requests: 1200, avgResponseTime: 0.7, avgTokens: 450, totalCost: 18.60, successRate: 97.9 }
    ];

    const generateMockModels = (): ModelMetrics[] => [
        { model: 'gpt-4o', requests: 2800, avgResponseTime: 1.8, avgQuality: 0.92, totalCost: 85.40, successRate: 97.5 },
        { model: 'gpt-4o-mini', requests: 3200, avgResponseTime: 0.6, avgQuality: 0.85, totalCost: 12.80, successRate: 98.2 },
        { model: 'claude-3.5-sonnet', requests: 650, avgResponseTime: 2.1, avgQuality: 0.94, totalCost: 42.50, successRate: 96.8 },
        { model: 'gemini-1.5-pro', requests: 420, avgResponseTime: 1.4, avgQuality: 0.88, totalCost: 8.20, successRate: 95.2 }
    ];

    const generateMockTrend = (): TimeSeriesPoint[] => {
        const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
        return Array.from({ length: points }, (_, i) => ({
            timestamp: new Date(Date.now() - (points - i - 1) * (timeRange === '1h' ? 5 * 60000 : timeRange === '24h' ? 3600000 : 86400000)).toISOString(),
            value: 0.8 + Math.random() * 1.5
        }));
    };

    const handleExport = () => {
        const data = {
            exportDate: new Date().toISOString(),
            timeRange,
            metrics,
            capabilityMetrics,
            modelMetrics,
            responseTimeTrend
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Performance data exported');
    };

    const formatNumber = (num: number, decimals = 1) => num.toFixed(decimals);
    const formatCurrency = (num: number) => `$${num.toFixed(2)}`;
    const formatTokens = (num: number) => num >= 1000000 ? `${(num / 1000000).toFixed(1)}M` : num >= 1000 ? `${(num / 1000).toFixed(0)}K` : num.toString();

    const maxTrendValue = Math.max(...responseTimeTrend.map(t => t.value), 1);

    return (
        <div className="space-y-6">
            {/* Header - Clean minimal */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-lg font-medium text-white flex items-center gap-2">
                        <Activity size={16} className="text-slate-500" />
                        AI Performance Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">Real-time performance metrics and analytics</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Time Range */}
                    <div className="flex bg-white/[0.03] rounded-lg p-0.5">
                        {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                    timeRange === range
                                        ? 'bg-white/10 text-white'
                                        : 'text-slate-500 hover:text-white'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    {/* Auto Refresh Toggle */}
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`admin-btn ${autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'admin-btn-subtle'}`}
                    >
                        <Zap size={14} />
                        {autoRefresh ? 'Live' : 'Auto'}
                    </button>
                    <button onClick={handleExport} className="admin-btn admin-btn-subtle">
                        <Download size={14} />
                        Export
                    </button>
                    <button 
                        onClick={loadMetrics}
                        disabled={loading}
                        className="admin-btn admin-btn-subtle disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <MetricCard 
                    icon={Clock} 
                    label="Avg Response" 
                    value={`${formatNumber(metrics.avgResponseTime)}s`}
                    color="text-cyan-400"
                    trend={metrics.avgResponseTime < 1.5 ? 'up' : 'down'}
                />
                <MetricCard 
                    icon={Target} 
                    label="Success Rate" 
                    value={`${formatNumber(metrics.successRate)}%`}
                    color="text-emerald-400"
                    trend={metrics.successRate > 95 ? 'up' : 'down'}
                />
                <MetricCard 
                    icon={Database} 
                    label="Cache Hit Rate" 
                    value={`${formatNumber(metrics.cacheHitRate)}%`}
                    color="text-purple-400"
                    trend={metrics.cacheHitRate > 25 ? 'up' : 'down'}
                />
                <MetricCard 
                    icon={Layers} 
                    label="Total Requests" 
                    value={metrics.totalRequests.toLocaleString()}
                    color="text-blue-400"
                />
                <MetricCard 
                    icon={Cpu} 
                    label="Avg Tokens" 
                    value={formatTokens(metrics.avgTokensPerRequest)}
                    color="text-amber-400"
                />
                <MetricCard 
                    icon={DollarSign} 
                    label="Total Cost" 
                    value={formatCurrency(metrics.totalCostUsd)}
                    color="text-pink-400"
                />
            </div>

            {/* Response Time Distribution - Clean minimal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Percentiles */}
                <div className="admin-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <Gauge size={14} className="text-slate-500" />
                        Response Time Percentiles
                    </h3>
                    <div className="space-y-4">
                        <PercentileBar label="p50" value={metrics.p50ResponseTime} max={5} color="bg-slate-400" />
                        <PercentileBar label="p95" value={metrics.p95ResponseTime} max={5} color="bg-slate-500" />
                        <PercentileBar label="p99" value={metrics.p99ResponseTime} max={5} color="bg-slate-600" />
                    </div>
                </div>

                {/* Response Time Trend */}
                <div className="lg:col-span-2 admin-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-slate-500" />
                        Response Time Trend
                    </h3>
                    {loading ? (
                        <div className="h-32 flex items-center justify-center text-slate-600">Loading chart...</div>
                    ) : (
                        <div className="h-32 flex items-end gap-0.5">
                            {responseTimeTrend.map((point, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                                    <div 
                                        className="w-full bg-slate-500 hover:bg-slate-400 rounded-sm transition-all"
                                        style={{ height: `${(point.value / maxTrendValue) * 100}%`, minHeight: '2px' }}
                                        title={`${new Date(point.timestamp).toLocaleTimeString()}: ${point.value.toFixed(2)}s`}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Capability & Model Metrics - Clean minimal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By Capability */}
                <div className="admin-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <BarChart3 size={14} className="text-slate-500" />
                        Performance by Capability
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {capabilityMetrics.map((cap, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-300 capitalize">{cap.capability}</div>
                                    <div className="text-xs text-slate-600">{cap.requests.toLocaleString()} requests</div>
                                </div>
                                <div className="text-right text-xs space-y-1">
                                    <div className="text-slate-400">{cap.avgResponseTime.toFixed(1)}s</div>
                                    <div className="text-slate-600">{formatCurrency(cap.totalCost)}</div>
                                </div>
                                <div className={`text-xs ${cap.successRate > 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {cap.successRate.toFixed(1)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* By Model */}
                <div className="admin-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <PieChart size={14} className="text-slate-500" />
                        Performance by Model
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {modelMetrics.map((model, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-medium">{model.model}</div>
                                    <div className="text-xs text-slate-500">{model.requests.toLocaleString()} requests</div>
                                </div>
                                <div className="text-right text-xs space-y-1">
                                    <div className="text-purple-400">Q: {(model.avgQuality * 100).toFixed(0)}%</div>
                                    <div className="text-slate-500">{formatCurrency(model.totalCost)}</div>
                                </div>
                                <div className={`text-xs font-medium ${model.successRate > 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {model.successRate.toFixed(1)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Health Status - Clean minimal */}
            <div className="admin-card p-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-slate-500" />
                    System Health
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <HealthIndicator 
                        label="API Response" 
                        status={metrics.avgResponseTime < 2 ? 'healthy' : metrics.avgResponseTime < 4 ? 'warning' : 'critical'}
                    />
                    <HealthIndicator 
                        label="Error Rate" 
                        status={metrics.errorRate < 2 ? 'healthy' : metrics.errorRate < 5 ? 'warning' : 'critical'}
                    />
                    <HealthIndicator 
                        label="Cache Efficiency" 
                        status={metrics.cacheHitRate > 25 ? 'healthy' : metrics.cacheHitRate > 15 ? 'warning' : 'critical'}
                    />
                    <HealthIndicator 
                        label="Success Rate" 
                        status={metrics.successRate > 95 ? 'healthy' : metrics.successRate > 90 ? 'warning' : 'critical'}
                    />
                </div>
            </div>
        </div>
    );
}

// Helper Components - Clean minimal style
const MetricCard: React.FC<{ 
    icon: any; 
    label: string; 
    value: string; 
    color: string;
    trend?: 'up' | 'down';
}> = ({ icon: Icon, label, value, trend }) => (
    <div className="admin-metric">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon size={14} className="text-slate-500" />
                <span className="admin-metric-label">{label}</span>
            </div>
            {trend && (
                trend === 'up' 
                    ? <ArrowUpRight size={12} className="text-emerald-400" />
                    : <ArrowDownRight size={12} className="text-red-400" />
            )}
        </div>
        <div className="admin-metric-value">{value}</div>
    </div>
);

const PercentileBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ 
    label, value, max 
}) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 w-8">{label}</span>
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
                className="h-full bg-slate-400 rounded-full transition-all"
                style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
            />
        </div>
        <span className="text-xs text-slate-300 font-medium w-12 text-right">{value.toFixed(2)}s</span>
    </div>
);

const HealthIndicator: React.FC<{ label: string; status: 'healthy' | 'warning' | 'critical' }> = ({ 
    label, status 
}) => (
    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
        <span className={`admin-status ${
            status === 'healthy' ? 'admin-status-healthy' :
            status === 'warning' ? 'admin-status-warning' : 'admin-status-error'
        }`}>
            <span className="admin-status-dot" />
        </span>
        <div className="flex-1">
            <div className="text-sm text-slate-300">{label}</div>
            <div className={`text-xs capitalize ${
                status === 'healthy' ? 'text-emerald-400' : 
                status === 'warning' ? 'text-amber-400' : 'text-red-400'
            }`}>
                {status}
            </div>
        </div>
    </div>
);

export default AIPerformanceDashboard;


