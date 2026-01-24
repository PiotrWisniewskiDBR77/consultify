/**
 * PerformanceMetricsTab - Analytics > Performance Metrics
 * Performance analytics and metrics aggregation view
 */

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  Clock,
  Cpu,
  Download,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  target?: number;
  history: number[];
}

interface ProviderMetrics {
  provider: string;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  throughput: number;
  errorRate: number;
}

export const PerformanceMetricsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetrics[]>([]);

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Mock data - replace with API call
      setMetrics([
        {
          id: '1',
          name: 'Average Response Time',
          value: 1250,
          unit: 'ms',
          change: -8.5,
          changeType: 'positive',
          target: 1500,
          history: [1400, 1350, 1280, 1250, 1200, 1300, 1250],
        },
        {
          id: '2',
          name: 'P95 Latency',
          value: 2800,
          unit: 'ms',
          change: -12.3,
          changeType: 'positive',
          target: 3000,
          history: [3200, 3100, 2950, 2800, 2750, 2900, 2800],
        },
        {
          id: '3',
          name: 'Token Throughput',
          value: 125000,
          unit: 'tokens/min',
          change: 15.2,
          changeType: 'positive',
          history: [100000, 105000, 110000, 115000, 120000, 123000, 125000],
        },
        {
          id: '4',
          name: 'Error Rate',
          value: 0.15,
          unit: '%',
          change: 0.02,
          changeType: 'negative',
          target: 0.1,
          history: [0.12, 0.11, 0.13, 0.14, 0.13, 0.14, 0.15],
        },
        {
          id: '5',
          name: 'Cache Hit Rate',
          value: 42.5,
          unit: '%',
          change: 5.3,
          changeType: 'positive',
          target: 50,
          history: [35, 37, 38, 40, 41, 42, 42.5],
        },
        {
          id: '6',
          name: 'Queue Depth',
          value: 12,
          unit: 'requests',
          change: -3,
          changeType: 'positive',
          target: 20,
          history: [18, 16, 14, 13, 12, 11, 12],
        },
      ]);

      setProviderMetrics([
        {
          provider: 'OpenAI',
          avgLatency: 1150,
          p95Latency: 2500,
          p99Latency: 3800,
          successRate: 99.85,
          throughput: 85000,
          errorRate: 0.15,
        },
        {
          provider: 'Anthropic',
          avgLatency: 1050,
          p95Latency: 2200,
          p99Latency: 3200,
          successRate: 99.72,
          throughput: 32000,
          errorRate: 0.28,
        },
        {
          provider: 'Groq',
          avgLatency: 280,
          p95Latency: 450,
          p99Latency: 680,
          successRate: 99.45,
          throughput: 8000,
          errorRate: 0.55,
        },
      ]);
    } catch (err) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(num < 10 ? 2 : 0);
  };

  const getChangeIcon = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return <TrendingUp size={14} className="text-emerald-500" />;
    if (changeType === 'negative') return <TrendingDown size={14} className="text-red-500" />;
    return null;
  };

  const getChangeColor = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return 'text-emerald-500';
    if (changeType === 'negative') return 'text-red-500';
    return 'text-slate-400';
  };

  // Simple sparkline component
  const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge size={24} className="text-indigo-500" />
            Performance Metrics
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor AI system performance and latency metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
            {(['1d', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">{metric.name}</div>
              <Sparkline
                data={metric.history}
                color={metric.changeType === 'positive' ? '#10b981' : '#ef4444'}
              />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(metric.value)}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">
                    {metric.unit}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 text-sm ${getChangeColor(metric.changeType)}`}
                >
                  {getChangeIcon(metric.changeType)}
                  <span>
                    {metric.change > 0 ? '+' : ''}
                    {metric.change}%
                  </span>
                  <span className="text-slate-400">vs last period</span>
                </div>
              </div>
              {metric.target && (
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Target</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {formatNumber(metric.target)} {metric.unit}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Provider Performance Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu size={18} className="text-slate-500" />
            Provider Performance
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Provider
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Avg Latency
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                P95 Latency
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                P99 Latency
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Success Rate
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Throughput
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Error Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {providerMetrics.map((pm) => (
              <tr key={pm.provider} className="hover:bg-slate-50 dark:hover:bg-navy-900/50">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900 dark:text-white">{pm.provider}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-700 dark:text-slate-300">{pm.avgLatency}ms</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-700 dark:text-slate-300">{pm.p95Latency}ms</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-700 dark:text-slate-300">{pm.p99Latency}ms</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={
                      pm.successRate >= 99.5
                        ? 'text-emerald-500'
                        : pm.successRate >= 99
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }
                  >
                    {pm.successRate.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatNumber(pm.throughput)} t/min
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={
                      pm.errorRate <= 0.2
                        ? 'text-emerald-500'
                        : pm.errorRate <= 0.5
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }
                  >
                    {pm.errorRate.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Performance Alerts */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Performance Alerts
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle size={16} className="text-amber-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Error rate above target
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Current: 0.15% | Target: 0.10% | Since 2 hours ago
              </div>
            </div>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded">
              Warning
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Zap size={16} className="text-emerald-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Latency improved
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                P95 latency decreased by 12.3% in the last 7 days
              </div>
            </div>
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded">
              Improvement
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetricsTab;
