import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/SuperAdmin/Card';
import {
    Plus,
    TrendingUp,
    TrendingDown,
    Minus,
    Target,
    Calculator,
    RefreshCw,
    Trash2,
    Edit,
    DollarSign,
    Users,
    Activity,
    Clock,
    Percent,
    BarChart3,
    LineChart,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    XCircle
} from 'lucide-react';
import Api from '../../../services/api';

interface BusinessMetric {
    id: string;
    name: string;
    description?: string;
    metric_type: string;
    calculation_formula?: string;
    target_value?: number;
    unit?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    current_value?: number;
    previous_value?: number;
    trend?: number;
}

interface MetricHistory {
    id: string;
    metric_id: string;
    value: number;
    calculated_at: string;
}

const METRIC_TYPES = [
    { id: 'revenue', label: 'Revenue', icon: DollarSign, color: 'green' },
    { id: 'users', label: 'Users', icon: Users, color: 'blue' },
    { id: 'engagement', label: 'Engagement', icon: Activity, color: 'purple' },
    { id: 'conversion', label: 'Conversion', icon: Percent, color: 'orange' },
    { id: 'performance', label: 'Performance', icon: Clock, color: 'cyan' },
    { id: 'custom', label: 'Custom', icon: BarChart3, color: 'gray' },
];

const BusinessMetricsView: React.FC = () => {
    const [metrics, setMetrics] = useState<BusinessMetric[]>([]);
    const [selectedMetric, setSelectedMetric] = useState<BusinessMetric | null>(null);
    const [history, setHistory] = useState<MetricHistory[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterType, setFilterType] = useState<string>('');

    const [newMetric, setNewMetric] = useState({
        name: '',
        description: '',
        metricType: 'revenue',
        calculationFormula: '',
        targetValue: '',
        unit: ''
    });

    useEffect(() => {
        fetchMetrics();
        fetchStats();
    }, [filterType]);

    const fetchMetrics = async () => {
        setIsLoading(true);
        try {
            const data = await Api.getBusinessMetrics(
                filterType ? { metricType: filterType } : undefined
            );
            setMetrics(data || []);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await Api.getMetricsStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchHistory = async (metricId: string) => {
        try {
            const data = await Api.getMetricHistory(metricId);
            setHistory(data || []);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    const handleSelectMetric = (metric: BusinessMetric) => {
        setSelectedMetric(metric);
        fetchHistory(metric.id);
    };

    const handleCreateMetric = async () => {
        if (!newMetric.name || !newMetric.metricType) return;

        try {
            await Api.createBusinessMetric({
                ...newMetric,
                targetValue: newMetric.targetValue ? parseFloat(newMetric.targetValue) : null
            });
            setShowCreateModal(false);
            setNewMetric({
                name: '',
                description: '',
                metricType: 'revenue',
                calculationFormula: '',
                targetValue: '',
                unit: ''
            });
            fetchMetrics();
            fetchStats();
        } catch (error) {
            console.error('Failed to create metric:', error);
        }
    };

    const handleDeleteMetric = async (metricId: string) => {
        if (!confirm('Are you sure you want to delete this metric?')) return;

        try {
            await Api.deleteBusinessMetric(metricId);
            if (selectedMetric?.id === metricId) {
                setSelectedMetric(null);
                setHistory([]);
            }
            fetchMetrics();
            fetchStats();
        } catch (error) {
            console.error('Failed to delete metric:', error);
        }
    };

    const handleCalculateMetric = async (metricId: string) => {
        setIsCalculating(true);
        try {
            await Api.calculateBusinessMetric(metricId);
            fetchMetrics();
            if (selectedMetric?.id === metricId) {
                fetchHistory(metricId);
            }
        } catch (error) {
            console.error('Failed to calculate metric:', error);
        } finally {
            setIsCalculating(false);
        }
    };

    const getMetricTypeInfo = (type: string) => {
        return METRIC_TYPES.find(mt => mt.id === type) || METRIC_TYPES[5];
    };

    const getTrendIcon = (trend?: number) => {
        if (!trend || trend === 0) return <Minus className="w-4 h-4 text-gray-400" />;
        if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
        return <TrendingDown className="w-4 h-4 text-red-400" />;
    };

    const getHealthStatus = (metric: BusinessMetric) => {
        if (!metric.target_value || !metric.current_value) return 'neutral';
        const ratio = metric.current_value / metric.target_value;
        if (ratio >= 1) return 'good';
        if (ratio >= 0.8) return 'warning';
        return 'bad';
    };

    const formatValue = (value?: number, unit?: string) => {
        if (value === undefined || value === null) return '-';
        if (unit === '%') return `${value.toFixed(1)}%`;
        if (unit === '$') return `$${value.toLocaleString()}`;
        return value.toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Business Metrics & KPIs</h2>
                    <p className="text-gray-400 mt-1">Track and monitor key performance indicators</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                    >
                        <option value="">All Types</option>
                        {METRIC_TYPES.map(mt => (
                            <option key={mt.id} value={mt.id}>{mt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Metric
                    </button>
                </div>
            </div>

            {/* Overview Stats */}
            {stats && (
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.totalMetrics || 0}</p>
                                <span className="text-xs text-gray-400">Total Metrics</span>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.onTarget || 0}</p>
                                <span className="text-xs text-gray-400">On Target</span>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.needsAttention || 0}</p>
                                <span className="text-xs text-gray-400">Needs Attention</span>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <XCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.critical || 0}</p>
                                <span className="text-xs text-gray-400">Critical</span>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
                {metrics.length === 0 ? (
                    <Card className="col-span-3 bg-gray-800 p-8">
                        <div className="flex flex-col items-center justify-center">
                            <BarChart3 className="w-16 h-16 text-gray-600 mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No Metrics Yet</h3>
                            <p className="text-gray-400 text-center mb-4">
                                Create your first KPI to start tracking business performance
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create Metric
                            </button>
                        </div>
                    </Card>
                ) : (
                    metrics.map(metric => {
                        const typeInfo = getMetricTypeInfo(metric.metric_type);
                        const TypeIcon = typeInfo.icon;
                        const health = getHealthStatus(metric);
                        
                        return (
                            <Card
                                key={metric.id}
                                className={`bg-gray-800 p-4 cursor-pointer transition-all hover:ring-1 hover:ring-blue-500 ${
                                    selectedMetric?.id === metric.id ? 'ring-2 ring-blue-500' : ''
                                }`}
                                onClick={() => handleSelectMetric(metric)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg bg-${typeInfo.color}-500/20`}>
                                            <TypeIcon className={`w-4 h-4 text-${typeInfo.color}-400`} />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-medium">{metric.name}</h4>
                                            <span className="text-xs text-gray-400">{typeInfo.label}</span>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs ${
                                        health === 'good' ? 'bg-green-500/20 text-green-400' :
                                        health === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                        health === 'bad' ? 'bg-red-500/20 text-red-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {health === 'good' ? 'On Track' :
                                         health === 'warning' ? 'Warning' :
                                         health === 'bad' ? 'Critical' : 'No Target'}
                                    </div>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-white">
                                            {formatValue(metric.current_value, metric.unit)}
                                        </p>
                                        {metric.target_value && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Target className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-400">
                                                    Target: {formatValue(metric.target_value, metric.unit)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {getTrendIcon(metric.trend)}
                                        {metric.trend !== undefined && (
                                            <span className={`text-sm ${
                                                metric.trend > 0 ? 'text-green-400' :
                                                metric.trend < 0 ? 'text-red-400' : 'text-gray-400'
                                            }`}>
                                                {metric.trend > 0 ? '+' : ''}{metric.trend?.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar if has target */}
                                {metric.target_value && metric.current_value !== undefined && (
                                    <div className="mt-3">
                                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    health === 'good' ? 'bg-green-500' :
                                                    health === 'warning' ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{
                                                    width: `${Math.min(100, (metric.current_value / metric.target_value) * 100)}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Selected Metric Details */}
            {selectedMetric && (
                <Card className="bg-gray-800 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">{selectedMetric.name}</h3>
                            {selectedMetric.description && (
                                <p className="text-gray-400 text-sm mt-1">{selectedMetric.description}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleCalculateMetric(selectedMetric.id)}
                                disabled={isCalculating}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                            >
                                {isCalculating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Calculator className="w-4 h-4" />
                                )}
                                Calculate Now
                            </button>
                            <button
                                onClick={() => handleDeleteMetric(selectedMetric.id)}
                                className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Metric Info */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-700/50 rounded-lg p-3">
                            <span className="text-gray-400 text-xs">Current Value</span>
                            <p className="text-white font-bold text-lg mt-1">
                                {formatValue(selectedMetric.current_value, selectedMetric.unit)}
                            </p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-3">
                            <span className="text-gray-400 text-xs">Target</span>
                            <p className="text-white font-bold text-lg mt-1">
                                {formatValue(selectedMetric.target_value, selectedMetric.unit)}
                            </p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-3">
                            <span className="text-gray-400 text-xs">Unit</span>
                            <p className="text-white font-bold text-lg mt-1">
                                {selectedMetric.unit || '-'}
                            </p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-3">
                            <span className="text-gray-400 text-xs">Formula</span>
                            <p className="text-white font-mono text-sm mt-1 truncate">
                                {selectedMetric.calculation_formula || 'Manual'}
                            </p>
                        </div>
                    </div>

                    {/* History Chart Placeholder */}
                    <div className="bg-gray-700/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white font-medium">Value History</h4>
                            <LineChart className="w-4 h-4 text-gray-400" />
                        </div>
                        {history.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                                No history data yet. Calculate the metric to start tracking.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {history.slice(0, 10).map((h, idx) => (
                                    <div
                                        key={h.id}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="text-gray-400">
                                            {new Date(h.calculated_at).toLocaleDateString()}
                                        </span>
                                        <span className="text-white font-medium">
                                            {formatValue(h.value, selectedMetric.unit)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Create Metric Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Metric</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Metric Name
                                </label>
                                <input
                                    type="text"
                                    value={newMetric.name}
                                    onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    placeholder="Monthly Recurring Revenue"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={newMetric.description}
                                    onChange={(e) => setNewMetric({ ...newMetric, description: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Metric Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {METRIC_TYPES.map(mt => (
                                        <button
                                            key={mt.id}
                                            onClick={() => setNewMetric({ ...newMetric, metricType: mt.id })}
                                            className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                                                newMetric.metricType === mt.id
                                                    ? 'bg-blue-600/20 border border-blue-500'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                            }`}
                                        >
                                            <mt.icon className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-white">{mt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Target Value
                                    </label>
                                    <input
                                        type="number"
                                        value={newMetric.targetValue}
                                        onChange={(e) => setNewMetric({ ...newMetric, targetValue: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                        placeholder="1000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Unit
                                    </label>
                                    <select
                                        value={newMetric.unit}
                                        onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="">None</option>
                                        <option value="$">Dollar ($)</option>
                                        <option value="%">Percent (%)</option>
                                        <option value="users">Users</option>
                                        <option value="ms">Milliseconds (ms)</option>
                                        <option value="count">Count</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Calculation Formula (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newMetric.calculationFormula}
                                    onChange={(e) => setNewMetric({ ...newMetric, calculationFormula: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                    placeholder="SUM(revenue) / COUNT(users)"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    SQL-like formula for automatic calculation
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateMetric}
                                disabled={!newMetric.name}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Create Metric
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessMetricsView;

