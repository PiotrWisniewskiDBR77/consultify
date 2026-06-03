import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  LineChart,
  Loader2,
  Minus,
  Percent,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/ui/BaseCard';
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

const COLOR_STYLES: Record<string, { bg: string; text: string }> = {
  green: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  purple: { bg: 'bg-primary-500/15', text: 'text-primary-600 dark:text-primary-400' },
  orange: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
  cyan: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  gray: { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300' },
};

const BusinessMetricsView: React.FC = () => {
  const [metrics, setMetrics] = useState<BusinessMetric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<BusinessMetric | null>(null);
  const [history, setHistory] = useState<MetricHistory[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const [newMetric, setNewMetric] = useState({
    name: '',
    description: '',
    metricType: 'revenue',
    calculationFormula: '',
    targetValue: '',
    unit: '',
  });

  useEffect(() => {
    const load = async () => {
      const loadedMetrics = await fetchMetrics();
      await fetchStats(loadedMetrics);
    };
    load();
  }, [filterType]);

  const fetchMetrics = async (): Promise<any[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getBusinessMetrics(
        filterType ? { metricType: filterType } : undefined
      );
      const list = data || [];
      setMetrics(list);
      return list;
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err.message || 'Failed to load business metrics. Please try again.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const computeStatsFromMetrics = (metricsList: any[]) => {
    const onTarget = metricsList.filter(
      (m) =>
        m.target_value != null &&
        m.current_value != null &&
        Number(m.current_value) >= Number(m.target_value)
    ).length;
    const needsAttention = metricsList.filter(
      (m) =>
        m.target_value != null &&
        m.current_value != null &&
        Number(m.current_value) < Number(m.target_value) &&
        Number(m.current_value) >= Number(m.target_value) * 0.8
    ).length;
    const critical = metricsList.filter(
      (m) =>
        m.target_value != null &&
        m.current_value != null &&
        Number(m.current_value) < Number(m.target_value) * 0.8
    ).length;
    return {
      totalMetrics: metricsList.length,
      onTarget,
      needsAttention,
      critical,
      activeMetrics: metricsList.filter((m) => m.is_active).length,
      categories: new Set(metricsList.map((m) => m.category)).size,
    };
  };

  const fetchStats = async (metricsList?: any[]) => {
    try {
      const data = await Api.getMetricsStats();
      if (
        data &&
        (data.totalMetrics > 0 || data.onTarget > 0 || data.needsAttention > 0 || data.critical > 0)
      ) {
        setStats(data);
      } else {
        const list = metricsList ?? metrics;
        if (list.length > 0) {
          setStats(computeStatsFromMetrics(list));
        } else {
          setStats(data);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
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
        name: newMetric.name,
        description: newMetric.description,
        category: newMetric.metricType,
        formula: newMetric.calculationFormula || null,
        unit: newMetric.unit || null,
        target_value: newMetric.targetValue ? parseFloat(newMetric.targetValue) : null,
      });
      setShowCreateModal(false);
      setNewMetric({
        name: '',
        description: '',
        metricType: 'revenue',
        calculationFormula: '',
        targetValue: '',
        unit: '',
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
    return METRIC_TYPES.find((mt) => mt.id === type) || METRIC_TYPES[5];
  };

  const getTrendIcon = (trend?: number) => {
    if (!trend || trend === 0)
      return <Minus className="w-4 h-4 text-gray-600 dark:text-gray-500 dark:text-gray-400" />;
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    return <TrendingDown className="w-4 h-4 text-rose-400" />;
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Business Metrics & KPIs
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track and monitor key performance indicators
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
          >
            <option value="">All Types</option>
            {METRIC_TYPES.map((mt) => (
              <option key={mt.id} value={mt.id}>
                {mt.label}
              </option>
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

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span className="text-sm text-rose-700 dark:text-rose-300">{error}</span>
          </div>
          <button
            onClick={async () => {
              setError(null);
              const m = await fetchMetrics();
              await fetchStats(m);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Overview Stats */}
      {stats && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.totalMetrics || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Total Metrics</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.onTarget || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">On Target</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.needsAttention || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Needs Attention
                  </span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.critical || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Critical</span>
                </div>
              </div>
            </Card>
          </div>
          {stats.totalMetrics === 0 && metrics.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Stats update after metrics are calculated. Click &quot;Calculate Now&quot; on each
              metric to update.
            </p>
          )}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.length === 0 ? (
          <Card className="col-span-3 p-8">
            <div className="flex flex-col items-center justify-center">
              <BarChart3 className="w-16 h-16 text-slate-600 dark:text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No Metrics Yet
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center mb-4">
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
          metrics.map((metric) => {
            const typeInfo = getMetricTypeInfo(metric.metric_type);
            const TypeIcon = typeInfo.icon;
            const color = COLOR_STYLES[typeInfo.color] || COLOR_STYLES.gray;
            const health = getHealthStatus(metric);

            return (
              <Card
                key={metric.id}
                className={`p-4 cursor-pointer transition-all hover:ring-1 hover:ring-blue-500 ${
                  selectedMetric?.id === metric.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleSelectMetric(metric)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${color.bg}`}>
                      <TypeIcon className={`w-4 h-4 ${color.text}`} />
                    </div>
                    <div>
                      <h4 className="text-slate-900 dark:text-white font-medium">{metric.name}</h4>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      health === 'good'
                        ? 'bg-green-500/20 text-green-400'
                        : health === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : health === 'bad'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {health === 'good'
                      ? 'On Track'
                      : health === 'warning'
                        ? 'Warning'
                        : health === 'bad'
                          ? 'Critical'
                          : 'No Target'}
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {formatValue(metric.current_value, metric.unit)}
                    </p>
                    {metric.target_value && (
                      <div className="flex items-center gap-1 mt-1">
                        <Target className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Target: {formatValue(metric.target_value, metric.unit)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(metric.trend)}
                    {metric.trend !== undefined && (
                      <span
                        className={`text-sm ${
                          metric.trend > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : metric.trend < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {metric.trend > 0 ? '+' : ''}
                        {metric.trend?.toFixed(1)}%
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
                          health === 'good'
                            ? 'bg-green-500'
                            : health === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (metric.current_value / metric.target_value) * 100)}%`,
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
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedMetric.name}
              </h3>
              {selectedMetric.description && (
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                  {selectedMetric.description}
                </p>
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
                className="p-2 text-rose-400 hover:bg-rose-600/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metric Info */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
              <span className="text-slate-600 dark:text-slate-400 text-xs">Current Value</span>
              <p className="text-slate-900 dark:text-white font-bold text-lg mt-1">
                {formatValue(selectedMetric.current_value, selectedMetric.unit)}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
              <span className="text-slate-600 dark:text-slate-400 text-xs">Target</span>
              <p className="text-slate-900 dark:text-white font-bold text-lg mt-1">
                {formatValue(selectedMetric.target_value, selectedMetric.unit)}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
              <span className="text-slate-600 dark:text-slate-400 text-xs">Unit</span>
              <p className="text-slate-900 dark:text-white font-bold text-lg mt-1">
                {selectedMetric.unit || '-'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
              <span className="text-slate-600 dark:text-slate-400 text-xs">Formula</span>
              <p className="text-slate-900 dark:text-white font-mono text-sm mt-1 truncate">
                {selectedMetric.calculation_formula || 'Manual'}
              </p>
            </div>
          </div>

          {/* History Chart Placeholder */}
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-slate-900 dark:text-white font-medium">Value History</h4>
              <LineChart className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            {history.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-sm text-center py-4">
                No history data yet. Calculate the metric to start tracking.
              </p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 10).map((h, idx) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {new Date(h.calculated_at).toLocaleDateString()}
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium">
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
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Create New Metric
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Metric Name
                </label>
                <input
                  type="text"
                  value={newMetric.name}
                  onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="Monthly Recurring Revenue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  value={newMetric.description}
                  onChange={(e) => setNewMetric({ ...newMetric, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Metric Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {METRIC_TYPES.map((mt) => (
                    <button
                      key={mt.id}
                      onClick={() => setNewMetric({ ...newMetric, metricType: mt.id })}
                      className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                        newMetric.metricType === mt.id
                          ? 'bg-blue-600/10 border border-blue-400/60 dark:bg-blue-500/10 dark:border-blue-500/30'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <mt.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm text-slate-900 dark:text-white">{mt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    value={newMetric.targetValue}
                    onChange={(e) => setNewMetric({ ...newMetric, targetValue: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Unit
                  </label>
                  <select
                    value={newMetric.unit}
                    onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Calculation Formula (optional)
                </label>
                <input
                  type="text"
                  value={newMetric.calculationFormula}
                  onChange={(e) =>
                    setNewMetric({ ...newMetric, calculationFormula: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-sm"
                  placeholder="SUM(revenue) / COUNT(users)"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  SQL-like formula for automatic calculation
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg transition-colors dark:bg-navy-700 dark:hover:bg-navy-600 dark:text-white"
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
