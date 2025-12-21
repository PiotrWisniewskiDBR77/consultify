import React, { useEffect, useState } from 'react';
import {
    Building2, TrendingUp, AlertTriangle, CheckCircle2,
    Calendar, Users, Download, Share2, Loader2, ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InitiativeSummary {
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    dueDate?: string;
    owner?: string;
}

interface Blocker {
    initiative: string;
    task: string;
    blocked_reason?: string;
}

interface UpcomingTask {
    title: string;
    due_date?: string;
    initiative: string;
}

interface OrgOverviewReport {
    reportType: string;
    generatedAt: string;
    organization: {
        name: string;
        type: string;
        status: string;
        memberSince: string;
    };
    transformationContext: {
        goals?: string;
        digital_maturity?: string;
        transformation_type?: string;
    };
    overallProgress: number;
    initiativesSummary: InitiativeSummary[];
    activeBlockers: Blocker[];
    upcomingTasks: UpcomingTask[];
}

interface OrganizationOverviewReportProps {
    onExportPDF?: () => void;
    onShare?: () => void;
    isPublic?: boolean;
    snapshotData?: OrgOverviewReport;
}

const statusColors: Record<string, string> = {
    'draft': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    'in_progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'completed': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'blocked': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    'on_hold': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

const priorityColors: Record<string, string> = {
    'critical': 'text-red-600 dark:text-red-400',
    'high': 'text-orange-600 dark:text-orange-400',
    'medium': 'text-yellow-600 dark:text-yellow-400',
    'low': 'text-gray-500 dark:text-gray-400',
};

export const OrganizationOverviewReport: React.FC<OrganizationOverviewReportProps> = ({
    onExportPDF,
    onShare,
    isPublic = false,
    snapshotData
}) => {
    const { t } = useTranslation();
    const [report, setReport] = useState<OrgOverviewReport | null>(snapshotData || null);
    const [loading, setLoading] = useState(!snapshotData);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (snapshotData) return;

        const fetchReport = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/reports/org-overview', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to load report');
                const data = await response.json();
                setReport(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [snapshotData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="p-6 text-center text-red-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                <p>{error || 'Failed to load report'}</p>
            </div>
        );
    }

    return (
        <div id="org-report" className="max-w-5xl mx-auto p-6 space-y-8 bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {report.organization.name}
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('reports.generatedAt')}: {new Date(report.generatedAt).toLocaleString()}
                    </p>
                </div>

                {!isPublic && (
                    <div className="flex gap-2">
                        {onExportPDF && (
                            <button
                                onClick={onExportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                {t('reports.exportPDF')}
                            </button>
                        )}
                        {onShare && (
                            <button
                                onClick={onShare}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <Share2 className="w-4 h-4" />
                                {t('reports.share')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Overall Progress Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold mb-1">{t('reports.overallProgress')}</h2>
                        <p className="text-white/80 text-sm">
                            {report.initiativesSummary.length} {t('reports.initiatives')}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">{report.overallProgress}%</div>
                        <div className="text-white/80 text-sm">{t('reports.complete')}</div>
                    </div>
                </div>
                <div className="mt-4 bg-white/20 rounded-full h-3">
                    <div
                        className="bg-white rounded-full h-3 transition-all duration-500"
                        style={{ width: `${report.overallProgress}%` }}
                    />
                </div>
            </div>

            {/* Transformation Context */}
            {report.transformationContext?.goals && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        {t('reports.transformationGoals')}
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300">
                        {report.transformationContext.goals}
                    </p>
                    {report.transformationContext.digital_maturity && (
                        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            {t('reports.digitalMaturity')}: {report.transformationContext.digital_maturity}
                        </div>
                    )}
                </div>
            )}

            {/* Initiatives Summary */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    {t('reports.keyInitiatives')}
                </h2>
                <div className="space-y-3">
                    {report.initiativesSummary.map((initiative) => (
                        <div
                            key={initiative.id}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                            {initiative.title}
                                        </h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[initiative.status] || statusColors.draft}`}>
                                            {initiative.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                        {initiative.owner && (
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {initiative.owner}
                                            </span>
                                        )}
                                        {initiative.dueDate && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(initiative.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className={priorityColors[initiative.priority] || priorityColors.medium}>
                                            {initiative.priority}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right ml-4">
                                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {initiative.progress}%
                                    </div>
                                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                                        <div
                                            className="bg-blue-500 rounded-full h-2 transition-all"
                                            style={{ width: `${initiative.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Blockers */}
            {report.activeBlockers.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        {t('reports.activeBlockers')}
                    </h2>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 space-y-3">
                        {report.activeBlockers.map((blocker, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {blocker.task}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {blocker.initiative}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Tasks */}
            {report.upcomingTasks.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-blue-500" />
                        {t('reports.nextSteps')}
                    </h2>
                    <div className="space-y-2">
                        {report.upcomingTasks.map((task, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {task.title}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {task.initiative}
                                    </div>
                                </div>
                                {task.due_date && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            {isPublic && (
                <div className="text-center text-sm text-gray-400 dark:text-gray-500 pt-8 border-t border-gray-200 dark:border-gray-700">
                    {t('reports.sharedReport')} • Consultinity
                </div>
            )}
        </div>
    );
};

export default OrganizationOverviewReport;
