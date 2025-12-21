import React, { useEffect, useState } from 'react';
import {
    Target, CheckCircle2, AlertTriangle, Clock,
    Users, Calendar, Download, Share2, Loader2,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    progress: number;
    assignee?: string;
    blockedReason?: string;
}

interface TaskStats {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    todo: number;
}

interface Blocker {
    task: string;
    reason?: string;
}

interface Deadline {
    task: string;
    dueDate: string;
    assignee?: string;
}

interface InitiativeReport {
    reportType: string;
    generatedAt: string;
    initiative: {
        id: string;
        title: string;
        description?: string;
        status: string;
        priority: string;
        dueDate?: string;
        owner?: string;
    };
    progress: number;
    taskStats: TaskStats;
    tasks: Task[];
    blockers: Blocker[];
    upcomingDeadlines: Deadline[];
}

interface InitiativeExecutionReportProps {
    initiativeId?: string;
    onExportPDF?: () => void;
    onShare?: () => void;
    isPublic?: boolean;
    snapshotData?: InitiativeReport;
}

const statusColors: Record<string, string> = {
    'todo': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    'in_progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'done': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'blocked': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export const InitiativeExecutionReport: React.FC<InitiativeExecutionReportProps> = ({
    initiativeId,
    onExportPDF,
    onShare,
    isPublic = false,
    snapshotData
}) => {
    const { t } = useTranslation();
    const [report, setReport] = useState<InitiativeReport | null>(snapshotData || null);
    const [loading, setLoading] = useState(!snapshotData);
    const [error, setError] = useState<string | null>(null);
    const [showAllTasks, setShowAllTasks] = useState(false);

    useEffect(() => {
        if (snapshotData || !initiativeId) return;

        const fetchReport = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/reports/initiative/${initiativeId}`, {
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
    }, [initiativeId, snapshotData]);

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

    const displayedTasks = showAllTasks ? report.tasks : report.tasks.slice(0, 10);

    return (
        <div id="initiative-report" className="max-w-5xl mx-auto p-6 space-y-8 bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Target className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {report.initiative.title}
                        </h1>
                    </div>
                    {report.initiative.description && (
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mb-2">
                            {report.initiative.description}
                        </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('reports.generatedAt')}: {new Date(report.generatedAt).toLocaleString()}
                    </p>
                </div>

                {!isPublic && (
                    <div className="flex gap-2">
                        {onExportPDF && (
                            <button
                                onClick={onExportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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

            {/* Owner and Due Date */}
            <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                {report.initiative.owner && (
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{t('reports.owner')}: {report.initiative.owner}</span>
                    </div>
                )}
                {report.initiative.dueDate && (
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{t('reports.dueDate')}: {new Date(report.initiative.dueDate).toLocaleDateString()}</span>
                    </div>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.initiative.status] || statusColors.todo}`}>
                    {report.initiative.status}
                </span>
            </div>

            {/* Progress Card */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">{t('reports.progress')}</h2>
                    <div className="text-4xl font-bold">{report.progress}%</div>
                </div>
                <div className="bg-white/20 rounded-full h-3 mb-4">
                    <div
                        className="bg-white rounded-full h-3 transition-all duration-500"
                        style={{ width: `${report.progress}%` }}
                    />
                </div>

                {/* Task Stats */}
                <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold">{report.taskStats.completed}</div>
                        <div className="text-white/80 text-sm">{t('reports.completed')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{report.taskStats.inProgress}</div>
                        <div className="text-white/80 text-sm">{t('reports.inProgress')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{report.taskStats.todo}</div>
                        <div className="text-white/80 text-sm">{t('reports.todo')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{report.taskStats.blocked}</div>
                        <div className="text-white/80 text-sm">{t('reports.blocked')}</div>
                    </div>
                </div>
            </div>

            {/* Blockers */}
            {report.blockers.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        {t('reports.blockers')} ({report.blockers.length})
                    </h2>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 space-y-3">
                        {report.blockers.map((blocker, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {blocker.task}
                                    </div>
                                    {blocker.reason && (
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {blocker.reason}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Deadlines */}
            {report.upcomingDeadlines.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        {t('reports.upcomingDeadlines')}
                    </h2>
                    <div className="space-y-2">
                        {report.upcomingDeadlines.map((deadline, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-orange-500" />
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {deadline.task}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    {deadline.assignee && <span>{deadline.assignee}</span>}
                                    <span className="font-medium text-orange-600 dark:text-orange-400">
                                        {new Date(deadline.dueDate).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tasks List */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    {t('reports.tasks')} ({report.taskStats.total})
                </h2>
                <div className="space-y-2">
                    {displayedTasks.map((task) => (
                        <div
                            key={task.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${task.status === 'done' ? 'bg-green-500' :
                                    task.status === 'in_progress' ? 'bg-blue-500' :
                                        task.status === 'blocked' ? 'bg-red-500' : 'bg-gray-400'
                                    }`} />
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {task.title}
                                </span>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[task.status] || statusColors.todo}`}>
                                    {task.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                {task.assignee && <span>{task.assignee}</span>}
                                {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                                <span className="font-medium">{task.progress}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                {report.tasks.length > 10 && (
                    <button
                        onClick={() => setShowAllTasks(!showAllTasks)}
                        className="w-full mt-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
                    >
                        {showAllTasks ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                {t('reports.showLess')}
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" />
                                {t('reports.showAll')} ({report.tasks.length - 10} {t('reports.more')})
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Footer */}
            {isPublic && (
                <div className="text-center text-sm text-gray-400 dark:text-gray-500 pt-8 border-t border-gray-200 dark:border-gray-700">
                    {t('reports.sharedReport')} • Consultinity
                </div>
            )}
        </div>
    );
};

export default InitiativeExecutionReport;
