/**
 * HealthMonitoringTab - AI Health & Monitoring
 * 
 * Tab 2 of the reorganized AI & Intelligence section
 * Includes: Mission Control, Provider Health Dashboard, Usage Analytics, Error Log
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Zap,
    Coins,
    Terminal,
    TrendingUp,
    Clock,
    BarChart2,
    AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Api } from '../../../services/api';
import { Button } from '../../Button';

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

interface AnalyticsData {
    total_requests: number;
    avg_latency: number;
    total_cost: number;
    error_rate: number;
    error_count: number;
}

interface LogEntry {
    id: string;
    timestamp: string;
    provider: string;
    model: string;
    status: string;
    latency_ms: number;
    cost: number;
    error_message?: string;
}

export const HealthMonitoringTab: React.FC = () => {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [results, setResults] = useState<Record<string, CapabilityResult>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'mission' | 'analytics' | 'logs'>('mission');

    const capabilities = [
        { id: 'connection', name: 'AI Connection (Basic)', icon: '🔌', description: 'Test if AI connection is functioning correctly' },
        { id: 'eyes', name: 'AI Eyes (Visual Context)', icon: '👁️', description: 'Test visual context understanding' },
        { id: 'memory', name: 'AI Memory (RAG)', icon: '🧠', description: 'Test memory retrieval system' },
        { id: 'hands', name: 'AI Hands (MCP Tools)', icon: '🤝', description: 'Test tool execution capability' },
        { id: 'reasoning', name: 'MAX Mode (Reasoning)', icon: '🚀', description: 'Test advanced reasoning mode' }
    ];

    useEffect(() => {
        fetchStatus();
        loadAnalytics();
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/llm/health/status', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
            const [stats, recentLogs] = await Promise.all([
                Api.getLLMAnalytics(7),
                Api.getLLMLogs(50)
            ]);
            setAnalytics(stats);
            setLogs(recentLogs.logs || []);
        } catch (error) {
            console.error('Failed to load analytics', error);
        }
        setLoadingAnalytics(false);
    };

    const testCapability = async (capId: string) => {
        setLoading(prev => ({ ...prev, [capId]: true }));
        try {
            const response = await fetch(`/api/llm/health/test/${capId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ context: {} })
            });
            const data = await response.json();
            setResults(prev => ({ ...prev, [capId]: data }));
            if (data.status === 'SUCCESS') {
                toast.success(`${capId} test passed (${data.latency}ms)`);
            } else {
                toast.error(`${capId} test failed`);
            }
        } catch (err: any) {
            setResults(prev => ({ 
                ...prev, 
                [capId]: { 
                    capability: capId, 
                    status: 'FAILED', 
                    latency: 0, 
                    details: null, 
                    error: err.message 
                } 
            }));
            toast.error(`Test failed: ${err.message}`);
        } finally {
            setLoading(prev => ({ ...prev, [capId]: false }));
            fetchStatus();
        }
    };

    const runAllTests = async () => {
        for (const cap of capabilities) {
            await testCapability(cap.id);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-1">
                <button
                    onClick={() => setActiveSubTab('mission')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeSubTab === 'mission' 
                            ? 'border-violet-500 text-violet-400' 
                            : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                >
                    <Activity size={14} className="inline mr-2" />
                    Mission Control
                </button>
                <button
                    onClick={() => setActiveSubTab('analytics')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeSubTab === 'analytics' 
                            ? 'border-violet-500 text-violet-400' 
                            : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                >
                    <BarChart2 size={14} className="inline mr-2" />
                    Usage Analytics
                </button>
                <button
                    onClick={() => setActiveSubTab('logs')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeSubTab === 'logs' 
                            ? 'border-violet-500 text-violet-400' 
                            : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                >
                    <Terminal size={14} className="inline mr-2" />
                    Request Logs
                </button>
            </div>

            {/* Mission Control */}
            {activeSubTab === 'mission' && (
                <div className="space-y-6">
                    {/* System Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-navy-900/50 border border-white/10 p-6 rounded-xl">
                            <h3 className="text-sm font-medium text-slate-400 uppercase mb-2">Success Rate (Last 50)</h3>
                            <div className="flex items-baseline">
                                <span className="text-3xl font-bold text-white">
                                    {status?.metrics.uptime50?.toFixed(1) || '0.0'}%
                                </span>
                                <span className={`ml-2 text-sm font-medium ${
                                    status && status.metrics.uptime50 > 95 ? 'text-green-400' : 'text-amber-400'
                                }`}>
                                    {status && status.metrics.uptime50 > 95 ? 'Excellent' : 'Degraded'}
                                </span>
                            </div>
                        </div>
                        <div className="bg-navy-900/50 border border-white/10 p-6 rounded-xl">
                            <h3 className="text-sm font-medium text-slate-400 uppercase mb-2">Avg Latency</h3>
                            <div className="flex items-baseline">
                                <span className="text-3xl font-bold text-white">
                                    {status?.metrics.avgLatencyMs || 0}ms
                                </span>
                                <span className="ml-2 text-sm text-slate-500">per request</span>
                            </div>
                        </div>
                        <div className="bg-navy-900/50 border border-white/10 p-6 rounded-xl">
                            <h3 className="text-sm font-medium text-slate-400 uppercase mb-2">Active Providers</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {status?.providers.filter(p => p.status === 'ACTIVE').map(p => (
                                    <span key={p.name} className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-medium rounded-full">
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Capability Tests */}
                    <div className="bg-navy-900/50 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                            <div>
                                <h2 className="font-semibold text-white">AI Capability Diagnostics</h2>
                                <p className="text-sm text-slate-400 mt-1">Test individual AI capabilities</p>
                            </div>
                            <button
                                onClick={runAllTests}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Run All Tests
                            </button>
                        </div>
                        <div className="divide-y divide-white/5">
                            {capabilities.map(cap => (
                                <div key={cap.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl">{cap.icon}</span>
                                        <div>
                                            <h3 className="font-medium text-white">{cap.name}</h3>
                                            <p className="text-sm text-slate-400">{cap.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {results[cap.id] && (
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                                results[cap.id].status === 'SUCCESS' 
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : 'bg-red-500/20 text-red-400'
                                            }`}>
                                                {results[cap.id].status} ({results[cap.id].latency}ms)
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => testCapability(cap.id)} 
                                            disabled={loading[cap.id]}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                results[cap.id]?.status === 'FAILED' 
                                                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                                                    : 'bg-violet-600 hover:bg-violet-500 text-white'
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
                        <div className="bg-gray-900 rounded-xl p-6 font-mono text-xs text-green-400 overflow-auto max-h-64">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <span className="text-gray-400">DIAGNOSTIC LOGS</span>
                                <button 
                                    onClick={() => setResults({})} 
                                    className="text-gray-500 hover:text-white text-xs"
                                >
                                    Clear
                                </button>
                            </div>
                            {Object.entries(results).reverse().map(([id, res]) => (
                                <div key={id} className="mb-3">
                                    <div className="flex gap-2">
                                        <span className="text-blue-400">[{new Date().toLocaleTimeString()}]</span>
                                        <span className="text-yellow-400">{id.toUpperCase()}</span>
                                        <span className={res.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>
                                            {res.status} ({res.latency}ms)
                                        </span>
                                    </div>
                                    {res.error && <div className="text-red-400 ml-4">Error: {res.error}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Usage Analytics */}
            {activeSubTab === 'analytics' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-navy-900/50 border border-white/10 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Activity size={20} className="text-blue-400" />
                                </div>
                                <span className="text-xs font-mono text-slate-500">LAST 7 DAYS</span>
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {analytics?.total_requests?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-slate-400">Total Requests</div>
                        </div>

                        <div className="p-4 bg-navy-900/50 border border-white/10 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <Zap size={20} className="text-emerald-400" />
                                </div>
                                <span className="text-xs font-mono text-slate-500">AVG LATENCY</span>
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {analytics?.avg_latency || 0}ms
                            </div>
                            <div className="text-xs text-slate-400">Response Time</div>
                        </div>

                        <div className="p-4 bg-navy-900/50 border border-white/10 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <Coins size={20} className="text-amber-400" />
                                </div>
                                <span className="text-xs font-mono text-slate-500">EST. COST</span>
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                ${(analytics?.total_cost || 0).toFixed(4)}
                            </div>
                            <div className="text-xs text-slate-400">Total Spend</div>
                        </div>

                        <div className="p-4 bg-navy-900/50 border border-white/10 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-lg ${
                                    (analytics?.error_rate || 0) > 0.05 ? 'bg-red-500/20' : 'bg-purple-500/20'
                                }`}>
                                    <AlertTriangle size={20} className={
                                        (analytics?.error_rate || 0) > 0.05 ? 'text-red-400' : 'text-purple-400'
                                    } />
                                </div>
                                <span className="text-xs font-mono text-slate-500">ERROR RATE</span>
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {((analytics?.error_rate || 0) * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-400">
                                {analytics?.error_count || 0} Failed Requests
                            </div>
                        </div>
                    </div>

                    {/* Placeholder for charts */}
                    <div className="bg-navy-900/50 border border-white/10 rounded-xl p-8 text-center">
                        <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white">Usage Trends</h3>
                        <p className="text-slate-400 mt-1">Coming soon: Interactive usage charts</p>
                    </div>
                </div>
            )}

            {/* Request Logs */}
            {activeSubTab === 'logs' && (
                <div className="bg-navy-900/50 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Terminal size={18} className="text-slate-400" />
                            Recent AI Interactions
                        </h3>
                        <button 
                            onClick={loadAnalytics}
                            className="text-sm text-violet-400 hover:text-violet-300"
                        >
                            <RefreshCw size={14} className="inline mr-1" />
                            Refresh
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 text-xs uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Provider / Model</th>
                                    <th className="px-4 py-3">Latency</th>
                                    <th className="px-4 py-3">Cost</th>
                                    <th className="px-4 py-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map((log: LogEntry) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm">
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                log.status === 'success'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{log.provider}</span>
                                                <span className="text-xs text-slate-500">{log.model}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                                            {log.latency_ms}ms
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                                            ${(log.cost || 0).toFixed(6)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {log.error_message ? (
                                                <span className="text-red-400 text-xs truncate max-w-[200px] block" title={log.error_message}>
                                                    {log.error_message}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-xs italic">Success</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
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


