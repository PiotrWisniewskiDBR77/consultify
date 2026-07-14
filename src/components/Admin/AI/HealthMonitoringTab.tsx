/**
 * HealthMonitoringTab - AI Health & Monitoring
 *
 * Tab 2 of the reorganized AI & Intelligence section
 * Includes: Mission Control, Provider Health Dashboard, Usage Analytics, Error Log
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  Coins,
  MessageSquare,
  RefreshCw,
  Terminal,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { Button } from '../../ui/primitives/Button';

interface CapabilityResult {
  capability: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  latency: number;
  details: any;
  error?: string;
  alertSent?: boolean;
  alertDetails?: any;
}

interface SystemStatus {
  providers: Array<{
    name: string;
    type: string;
    status: string;
    visibility: string;
  }>;
  metrics: {
    uptime50: number;
    avgLatencyMs: number;
    totalRequests: number;
  };
  timestamp: string;
}

interface AnalyticsData {
  totalCalls: number;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
  byProvider: Record<string, { calls: number; tokens: number }>;
  byDay: { date: string; calls: number; tokens: number }[];
}

interface LogEntry {
  id: string;
  provider: string;
  model: string;
  prompt: string;
  response?: string;
  tokens: number;
  latency: number;
  error?: string;
  createdAt: string;
}

export const HealthMonitoringTab: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [results, setResults] = useState<Record<string, CapabilityResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'mission' | 'analytics' | 'logs'>('mission');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [runningAllTests, setRunningAllTests] = useState(false);

  const capabilities = [
    {
      id: 'connection',
      name: 'AI Connection (Basic)',
      icon: '🔌',
      description: 'Test if AI connection is functioning correctly',
    },
    {
      id: 'chat_ready',
      name: 'Chat Ready',
      icon: '💬',
      description: 'Test if AI model is ready for conversation',
    },
    {
      id: 'eyes',
      name: 'AI Eyes (Visual Context)',
      icon: '👁️',
      description: 'Test visual context understanding',
    },
    {
      id: 'memory',
      name: 'AI Memory (RAG)',
      icon: '🧠',
      description: 'Test memory retrieval system',
    },
    {
      id: 'hands',
      name: 'AI Hands (MCP Tools)',
      icon: '🤝',
      description: 'Test tool execution capability',
    },
    {
      id: 'reasoning',
      name: 'MAX Mode (Reasoning)',
      icon: '🚀',
      description: 'Test advanced reasoning mode',
    },
  ];

  useEffect(() => {
    fetchStatus();
    loadAnalytics();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/llm/health/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch AI status', err);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const [stats, recentLogs] = await Promise.all([Api.getLLMAnalytics(7), Api.getLLMLogs(50)]);
      setAnalytics(stats);
      setLogs(recentLogs.logs || []);
    } catch (error) {
      console.error('Failed to load analytics', error);
    }
    setLoadingAnalytics(false);
  };

  const testCapability = async (capId: string, sendAlerts = false) => {
    setLoading((prev) => ({ ...prev, [capId]: true }));
    try {
      const response = await fetch(`/api/llm/health/test/${capId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ context: {}, sendAlerts }),
      });
      const data = await response.json();
      setResults((prev) => ({ ...prev, [capId]: data }));
      if (data.status === 'SUCCESS') {
        const skipped = data.details?.skipped;
        toast.success(`${capId} test ${skipped ? 'skipped' : 'passed'} (${data.latency}ms)`);
      } else {
        toast.error(`${capId} test failed${data.alertSent ? ' - Alert sent!' : ''}`);
      }
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [capId]: {
          capability: capId,
          status: 'FAILED',
          latency: 0,
          details: null,
          error: err.message,
        },
      }));
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [capId]: false }));
      fetchStatus();
    }
  };

  const runAllTests = async () => {
    for (const cap of capabilities) {
      await testCapability(cap.id, false);
    }
  };

  const runAllTestsWithAlerts = async () => {
    setRunningAllTests(true);
    try {
      const response = await fetch('/api/llm/health/test-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sendAlerts: alertsEnabled }),
      });
      const data = await response.json();

      // Update results from all tests
      if (data.results) {
        setResults(data.results);
      }

      // Show summary
      const { summary, alertSent, alertDetails } = data;
      if (summary?.allPassed) {
        toast.success(`All ${summary.total} tests passed!`);
      } else {
        const msg = `${summary?.failed || 0} of ${summary?.total || 0} tests failed`;
        if (alertSent) {
          toast.error(`${msg} - Alert sent to SuperAdmins!`, { duration: 5000, icon: '🚨' });
        } else {
          toast.error(msg);
        }
      }

      fetchStatus();
    } catch (err: any) {
      toast.error(`Failed to run tests: ${err.message}`);
    } finally {
      setRunningAllTests(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs - DBR77 Compatible */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-1">
        <button
          onClick={() => setActiveSubTab('mission')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'mission'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Activity size={14} className="inline mr-2" />
          Mission Control
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'analytics'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <BarChart2 size={14} className="inline mr-2" />
          Usage Analytics
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'logs'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Terminal size={14} className="inline mr-2" />
          Request Logs
        </button>
      </div>

      {/* Mission Control - DBR77 Compatible */}
      {activeSubTab === 'mission' && (
        <div className="space-y-6">
          {/* System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 p-6 rounded-xl shadow-sm dark:shadow-none">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                Success Rate (Last 50)
              </h3>
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-navy-900 dark:text-white">
                  {status?.metrics?.uptime50?.toFixed(1) ?? '0.0'}%
                </span>
                <span
                  className={`ml-2 text-sm font-medium ${
                    status?.metrics?.uptime50 && status.metrics.uptime50 > 95
                      ? 'text-success-600 dark:text-green-400'
                      : 'text-warning-600 dark:text-amber-400'
                  }`}
                >
                  {status?.metrics?.uptime50 && status.metrics.uptime50 > 95
                    ? 'Excellent'
                    : 'Degraded'}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 p-6 rounded-xl shadow-sm dark:shadow-none">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                Avg Latency
              </h3>
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-navy-900 dark:text-white">
                  {status?.metrics?.avgLatencyMs ?? 0}ms
                </span>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">per request</span>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 p-6 rounded-xl shadow-sm dark:shadow-none">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                Active Providers
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {status?.providers
                  .filter((p) => p.status === 'ACTIVE')
                  .map((p) => (
                    <span
                      key={p.name}
                      className="px-2 py-1 bg-success-500/20 text-success-700 dark:text-green-300 text-xs font-medium rounded-full border border-success-500/30 dark:border-transparent"
                    >
                      {p.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Capability Tests - DBR77 Compatible */}
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h2 className="font-semibold text-navy-900 dark:text-white">
                  AI Capability Diagnostics
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Test individual AI capabilities
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Alert Toggle */}
                <button
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    alertsEnabled
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title={
                    alertsEnabled
                      ? 'Alerts enabled - SuperAdmins will be notified on failure'
                      : 'Alerts disabled'
                  }
                >
                  {alertsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  {alertsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                </button>

                <button
                  onClick={runAllTests}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Quick Test
                </button>

                <button
                  onClick={runAllTestsWithAlerts}
                  disabled={runningAllTests}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {runningAllTests ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Activity size={14} />
                  )}
                  Run All Tests
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {capabilities.map((cap) => (
                <div
                  key={cap.id}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{cap.icon}</span>
                    <div>
                      <h3 className="font-medium text-navy-900 dark:text-white">{cap.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {cap.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {results[cap.id] && (
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                            results[cap.id].status === 'SUCCESS'
                              ? results[cap.id].details?.skipped
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 dark:border-transparent'
                                : 'bg-success-500/10 text-success-700 dark:text-green-400 border-success-500/30 dark:border-transparent'
                              : 'bg-danger-500/10 text-danger-700 dark:text-danger-400 border-danger-500/30 dark:border-transparent'
                          }`}
                        >
                          {results[cap.id].details?.skipped ? 'SKIPPED' : results[cap.id].status} (
                          {results[cap.id].latency}ms)
                        </div>

                        {/* Alert Sent Indicator */}
                        {results[cap.id].alertSent && (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold flex items-center gap-1">
                            <Bell size={10} />
                            ALERT
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => testCapability(cap.id, alertsEnabled)}
                      disabled={loading[cap.id]}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        results[cap.id]?.status === 'FAILED'
                          ? 'bg-danger-600 hover:bg-danger-700 text-white'
                          : 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                      }`}
                    >
                      {loading[cap.id] && <RefreshCw size={14} className="animate-spin" />}
                      Run Test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Debug Logs */}
          {Object.keys(results).length > 0 && (
            <div className="bg-gray-900 rounded-xl p-6 font-mono text-xs text-green-400 overflow-auto max-h-80">
              <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  DIAGNOSTIC LOGS
                </span>
                <button
                  onClick={() => setResults({})}
                  className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-xs"
                >
                  Clear
                </button>
              </div>
              {Object.entries(results)
                .reverse()
                .map(([id, res]) => (
                  <div key={id} className="mb-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-blue-400">[{new Date().toLocaleTimeString()}]</span>
                      <span className="text-yellow-400">{id.toUpperCase()}</span>
                      <span
                        className={
                          res.status === 'SUCCESS'
                            ? res.details?.skipped
                              ? 'text-amber-400'
                              : 'text-green-400'
                            : 'text-danger-400'
                        }
                      >
                        {res.details?.skipped ? 'SKIPPED' : res.status} ({res.latency}ms)
                      </span>
                      {res.alertSent && (
                        <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          🔔 ALERT SENT
                        </span>
                      )}
                    </div>
                    {res.error && (
                      <div className="text-danger-400 ml-4 mt-1">Error: {res.error}</div>
                    )}
                    {res.details?.warning && (
                      <div className="text-amber-400 ml-4 mt-1">⚠️ {res.details.warning}</div>
                    )}
                    {res.details?.model && (
                      <div className="text-gray-500 dark:text-gray-400 ml-4 mt-1">
                        Model: {res.details.model}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Usage Analytics - DBR77 Compatible */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-info-500/20 rounded-lg">
                  <Activity size={20} className="text-info-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  LAST 7 DAYS
                </span>
              </div>
              <div className="text-2xl font-bold text-navy-900 dark:text-white mb-1">
                {analytics?.totalCalls?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Requests</div>
            </div>

            <div className="p-4 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-success-500/20 rounded-lg">
                  <Zap size={20} className="text-success-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  AVG LATENCY
                </span>
              </div>
              <div className="text-2xl font-bold text-navy-900 dark:text-white mb-1">
                {analytics?.avgLatency || 0}ms
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Response Time</div>
            </div>

            <div className="p-4 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-warning-500/20 rounded-lg">
                  <Coins size={20} className="text-warning-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  TOTAL TOKENS
                </span>
              </div>
              <div className="text-2xl font-bold text-navy-900 dark:text-white mb-1">
                {(analytics?.totalTokens || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tokens Used</div>
            </div>

            <div className="p-4 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start mb-2">
                <div
                  className={`p-2 rounded-lg ${
                    (analytics?.errorRate || 0) > 0.05 ? 'bg-danger-500/20' : 'bg-primary-500/20'
                  }`}
                >
                  <AlertTriangle
                    size={20}
                    className={
                      (analytics?.errorRate || 0) > 0.05
                        ? 'text-danger-600 dark:text-danger-400'
                        : 'text-primary-600 dark:text-primary-400'
                    }
                  />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  ERROR RATE
                </span>
              </div>
              <div className="text-2xl font-bold text-navy-900 dark:text-white mb-1">
                {((analytics?.errorRate || 0) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {Math.round((analytics?.errorRate || 0) * (analytics?.totalCalls || 0))} Failed
                Requests
              </div>
            </div>
          </div>

          {/* Placeholder for charts */}
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-8 text-center shadow-sm dark:shadow-none">
            <TrendingUp className="w-12 h-12 text-slate-500 dark:text-slate-400 dark:text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">Usage Trends</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Interactive usage charts are available in the Analytics tab
            </p>
          </div>
        </div>
      )}

      {/* Request Logs - DBR77 Compatible */}
      {activeSubTab === 'logs' && (
        <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700 flex justify-between items-center">
            <h3 className="font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <Terminal size={18} className="text-slate-500 dark:text-slate-400" />
              Recent AI Interactions
            </h3>
            <button
              onClick={loadAnalytics}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <RefreshCw size={14} className="inline mr-1" />
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-left border-collapse"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-black/20 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Provider / Model</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {logs.map((log: LogEntry) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          !log.error
                            ? 'bg-success-500/10 text-success-700 dark:text-emerald-400 border-success-500/30 dark:border-emerald-500/20'
                            : 'bg-danger-500/10 text-danger-700 dark:text-danger-400 border-danger-500/30 dark:border-danger-500/20'
                        }`}
                      >
                        {log.error ? 'error' : 'success'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-navy-900 dark:text-white font-medium">
                          {log.provider}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {log.model}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {log.latency}ms
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {log.tokens} tokens
                    </td>
                    <td className="px-4 py-3">
                      {log.error ? (
                        <span
                          className="text-danger-600 dark:text-danger-400 text-xs truncate max-w-[200px] block"
                          title={log.error}
                        >
                          {log.error}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-400 text-xs italic">
                          Success
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 italic"
                    >
                      No logs found in the last 7 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthMonitoringTab;
