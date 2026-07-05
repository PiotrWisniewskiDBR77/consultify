import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  FileSearch,
  Gauge,
  MessageSquare,
  RefreshCw,
  Shield,
  TrendingUp,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '../../components/ui/primitives';
import { Api } from '../../services/api';

interface ObservabilityMetrics {
  period: { from: string; to: string };
  requests: { total: number; avgPerDay: number };
  quality: {
    avgScore: number;
    p50: number;
    p95: number;
    trend: Array<{ date: string; avgScore: number; count: number }>;
  };
  latency: { avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number };
  cost: {
    totalUsd: number;
    avgPerRequest: number;
    byModel: Array<{ model: string; totalUsd: number; count: number }>;
  };
  safety: {
    totalRefusals: number;
    refusalRate: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  tools: {
    totalCalls: number;
    successRate: number;
    byTool: Array<{ tool: string; count: number; successRate: number }>;
  };
  rag: { avgGroundedness: number; avgChunksUsed: number; retrievalLatencyMs: number };
  feedback: {
    totalRatings: number;
    satisfactionRate: number;
    helpfulCount: number;
    notHelpfulCount: number;
  };
  grounding: {
    avgGroundingScore: number;
    avgConfidenceScore: number;
    avgCitationAccuracy: number;
    totalValidated: number;
  };
  evalRegression: {
    latestRunId: string | null;
    passesGate: boolean | null;
    lastRunDate: string | null;
    metrics: Record<string, number>;
  };
}

interface Alert {
  metric: string;
  severity: 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  operator: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const ms = (v: number) => `${Math.round(v)}ms`;
const usd = (v: number) => `$${v.toFixed(2)}`;

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = 'text-blue-400' }) => (
  <div className="rounded-xl border border-c-border bg-c-surface p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-xs text-c-text-muted uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-2xl font-bold text-c-text">{value}</div>
    {sub && <div className="text-xs text-c-text-muted mt-1">{sub}</div>}
  </div>
);

const AIObservabilityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const hoursBack = range === '24h' ? 24 : range === '7d' ? 168 : 720;
      const from = new Date(now.getTime() - hoursBack * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const [metricsRes, alertsRes] = await Promise.all([
        Api.get(`/admin/ai-observability/metrics?from=${from}&to=${to}`),
        Api.get(`/admin/ai-observability/alerts?from=${from}&to=${to}`),
      ]);

      if (metricsRes.data?.data) setMetrics(metricsRes.data.data);
      if (alertsRes.data?.data?.alerts) setAlerts(alertsRes.data.data.alerts);
    } catch (err) {
      toast.error('Failed to load observability data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !metrics) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (!metrics) {
    return <div className="text-c-text-muted text-center py-12">No observability data available</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-c-text flex items-center gap-3">
          <Activity className="w-7 h-7 text-blue-400" />
          AI Observability Dashboard
        </h1>
        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-c-surface text-c-text-muted border border-c-border hover:bg-c-surface-raised'
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-c-surface border border-c-border hover:bg-c-surface-raised transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-c-text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-danger-400" />
            <span className="text-danger-300 font-semibold">
              {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    alert.severity === 'critical'
                      ? 'bg-danger-500/20 text-danger-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {alert.severity}
                </span>
                <span className="text-c-text-secondary">
                  {alert.metric}:{' '}
                  {typeof alert.currentValue === 'number' && alert.currentValue < 1
                    ? pct(alert.currentValue)
                    : alert.currentValue.toFixed(1)}{' '}
                  ({alert.operator === 'lt' ? '<' : '>'}{' '}
                  {alert.threshold < 1 ? pct(alert.threshold) : alert.threshold})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Total Requests"
          value={metrics.requests.total.toLocaleString()}
          sub={`${metrics.requests.avgPerDay}/day avg`}
        />
        <MetricCard
          icon={<Gauge className="w-4 h-4" />}
          label="Avg Quality"
          value={pct(metrics.quality.avgScore)}
          color={metrics.quality.avgScore > 0.7 ? 'text-green-400' : 'text-yellow-400'}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Latency p95"
          value={ms(metrics.latency.p95Ms)}
          sub={`avg: ${ms(metrics.latency.avgMs)}`}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Cost"
          value={usd(metrics.cost.totalUsd)}
          sub={`${usd(metrics.cost.avgPerRequest)}/req`}
        />
        <MetricCard
          icon={<Shield className="w-4 h-4" />}
          label="Safety Refusals"
          value={metrics.safety.totalRefusals.toString()}
          sub={pct(metrics.safety.refusalRate)}
          color="text-amber-400"
        />
        <MetricCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Satisfaction"
          value={pct(metrics.feedback.satisfactionRate)}
          sub={`${metrics.feedback.totalRatings} ratings`}
          color={metrics.feedback.satisfactionRate > 0.8 ? 'text-green-400' : 'text-yellow-400'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Grounding & Confidence */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-primary-400" /> Grounding & Citation
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Grounding Score</span>
              <span className="text-c-text font-medium">
                {pct(metrics.grounding.avgGroundingScore)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Confidence Score</span>
              <span className="text-c-text font-medium">
                {pct(metrics.grounding.avgConfidenceScore)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Citation Accuracy</span>
              <span className="text-c-text font-medium">
                {pct(metrics.grounding.avgCitationAccuracy)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Total Validated</span>
              <span className="text-c-text font-medium">{metrics.grounding.totalValidated}</span>
            </div>
          </div>
        </div>

        {/* RAG Performance */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> RAG Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Avg Groundedness</span>
              <span className="text-c-text font-medium">{pct(metrics.rag.avgGroundedness)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Avg Chunks Used</span>
              <span className="text-c-text font-medium">{metrics.rag.avgChunksUsed.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Retrieval Latency</span>
              <span className="text-c-text font-medium">{ms(metrics.rag.retrievalLatencyMs)}</span>
            </div>
          </div>
        </div>

        {/* Eval Regression Gate */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            {metrics.evalRegression.passesGate ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-danger-400" />
            )}{' '}
            Eval Regression Gate
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Status</span>
              <span
                className={`font-medium ${metrics.evalRegression.passesGate ? 'text-green-400' : 'text-danger-400'}`}
              >
                {metrics.evalRegression.passesGate == null
                  ? 'No runs'
                  : metrics.evalRegression.passesGate
                    ? 'PASSING'
                    : 'FAILING'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Last Run</span>
              <span className="text-c-text font-medium text-xs">
                {metrics.evalRegression.lastRunDate
                  ? new Date(metrics.evalRegression.lastRunDate).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Tool Calls */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" /> Tool Calls
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Total Calls</span>
              <span className="text-c-text font-medium">{metrics.tools.totalCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-c-text-muted text-sm">Success Rate</span>
              <span className="text-c-text font-medium">{pct(metrics.tools.successRate)}</span>
            </div>
            {metrics.tools.byTool.slice(0, 5).map((t) => (
              <div key={t.tool} className="flex justify-between text-xs">
                <span className="text-c-text-muted truncate max-w-[60%]">{t.tool}</span>
                <span className="text-c-text-secondary">
                  {t.count}x ({pct(t.successRate)})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" /> Cost by Model
          </h3>
          <div className="space-y-2">
            {metrics.cost.byModel.slice(0, 6).map((m) => (
              <div key={m.model} className="flex justify-between text-sm">
                <span className="text-c-text-muted truncate max-w-[55%]">{m.model}</span>
                <span className="text-c-text font-medium">
                  {usd(m.totalUsd)} ({m.count}x)
                </span>
              </div>
            ))}
            {metrics.cost.byModel.length === 0 && (
              <span className="text-c-text-muted text-sm">No data</span>
            )}
          </div>
        </div>

        {/* Quality Trend */}
        <div className="rounded-xl border border-c-border bg-c-surface p-5">
          <h3 className="text-sm font-semibold text-c-text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" /> Quality Trend
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {metrics.quality.trend.map((t) => (
              <div key={t.date} className="flex items-center gap-2 text-xs">
                <span className="text-c-text-muted w-20">{t.date}</span>
                <div className="flex-1 h-2 bg-c-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ width: `${(t.avgScore * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-c-text-muted w-14 text-right">{pct(t.avgScore)}</span>
              </div>
            ))}
            {metrics.quality.trend.length === 0 && (
              <span className="text-c-text-muted text-sm">No data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIObservabilityDashboard;
