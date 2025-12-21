/**
 * AI Analytics Dashboard
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Executive dashboard for AI action/playbook analytics:
 * - Approval breakdown (manual vs auto)
 * - Execution success rates
 * - Playbook completion rates
 * - Dead-letter statistics
 * - ROI summary (hours saved, cost reduction)
 * - Export functionality
 */

import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    TrendingUp, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle,
    Play, Download, RefreshCw, Activity, Zap, Target
} from 'lucide-react';
import { Api } from '../services/api';

interface DashboardData {
    actions: {
        total_executions: number;
        success_count: number;
        failed_count: number;
        success_rate: number;
        by_action_type: Record<string, { success: number; failed: number; total: number }>;
    };
    approvals: {
        total_decisions: number;
        approved: number;
        rejected: number;
        modified: number;
        auto_approved: number;
        manual_approved: number;
        auto_approval_rate: number;
        approval_rate: number;
    };
    playbooks: {
        total_runs: number;
        completed: number;
        failed: number;
        completion_rate: number;
        by_playbook: Record<string, { name: string; total: number; completed: number; failed: number; completion_rate: number; avg_duration_mins: number | null }>;
    };
    deadLetter: {
        total_jobs: number;
        dead_letter_count: number;
        dead_letter_rate: number;
        by_error_code: Record<string, number>;
    };
    timeToResolution: {
        avg_resolution_mins: number | null;
        min_resolution_mins: number | null;
        max_resolution_mins: number | null;
        sample_count: number;
    };
    roi: {
        hours_saved: number;
        cost_saved: number;
        currency: string;
        actions_executed: number;
        playbooks_completed: number;
    };
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const AIAnalyticsDashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
            const response = await Api.get(`/analytics/ai/dashboard?${params.toString()}`);
            setData(response);
        } catch (err: unknown) {
            console.error('Failed to load AI analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            setExporting(true);
            const params = new URLSearchParams({ format, from: dateRange.from, to: dateRange.to });
            const response = await Api.get(`/analytics/ai/export?${params.toString()}`);

            if (format === 'csv' && typeof response === 'string') {
                const blob = new Blob([response], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ai_analytics_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ai_analytics_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                {error}
                <button onClick={loadData} className="ml-4 text-red-600 underline">Retry</button>
            </div>
        );
    }

    if (!data) return null;

    // Prepare chart data
    const approvalPieData = [
        { name: 'Auto-Approved', value: data.approvals.auto_approved, color: '#10b981' },
        { name: 'Manual Approved', value: data.approvals.manual_approved, color: '#6366f1' },
        { name: 'Rejected', value: data.approvals.rejected, color: '#ef4444' },
        { name: 'Modified', value: data.approvals.modified, color: '#f59e0b' }
    ].filter(d => d.value > 0);

    const executionData = [
        { name: 'Success', value: data.actions.success_count, fill: '#10b981' },
        { name: 'Failed', value: data.actions.failed_count, fill: '#ef4444' }
    ];

    const playbookData = Object.entries(data.playbooks.by_playbook || {}).map(([key, pb]) => ({
        name: pb.name || key,
        completed: pb.completed,
        failed: pb.failed,
        rate: pb.completion_rate
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Analytics Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Outcomes, ROI & Learning Loop
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Date Range */}
                    <div className="flex items-center space-x-2 text-sm">
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    {/* Export Buttons */}
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport('json')}
                            disabled={exporting}
                            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            JSON
                        </button>
                    </div>
                </div>
            </div>

            {/* ROI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Hours Saved</p>
                            <p className="text-2xl font-bold text-green-600">{data.roi.hours_saved.toFixed(1)}h</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full">
                            <Clock className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Cost Saved</p>
                            <p className="text-2xl font-bold text-indigo-600">${data.roi.cost_saved.toFixed(0)}</p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                            <DollarSign className="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Actions Executed</p>
                            <p className="text-2xl font-bold text-purple-600">{data.actions.total_executions}</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                            <Zap className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Playbooks Completed</p>
                            <p className="text-2xl font-bold text-amber-600">{data.playbooks.completed}</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-full">
                            <Target className="w-6 h-6 text-amber-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Rates Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Execution Success Rate</span>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.actions.success_rate}%</div>
                    <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${data.actions.success_rate}%` }}></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Playbook Completion Rate</span>
                        <Play className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.playbooks.completion_rate}%</div>
                    <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${data.playbooks.completion_rate}%` }}></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dead-Letter Rate</span>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.deadLetter.dead_letter_rate}%</div>
                    <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(data.deadLetter.dead_letter_rate, 100)}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Approval Breakdown */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Approval Breakdown</h3>
                    <div className="h-64">
                        {approvalPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={approvalPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    >
                                        {approvalPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <Activity className="w-8 h-8 mr-2" />
                                No approval data yet
                            </div>
                        )}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.approvals.auto_approval_rate}%</div>
                            <div className="text-gray-500 dark:text-gray-400">Auto-Approval Rate</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.approvals.total_decisions}</div>
                            <div className="text-gray-500 dark:text-gray-400">Total Decisions</div>
                        </div>
                    </div>
                </div>

                {/* Execution Status */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Execution Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={executionData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-between text-sm">
                        <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            <span className="text-gray-600 dark:text-gray-400">{data.actions.success_count} successful</span>
                        </div>
                        <div className="flex items-center">
                            <XCircle className="w-4 h-4 text-red-500 mr-1" />
                            <span className="text-gray-600 dark:text-gray-400">{data.actions.failed_count} failed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Playbook Performance Table */}
            {playbookData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Playbook Performance</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Playbook</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Completed</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Failed</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {playbookData.map((pb, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{pb.name}</td>
                                        <td className="py-3 px-4 text-sm text-right text-green-600">{pb.completed}</td>
                                        <td className="py-3 px-4 text-sm text-right text-red-600">{pb.failed}</td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <span className={`px-2 py-1 rounded ${pb.rate >= 80 ? 'bg-green-100 text-green-700' : pb.rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {pb.rate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Time to Resolution */}
            {data.timeToResolution.sample_count > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Time to Resolution</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                {data.timeToResolution.avg_resolution_mins?.toFixed(1) || '-'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Avg (mins)</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="text-3xl font-bold text-green-600">
                                {data.timeToResolution.min_resolution_mins?.toFixed(1) || '-'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Min (mins)</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="text-3xl font-bold text-red-600">
                                {data.timeToResolution.max_resolution_mins?.toFixed(1) || '-'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Max (mins)</div>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Based on {data.timeToResolution.sample_count} completed playbook runs
                    </p>
                </div>
            )}
        </div>
    );
};

export default AIAnalyticsDashboard;
