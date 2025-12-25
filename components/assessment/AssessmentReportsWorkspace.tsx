import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, Loader2, AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface AssessmentReport {
    id: string;
    title: string;
    generated_at: string;
    avg_actual: number;
    avg_target: number;
    gap_points: number;
    status?: 'draft' | 'finalized';
}

interface AssessmentReportsWorkspaceProps {
    onStartNewAssessment?: () => void;
    onViewReport?: (reportId: string) => void;
    onGenerateInitiatives?: (reportId: string) => void;
}

export const AssessmentReportsWorkspace: React.FC<AssessmentReportsWorkspaceProps> = ({
    onStartNewAssessment,
    onViewReport,
    onGenerateInitiatives
}) => {
    const { currentProjectId, setCurrentReport } = useAppStore();
    const { t } = useTranslation();
    const [reports, setReports] = useState<AssessmentReport[]>([]);
    const [filteredReports, setFilteredReports] = useState<AssessmentReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [sortBy, setSortBy] = useState<'date' | 'title' | 'gap'>('date');


    useEffect(() => {
        loadReports();
    }, [currentProjectId]);

    const loadReports = async () => {
        if (!currentProjectId) return;
        try {
            setLoading(true);
            const data = await Api.getAssessmentReports(currentProjectId);
            setReports(data);
        } catch (error: any) {
            console.error('Failed to load reports:', error);
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    // Filter and sort reports
    useEffect(() => {
        let filtered = reports;

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(r =>
                r.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
            } else if (sortBy === 'title') {
                return a.title.localeCompare(b.title);
            } else { // gap
                return b.gap_points - a.gap_points;
            }
        });

        setFilteredReports(filtered);
    }, [reports, searchQuery, showArchived, sortBy]);


    const handleGenerateReport = async () => {
        if (!currentProjectId) return;
        try {
            setGenerating(true);
            const newReport = await Api.generateAssessmentReport(currentProjectId);
            toast.success('Report generated successfully');
            await loadReports();
        } catch (error: any) {
            console.error('Failed to generate report:', error);
            toast.error('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const handleViewReport = async (reportId: string) => {
        try {
            const report = await Api.getAssessmentReport(reportId);
            setSelectedReport(report);
        } catch (error: any) {
            console.error('Failed to load report details:', error);
            toast.error('Failed to load report');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    if (selectedReport) {
        // Report Detail View
        const assessment = selectedReport.assessment_snapshot || {};
        const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

        return (
            <div className="flex flex-col h-full bg-white dark:bg-navy-900">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => setSelectedReport(null)}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline mb-2"
                        >
                            ← {t('common.back', 'Back to reports')}
                        </button>
                        <h3 className="text-2xl font-bold text-navy-900 dark:text-white">{selectedReport.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('assessment.reports.generatedOn', 'Generated on')} {formatDate(selectedReport.generated_at)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Download size={16} />
                            {t('common.print', 'Print')}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const { pdfUrl } = await Api.exportReportPDF(selectedReport.id);
                                    window.open(pdfUrl, '_blank');
                                    toast.success('PDF exported successfully');
                                } catch (error) {
                                    toast.error('Failed to export PDF');
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <FileText size={16} />
                            {t('assessment.reports.exportPDF', 'Export PDF')}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const { excelUrl } = await Api.exportReportExcel(selectedReport.id);
                                    window.open(excelUrl, '_blank');
                                    toast.success('Excel exported successfully');
                                } catch (error) {
                                    toast.error('Failed to export Excel');
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Download size={16} />
                            {t('assessment.reports.exportExcel', 'Export Excel')}
                        </button>
                        <button
                            onClick={() => {
                                const dataStr = JSON.stringify(selectedReport, null, 2);
                                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                                const exportFileDefaultName = `report_${selectedReport.id}.json`;
                                const linkElement = document.createElement('a');
                                linkElement.setAttribute('href', dataUri);
                                linkElement.setAttribute('download', exportFileDefaultName);
                                linkElement.click();
                                toast.success('JSON exported successfully');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Download size={16} />
                            JSON
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                                {t('assessment.reports.avgActual', 'Average Current Level')}
                            </div>
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {selectedReport.avg_actual?.toFixed(1) || '0.0'}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                                {t('assessment.reports.avgTarget', 'Average Target Level')}
                            </div>
                            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                {selectedReport.avg_target?.toFixed(1) || '0.0'}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                                {t('assessment.reports.gapPoints', 'Gap Points')}
                            </div>
                            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                                {selectedReport.gap_points || 0}
                            </div>
                        </div>
                    </div>

                    {/* Axis Details */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-3">
                            {t('assessment.reports.axisBreakdown', 'Axis Breakdown')}
                        </h4>
                        {axes.map(axis => {
                            const data = assessment[axis];
                            if (!data) return null;

                            const gap = (data.target || 0) - (data.actual || 0);

                            return (
                                <div
                                    key={axis}
                                    className="bg-white dark:bg-navy-950 rounded-lg p-4 border border-slate-200 dark:border-white/10"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-medium text-sm text-navy-900 dark:text-white capitalize">
                                            {axis.replace(/([A-Z])/g, ' $1').trim()}
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs font-medium ${gap > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {gap > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            Gap: {gap.toFixed(1)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Current:</span>{' '}
                                            <span className="text-blue-600 dark:text-blue-400 font-bold">{data.actual}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Target:</span>{' '}
                                            <span className="text-purple-600 dark:text-purple-400 font-bold">{data.target}</span>
                                        </div>
                                    </div>
                                    {data.justification && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                            <p className="text-xs text-slate-600 dark:text-slate-300">{data.justification}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Report List View
    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-navy-900 dark:text-white">
                            {t('assessment.reports.archive', 'Assessment Reports Archive')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('assessment.reports.archiveDesc', 'View and download historical assessment reports')}
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            if (!currentProjectId) return;
                            try {
                                setGenerating(true);
                                // Create draft report via API
                                const newReport = await Api.generateAssessmentReport(currentProjectId);
                                if (newReport?.id) {
                                    setCurrentReport(newReport.id, 'new');
                                    toast.success(t('assessment.reports.draftCreated', 'Draft report created'));
                                } else {
                                    setCurrentReport(null, 'new');
                                }
                                onStartNewAssessment?.();
                            } catch (error) {
                                console.error('Failed to create draft report:', error);
                                // Still allow switching to assessment tab even if draft creation fails
                                setCurrentReport(null, 'new');
                                onStartNewAssessment?.();
                            } finally {
                                setGenerating(false);
                            }
                        }}
                        disabled={generating}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-purple-500/20"
                    >
                        {generating ? (
                            <><Loader2 className="animate-spin" size={16} /> {t('common.creating', 'Creating...')}</>
                        ) : (
                            <><Plus size={16} /> {t('assessment.reports.newAssessment', 'New Assessment')}</>
                        )}
                    </button>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder={t('common.search', 'Search reports...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="date">{t('common.sortByDate', 'Sort by Date')}</option>
                        <option value="title">{t('common.sortByTitle', 'Sort by Title')}</option>
                        <option value="gap">{t('assessment.reports.sortByGap', 'Sort by Gap')}</option>
                    </select>
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showArchived
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                            }`}
                    >
                        {showArchived ? t('common.hideArchived', 'Hide Archived') : t('common.showArchived', 'Show Archived')}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="animate-spin text-purple-600" size={32} />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <AlertCircle className="text-slate-400 dark:text-slate-600 mb-3" size={48} />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            {t('assessment.reports.noReports', 'No reports generated yet')}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {t('assessment.reports.noReportsHint', 'Click "Generate Report" to create your first assessment report')}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredReports.map(report => (
                            <div
                                key={report.id}
                                className="bg-white dark:bg-navy-950 rounded-lg p-4 border border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-700 transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText size={16} className="text-purple-600 dark:text-purple-400" />
                                            <h4 className="text-base font-semibold text-navy-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                {report.title}
                                            </h4>
                                            {report.status === 'draft' && (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded">
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <Calendar size={12} />
                                            {formatDate(report.generated_at)}
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Current</div>
                                            <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                                                {report.avg_actual.toFixed(1)}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Target</div>
                                            <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                                                {report.avg_target.toFixed(1)}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Gap</div>
                                            <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                                                {report.gap_points}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentReport(report.id, 'view');
                                            handleViewReport(report.id);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <FileText size={14} />
                                        {t('assessment.reports.viewDetails', 'View Details')}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentReport(report.id, 'view');
                                            onGenerateInitiatives?.(report.id);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                    >
                                        <ArrowRight size={14} />
                                        {t('assessment.reports.generateInitiatives', 'Generate Initiatives')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
