import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { Button } from '../Button';

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
            const response = await fetch('/api/llm/health/status', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const data = await response.json();
            setStatus(data);
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
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">AI Mission Control 🛰️</h1>
                <Button onClick={fetchStatus} variant="outline" size="sm">
                    Refresh Status
                </Button>
            </div>

            {/* System Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Success Rate (Last 50)</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">{status?.metrics.uptime50.toFixed(1)}%</span>
                        <span
                            className={`ml-2 text-sm font-medium ${status && status.metrics.uptime50 > 95 ? 'text-green-600' : 'text-amber-600'}`}
                        >
                            {status && status.metrics.uptime50 > 95 ? 'Excellent' : 'Degraded'}
                        </span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Avg Latency</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">{status?.metrics.avgLatencyMs}ms</span>
                        <span className="ml-2 text-sm text-gray-500">per request</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Active Providers</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {status?.providers
                            .filter((p) => p.status === 'ACTIVE')
                            .map((p) => (
                                <span
                                    key={p.name}
                                    className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full"
                                >
                                    {p.name}
                                </span>
                            ))}
                    </div>
                </div>
            </div>

            {/* Capability Tests */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="font-semibold text-gray-800">AI Capability Diagnostics</h2>
                </div>
                <div className="divide-y divide-gray-100">
                    {capabilities.map((cap) => (
                        <div
                            key={cap.id}
                            className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-3xl">{cap.icon}</span>
                                <div>
                                    <h3 className="font-medium text-gray-900">{cap.name}</h3>
                                    <p className="text-sm text-gray-500">Test if {cap.id} is functioning correctly.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {results[cap.id] && (
                                    <div
                                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                            results[cap.id].status === 'SUCCESS'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
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
                <div className="bg-gray-900 rounded-xl shadow-lg p-6 font-mono text-xs text-green-400 overflow-auto max-h-96">
                    <h3 className="text-gray-400 mb-4 border-b border-gray-800 pb-2 flex justify-between">
                        <span>LATEST DIAGNOSTIC LOGS</span>
                        <button onClick={() => setResults({})} className="text-gray-500 hover:text-white">
                            Clear
                        </button>
                    </h3>
                    {Object.entries(results)
                        .reverse()
                        .map(([id, res]) => (
                            <div key={id} className="mb-4">
                                <div className="flex gap-2">
                                    <span className="text-blue-400">[{new Date().toLocaleTimeString()}]</span>
                                    <span className="text-yellow-400">{id.toUpperCase()}</span>
                                    <span className={res.status === 'SUCCESS' ? 'text-green-500' : 'text-red-500'}>
                                        {res.status} ({res.latency}ms)
                                    </span>
                                </div>
                                {res.error && <div className="text-red-400 ml-4">Error: {res.error}</div>}
                                {res.details && (
                                    <pre className="ml-4 mt-1 opacity-80">{JSON.stringify(res.details, null, 2)}</pre>
                                )}
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};
