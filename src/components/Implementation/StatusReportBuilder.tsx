// @ts-nocheck
/**
 * StatusReportBuilder Component
 *
 * PMO Status Reporting and Performance Monitoring
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Progress Reporting (Clause 4.5.3)
 * - PMI PMBOK 7th Edition - Status Report / Dashboard
 * - PRINCE2 - Highlight Report
 *
 * PMO Domain: PERFORMANCE_MONITORING
 */

import {
  AlertTriangle,
  Archive,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Share2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

type ReportStatus = 'GREEN' | 'AMBER' | 'RED';

interface ReportSection {
  title: string;
  status: ReportStatus;
  content: string;
  highlights?: string[];
  issues?: string[];
}

interface StatusReport {
  id: string;
  initiativeId: string;
  initiativeName?: string;
  periodType: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  overallStatus: ReportStatus;
  overallTrend: string;
  sections: Record<string, ReportSection>;
  executiveSummary?: string;
  accomplishments: string[];
  nextSteps: string[];
  escalations: Array<{ type?: string; message: string; requiredAction?: string }>;
  risksAndIssues?: string;
  recommendations?: string;
  metrics?: {
    progressPercent: number;
    budgetConsumedPercent: number;
    tasksCompleted: number;
    tasksTotal: number;
    openRisks: number;
    openIssues: number;
    pendingDecisions: number;
  };
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ReportListItem {
  id: string;
  periodType: string;
  periodLabel: string;
  overallStatus: ReportStatus;
  status: string;
  progressPercent: number;
  createdBy?: string;
  createdAt: string;
}

interface StatusReportBuilderProps {
  initiativeId?: string;
  initiativeName?: string;
}

const STATUS_CONFIG: Record<ReportStatus, { color: string; bgColor: string; label: string }> = {
  GREEN: { color: 'text-green-600', bgColor: 'bg-green-500', label: 'On Track' },
  AMBER: { color: 'text-amber-600', bgColor: 'bg-amber-500', label: 'At Risk' },
  RED: { color: 'text-red-600', bgColor: 'bg-red-500', label: 'Off Track' },
};

export const StatusReportBuilder: React.FC<StatusReportBuilderProps> = ({
  initiativeId,
  initiativeName,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>(
    'WEEKLY'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentReport, setCurrentReport] = useState<StatusReport | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportListItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState('');

  const fetchLatestReport = useCallback(async () => {
    if (!initiativeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await Api.get(`/status-reports/initiative/${initiativeId}/latest`);
      setCurrentReport(response.report);
    } catch (error) {
      console.error('[StatusReportBuilder] Error fetching report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  const fetchReportHistory = useCallback(async () => {
    if (!initiativeId) return;

    try {
      const response = await Api.get(`/status-reports/initiative/${initiativeId}`);
      setReportHistory(response.reports || []);
    } catch (error) {
      console.error('[StatusReportBuilder] Error fetching history:', error);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchLatestReport();
    fetchReportHistory();
  }, [fetchLatestReport, fetchReportHistory]);

  const handleGenerateReport = async () => {
    if (!initiativeId) {
      toast.error('Please select an initiative');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await Api.post(`/status-reports/initiative/${initiativeId}/generate`, {
        periodType: selectedPeriod,
      });

      setCurrentReport(response.report);
      toast.success('Report generated successfully');
      fetchReportHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'pptx') => {
    if (!currentReport) {
      toast.error('No report to export');
      return;
    }

    try {
      const response = await fetch(`/api/status-reports/${currentReport.id}/export/${format}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `status-report-${currentReport.periodLabel.replace(/[^a-zA-Z0-9]/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const handleDistribute = async () => {
    if (!currentReport || !recipientEmails.trim()) {
      toast.error('Please enter recipient emails');
      return;
    }

    const emails = recipientEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const recipients = emails.map((email) => ({
      recipientEmail: email,
      recipientType: 'STAKEHOLDER',
      distributionMethod: 'EMAIL',
    }));

    try {
      await Api.post(`/status-reports/${currentReport.id}/distribute`, { recipients });
      toast.success(`Report distributed to ${emails.length} recipients`);
      setShowDistributeModal(false);
      setRecipientEmails('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to distribute report');
    }
  };

  const handleApprove = async () => {
    if (!currentReport) return;

    try {
      await Api.post(`/status-reports/${currentReport.id}/approve`, {});
      setCurrentReport({ ...currentReport, status: 'APPROVED' });
      toast.success('Report approved');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve report';
      toast.error(errorMessage);
    }
  };

  const handlePublish = async () => {
    if (!currentReport) return;

    try {
      await Api.post(`/status-reports/${currentReport.id}/publish`, {});
      setCurrentReport({ ...currentReport, status: 'PUBLISHED' });
      toast.success('Report published');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish report';
      toast.error(errorMessage);
    }
  };

  const renderStatusIndicator = (status: ReportStatus, size: 'sm' | 'lg' = 'sm') => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.GREEN;
    const sizeClasses = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
    return <div className={`${sizeClasses} rounded-full ${config.bgColor}`} title={config.label} />;
  };

  const renderSection = (sectionKey: string, section: ReportSection, icon: React.ReactNode) => (
    <div
      key={sectionKey}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-medium text-navy-900 dark:text-white">
            {section.title || sectionKey}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusIndicator(section.status, 'lg')}
          <span
            className={`text-sm font-medium ${STATUS_CONFIG[section.status]?.color || 'text-slate-500 dark:text-slate-400'}`}
          >
            {STATUS_CONFIG[section.status]?.label || section.status}
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{section.content}</p>
      {section.highlights && section.highlights.length > 0 && (
        <div className="space-y-1">
          {section.highlights.map((h, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400"
            >
              <CheckCircle2 size={12} />
              {h}
            </div>
          ))}
        </div>
      )}
      {section.issues && section.issues.length > 0 && (
        <div className="space-y-1 mt-2">
          {section.issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle size={12} />
              {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getSectionIcon = (key: string) => {
    switch (key.toUpperCase()) {
      case 'SCHEDULE':
        return <Clock size={16} className="text-amber-500" />;
      case 'BUDGET':
        return <BarChart3 size={16} className="text-green-500" />;
      case 'SCOPE':
        return <FileText size={16} className="text-blue-500" />;
      case 'QUALITY':
        return <CheckCircle2 size={16} className="text-purple-500" />;
      case 'RISKS':
        return <AlertTriangle size={16} className="text-red-500" />;
      case 'RESOURCES':
        return <Clock size={16} className="text-cyan-500" />;
      default:
        return <FileText size={16} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  // No initiative selected
  if (!initiativeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <FileText size={48} className="mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">Status Reports</h3>
        <p className="text-sm">Select an initiative to view or generate reports</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // No report yet
  if (!currentReport) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <FileText size={48} className="mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">No Reports Yet</h3>
        <p className="text-sm mb-4">Generate your first status report for this initiative</p>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as typeof selectedPeriod)}
            className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm"
          >
            <option value="WEEKLY">Weekly Report</option>
            <option value="MONTHLY">Monthly Report</option>
            <option value="QUARTERLY">Quarterly Report</option>
          </select>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const overallStatus = currentReport.overallStatus || 'GREEN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-500" size={24} />
            Status Report
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {initiativeName || currentReport.initiativeName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm transition-colors"
            title="Report History"
          >
            <History size={16} />
            History
          </button>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as typeof selectedPeriod)}
            className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            PDF
          </button>
          <button
            onClick={() => setShowDistributeModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Send size={16} />
            Share
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Regenerate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Report Status Badge */}
      {currentReport.status && currentReport.status !== 'PUBLISHED' && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg ${
            currentReport.status === 'DRAFT'
              ? 'bg-slate-100 dark:bg-navy-800'
              : currentReport.status === 'APPROVED'
                ? 'bg-green-50 dark:bg-green-900/20'
                : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                currentReport.status === 'DRAFT'
                  ? 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
                  : currentReport.status === 'APPROVED'
                    ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300'
                    : 'bg-purple-200 text-purple-700'
              }`}
            >
              {currentReport.status}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {currentReport.status === 'DRAFT' &&
                'This report is a draft. Approve to share with stakeholders.'}
              {currentReport.status === 'APPROVED' && 'Report approved. Ready to publish.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {currentReport.status === 'DRAFT' && (
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500"
              >
                Approve
              </button>
            )}
            {currentReport.status === 'APPROVED' && (
              <button
                onClick={handlePublish}
                className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-500"
              >
                Publish
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overall Status Banner */}
      <div
        className={`p-6 rounded-xl ${
          overallStatus === 'GREEN'
            ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20'
            : overallStatus === 'AMBER'
              ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20'
              : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-xl ${STATUS_CONFIG[overallStatus].bgColor} flex items-center justify-center`}
            >
              {overallStatus === 'GREEN' ? (
                <TrendingUp size={32} className="text-white" />
              ) : overallStatus === 'AMBER' ? (
                <AlertTriangle size={32} className="text-white" />
              ) : (
                <TrendingDown size={32} className="text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
                {initiativeName || currentReport.initiativeName}
              </h2>
              <p className={`text-lg font-medium ${STATUS_CONFIG[overallStatus].color}`}>
                Overall Status: {STATUS_CONFIG[overallStatus].label}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 dark:text-slate-400">Report Period</div>
            <div className="text-lg font-medium text-navy-900 dark:text-white">
              {currentReport.periodLabel}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 justify-end mt-1">
              <Calendar size={12} />
              Generated {new Date(currentReport.createdAt).toLocaleDateString('pl-PL')}
            </div>
          </div>
        </div>

        {/* Metrics Summary */}
        {currentReport.metrics && (
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {currentReport.metrics.progressPercent}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {currentReport.metrics.tasksCompleted}/{currentReport.metrics.tasksTotal}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {currentReport.metrics.openRisks}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Open Risks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {currentReport.metrics.pendingDecisions}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Pending Decisions</div>
            </div>
          </div>
        )}
      </div>

      {/* Executive Summary */}
      {currentReport.executiveSummary && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <h4 className="font-bold text-navy-900 dark:text-white mb-2">Executive Summary</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {currentReport.executiveSummary}
          </p>
        </div>
      )}

      {/* Status Sections Grid */}
      {currentReport.sections && Object.keys(currentReport.sections).length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(currentReport.sections).map(([key, section]) =>
            renderSection(key, section, getSectionIcon(key))
          )}
        </div>
      )}

      {/* Accomplishments & Next Steps */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            Key Accomplishments
          </h4>
          {currentReport.accomplishments && currentReport.accomplishments.length > 0 ? (
            <ul className="space-y-2">
              {currentReport.accomplishments.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight size={14} className="text-green-500 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No accomplishments recorded
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            Next Steps
          </h4>
          {currentReport.nextSteps && currentReport.nextSteps.length > 0 ? (
            <ul className="space-y-2">
              {currentReport.nextSteps.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight size={14} className="text-blue-500 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">No next steps defined</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {currentReport.recommendations && (
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4">
          <h4 className="font-bold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
            <TrendingUp size={18} />
            Recommendations
          </h4>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            {currentReport.recommendations}
          </p>
        </div>
      )}

      {/* Escalations */}
      {currentReport.escalations && currentReport.escalations.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
          <h4 className="font-bold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} />
            Escalations Requiring Decision
          </h4>
          <ul className="space-y-2">
            {currentReport.escalations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <ChevronRight size={14} className="mt-1 shrink-0" />
                {typeof item === 'string' ? item : item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg p-6 m-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy-900 dark:text-white">Report History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {reportHistory.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 text-center py-8">
                  No previous reports
                </p>
              ) : (
                reportHistory.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {renderStatusIndicator(report.overallStatus, 'lg')}
                      <div>
                        <div className="font-medium text-navy-900 dark:text-white">
                          {report.periodLabel}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(report.createdAt).toLocaleDateString('pl-PL')}
                          {report.createdBy && ` • ${report.createdBy}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          report.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-700'
                            : report.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-200 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {report.status}
                      </span>
                      <Eye size={16} className="text-slate-400 dark:text-slate-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distribute Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy-900 dark:text-white">Distribute Report</h3>
              <button
                onClick={() => setShowDistributeModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recipient Emails (comma-separated)
              </label>
              <textarea
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                rows={3}
                placeholder="ceo@company.com, sponsor@company.com"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowDistributeModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDistribute}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusReportBuilder;
