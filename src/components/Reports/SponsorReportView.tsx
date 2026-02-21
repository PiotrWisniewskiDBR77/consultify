/**
 * SponsorReportView (T017)
 * N-mode artifact for sponsor-level analysis reports.
 * Left nav (sections), canvas (content), properties strip (status, export).
 */

import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  section_order: number;
  section_type: string;
}

interface SponsorReport {
  id: string;
  title: string;
  status: string;
  language: string;
  created_by: string;
  created_at: string;
  approved_by?: string;
  utilized_at?: string;
  utilization_notes?: string;
  rejected_reason?: string;
  assumptions_json?: string;
  unknowns_json?: string;
  counterpoints_json?: string;
  insight_source_ids?: string;
  sections: ReportSection[];
}

interface SponsorReportViewProps {
  reportId?: string;
  organizationId: string;
  projectId?: string;
  assessmentId?: string;
  locked?: boolean;
  onGenerate?: () => void;
}

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['FINAL'],
  REJECTED: ['DRAFT'],
  FINAL: ['UTILIZED', 'ARCHIVED'],
  UTILIZED: ['ARCHIVED'],
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  GENERATING: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  FINAL: 'bg-indigo-100 text-indigo-700',
  UTILIZED: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export const SponsorReportView: React.FC<SponsorReportViewProps> = ({
  reportId,
  organizationId,
  projectId,
  assessmentId,
  locked = false,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<SponsorReport | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState(reportId || '');
  const [activeSection, setActiveSection] = useState(0);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showUtilizeModal, setShowUtilizeModal] = useState(false);
  const [utilizeNotes, setUtilizeNotes] = useState('');

  useEffect(() => {
    loadReportsList();
  }, [organizationId]);

  useEffect(() => {
    if (selectedReportId) loadReport(selectedReportId);
  }, [selectedReportId]);

  const loadReportsList = async () => {
    try {
      const res = await Api.get('/api/sponsor-reports');
      if (Array.isArray(res)) setReports(res);
    } catch { /* ignore */ }
  };

  const loadReport = async (id: string) => {
    try {
      const res = await Api.get(`/api/sponsor-reports/${id}`);
      if (res?.id) {
        setReport(res);
        setActiveSection(0);
      }
    } catch { /* ignore */ }
  };

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    trackFunnelEvent('sponsor_report_created');
    try {
      const res = await Api.post('/api/sponsor-reports/generate', {
        projectId,
        assessmentId,
        language: 'en',
      });
      if (res?.reportId) {
        setSelectedReportId(res.reportId);
        await loadReportsList();
        trackFunnelEvent('sponsor_report_generated');
      }
    } catch { /* ignore */ }
    setIsGenerating(false);
  }, [projectId, assessmentId]);

  const handleSaveSection = useCallback(async () => {
    if (!editingSection || !report) return;
    setIsSaving(true);
    trackFunnelEvent('sponsor_report_section_edited');
    try {
      await Api.put(`/api/sponsor-reports/${report.id}/sections/${editingSection}`, { content: editContent });
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === editingSection ? { ...s, content: editContent } : s
          ),
        };
      });
      setEditingSection(null);
    } catch { /* ignore */ }
    setIsSaving(false);
  }, [editingSection, editContent, report]);

  const handleStatusChange = useCallback(async (newStatus: string, params?: Record<string, string>) => {
    if (!report) return;
    try {
      await Api.put(`/api/sponsor-reports/${report.id}/status`, { status: newStatus, ...params });
      setReport((prev) => prev ? { ...prev, status: newStatus } : prev);
      if (newStatus === 'APPROVED') trackFunnelEvent('sponsor_report_approved');
      if (newStatus === 'REJECTED') trackFunnelEvent('sponsor_report_rejected');
      if (newStatus === 'UTILIZED') trackFunnelEvent('sponsor_report_utilized');
    } catch { /* ignore */ }
  }, [report]);

  const handleExport = useCallback(async () => {
    if (!report) return;
    setIsExporting(true);
    trackFunnelEvent('sponsor_report_exported', { format: 'pptx' });
    try {
      const res = await fetch(`/api/sponsor-reports/${report.id}/export?format=pptx`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sponsor-report-${report.id.substring(0, 8)}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
    setIsExporting(false);
  }, [report]);

  const assumptions = report?.assumptions_json ? JSON.parse(report.assumptions_json) : [];
  const unknowns = report?.unknowns_json ? JSON.parse(report.unknowns_json) : [];
  const counterpoints = report?.counterpoints_json ? JSON.parse(report.counterpoints_json) : [];
  const sections = report?.sections || [];

  if (!report && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {t('sponsorReport.empty', 'No Sponsor Reports')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
          {t('sponsorReport.emptyHint', 'Generate a sponsor-level analysis report from approved insights and assessment data.')}
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700
            disabled:opacity-50 text-sm font-medium"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t('sponsorReport.generate', 'Generate Report')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left Nav */}
      <nav className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
        {reports.length > 1 && (
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800
              text-sm text-gray-700 dark:text-gray-300"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>{r.title} ({r.status})</option>
            ))}
          </select>
        )}

        {report && (
          <>
            <div className="mb-4">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[report.status] || 'bg-gray-100'}`}>
                {report.status}
              </span>
            </div>
            <ul className="space-y-1">
              {sections.map((section, idx) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => { setActiveSection(idx); setEditingSection(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2
                      ${idx === activeSection
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <span className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{section.title}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400
                  hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {t('sponsorReport.generateNew', 'New Report')}
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Canvas */}
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {report && sections[activeSection] && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                {sections[activeSection].title}
              </h2>
              {!locked && report.status === 'DRAFT' && editingSection !== sections[activeSection].id && (
                <button
                  onClick={() => {
                    setEditingSection(sections[activeSection].id);
                    setEditContent(sections[activeSection].content);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Edit3 className="w-3 h-3" /> {t('sponsorReport.edit', 'Edit')}
                </button>
              )}
            </div>

            {editingSection === sections[activeSection].id ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800
                    text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 resize-y font-mono"
                />
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleSaveSection}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {t('sponsorReport.save', 'Save')}
                  </button>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                  >
                    <X className="w-3 h-3" /> {t('sponsorReport.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {sections[activeSection].content.split('\n').map((line, i) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Evidence sources */}
            {sections[activeSection].section_type === 'key_findings' && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {t('sponsorReport.evidenceNote', 'Findings backed by approved insights from interview and assessment data.')}
                </p>
              </div>
            )}

            {/* Caveats section inline */}
            {sections[activeSection].section_type === 'assumptions' && (
              <div className="mt-6 space-y-3">
                {assumptions.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                    <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">{t('sponsorReport.assumptions', 'Assumptions')}</h4>
                    <ul className="text-xs text-yellow-600 dark:text-yellow-500 space-y-1">
                      {assumptions.map((a: string, i: number) => <li key={i}>• {a}</li>)}
                    </ul>
                  </div>
                )}
                {unknowns.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">{t('sponsorReport.unknowns', 'Unknowns')}</h4>
                    <ul className="text-xs text-blue-600 dark:text-blue-500 space-y-1">
                      {unknowns.map((u: string, i: number) => <li key={i}>• {u}</li>)}
                    </ul>
                  </div>
                )}
                {counterpoints.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">{t('sponsorReport.counterpoints', 'Counterpoints')}</h4>
                    <ul className="text-xs text-red-600 dark:text-red-500 space-y-1">
                      {counterpoints.map((c: string, i: number) => <li key={i}>• {c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Properties Strip */}
      <aside className="hidden xl:block w-60 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {t('sponsorReport.properties', 'Properties')}
        </h3>

        {report && (
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-400">{t('sponsorReport.status', 'Status')}</span>
              <p className={`text-sm font-medium mt-0.5 inline-block px-2 py-0.5 rounded ${STATUS_COLORS[report.status] || ''}`}>
                {report.status}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-400">{t('sponsorReport.created', 'Created')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{new Date(report.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">{t('sponsorReport.sections', 'Sections')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{sections.length}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">{t('sponsorReport.languageProp', 'Language')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{(report.language || 'en').toUpperCase()}</p>
            </div>

            {/* Workflow actions */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {STATUS_FLOW[report.status]?.includes('PENDING_APPROVAL') && (
                <button
                  onClick={() => handleStatusChange('PENDING_APPROVAL')}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
                >
                  <Eye className="w-3 h-3" /> {t('sponsorReport.submitForApproval', 'Submit for Approval')}
                </button>
              )}
              {STATUS_FLOW[report.status]?.includes('APPROVED') && (
                <button
                  onClick={() => handleStatusChange('APPROVED')}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                >
                  <ThumbsUp className="w-3 h-3" /> {t('sponsorReport.approve', 'Approve')}
                </button>
              )}
              {STATUS_FLOW[report.status]?.includes('REJECTED') && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                >
                  <ThumbsDown className="w-3 h-3" /> {t('sponsorReport.reject', 'Reject')}
                </button>
              )}
              {STATUS_FLOW[report.status]?.includes('UTILIZED') && (
                <button
                  onClick={() => setShowUtilizeModal(true)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                >
                  <CheckCircle2 className="w-3 h-3" /> {t('sponsorReport.markUtilized', 'Mark Utilized')}
                </button>
              )}
              {STATUS_FLOW[report.status]?.includes('DRAFT') && report.status === 'REJECTED' && (
                <button
                  onClick={() => handleStatusChange('DRAFT')}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <RotateCcw className="w-3 h-3" /> {t('sponsorReport.backToDraft', 'Back to Draft')}
                </button>
              )}
            </div>

            {/* Export */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                  bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
                {t('sponsorReport.exportPptx', 'Export PPTX')}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('sponsorReport.rejectReason', 'Rejection Reason')}</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              placeholder={t('sponsorReport.rejectPlaceholder', 'Why is this report being rejected?')}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm text-gray-500">
                {t('sponsorReport.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  handleStatusChange('REJECTED', { rejectedReason: rejectReason });
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg"
              >
                {t('sponsorReport.confirmReject', 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Utilize Modal */}
      {showUtilizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('sponsorReport.utilizeNotes', 'Utilization Notes')}</h3>
            <textarea
              value={utilizeNotes}
              onChange={(e) => setUtilizeNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              placeholder={t('sponsorReport.utilizePlaceholder', 'How was this report used? Meeting outcome?')}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUtilizeModal(false)} className="px-4 py-2 text-sm text-gray-500">
                {t('sponsorReport.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  handleStatusChange('UTILIZED', { utilizationNotes: utilizeNotes });
                  setShowUtilizeModal(false);
                  setUtilizeNotes('');
                }}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg"
              >
                {t('sponsorReport.confirmUtilize', 'Mark Utilized')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
