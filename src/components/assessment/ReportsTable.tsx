/**
 * ReportsTable
 *
 * Global reports table for Assessment module:
 * - Shows only reports that have reached IN_REVIEW status or higher
 * - All assessment reports across all assessments
 * - Uses Report Builder API
 *
 * Reports created from approved assessments first appear in the assessment's
 * Manager → Reports panel. Once they reach IN_REVIEW status, they also
 * appear here in this global view.
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  FileOutput,
  FileText,
  Lightbulb,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import { ImportReportModal } from '../Reports/ImportReportModal';
import { NewReportModal } from './modals/NewReportModal';
import { StageGateModal } from './modals/StageGateModal';
import { ReportEditor } from './ReportEditor';

// ============================================
// Types
// ============================================

type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED';

interface Report {
  id: string;
  name: string;
  assessmentId: string;
  assessmentName: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  canGenerateInitiatives: boolean;
  initiativesGenerated: boolean;
  initiativesCount: number;
}

// Statuses visible in this global table (IN_REVIEW and above)
const VISIBLE_STATUSES: ReportStatus[] = [
  'IN_REVIEW',
  'APPROVED',
  'SENT_INTERNAL',
  'SENT_EXTERNAL',
  'UTILIZED',
];

type FilterStatus = 'all' | 'in_review' | 'approved' | 'sent';

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface ReportsTableProps {
  projectId: string;
  framework?: AssessmentFramework;
  onCreateInitiatives: (reportId: string) => void;
  pendingAssessmentId?: string | null;
  onOpenReport?: (reportId: string, reportName: string, status?: string) => void;
}

// ============================================
// Status Config
// ============================================

const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    color: string;
    icon: React.ReactElement;
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon: <Edit size={14} />,
  },
  CONFIGURING: {
    label: 'Configuring',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon: <Edit size={14} />,
  },
  GENERATING: {
    label: 'Generating',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Loader2 size={14} className="animate-spin" />,
  },
  GENERATED: {
    label: 'Generated',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <FileText size={14} />,
  },
  IN_REVIEW: {
    label: 'In Review',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <Eye size={14} />,
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 size={14} />,
  },
  SENT_INTERNAL: {
    label: 'Sent Internal',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    icon: <Send size={14} />,
  },
  SENT_EXTERNAL: {
    label: 'Sent External',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    icon: <ArrowRight size={14} />,
  },
  UTILIZED: {
    label: 'Utilized',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    icon: <Sparkles size={14} />,
  },
};

// ============================================
// Main Component
// ============================================

export const ReportsTable: React.FC<ReportsTableProps> = ({
  projectId,
  onCreateInitiatives,
  pendingAssessmentId,
  onOpenReport,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const navigate = useNavigate();

  // State
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const [showNewReportModal, setShowNewReportModal] = useState(!!pendingAssessmentId);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [showStageGate, setShowStageGate] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch reports from Report Builder API
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch reports with IN_REVIEW+ status from Report Builder API
      const statusFilter = VISIBLE_STATUSES.join(',');
      const response = await Api.get(
        `/report-builder?sourceType=ASSESSMENT&statusIn=${statusFilter}`
      );
      const apiReports = response?.reports || [];

      // Map API response to component's expected format
      const mappedReports: Report[] = apiReports.map((r: any) => ({
        id: r.id,
        name: r.title,
        assessmentId: r.sourceId,
        assessmentName: r.sourceName || '',
        status: r.status as ReportStatus,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdByName || r.createdBy || '',
        createdByName: r.createdByName,
        canGenerateInitiatives:
          r.status === 'APPROVED' || r.status === 'SENT_INTERNAL' || r.status === 'SENT_EXTERNAL',
        initiativesGenerated: false, // TODO: Check if initiatives exist
        initiativesCount: 0,
      }));

      setReports(mappedReports);
    } catch (err) {
      console.error('[ReportsTable] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Approve report
  const handleApproveReport = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/approve`, {});
      toast.success(isPolish ? 'Raport zatwierdzony' : 'Report approved');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Approve error:', err);
      toast.error(isPolish ? 'Nie udało się zatwierdzić raportu' : 'Failed to approve report');
    }
  };

  // Mark as sent internally
  const handleMarkSentInternal = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-internal`, {});
      toast.success(isPolish ? 'Oznaczono jako wysłany wewnętrznie' : 'Marked as sent internally');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Mark sent internal error:', err);
      toast.error(
        isPolish ? 'Nie udało się oznaczyć jako wysłany' : 'Failed to mark as sent internally'
      );
    }
  };

  // Mark as sent externally
  const handleMarkSentExternal = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-external`, {});
      toast.success(isPolish ? 'Oznaczono jako wysłany zewnętrznie' : 'Marked as sent externally');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Mark sent external error:', err);
      toast.error(
        isPolish ? 'Nie udało się oznaczyć jako wysłany' : 'Failed to mark as sent externally'
      );
    }
  };

  // Send back to draft
  const handleSendBack = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/send-back`, {});
      toast.success(isPolish ? 'Raport odesłany do edycji' : 'Report sent back for editing');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Send back error:', err);
      toast.error(isPolish ? 'Nie udało się odesłać raportu' : 'Failed to send report back');
    }
  };

  // Export PDF
  const handleExportPDF = async (reportId: string, reportName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/report-builder/${reportId}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName.replace(/\s+/g, '_')}_Report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(isPolish ? 'Eksport PDF zakończony' : 'PDF export completed');
      } else {
        console.error('PDF export failed');
        toast.error(isPolish ? 'Nie udało się wyeksportować PDF' : 'Failed to export PDF');
      }
    } catch (err) {
      console.error('[ReportsTable] PDF Export error:', err);
      toast.error(isPolish ? 'Błąd eksportu PDF' : 'PDF export error');
    }
  };

  // Filter reports
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'in_review' && report.status !== 'IN_REVIEW') return false;
        if (filterStatus === 'approved' && report.status !== 'APPROVED') return false;
        if (filterStatus === 'sent' && !['SENT_INTERNAL', 'SENT_EXTERNAL'].includes(report.status))
          return false;
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
  }, [reports, filterStatus, searchQuery]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Stats
  const stats = useMemo(
    () => ({
      total: reports.length,
      inReview: reports.filter((r) => r.status === 'IN_REVIEW').length,
      approved: reports.filter((r) => r.status === 'APPROVED').length,
      sent: reports.filter((r) => ['SENT_INTERNAL', 'SENT_EXTERNAL'].includes(r.status)).length,
    }),
    [reports]
  );

  // Handle open report
  const handleOpenReport = (reportId: string, reportName: string, status?: string) => {
    if (onOpenReport) {
      onOpenReport(reportId, reportName, status);
    } else {
      navigate(`/reports/builder?reportId=${reportId}`);
    }
  };

  // If editing a report, show the editor
  if (editingReportId) {
    return (
      <ReportEditor
        reportId={editingReportId}
        onClose={() => setEditingReportId(null)}
        onSaved={() => fetchReports()}
        onFinalized={() => {
          fetchReports();
          setEditingReportId(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
              {isPolish ? 'Raporty' : 'Reports'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Raporty z ocen w statusie przeglądu i wyższych'
                : 'Assessment reports in review status and above'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title={isPolish ? 'Importuj raport zewnętrzny' : 'Import external report'}
            >
              <Upload size={18} />
              {isPolish ? 'Importuj' : 'Import'}
            </button>
            <button
              onClick={() => navigate('/reports/builder?new=true')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
              title={isPolish ? 'Utwórz raport z pomocą AI' : 'Create AI-powered report'}
            >
              <Sparkles size={18} />
              {isPolish ? 'Nowy Raport' : 'New Report'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`text-sm ${filterStatus === 'all' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
          >
            {isPolish ? 'Wszystkie' : 'All'} ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('in_review')}
            className={`text-sm ${filterStatus === 'in_review' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
          >
            {isPolish ? 'W przeglądzie' : 'In Review'} ({stats.inReview})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`text-sm ${filterStatus === 'approved' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
          >
            {isPolish ? 'Zatwierdzone' : 'Approved'} ({stats.approved})
          </button>
          <button
            onClick={() => setFilterStatus('sent')}
            className={`text-sm ${filterStatus === 'sent' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
          >
            {isPolish ? 'Wysłane' : 'Sent'} ({stats.sent})
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPolish ? 'Szukaj raportów...' : 'Search reports...'}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
            />
          </div>
          <button
            onClick={fetchReports}
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileOutput className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              {searchQuery
                ? isPolish
                  ? 'Brak raportów pasujących do wyszukiwania'
                  : 'No reports match your search'
                : isPolish
                  ? 'Brak raportów w przeglądzie'
                  : 'No reports in review yet'}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
              {isPolish
                ? 'Raporty pojawią się tutaj po przesłaniu do przeglądu'
                : 'Reports will appear here after being submitted for review'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-navy-900/50 sticky top-0">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Raport' : 'Report'}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Autor' : 'Author'}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Ocena' : 'Assessment'}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Zaktualizowany' : 'Updated'}
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Akcje' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {filteredReports.map((report) => {
                  const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.IN_REVIEW;

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
                          <button
                            onClick={() => handleOpenReport(report.id, report.name, report.status)}
                            className="font-medium text-navy-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                          >
                            {report.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div
                          className="flex items-center gap-2 cursor-default"
                          title={report.createdBy}
                        >
                          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-700 dark:text-purple-300">
                            {(report.createdByName || report.createdBy || '?')
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[60px]">
                            {(report.createdByName || report.createdBy || '').split(' ')[0]}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {report.assessmentName}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(report.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Primary Action based on status */}
                          {report.status === 'IN_REVIEW' ? (
                            <button
                              onClick={() => handleApproveReport(report.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                            >
                              <CheckCircle2 size={14} />
                              {isPolish ? 'Zatwierdź' : 'Approve'}
                            </button>
                          ) : report.status === 'APPROVED' ? (
                            <button
                              onClick={() => handleMarkSentInternal(report.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                            >
                              <Send size={14} />
                              {isPolish ? 'Wyślij wewn.' : 'Send Internal'}
                            </button>
                          ) : report.status === 'SENT_INTERNAL' ? (
                            <button
                              onClick={() => handleMarkSentExternal(report.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
                            >
                              <ArrowRight size={14} />
                              {isPolish ? 'Wyślij zewn.' : 'Send External'}
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleOpenReport(report.id, report.name, report.status)
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            >
                              <Eye size={14} />
                              {isPolish ? 'Podgląd' : 'View'}
                            </button>
                          )}

                          {/* Download PDF - for approved+ reports */}
                          {['APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'].includes(
                            report.status
                          ) && (
                            <button
                              onClick={() => handleExportPDF(report.id, report.name)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                              title="Download PDF"
                            >
                              <Download size={16} />
                            </button>
                          )}

                          {/* More menu */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveRowMenu(activeRowMenu === report.id ? null : report.id)
                              }
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeRowMenu === report.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setActiveRowMenu(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-50">
                                  <button
                                    onClick={() => {
                                      handleOpenReport(report.id, report.name, report.status);
                                      setActiveRowMenu(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <Eye size={14} />
                                    {isPolish ? 'Podgląd raportu' : 'View Report'}
                                  </button>

                                  {report.status === 'IN_REVIEW' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          handleApproveReport(report.id);
                                          setActiveRowMenu(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center gap-2"
                                      >
                                        <CheckCircle2 size={14} />
                                        {isPolish ? 'Zatwierdź' : 'Approve'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleSendBack(report.id);
                                          setActiveRowMenu(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2"
                                      >
                                        <ArrowRight size={14} className="rotate-180" />
                                        {isPolish ? 'Odeślij do edycji' : 'Send Back'}
                                      </button>
                                    </>
                                  )}

                                  {report.status === 'APPROVED' && (
                                    <button
                                      onClick={() => {
                                        handleMarkSentInternal(report.id);
                                        setActiveRowMenu(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 flex items-center gap-2"
                                    >
                                      <Send size={14} />
                                      {isPolish
                                        ? 'Oznacz jako wysłany wewn.'
                                        : 'Mark Sent Internal'}
                                    </button>
                                  )}

                                  {report.status === 'SENT_INTERNAL' && (
                                    <button
                                      onClick={() => {
                                        handleMarkSentExternal(report.id);
                                        setActiveRowMenu(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/10 flex items-center gap-2"
                                    >
                                      <ArrowRight size={14} />
                                      {isPolish
                                        ? 'Oznacz jako wysłany zewn.'
                                        : 'Mark Sent External'}
                                    </button>
                                  )}

                                  {[
                                    'APPROVED',
                                    'SENT_INTERNAL',
                                    'SENT_EXTERNAL',
                                    'UTILIZED',
                                  ].includes(report.status) && (
                                    <>
                                      <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
                                      <button
                                        onClick={() => {
                                          handleExportPDF(report.id, report.name);
                                          setActiveRowMenu(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2"
                                      >
                                        <FileText size={14} />
                                        {isPolish ? 'Eksportuj PDF' : 'Export PDF'}
                                      </button>
                                    </>
                                  )}

                                  {report.canGenerateInitiatives &&
                                    !report.initiativesGenerated && (
                                      <>
                                        <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
                                        <button
                                          onClick={() => {
                                            onCreateInitiatives(report.id);
                                            setActiveRowMenu(null);
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 flex items-center gap-2"
                                        >
                                          <Lightbulb size={14} />
                                          {isPolish ? 'Generuj inicjatywy' : 'Generate Initiatives'}
                                        </button>
                                      </>
                                    )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stage Gate Modal */}
      {showStageGate && (
        <StageGateModal
          projectId={projectId}
          assessmentId={pendingAssessmentId || ''}
          gateType="DESIGN_GATE"
          fromPhase="Assessment"
          toPhase="Reports"
          onClose={() => setShowStageGate(false)}
          onProceed={() => {
            setShowStageGate(false);
            setShowNewReportModal(true);
          }}
        />
      )}

      {/* New Report Modal */}
      {showNewReportModal && (
        <NewReportModal
          projectId={projectId}
          preselectedAssessmentId={pendingAssessmentId || undefined}
          onClose={() => setShowNewReportModal(false)}
          onCreated={(reportId) => {
            fetchReports();
            setShowNewReportModal(false);
          }}
        />
      )}

      {/* Import Report Modal */}
      {showImportModal && (
        <ImportReportModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onImported={(reportId) => {
            fetchReports();
            setShowImportModal(false);
            toast.success(
              isPolish ? 'Raport zaimportowany pomyślnie' : 'Report imported successfully'
            );
          }}
        />
      )}
    </div>
  );
};
