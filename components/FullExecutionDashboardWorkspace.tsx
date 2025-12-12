import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FullSession, FullInitiative, Language } from '../types';
// import { translations } from '../translations';
import {
    LayoutDashboard, ListChecks, Activity, TrendingUp,
    AlertTriangle, Bot, FileText, ArrowRight, Download, BarChart3,
    CheckCircle2, Clock, Zap
} from 'lucide-react';
// import { exportReportToPDF } from '../services/pdf/pdfExport';
import { AIInsightFeed } from './AIInsightFeed';
import { Button } from './Button';

interface FullExecutionDashboardWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onGenerateReport: () => void;
    language: Language;
}

type DashboardTab = 'overview' | 'progress' | 'kpi' | 'roi' | 'risks' | 'ai' | 'report';

export const FullExecutionDashboardWorkspace: React.FC<FullExecutionDashboardWorkspaceProps> = ({
    fullSession,
    onGenerateReport,
    language: _language
}) => {
    const { currentUser } = useAppStore();
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

    const handleDownloadPDF = async () => {
        onGenerateReport();
    };

    // --- Components ---

    const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
        <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-500 group-hover:scale-110 duration-500`}>
                <Icon size={64} />
            </div>
            <div>
                <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    {title}
                </div>
                <div className={`text-3xl font-black text-navy-900 dark:text-white tracking-tight`}>
                    {value}
                </div>
            </div>
            <div className={`mt-4 text-xs font-medium flex items-center gap-1 text-${color}-600 dark:text-${color}-400`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse`} />
                {subtext}
            </div>
        </div>
    );

    const renderOverview = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Health Score"
                    value="92%"
                    subtext="Transformation Healthy"
                    icon={Activity}
                    color="green"
                />
                <StatCard
                    title="Active Initiatives"
                    value={fullSession.initiatives.length.toString()}
                    subtext={`${fullSession.initiatives.filter(i => i.status === 'In Progress').length} In Progress`}
                    icon={ListChecks}
                    color="blue"
                />
                <StatCard
                    title="Value Realized"
                    value="$1.85M"
                    subtext="22% of Target ($8.4M)"
                    icon={TrendingUp}
                    color="purple"
                />
                <StatCard
                    title="Critical Risks"
                    value="3"
                    subtext="Need Attention"
                    icon={AlertTriangle}
                    color="red"
                />
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">

                {/* Main Content - 2 Cols */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full">

                    {/* Charts Area */}
                    <div className="flex-1 glass-card p-6 relative flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-navy-900 dark:text-white">
                                <BarChart3 size={20} className="text-brand" />
                                Value Realization Trajectory
                            </h3>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-[10px] uppercase font-bold text-slate-500">Milestone 1</span>
                                <span className="px-2 py-1 rounded bg-brand/10 text-[10px] uppercase font-bold text-brand">Current</span>
                            </div>
                        </div>

                        {/* Placeholder Chart */}
                        <div className="flex-1 w-full bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brand/20 to-transparent opacity-50 group-hover:h-full transition-all duration-1000" />
                            <p className="text-slate-400 text-sm font-medium z-10">Use Recharts for real data visualization here</p>
                        </div>
                    </div>

                    {/* AI Insights Bar */}
                    <div className="h-48 glass-card p-0 overflow-hidden relative border-brand/20">
                        <div className="absolute top-0 left-0 w-1 h-full bg-brand" />
                        <AIInsightFeed session={fullSession} />
                    </div>

                </div>

                {/* Right Panel - 1 Col */}
                <div className="lg:col-span-1 flex flex-col gap-6 h-full">

                    {/* Recent Activity */}
                    <div className="flex-1 glass-card p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                            <Clock size={14} /> Live Activity
                        </h3>
                        <div className="space-y-4">
                            {[
                                { text: "Pilot 1 'Smart Factory' Completed", time: "2h ago", color: "green" },
                                { text: "Risk #4 'Data Privacy' Updated to High", time: "5h ago", color: "red" },
                                { text: "New Initiative 'AI Customer Support' Added", time: "1d ago", color: "blue" },
                                { text: "Budget approved for Phase 2", time: "2d ago", color: "purple" },
                            ].map((evt, i) => (
                                <div key={i} className="flex gap-3 group">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-2 h-2 rounded-full bg-${evt.color}-500 ring-4 ring-${evt.color}-500/20 group-hover:ring-8 transition-all duration-300`} />
                                        <div className="w-px h-full bg-slate-200 dark:bg-white/10 mt-2" />
                                    </div>
                                    <div className="pb-4">
                                        <p className="text-sm font-medium text-navy-900 dark:text-white leading-tight">{evt.text}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{evt.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Action */}
                    <div className="h-32 bg-gradient-to-br from-brand to-brand-hover rounded-xl p-5 shadow-lg shadow-brand/20 text-white flex flex-col justify-between relative overflow-hidden group cursor-pointer border border-white/10" onClick={() => setActiveTab('report')}>
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500">
                            <FileText size={80} />
                        </div>
                        <h4 className="font-bold text-lg z-10">Generate Report</h4>
                        <div className="flex items-center gap-2 text-xs font-medium bg-white/20 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors z-10">
                            Download PDF <ArrowRight size={12} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );

    const renderProgress = () => (
        <div className="glass-panel rounded-xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-transparent">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <ListChecks className="text-blue-500" size={20} /> Initiative Tracking
                </h3>
                <div className="flex gap-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">12 On Track</span>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">3 At Risk</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                            <th className="p-4 pl-6">Initiative</th>
                            <th className="p-4">Owner</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 w-1/3">Progress</th>
                            <th className="p-4">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {fullSession.initiatives.map(init => (
                            <tr key={init.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                <td className="p-4 pl-6 font-semibold text-navy-900 dark:text-white group-hover:text-brand transition-colors">
                                    {init.name}
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px] font-bold">
                                            {(init.ownerBusiness?.firstName || 'U')[0]}
                                        </div>
                                        {init.ownerBusiness?.firstName || 'Unassigned'}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium border
                                        ${init.status === 'Done' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20' :
                                            init.status === 'In Progress' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                                                'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
                                        {init.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-900 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-brand to-blue-500 rounded-full" style={{ width: '65%' }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">65%</span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs font-mono">
                                    Dec 2025
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderAI = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            <div className="glass-panel p-6 rounded-2xl border-brand/20 relative overflow-hidden animate-fade-in">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand/20 blur-3xl rounded-full pointer-events-none" />
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Zap className="text-brand" size={20} /> Proactive Insights
                </h3>
                <AIInsightFeed session={fullSession} />
            </div>

            <div className="glass-card p-10 flex flex-col items-center justify-center text-center animate-fade-in delay-100">
                <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mb-6 shadow-glow">
                    <Bot size={40} className="text-brand" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-navy-900 dark:text-white">AI Command Center</h3>
                <p className="text-slate-500 mb-8 max-w-sm leading-relaxed">
                    Ask complex questions about your transformation data. The AI has access to your KPIs, Risks, and Roadmap.
                </p>

                <div className="w-full max-w-md relative group">
                    <input
                        type="text"
                        placeholder="Ask a question..."
                        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 p-4 pl-6 rounded-xl text-sm focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all shadow-lg dark:text-white group-hover:shadow-glow-lg/20"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-md">
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderReport = () => (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center max-w-3xl mx-auto space-y-10 animate-fade-in">
            <div className="space-y-4 relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
                <FileText className="w-24 h-24 text-blue-500 mx-auto relative z-10 drop-shadow-lg" />
                <h2 className="text-4xl font-black text-navy-900 dark:text-white tracking-tight relative z-10">Use The Final Report</h2>
                <p className="text-slate-500 text-lg max-w-xl mx-auto relative z-10">
                    Generate a comprehensive, board-ready PDF report encapsulating your entire Digital Transformation Strategy.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full text-left">
                <div className="glass-card p-6">
                    <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-green-500" /> Sections
                    </h4>
                    <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-3">
                        {['Executive Summary', 'Maturity Assessment Results', 'Strategic Initiatives Roadmap', 'Financial Case (ROI, NPV)', 'Risk & Change Management'].map(item => (
                            <li key={item} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" /> {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="glass-card p-6">
                    <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                        <Download size={18} className="text-blue-500" /> Options
                    </h4>
                    <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-3">
                        <li className="flex items-center justify-between">
                            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> PDF Document</span>
                            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-bold">READY</span>
                        </li>
                        <li className="flex items-center justify-between opacity-60">
                            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> PowerPoint</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-white/10 text-slate-500 px-2 py-0.5 rounded font-bold">SOON</span>
                        </li>
                    </ul>
                </div>
            </div>

            <Button
                onClick={handleDownloadPDF}
                size="lg"
                variant="primary"
                className="px-12 py-4 text-lg shadow-glow-lg hover:scale-105 transition-transform"
                icon={<Download size={24} />}
            >
                Generate Final Report
            </Button>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'progress': return renderProgress();
            case 'kpi': return <div className="p-20 text-center text-slate-400 font-mono text-sm bg-white/5 border border-dashed border-white/10 rounded-xl">KPI Widgets Coming Soon</div>;
            case 'roi': return <div className="p-20 text-center text-slate-400 font-mono text-sm bg-white/5 border border-dashed border-white/10 rounded-xl">ROI Widgets Coming Soon</div>;
            case 'risks': return <div className="p-20 text-center text-slate-400 font-mono text-sm bg-white/5 border border-dashed border-white/10 rounded-xl">Risk Matrix Coming Soon</div>;
            case 'ai': return renderAI();
            case 'report': return renderReport();
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-navy-950 text-navy-900 dark:text-white transition-colors">
            {/* Header */}
            <div className="h-20 px-8 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-brand/10 rounded-lg text-brand">
                            <LayoutDashboard size={24} />
                        </div>
                        Execution Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-1">{currentUser?.companyName || 'Client'} Transformation Program</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-900 rounded-full border border-slate-200 dark:border-white/10 shadow-sm text-xs font-medium text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Last updated: Just now
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Floating Pill Style */}
            <div className="px-8 pb-6">
                <div className="flex gap-1 p-1 bg-white/60 dark:bg-navy-900/60 backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/5 w-fit shadow-sm">
                    {[
                        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                        { id: 'progress', label: 'Progress', icon: ListChecks },
                        { id: 'ai', label: 'AI Command', icon: Bot },
                        { id: 'report', label: 'Report', icon: FileText },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as DashboardTab)}
                            className={`
                                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-200
                                ${activeTab === tab.id
                                    ? 'bg-white dark:bg-navy-800 text-brand shadow-sm scale-105'
                                    : 'text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}
                            `}
                        >
                            <tab.icon size={16} className={activeTab === tab.id ? 'text-brand' : 'opacity-70'} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                <div className="max-w-[1600px] mx-auto animate-fade-up">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
