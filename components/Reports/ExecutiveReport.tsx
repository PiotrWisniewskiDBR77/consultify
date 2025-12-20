import React, { useState, useCallback } from 'react';
import {
    FileText,
    Download,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Clock,
    TrendingUp,
    Users,
    Target,
    Calendar
} from 'lucide-react';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

interface ExecutiveReportProps {
    projectId?: string;
}

interface ReportData {
    projectName: string;
    generatedAt: string;
    phase: string;
    phaseProgress: number;
    overallHealth: 'healthy' | 'warning' | 'critical';
    summary: string;
    keyMetrics: {
        initiativesTotal: number;
        initiativesCompleted: number;
        tasksTotal: number;
        tasksDone: number;
        decisionsApproved: number;
        decisionsPending: number;
    };
    risks: { title: string; severity: string; description: string }[];
    blockers: { title: string; type: string; daysBlocked: number }[];
    decisions: { title: string; status: string; owner: string }[];
    forecast: string;
}

/**
 * Executive Report Generator
 * AI-powered management summary for CEO/Board level
 */
export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({ projectId }) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ReportData | null>(null);
    const currentProjectId = useAppStore(state => state.currentProjectId);
    const activeProjectId = projectId || currentProjectId;

    const generateReport = useCallback(async () => {
        if (!activeProjectId) {
            toast.error('Please select a project first');
            return;
        }

        setLoading(true);
        try {
            const pmoData = await Api.getPMOContext(activeProjectId);

            // Build executive summary from PMO data
            const reportData: ReportData = {
                projectName: pmoData.projectName || 'Project',
                generatedAt: new Date().toISOString(),
                phase: pmoData.currentPhase || 'Unknown',
                phaseProgress: pmoData.phaseProgress || 0,
                overallHealth: pmoData.blockingIssues?.length > 0 ? 'critical'
                    : pmoData.risks?.length > 0 ? 'warning' : 'healthy',
                summary: generateSummary(pmoData),
                keyMetrics: {
                    initiativesTotal: pmoData.initiativesTotal || 0,
                    initiativesCompleted: pmoData.initiativesCompleted || 0,
                    tasksTotal: pmoData.tasksTotal || 0,
                    tasksDone: pmoData.tasksDone || 0,
                    decisionsApproved: pmoData.decisionsApproved || 0,
                    decisionsPending: pmoData.pendingDecisions?.length || 0
                },
                risks: pmoData.risks || [],
                blockers: pmoData.blockingIssues || [],
                decisions: pmoData.pendingDecisions || [],
                forecast: generateForecast(pmoData)
            };

            setReport(reportData);
            toast.success('Report generated successfully');
        } catch (error) {
            console.error('Failed to generate report:', error);
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    }, [activeProjectId]);

    const generateSummary = (data: any): string => {
        const phase = data.currentPhase || 'Initial';
        const blockers = data.blockingIssues?.length || 0;
        const decisions = data.pendingDecisions?.length || 0;

        if (blockers > 0) {
            return `Project is currently in ${phase} phase with ${blockers} blocking issue(s) requiring immediate attention. ${decisions > 0 ? `Additionally, ${decisions} decision(s) are pending approval.` : ''}`;
        }
        if (decisions > 0) {
            return `Project progressing through ${phase} phase. ${decisions} decision(s) pending that may impact timeline if delayed.`;
        }
        return `Project is on track in ${phase} phase with no critical blockers or pending decisions.`;
    };

    const generateForecast = (data: any): string => {
        const blockers = data.blockingIssues?.length || 0;
        const decisions = data.pendingDecisions?.length || 0;

        if (blockers > 2) {
            return 'HIGH RISK: Multiple blockers may cause significant delays. Recommend executive escalation.';
        }
        if (blockers > 0 || decisions > 3) {
            return 'MEDIUM RISK: Current blockers and pending decisions require active management to stay on schedule.';
        }
        return 'LOW RISK: Project trajectory is positive. Continue current execution cadence.';
    };

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'critical': return 'bg-red-500';
            case 'warning': return 'bg-amber-500';
            default: return 'bg-green-500';
        }
    };

    const getHealthLabel = (health: string) => {
        switch (health) {
            case 'critical': return 'Critical';
            case 'warning': return 'At Risk';
            default: return 'Healthy';
        }
    };

    return (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white">Executive Report</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">AI-generated management summary</p>
                        </div>
                    </div>
                    <button
                        onClick={generateReport}
                        disabled={loading || !activeProjectId}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>
            </div>

            {/* Report Content */}
            {report && (
                <div className="p-6 space-y-6">
                    {/* Report Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">{report.projectName}</h3>
                            <p className="text-xs text-slate-400">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-white text-sm font-medium ${getHealthColor(report.overallHealth)}`}>
                            {getHealthLabel(report.overallHealth)}
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                            <Target size={16} className="text-indigo-500" />
                            Executive Summary
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{report.summary}</p>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {report.keyMetrics.initiativesCompleted}/{report.keyMetrics.initiativesTotal}
                            </div>
                            <div className="text-xs text-blue-500">Initiatives</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {report.keyMetrics.tasksDone}/{report.keyMetrics.tasksTotal}
                            </div>
                            <div className="text-xs text-green-500">Tasks Done</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {report.keyMetrics.decisionsApproved}
                            </div>
                            <div className="text-xs text-purple-500">Decisions Made</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {report.keyMetrics.decisionsPending}
                            </div>
                            <div className="text-xs text-amber-500">Pending Decisions</div>
                        </div>
                    </div>

                    {/* Blockers */}
                    {report.blockers.length > 0 && (
                        <div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                Blocking Issues ({report.blockers.length})
                            </h4>
                            <div className="space-y-2">
                                {report.blockers.map((blocker, idx) => (
                                    <div key={idx} className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-3 rounded-r-lg">
                                        <div className="text-sm font-medium text-red-800 dark:text-red-300">{blocker.title}</div>
                                        <div className="text-xs text-red-600 dark:text-red-400">
                                            {blocker.type} • {blocker.daysBlocked || 0} days blocked
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Decisions */}
                    {report.decisions.length > 0 && (
                        <div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <Clock size={16} className="text-amber-500" />
                                Pending Decisions ({report.decisions.length})
                            </h4>
                            <div className="space-y-2">
                                {report.decisions.slice(0, 5).map((d, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{d.title}</span>
                                        <span className="text-xs text-slate-500">{d.owner || 'Unassigned'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Forecast */}
                    <div className={`rounded-xl p-4 ${report.forecast.includes('HIGH') ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30' :
                            report.forecast.includes('MEDIUM') ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30' :
                                'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30'
                        }`}>
                        <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                            <TrendingUp size={16} />
                            Forecast & Recommendation
                        </h4>
                        <p className="text-sm">{report.forecast}</p>
                    </div>

                    {/* Export Button */}
                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                        <button className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors">
                            <Download size={16} />
                            Export PDF
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!report && !loading && (
                <div className="p-12 text-center">
                    <FileText size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">No Report Generated</h3>
                    <p className="text-sm text-slate-400 mb-4">Click "Generate Report" to create an AI-powered executive summary</p>
                </div>
            )}
        </div>
    );
};

export default ExecutiveReport;
