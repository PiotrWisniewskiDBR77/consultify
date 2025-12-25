/**
 * ReportsTable
 * 
 * Table view for assessment reports:
 * - Draft reports (being edited)
 * - Final reports (approved, can generate initiatives)
 * 
 * Reports are created from approved assessments.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    FileOutput,
    Edit,
    Eye,
    Lightbulb,
    Clock,
    CheckCircle2,
    Download,
    MoreVertical,
    RefreshCw,
    Loader2,
    FileText,
    Trash2,
    AlertCircle
} from 'lucide-react';

interface Report {
    id: string;
    name: string;
    assessmentId: string;
    assessmentName: string;
    status: 'DRAFT' | 'FINAL' | 'ARCHIVED';
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    canGenerateInitiatives: boolean;
    initiativesGenerated: boolean;
    initiativesCount: number;
}

type FilterStatus = 'all' | 'draft' | 'final';

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface ReportsTableProps {
    projectId: string;
    framework?: AssessmentFramework;
    onCreateInitiatives: (reportId: string) => void;
    pendingAssessmentId?: string | null;
}

const STATUS_CONFIG = {
    'DRAFT': { 
        label: 'Draft', 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: <Edit size={14} />
    },
    'FINAL': { 
        label: 'Final', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle2 size={14} />
    },
    'ARCHIVED': { 
        label: 'Archived', 
        color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
        icon: <Clock size={14} />
    }
};

export const ReportsTable: React.FC<ReportsTableProps> = ({
    projectId,
    onCreateInitiatives,
    pendingAssessmentId
}) => {
    // State
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
    const [showNewReportModal, setShowNewReportModal] = useState(!!pendingAssessmentId);
    const [isCreatingReport, setIsCreatingReport] = useState(false);

    // Fetch reports
    const fetchReports = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports?projectId=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setReports(data.reports || []);
            }
        } catch (err) {
            console.error('[ReportsTable] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            fetchReports();
        }
    }, [projectId, fetchReports]);

    // Create report from assessment
    const handleCreateReport = async (assessmentId: string, name: string) => {
        setIsCreatingReport(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/assessment-reports', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ assessmentId, name, projectId })
            });

            if (response.ok) {
                await fetchReports();
                setShowNewReportModal(false);
            }
        } catch (err) {
            console.error('[ReportsTable] Create error:', err);
        } finally {
            setIsCreatingReport(false);
        }
    };

    // Finalize report (draft → final)
    const handleFinalizeReport = async (reportId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/assessment-reports/${reportId}/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchReports();
        } catch (err) {
            console.error('[ReportsTable] Finalize error:', err);
        }
    };

    // Filter reports
    const filteredReports = reports.filter(report => {
        // Status filter
        if (filterStatus !== 'all') {
            if (filterStatus === 'draft' && report.status !== 'DRAFT') return false;
            if (filterStatus === 'final' && report.status !== 'FINAL') return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                report.name.toLowerCase().includes(query) ||
                report.assessmentName.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    // Stats
    const stats = {
        total: reports.length,
        draft: reports.filter(r => r.status === 'DRAFT').length,
        final: reports.filter(r => r.status === 'FINAL').length
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                            Reports
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Assessment reports created from approved assessments
                        </p>
                    </div>
                    <button
                        onClick={() => setShowNewReportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        New Report
                    </button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-4">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`text-sm ${filterStatus === 'all' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        All ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilterStatus('draft')}
                        className={`text-sm ${filterStatus === 'draft' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        Draft ({stats.draft})
                    </button>
                    <button
                        onClick={() => setFilterStatus('final')}
                        className={`text-sm ${filterStatus === 'final' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        Final ({stats.final})
                    </button>
                </div>

                {/* Search */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search reports..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={fetchReports}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <FileOutput className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 mb-2">
                            {searchQuery ? 'No reports match your search' : 'No reports yet'}
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
                            Create a report from an approved assessment
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-navy-950 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Report
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Assessment
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Initiatives
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Updated
                                </th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                            {filteredReports.map((report) => {
                                const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.DRAFT;
                                
                                return (
                                    <tr 
                                        key={report.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <p className="font-medium text-navy-900 dark:text-white">
                                                    {report.name}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {report.assessmentName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                {statusConfig.icon}
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {report.initiativesGenerated ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <Lightbulb size={12} />
                                                    {report.initiativesCount} generated
                                                </span>
                                            ) : (
                                                <span className="text-sm text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {formatDate(report.updatedAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit/View */}
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                                    {report.status === 'DRAFT' ? <Edit size={14} /> : <Eye size={14} />}
                                                    {report.status === 'DRAFT' ? 'Edit' : 'View'}
                                                </button>

                                                {/* Finalize - only for draft */}
                                                {report.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleFinalizeReport(report.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Finalize
                                                    </button>
                                                )}

                                                {/* Generate Initiatives - only for final */}
                                                {report.status === 'FINAL' && !report.initiativesGenerated && (
                                                    <button
                                                        onClick={() => onCreateInitiatives(report.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                    >
                                                        <Lightbulb size={14} />
                                                        Generate Initiatives
                                                    </button>
                                                )}

                                                {/* Download */}
                                                {report.status === 'FINAL' && (
                                                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
                                                        <Download size={16} />
                                                    </button>
                                                )}

                                                {/* More menu */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveRowMenu(activeRowMenu === report.id ? null : report.id)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    
                                                    {activeRowMenu === report.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 z-10">
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Export PDF
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Export Excel
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Duplicate
                                                            </button>
                                                            {report.status === 'DRAFT' && (
                                                                <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10">
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Workflow hint */}
            <div className="shrink-0 px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    <span className="font-medium">Workflow:</span> Approved Assessment → Draft Report → Final Report → Generate Initiatives
                </p>
            </div>
        </div>
    );
};

export default ReportsTable;

