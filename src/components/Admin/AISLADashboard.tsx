/**
 * AI SLA Dashboard
 *
 * Real-time monitoring of AI system SLA compliance including:
 * - P50/P95/P99 latency gauges
 * - SLA breach alerts
 * - Historical trend charts
 * - Availability percentage
 *
 * Part of Stability Excellence - Phase 2.3
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { Badge } from '../ui/primitives/Badge';
import { Button } from '../ui/primitives/Button';
import { Card, CardContent, CardHeader } from '../ui/primitives/Card';
import { Skeleton } from '../ui/primitives/Skeleton';

// CardTitle component - if not exported from Card, define it here
const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;

// SLA Thresholds (in milliseconds)
const SLA_THRESHOLDS = {
  P50: 2000, // 2s
  P95: 5000, // 5s
  P99: 10000, // 10s
  AVAILABILITY: 99.9,
};

interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
}

interface AvailabilityMetrics {
  current: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

interface SLABreachEvent {
  id: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
}

interface TrendData {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
  availability: number;
}

export const AISLADashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [availability, setAvailability] = useState<AvailabilityMetrics | null>(null);
  const [breaches, setBreaches] = useState<SLABreachEvent[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      // Fetch latency metrics
      const latencyRes = await Api.getAIHealthMetrics?.();
      if (latencyRes) setLatency(latencyRes.latency as any);

      // Fetch availability metrics
      const availRes = await Api.getAIAvailability?.();
      if (availRes) setAvailability(availRes.availability as any);

      // Fetch SLA breaches
      const breachRes = await Api.getAISLABreaches?.();
      setBreaches(breachRes?.breaches || []);

      // Fetch trend data
      const trendRes = await Api.getAISLATrends?.();
      setTrends(trendRes?.trends || []);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch SLA metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(() => void fetchMetrics(), 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchMetrics, autoRefresh]);

  // Calculate SLA status
  const getSLAStatus = (metric: keyof typeof SLA_THRESHOLDS, value: number) => {
    const threshold = SLA_THRESHOLDS[metric];
    if (metric === 'AVAILABILITY') {
      return value >= threshold ? 'healthy' : value >= threshold - 0.5 ? 'warning' : 'critical';
    }
    return value <= threshold ? 'healthy' : value <= threshold * 1.5 ? 'warning' : 'critical';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'warning':
        return 'text-amber-500';
      case 'critical':
        return 'text-rose-500';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30';
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/30';
      default:
        return 'bg-gray-50 dark:bg-navy-8000/10 border-gray-500/30';
    }
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Render metric card with gauge visualization
  const renderLatencyGauge = (
    title: string,
    value: number,
    threshold: number,
    icon: React.ReactNode
  ) => {
    const status =
      value <= threshold ? 'healthy' : value <= threshold * 1.5 ? 'warning' : 'critical';
    const percentage = Math.min((value / (threshold * 2)) * 100, 100);

    return (
      <Card className={`${getStatusBg(status)} border`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <Badge
              variant={
                status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'danger'
              }
            >
              {status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className={`text-3xl font-bold ${getStatusColor(status)}`}>
                {formatLatency(value)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                SLA Target: {formatLatency(threshold)}
              </div>
              {/* Progress bar gauge */}
              <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    status === 'healthy'
                      ? 'bg-green-500'
                      : status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAvailabilityCard = () => {
    const status = availability ? getSLAStatus('AVAILABILITY', availability.current) : 'healthy';

    return (
      <Card className={`${getStatusBg(status)} border col-span-2`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t('admin.sla.availability', 'System Availability')}
            </CardTitle>
            {status === 'healthy' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getStatusColor(status)}`}>
                  {availability?.current.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">Current</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {availability?.last24h.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">24h</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {availability?.last7d.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">7 Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {availability?.last30d.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">30 Days</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderBreachAlerts = () => (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('admin.sla.recentBreaches', 'Recent SLA Breaches')}
          </CardTitle>
          <Badge variant="neutral">{breaches.length} events</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : breaches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>{t('admin.sla.noBreaches', 'No SLA breaches in the last 24 hours')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {breaches.map((breach) => (
              <div
                key={breach.id}
                className={`p-3 rounded-lg border ${
                  breach.severity === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {breach.severity === 'critical' ? (
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="font-medium">{breach.metric}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(breach.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm mt-1 text-muted-foreground">
                  Value: {formatLatency(breach.value)} (threshold: {formatLatency(breach.threshold)}
                  )
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTrendChart = () => (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {t('admin.sla.latencyTrend', 'Latency Trend (24h)')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="h-48 flex items-end justify-between gap-1">
            {trends.slice(-24).map((point, idx) => {
              const maxP99 = Math.max(...trends.map((t) => t.p99), SLA_THRESHOLDS.P99);
              const heightP99 = (point.p99 / maxP99) * 100;
              const heightP95 = (point.p95 / maxP99) * 100;
              const heightP50 = (point.p50 / maxP99) * 100;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${new Date(point.timestamp).toLocaleTimeString()}\nP50: ${formatLatency(point.p50)}\nP95: ${formatLatency(point.p95)}\nP99: ${formatLatency(point.p99)}`}
                >
                  <div
                    className="w-full bg-rose-400/60 rounded-t"
                    style={{ height: `${heightP99}%` }}
                  />
                  <div
                    className="w-full bg-amber-400/60 -mt-[1px]"
                    style={{ height: `${heightP95}%` }}
                  />
                  <div
                    className="w-full bg-green-400/60 -mt-[1px] rounded-b"
                    style={{ height: `${heightP50}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-400/60" /> P50
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-400/60" /> P95
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-rose-400/60" /> P99
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t('admin.sla.title', 'AI SLA Dashboard')}
          </h2>
          <p className="text-muted-foreground">
            {t(
              'admin.sla.description',
              'Real-time AI system performance and SLA compliance monitoring'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'text-green-500' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Latency Gauges */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderLatencyGauge(
          'P50 Latency',
          latency?.p50 || 0,
          SLA_THRESHOLDS.P50,
          <Gauge className="h-4 w-4" />
        )}
        {renderLatencyGauge(
          'P95 Latency',
          latency?.p95 || 0,
          SLA_THRESHOLDS.P95,
          <Clock className="h-4 w-4" />
        )}
        {renderLatencyGauge(
          'P99 Latency',
          latency?.p99 || 0,
          SLA_THRESHOLDS.P99,
          <Zap className="h-4 w-4" />
        )}
        <Card className="bg-background border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="text-3xl font-bold">{(latency?.count || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Availability Section */}
      <div className="grid gap-4 md:grid-cols-2">{renderAvailabilityCard()}</div>

      {/* Trend Chart */}
      {renderTrendChart()}

      {/* Breach Alerts */}
      {renderBreachAlerts()}
    </div>
  );
};

export default AISLADashboard;
