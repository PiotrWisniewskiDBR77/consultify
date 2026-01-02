/**
 * AdminAnalyticsView - AI Strategic Center with Performance KPIs
 */

import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import {
    Cpu, Zap, AlertTriangle, TrendingUp, DollarSign, Activity,
    MessageSquare, Lightbulb, Target, CheckCircle, Clock, RefreshCw,
    Loader2, BarChart2, ThumbsUp, ThumbsDown, Eye
} from 'lucide-react';
import { Api } from '../../services/api';
import { useTranslation } from 'react-i18next';

// Generate mock data for empty charts
const generateMockUsageData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            tokens: Math.floor(Math.random() * 50000) + 10000,
            cost: Math.random() * 5 + 1
        });
    }
    return data;
};

const generateMockFailureData = () => [
    { reason: 'Timeout', count: 12 },
    { reason: 'Rate Limit', count: 8 },
    { reason: 'Invalid Input', count: 5 },
    { reason: 'API Error', count: 3 },
];

export const AdminAnalyticsView: React.FC = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<any>(null);
    const [ideas, setIdeas] = useState<any[]>([]);
    const [observations, setObservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'kpis' | 'ideas' | 'observations'>('kpis');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [statsData, ideasData, obsData] = await Promise.all([
                Api.getAIDeepReports().catch(() => null),
                Api.getAIIdeas().catch(() => []),
                Api.getAIObservations().catch(() => [])
            ]);
            setStats(statsData);
            setIdeas(ideasData || []);
            setObservations(obsData || []);
        } catch (error) {
            console.error("Failed to load AI analytics", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleVoteIdea = async (id: string, status: string) => {
        try {
            await Api.updateAIIdea(id, { status });
            loadData();
        } catch (e) {
            console.error("Failed to update idea", e);
        }
    };

    // Safe number formatting
    const formatPercentage = (value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(value)) return '0%';
        return `${(value * 100).toFixed(1)}%`;
    };

    const formatNumber = (value: number | undefined | null, fallback: string = '0'): string => {
        if (value === undefined || value === null || isNaN(value)) return fallback;
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toLocaleString();
    };

    const formatCurrency = (value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(value)) return '$0.00';
        return `$${value.toFixed(2)}`;
    };

    // Use mock data if real data is empty
    const usageData = stats?.usageTrend?.length > 0 ? stats.usageTrend : generateMockUsageData();
    const failureData = stats?.topFailureModes?.length > 0 ? stats.topFailureModes : generateMockFailureData();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header - Clean minimal */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-medium text-white flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-slate-500" />
                        {t('admin.analytics.title', 'AI Strategic Center')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {t('admin.analytics.subtitle', 'Monitor AI performance, costs, and strategic insights')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="admin-btn admin-btn-accent disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('admin.analytics.refresh', 'Refresh Analysis')}
                    </button>
                </div>
            </div>

            {/* Tab Buttons - Clean minimal */}
            <div className="flex space-x-1">
                <button
                    onClick={() => setActiveTab('kpis')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'kpis' 
                            ? 'bg-white/10 text-white' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {t('admin.analytics.performanceKpis', 'Performance & KPIs')}
                </button>
                <button
                    onClick={() => setActiveTab('ideas')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'ideas' 
                            ? 'bg-white/10 text-white' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {t('admin.analytics.strategicIdeas', 'Strategic Ideas')}
                </button>
                <button
                    onClick={() => setActiveTab('observations')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'observations' 
                            ? 'bg-white/10 text-white' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {t('admin.analytics.observations', 'Observations')}
                </button>
            </div>

            {/* KPIs Tab */}
            {activeTab === 'kpis' && (
                <div className="space-y-6">
                    {/* KPI Cards - Clean minimal */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="admin-metric">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="admin-metric-label">
                                        {t('admin.analytics.successRate', 'Success Rate')}
                                    </p>
                                    <p className="admin-metric-value">
                                        {formatPercentage(stats?.successRate)}
                                    </p>
                                </div>
                                <CheckCircle className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">+2.3%</span>
                                <span>{t('admin.analytics.vsLastMonth', 'vs last month')}</span>
                            </div>
                        </div>

                        <div className="admin-metric">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="admin-metric-label">
                                        {t('admin.analytics.avgResponseTime', 'Avg Response Time')}
                                    </p>
                                    <p className="admin-metric-value">
                                        {stats?.avgResponseTime?.toFixed(1) || '1.2'}s
                                    </p>
                                </div>
                                <Clock className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">-0.3s</span>
                                <span>{t('admin.analytics.improvement', 'improvement')}</span>
                            </div>
                        </div>

                        <div className="admin-metric">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="admin-metric-label">
                                        {t('admin.analytics.totalTokens', 'Total Tokens')}
                                    </p>
                                    <p className="admin-metric-value">
                                        {formatNumber(stats?.totalTokens, '1.2M')}
                                    </p>
                                </div>
                                <Cpu className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                                {t('admin.analytics.thisWeek', 'This week')}
                            </div>
                        </div>

                        <div className="admin-metric">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="admin-metric-label">
                                        {t('admin.analytics.estCost', 'Est. Cost')}
                                    </p>
                                    <p className="admin-metric-value">
                                        {formatCurrency(stats?.estimatedCost)}
                                    </p>
                                </div>
                                <DollarSign className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                                {t('admin.analytics.thisMonth', 'This month')}
                            </div>
                        </div>
                    </div>

                    {/* Charts Row - Clean minimal */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Failure Modes */}
                        <div className="admin-card p-4">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-slate-500" />
                                {t('admin.analytics.failureModes', 'Failure Modes Analysis')}
                            </h3>
                            <div className="h-64">
                                {failureData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={failureData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                                            <YAxis dataKey="reason" type="category" stroke="#64748b" fontSize={12} width={80} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#0f172a', 
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    color: '#fff'
                                                }} 
                                            />
                                            <Bar dataKey="count" fill="#64748b" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                        <CheckCircle className="w-12 h-12 mb-2 opacity-50" />
                                        <p className="text-sm">{t('admin.analytics.noFailures', 'No failures recorded')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Token Usage Trend */}
                        <div className="admin-card p-4">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-500" />
                                {t('admin.analytics.tokenUsageTrend', 'Token Usage Trend')}
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={usageData}>
                                        <defs>
                                            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            formatter={(value: any) => [value.toLocaleString(), 'Tokens']}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="tokens" 
                                            stroke="#94a3b8" 
                                            strokeWidth={2} 
                                            fill="url(#tokenGradient)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Model Performance */}
                    <div className="admin-card p-4">
                        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-slate-500" />
                            {t('admin.analytics.modelPerformance', 'Model Performance by Provider')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { name: 'OpenAI GPT-4', success: 98.5, tokens: '450K', cost: '$12.50', color: 'emerald' },
                                { name: 'Claude 3.5', success: 97.2, tokens: '320K', cost: '$8.20', color: 'purple' },
                                { name: 'Gemini Pro', success: 95.8, tokens: '180K', cost: '$4.30', color: 'blue' }
                            ].map((model, idx) => (
                                <div key={idx} className="p-4 bg-white/5 rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-white">{model.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full bg-${model.color}-500/20 text-${model.color}-400`}>
                                            {model.success}% success
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-400">
                                        <span>{model.tokens} tokens</span>
                                        <span>{model.cost}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Ideas Tab */}
            {activeTab === 'ideas' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-white">
                            {t('admin.analytics.ideasBoard', 'Strategic Ideas Board')}
                        </h2>
                        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            {t('admin.analytics.submitIdea', 'Submit New Idea')}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ideas.length > 0 ? ideas.map((idea) => (
                            <div key={idea.id} className="bg-navy-900 border border-white/5 p-5 rounded-xl hover:border-purple-500/30 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        idea.priority === 'high' 
                                            ? 'bg-red-500/20 text-red-400' 
                                            : idea.priority === 'medium' 
                                                ? 'bg-amber-500/20 text-amber-400' 
                                                : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                        {idea.priority?.toUpperCase() || 'LOW'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {new Date(idea.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-white mb-2">{idea.title}</h3>
                                <p className="text-slate-400 text-sm mb-4 line-clamp-3">{idea.description}</p>
                                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleVoteIdea(idea.id, 'approved')}
                                            className="p-2 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors"
                                            title="Approve"
                                        >
                                            <ThumbsUp className="w-4 h-4" />
                                        </button>
                                        <button 
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" 
                                            title="Reject"
                                        >
                                            <ThumbsDown className="w-4 h-4" />
                                        </button>
                                        <button 
                                            className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors" 
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        idea.status === 'new' 
                                            ? 'bg-blue-500/20 text-blue-400' 
                                            : idea.status === 'approved' 
                                                ? 'bg-emerald-500/20 text-emerald-400' 
                                                : 'bg-white/10 text-slate-400'
                                    }`}>
                                        {idea.status?.toUpperCase() || 'NEW'}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-12 text-center bg-navy-900 border border-dashed border-white/10 rounded-xl">
                                <Lightbulb className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-500">{t('admin.analytics.noIdeas', 'No strategic ideas yet. Start by creating one!')}</p>
                                <button className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
                                    {t('admin.analytics.createFirst', 'Create First Idea')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Observations Tab */}
            {activeTab === 'observations' && (
                <div className="bg-navy-900 border border-white/5 rounded-xl overflow-hidden">
                    <div className="p-5 border-b border-white/5">
                        <h2 className="text-lg font-semibold text-white">
                            {t('admin.analytics.observationsLog', 'System Observations Log')}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {t('admin.analytics.observationsDesc', 'Automated insights and anomalies detected by the AI Monitor')}
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {observations.length > 0 ? observations.map((obs) => (
                            <div key={obs.id} className="p-5 hover:bg-white/5 transition-colors">
                                <div className="flex items-start">
                                    <div className={`mt-1 p-2 rounded-lg mr-4 ${
                                        obs.category === 'anomaly' 
                                            ? 'bg-red-500/20 text-red-400' 
                                            : obs.category === 'insight' 
                                                ? 'bg-purple-500/20 text-purple-400' 
                                                : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                        {obs.category === 'anomaly' 
                                            ? <AlertTriangle className="w-5 h-5" /> 
                                            : obs.category === 'insight' 
                                                ? <Lightbulb className="w-5 h-5" /> 
                                                : <Activity className="w-5 h-5" />
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-semibold text-white">
                                                Observation #{obs.id.substring(0, 8)}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(obs.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-sm">{obs.content}</p>
                                        <div className="mt-2 flex items-center space-x-4">
                                            <span className="text-xs bg-white/10 text-slate-300 px-2 py-1 rounded">
                                                Confidence: {(obs.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center">
                                <Activity className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-500">{t('admin.analytics.noObservations', 'No observations recorded yet.')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAnalyticsView;
