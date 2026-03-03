import React, { useEffect, useState } from 'react';

import { Button } from '../ui/primitives/Button';

interface CapabilityResult {
  capability: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  latency: number;
  details: any;
  error?: string;
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

export const AIMissionControl: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [results, setResults] = useState<Record<string, CapabilityResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const capabilities = [
    { id: 'connection', name: 'AI Connection (Basic)', icon: '🔌' },
    { id: 'eyes', name: 'AI Eyes (Visual Context)', icon: '👁️' },
    { id: 'memory', name: 'AI Memory (RAG)', icon: '🧠' },
    { id: 'hands', name: 'AI Hands (MCP Tools)', icon: '🤝' },
    { id: 'reasoning', name: 'MAX Mode (Reasoning)', icon: '🚀' },
  ];

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      // Using direct fetch or Api service if available
      const token = localStorage.getItem('token');
      const response = await fetch('/api/llm/health/status', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setStatus({
        providers: Array.isArray(data?.providers) ? data.providers : [],
        metrics: {
          uptime50: Number(data?.metrics?.uptime50 || 0),
          avgLatencyMs: Number(data?.metrics?.avgLatencyMs || 0),
          totalRequests: Number(data?.metrics?.totalRequests || 0),
        },
        timestamp: String(data?.timestamp || new Date().toISOString()),
      });
    } catch (err) {
      console.error('Failed to fetch AI status', err);
    }
  };

  const testCapability = async (capId: string) => {
    setLoading((prev) => ({ ...prev, [capId]: true }));
    try {
      const response = await fetch(`/api/llm/health/test/${capId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token')
            ? `Bearer ${localStorage.getItem('token')}`
            : '',
        },
        body: JSON.stringify({ context: {} }),
      });
      const data = await response.json();
      setResults((prev) => ({ ...prev, [capId]: data }));
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
    } finally {
      setLoading((prev) => ({ ...prev, [capId]: false }));
      fetchStatus(); // Refresh overall metrics
    }
  };

  return (
    <div className="p-6 space-y-8 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Mission Control</h1>
        <Button onClick={fetchStatus} variant="ghost" size="sm">
          Refresh Status
        </Button>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
            Success Rate (Last 50)
          </h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {status?.metrics?.uptime50?.toFixed(1) ?? '0.0'}%
            </span>
            <span
              className={`ml-2 text-sm font-medium ${status?.metrics?.uptime50 && status.metrics.uptime50 > 95 ? 'text-emerald-400' : 'text-amber-300'}`}
            >
              {status?.metrics?.uptime50 && status.metrics.uptime50 > 95 ? 'Excellent' : 'Degraded'}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
            Avg Latency
          </h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {status?.metrics?.avgLatencyMs ?? 0}ms
            </span>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">per request</span>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
            Active Providers
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {(() => {
              const activeProviders = status?.providers?.filter((p) => p.status === 'ACTIVE') || [];
              if (activeProviders.length === 0) {
                return (
                  <span className="text-slate-600 dark:text-slate-400 text-sm">No active providers</span>
                );
              }
              return activeProviders.map((p) => (
                <span
                  key={p.name}
                  className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 text-xs font-medium rounded-full border border-emerald-500/30"
                >
                  {p.name}
                </span>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Capability Tests */}
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-800/60">
          <h2 className="font-semibold text-slate-900 dark:text-white">AI Capability Diagnostics</h2>
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
                  <h3 className="font-medium text-slate-900 dark:text-white">{cap.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Test if {cap.id} is functioning correctly.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {results[cap.id] && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      results[cap.id].status === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-200 border border-red-500/40'
                    }`}
                  >
                    {results[cap.id].status} ({results[cap.id].latency}ms)
                  </div>
                )}
                <Button
                  onClick={() => testCapability(cap.id)}
                  loading={loading[cap.id] as any}
                  variant={results[cap.id]?.status === 'FAILED' ? 'danger' : 'primary'}
                  size="sm"
                  {...({} as any)}
                >
                  Run Test
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Logs (Last Test) */}
      {Object.keys(results).length > 0 && (
        <div className="bg-slate-900 dark:bg-black/60 rounded-xl shadow-lg p-6 font-mono text-xs text-emerald-200 overflow-auto max-h-96 border border-white/10">
          <h3 className="text-slate-200 mb-4 border-b border-white/5 pb-2 flex justify-between">
            <span>LATEST DIAGNOSTIC LOGS</span>
            <button
              onClick={() => setResults({})}
              className="text-slate-400 hover:bg-white/[0.05] rounded px-2 py-1 transition-colors"
            >
              Clear
            </button>
          </h3>
          {Object.entries(results)
            .reverse()
            .map(([id, res]) => (
              <div key={id} className="mb-4">
                <div className="flex gap-2">
                  <span className="text-blue-300">[{new Date().toLocaleTimeString()}]</span>
                  <span className="text-amber-300">{id.toUpperCase()}</span>
                  <span className={res.status === 'SUCCESS' ? 'text-emerald-200' : 'text-rose-200'}>
                    {res.status} ({res.latency}ms)
                  </span>
                </div>
                {res.error && <div className="text-rose-200 ml-4">Error: {res.error}</div>}
                {res.details && (
                  <pre className="ml-4 mt-1 text-slate-100 whitespace-pre-wrap break-words">
                    {JSON.stringify(res.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
