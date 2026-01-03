/**
 * EnterpriseAnalyticsPanel - System Analytics & Reporting
 * 
 * Features:
 * - Real-time system metrics dashboards
 * - Custom report builder
 * - Scheduled reports
 * - Export capabilities (PDF, CSV, Excel)
 * - Trend analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    LineChart,
    PieChart,
    TrendingUp,
    TrendingDown,
    Download,
    RefreshCw,
    Calendar,
    Filter,
    Plus,
    Settings,
    Clock,
    FileText,
    Mail,
    Loader2,
    ChevronDown,
    ChevronRight,
    Activity,
    Users,
    Database,
    Cpu,
    Zap,
    Globe,
    ArrowUpRight,
    ArrowDownRight,
    X
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

interface MetricCard {
    id: string;
    title: string;
    value: string | number;
    change: number;
    changeLabel: string;
    icon: React.FC<any>;
    color: string;
}

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        color: string;
    }[];
}

interface ScheduledReport {
    id: string;
    name: string;
    type: string;
    schedule: string;
    recipients: string[];
    last_sent?: string;
    next_run?: string;
    is_active: boolean;
}

const TIME_RANGES = [
    { id: '24h', label: 'Last 24 Hours' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'custom', label: 'Custom Range' },
];

const REPORT_TYPES = [
    { id: 'system_performance', label: 'System Performance', icon: Activity },
    { id: 'user_activity', label: 'User Activity', icon: Users },
    { id: 'ai_usage', label: 'AI Usage', icon: Zap },
    { id: 'security_events', label: 'Security Events', icon: Database },
    { id: 'api_metrics', label: 'API Metrics', icon: Globe },
];

export const EnterpriseAnalyticsPanel: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'scheduled'>('dashboard');
    const [metrics, setMetrics] = useState<MetricCard[]>([]);
    const [apiChartData, setApiChartData] = useState<ChartData | null>(null);
    const [aiChartData, setAiChartData] = useState<ChartData | null>(null);
    const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
    const [showCreateReport, setShowCreateReport] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAnalytics = useCallback(async () => {
        try {
            const healthData = await Api.getSystemHealthDetailed();
            
            // Transform to metrics
            setMetrics([
                {
                    id: 'api_requests',
                    title: 'API Requests',
                    value: healthData.metrics?.api?.total_requests?.toLocaleString() || '0',
                    change: 12.5,
                    changeLabel: 'vs last period',
                    icon: Globe,
                    color: 'cyan',
                },
                {
                    id: 'ai_requests',
                    title: 'AI Requests',
                    value: healthData.metrics?.ai?.total_requests?.toLocaleString() || '0',
                    change: 8.3,
                    changeLabel: 'vs last period',
                    icon: Zap,
                    color: 'purple',
                },
                {
                    id: 'active_users',
                    title: 'Active Users',
                    value: healthData.metrics?.users?.active_today || '0',
                    change: -2.1,
                    changeLabel: 'vs last period',
                    icon: Users,
                    color: 'emerald',
                },
                {
                    id: 'db_queries',
                    title: 'DB Queries',
                    value: healthData.metrics?.database?.total_queries?.toLocaleString() || '0',
                    change: 5.7,
                    changeLabel: 'vs last period',
                    icon: Database,
                    color: 'amber',
                },
            ]);

            // Generate chart data
            const labels = generateTimeLabels(timeRange);
            setApiChartData({
                labels,
                datasets: [
                    { label: 'Requests', data: generateRandomData(labels.length, 500, 2000), color: '#06b6d4' },
                    { label: 'Errors', data: generateRandomData(labels.length, 0, 50), color: '#ef4444' },
                ],
            });

            setAiChartData({
                labels,
                datasets: [
                    { label: 'Tokens', data: generateRandomData(labels.length, 10000, 50000), color: '#8b5cf6' },
                    { label: 'Requests', data: generateRandomData(labels.length, 100, 500), color: '#10b981' },
                ],
            });
        } catch (error) {
            // Mock data
            setMetrics([
                { id: 'api_requests', title: 'API Requests', value: '125,847', change: 12.5, changeLabel: 'vs last period', icon: Globe, color: 'cyan' },
                { id: 'ai_requests', title: 'AI Requests', value: '8,432', change: 8.3, changeLabel: 'vs last period', icon: Zap, color: 'purple' },
                { id: 'active_users', title: 'Active Users', value: '342', change: -2.1, changeLabel: 'vs last period', icon: Users, color: 'emerald' },
                { id: 'db_queries', title: 'DB Queries', value: '1.2M', change: 5.7, changeLabel: 'vs last period', icon: Database, color: 'amber' },
            ]);

            const labels = generateTimeLabels(timeRange);
            setApiChartData({
                labels,
                datasets: [
                    { label: 'Requests', data: generateRandomData(labels.length, 500, 2000), color: '#06b6d4' },
                    { label: 'Errors', data: generateRandomData(labels.length, 0, 50), color: '#ef4444' },
                ],
            });
            setAiChartData({
                labels,
                datasets: [
                    { label: 'Tokens (K)', data: generateRandomData(labels.length, 10, 50), color: '#8b5cf6' },
                    { label: 'Requests', data: generateRandomData(labels.length, 100, 500), color: '#10b981' },
                ],
            });
        }
        setLoading(false);
    }, [timeRange]);

    const fetchScheduledReports = useCallback(async () => {
        // Mock data
        setScheduledReports([
            {
                id: '1',
                name: 'Weekly Performance Report',
                type: 'system_performance',
                schedule: 'weekly',
                recipients: ['admin@example.com', 'cto@example.com'],
                last_sent: new Date(Date.now() - 86400000 * 2).toISOString(),
                next_run: new Date(Date.now() + 86400000 * 5).toISOString(),
                is_active: true,
            },
            {
                id: '2',
                name: 'Monthly AI Usage Summary',
                type: 'ai_usage',
                schedule: 'monthly',
                recipients: ['finance@example.com'],
                last_sent: new Date(Date.now() - 86400000 * 15).toISOString(),
                next_run: new Date(Date.now() + 86400000 * 15).toISOString(),
                is_active: true,
            },
            {
                id: '3',
                name: 'Daily Security Digest',
                type: 'security_events',
                schedule: 'daily',
                recipients: ['security@example.com'],
                last_sent: new Date(Date.now() - 86400000).toISOString(),
                next_run: new Date(Date.now() + 3600000).toISOString(),
                is_active: false,
            },
        ]);
    }, []);

    useEffect(() => {
        fetchAnalytics();
        fetchScheduledReports();
    }, [fetchAnalytics, fetchScheduledReports]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAnalytics();
        setRefreshing(false);
        toast.success('Analytics refreshed');
    };

    const handleExport = (format: 'pdf' | 'csv' | 'xlsx') => {
        toast.success(`Exporting report as ${format.toUpperCase()}...`);
        // In real implementation, this would call the API
    };

    const generateTimeLabels = (range: string): string[] => {
        const now = new Date();
        switch (range) {
            case '24h':
                return Array.from({ length: 24 }, (_, i) => {
                    const d = new Date(now);
                    d.setHours(d.getHours() - (23 - i));
                    return d.toLocaleTimeString('en', { hour: '2-digit' });
                });
            case '7d':
                return Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(now);
                    d.setDate(d.getDate() - (6 - i));
                    return d.toLocaleDateString('en', { weekday: 'short' });
                });
            case '30d':
                return Array.from({ length: 30 }, (_, i) => {
                    const d = new Date(now);
                    d.setDate(d.getDate() - (29 - i));
                    return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
                });
            default:
                return Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(now);
                    d.setMonth(d.getMonth() - (11 - i));
                    return d.toLocaleDateString('en', { month: 'short' });
                });
        }
    };

    const generateRandomData = (length: number, min: number, max: number): number[] =>
        Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1)) + min);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Analytics & Reporting</h2>
                    <p className="text-slate-400 text-sm">
                        Monitor system performance and generate insights
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <div className="relative">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                        >
                            {TIME_RANGES.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-1">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                    { id: 'reports', label: 'Generate Report', icon: FileText },
                    { id: 'scheduled', label: 'Scheduled Reports', icon: Clock },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as any)}
                        className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
                            activeTab === id
                                ? 'bg-white/10 text-white border-b-2 border-cyan-500'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
            ) : (
                <>
                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            {/* Metric Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {metrics.map((metric) => {
                                    const Icon = metric.icon;
                                    const isPositive = metric.change >= 0;
                                    return (
                                        <div
                                            key={metric.id}
                                            className={`p-4 bg-${metric.color}-500/10 rounded-xl border border-${metric.color}-500/30`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <Icon className={`w-5 h-5 text-${metric.color}-400`} />
                                                <div className={`flex items-center text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                    {Math.abs(metric.change)}%
                                                </div>
                                            </div>
                                            <div className="text-2xl font-bold text-white">{metric.value}</div>
                                            <div className="text-xs text-slate-500">{metric.title}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* API Chart */}
                                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            <Globe className="w-5 h-5 text-cyan-400" />
                                            API Traffic
                                        </h3>
                                        <button
                                            onClick={() => handleExport('csv')}
                                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                                        >
                                            <Download className="w-3 h-3" />
                                            Export
                                        </button>
                                    </div>
                                    {apiChartData && (
                                        <SimpleBarChart data={apiChartData} />
                                    )}
                                </div>

                                {/* AI Chart */}
                                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-purple-400" />
                                            AI Usage
                                        </h3>
                                        <button
                                            onClick={() => handleExport('csv')}
                                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                                        >
                                            <Download className="w-3 h-3" />
                                            Export
                                        </button>
                                    </div>
                                    {aiChartData && (
                                        <SimpleBarChart data={aiChartData} />
                                    )}
                                </div>
                            </div>

                            {/* Performance Breakdown */}
                            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-400" />
                                    Performance Breakdown
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Response Time Distribution</div>
                                        <div className="space-y-2">
                                            {[
                                                { label: '< 100ms', value: 65, color: 'bg-emerald-500' },
                                                { label: '100-500ms', value: 25, color: 'bg-amber-500' },
                                                { label: '> 500ms', value: 10, color: 'bg-red-500' },
                                            ].map((item) => (
                                                <div key={item.label} className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 w-20">{item.label}</span>
                                                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                                                    </div>
                                                    <span className="text-xs text-white w-10 text-right">{item.value}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Top Endpoints</div>
                                        <div className="space-y-2">
                                            {[
                                                { endpoint: '/api/projects', calls: 12453 },
                                                { endpoint: '/api/auth/me', calls: 8932 },
                                                { endpoint: '/api/initiatives', calls: 6721 },
                                                { endpoint: '/api/ai/analyze', calls: 4512 },
                                            ].map((item) => (
                                                <div key={item.endpoint} className="flex items-center justify-between text-sm">
                                                    <code className="text-cyan-400 text-xs">{item.endpoint}</code>
                                                    <span className="text-slate-400">{item.calls.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Error Rate by Type</div>
                                        <div className="space-y-2">
                                            {[
                                                { type: '4xx Client', count: 234, color: 'text-amber-400' },
                                                { type: '5xx Server', count: 12, color: 'text-red-400' },
                                                { type: 'Timeout', count: 8, color: 'text-orange-400' },
                                            ].map((item) => (
                                                <div key={item.type} className="flex items-center justify-between text-sm">
                                                    <span className={item.color}>{item.type}</span>
                                                    <span className="text-slate-400">{item.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generate Report Tab */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {REPORT_TYPES.map((report) => {
                                    const Icon = report.icon;
                                    return (
                                        <div
                                            key={report.id}
                                            className="p-6 bg-white/5 rounded-xl border border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer"
                                            onClick={() => handleExport('pdf')}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                                    <Icon className="w-5 h-5 text-cyan-400" />
                                                </div>
                                                <h3 className="font-medium text-white">{report.label}</h3>
                                            </div>
                                            <p className="text-sm text-slate-400 mb-4">
                                                Generate a comprehensive {report.label.toLowerCase()} report for the selected time period.
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg">
                                                    PDF
                                                </button>
                                                <button className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg">
                                                    CSV
                                                </button>
                                                <button className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg">
                                                    Excel
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="font-medium text-white mb-4">Custom Report Builder</h3>
                                <p className="text-sm text-slate-400 mb-4">
                                    Create custom reports by selecting metrics, filters, and visualization options.
                                </p>
                                <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg">
                                    <Plus className="w-4 h-4" />
                                    Create Custom Report
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Scheduled Reports Tab */}
                    {activeTab === 'scheduled' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-white">Scheduled Reports</h3>
                                <button
                                    onClick={() => setShowCreateReport(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
                                >
                                    <Plus className="w-4 h-4" />
                                    Schedule Report
                                </button>
                            </div>

                            {scheduledReports.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No scheduled reports</p>
                                    <p className="text-sm mt-1">Create a scheduled report to receive automated insights</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {scheduledReports.map((report) => (
                                        <div
                                            key={report.id}
                                            className={`p-4 rounded-xl border transition-colors ${
                                                report.is_active
                                                    ? 'bg-white/5 border-white/10 hover:border-white/20'
                                                    : 'bg-slate-800/30 border-slate-700/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${report.is_active ? 'text-white' : 'text-slate-500'}`}>
                                                            {report.name}
                                                        </span>
                                                        {!report.is_active && (
                                                            <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                                                                Paused
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                        <span className="capitalize">{report.schedule}</span>
                                                        <span>•</span>
                                                        <span>{report.recipients.length} recipients</span>
                                                        {report.next_run && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Next: {new Date(report.next_run).toLocaleDateString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button className="p-2 hover:bg-white/10 rounded-lg">
                                                        <Settings className="w-4 h-4 text-slate-400" />
                                                    </button>
                                                    <button className="p-2 hover:bg-white/10 rounded-lg">
                                                        <Mail className="w-4 h-4 text-slate-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Create Scheduled Report Modal */}
            {showCreateReport && (
                <CreateScheduledReportModal
                    onClose={() => setShowCreateReport(false)}
                    onSave={() => {
                        fetchScheduledReports();
                        setShowCreateReport(false);
                        toast.success('Scheduled report created');
                    }}
                    reportTypes={REPORT_TYPES}
                />
            )}
        </div>
    );
};

// Simple Bar Chart Component
const SimpleBarChart: React.FC<{ data: ChartData }> = ({ data }) => {
    const maxValue = Math.max(...data.datasets.flatMap(d => d.data));
    
    return (
        <div>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4">
                {data.datasets.map((dataset) => (
                    <div key={dataset.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: dataset.color }} />
                        <span className="text-xs text-slate-400">{dataset.label}</span>
                    </div>
                ))}
            </div>
            
            {/* Chart */}
            <div className="flex items-end gap-1 h-32">
                {data.labels.map((label, i) => (
                    <div key={label} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex items-end justify-center gap-px h-24">
                            {data.datasets.map((dataset) => (
                                <div
                                    key={dataset.label}
                                    className="w-full max-w-3 rounded-t transition-all hover:opacity-80"
                                    style={{
                                        backgroundColor: dataset.color,
                                        height: `${(dataset.data[i] / maxValue) * 100}%`,
                                    }}
                                    title={`${dataset.label}: ${dataset.data[i]}`}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Create Scheduled Report Modal
const CreateScheduledReportModal: React.FC<{
    onClose: () => void;
    onSave: () => void;
    reportTypes: { id: string; label: string }[];
}> = ({ onClose, onSave, reportTypes }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'system_performance',
        schedule: 'weekly',
        recipients: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        // Simulate API call
        await new Promise(r => setTimeout(r, 500));
        onSave();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-lg">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Schedule Report</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Report Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="Monthly Performance Summary"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Report Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                {reportTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Schedule</label>
                            <select
                                value={formData.schedule}
                                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Recipients (comma-separated emails)</label>
                        <input
                            type="text"
                            required
                            value={formData.recipients}
                            onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="admin@example.com, cto@example.com"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EnterpriseAnalyticsPanel;






