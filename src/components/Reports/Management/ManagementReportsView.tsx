/**
 * Management Reports View
 * Main view for generating and managing management reports
 *
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 * Report Types: Team Meeting (Checkpoint), Steering Committee (Highlight)
 */

import {
  ArrowLeft,
  CalendarClock,
  FileBarChart2,
  History,
  Loader2,
  Plus,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import {
  ManagementReport,
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '../../../types';
import { ExportControls } from './ExportControls';
import { PortfolioHealthReport } from './PortfolioHealthReport';
import { RaidReport } from './RaidReport';
import { ReportHistoryTable } from './ReportHistoryTable';
import { ReportScheduleView } from './ReportScheduleView';
import { ReportTemplatesView } from './ReportTemplatesView';
// Import sub-components
import { ReportTypeSelector } from './ReportTypeSelector';
import { ReportSkeleton } from './shared/ReportSkeleton';

// Lazy load report components for better performance
const TeamMeetingReport = lazy(() =>
  import('./TeamMeetingReport').then((m) => ({ default: m.TeamMeetingReport }))
);
const SteeringCommitteeReport = lazy(() =>
  import('./SteeringCommitteeReport').then((m) => ({ default: m.SteeringCommitteeReport }))
);

type ViewMode = 'selector' | 'preview' | 'history';
type ViewModeExtended = ViewMode | 'templates' | 'schedule' | 'settings';

interface ManagementReportsViewProps {
  className?: string;
}

export const normalizeManagementReportProjects = (
  response: any
): { id: string; name: string }[] => {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.projects)
        ? response.data.projects
        : null;
  if (!rows) throw new Error('Invalid projects response');
  return rows
    .map((project: any) => ({
      id: String(project?.id || '').trim(),
      name: String(project?.name || '').trim(),
    }))
    .filter((project) => project.id && project.name);
};

export const ManagementReportsView: React.FC<ManagementReportsViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  // State
  const [viewMode, setViewMode] = useState<ViewModeExtended>('selector');
  const [reportType, setReportType] = useState<ManagementReportType>('TEAM_MEETING');
  const [scope, setScope] = useState<ManagementReportScope>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [periodDays, setPeriodDays] = useState(7);
  const [includeSections, setIncludeSections] = useState<string[]>([]);
  const [excludeSections, setExcludeSections] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState<'PDF' | 'PPTX'>('PDF');
  const [scheduleMode, setScheduleMode] = useState<'ONE_TIME' | 'RECURRING'>('ONE_TIME');
  const [scheduleFrequency, setScheduleFrequency] = useState<
    'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  >('WEEKLY');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleTimezone, setScheduleTimezone] = useState('Europe/Warsaw');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<ManagementReport | null>(null);
  const [reportHistory, setReportHistory] = useState<ManagementReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<{
    reportType?: ManagementReportType;
    scope?: ManagementReportScope;
    status?: ManagementReportStatus;
  }>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Store
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUser = useAppStore((state) => state.currentUser);
  const currentOrganizationId = currentUser?.organizationId;

  // Projects list from API
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoadError, setProjectsLoadError] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await Api.get('/api/projects');
        setProjects(normalizeManagementReportProjects(response));
        setProjectsLoadError(false);
      } catch (error) {
        setProjectsLoadError(true);
        console.error('Failed to load projects:', error);
      }
    };
    loadProjects();
  }, []);

  // Load history when switching to history view
  useEffect(() => {
    if (viewMode === 'history') {
      loadReportHistory();
    }
  }, [viewMode, historyFilters, historyPage]);

  const loadReportHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyFilters.reportType) params.append('reportType', historyFilters.reportType);
      if (historyFilters.scope) params.append('scope', historyFilters.scope);
      if (historyFilters.status) params.append('status', historyFilters.status);
      params.append('limit', historyPageSize.toString());
      params.append('offset', ((historyPage - 1) * historyPageSize).toString());

      const response = await Api.get(`/api/management-reports/history?${params.toString()}`);
      setReportHistory(response.data?.reports || []);
      setHistoryTotal(response.data?.total || 0);
    } catch (error) {
      console.error('Failed to load report history:', error);
      toast.error(t('reports.toast.loadHistoryError', 'Nie udało się załadować historii'));
    } finally {
      setHistoryLoading(false);
    }
  };

  // Reset page when filters change
  const handleHistoryFilterChange = (newFilters: typeof historyFilters) => {
    setHistoryFilters(newFilters);
    setHistoryPage(1);
  };

  // Generate report
  const handleGenerateReport = useCallback(async () => {
    if (scope === 'PROJECT' && !selectedProjectId) {
      toast.error(t('reports.toast.selectProject', 'Wybierz projekt'));
      return;
    }

    setGenerating(true);
    try {
      const response = await Api.post('/api/management-reports/generate', {
        reportType,
        scope,
        projectId: scope === 'PROJECT' ? selectedProjectId : undefined,
        organizationId: currentOrganizationId,
        periodDays,
        includeSections: includeSections.length > 0 ? includeSections : undefined,
        excludeSections: excludeSections.length > 0 ? excludeSections : undefined,
        aiEnhancement: true,
      });

      if (response.data?.report) {
        setCurrentReport(response.data.report);
        setViewMode('preview');
        toast.success(t('reports.toast.reportGenerated', 'Raport wygenerowany pomyślnie!'));

        if (scheduleMode === 'RECURRING') {
          try {
            await Api.post('/api/management-reports/schedules', {
              reportType,
              scope,
              projectId: scope === 'PROJECT' ? selectedProjectId : undefined,
              organizationId: currentOrganizationId,
              frequency: scheduleFrequency,
              dayOfWeek: scheduleFrequency !== 'MONTHLY' ? scheduleDayOfWeek : undefined,
              dayOfMonth: scheduleFrequency === 'MONTHLY' ? scheduleDayOfMonth : undefined,
              timeOfDay: scheduleTime,
              timezone: scheduleTimezone,
              recipients: scheduleRecipients
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
            });
            toast.success(t('reports.toast.scheduleCreated', 'Harmonogram cykliczny utworzony'));
          } catch (scheduleError) {
            console.error('Failed to create schedule:', scheduleError);
            toast.error(
              t(
                'reports.toast.scheduleError',
                'Raport wygenerowany, ale harmonogram nie został utworzony'
              )
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Report generation failed:', error);
      toast.error(
        error.message || t('reports.toast.generateFailed', 'Nie udało się wygenerować raportu')
      );
    } finally {
      setGenerating(false);
    }
  }, [
    reportType,
    scope,
    selectedProjectId,
    currentOrganizationId,
    periodDays,
    includeSections,
    excludeSections,
    scheduleMode,
    scheduleFrequency,
    scheduleDayOfWeek,
    scheduleDayOfMonth,
    scheduleTime,
    scheduleTimezone,
    scheduleRecipients,
  ]);

  // Export handlers
  const handleExportPDF = async () => {
    if (!currentReport) return '';
    const response = await Api.get(`/api/management-reports/${currentReport.id}/pdf`);
    return response.data?.pdfUrl || '';
  };

  const handleExportPPTX = async () => {
    if (!currentReport) return '';
    const response = await Api.get(`/api/management-reports/${currentReport.id}/pptx`);
    return response.data?.pptxUrl || '';
  };

  const handleShare = async () => {
    if (!currentReport) return { shareUrl: '', expiresAt: '' };
    const response = await Api.post(`/api/management-reports/${currentReport.id}/share`, {
      expiresInDays: 7,
    });
    return {
      shareUrl: response.data?.shareUrl || '',
      expiresAt: response.data?.expiresAt || '',
    };
  };

  // View a report from history
  const handleViewReport = async (reportId: string) => {
    try {
      const response = await Api.get(`/api/management-reports/${reportId}`);
      if (response.data?.report) {
        setCurrentReport(response.data.report);
        setViewMode('preview');
      }
    } catch (error) {
      toast.error(t('reports.toast.loadReportError', 'Nie udało się załadować raportu'));
    }
  };

  return (
    <div className={`min-h-full bg-c-surface-raised dark:bg-c-bg ${className}`}>
      {/* Header */}
      <div className="bg-c-surface border-b border-c-border-subtle px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {viewMode !== 'selector' && (
              <button
                onClick={() => setViewMode('selector')}
                className="p-2 hover:bg-c-surface-raised dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-c-text-muted" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-c-text flex items-center gap-2">
                <FileBarChart2 size={28} className="text-c-accent" />
                Management Reports
              </h1>
              <p className="text-sm text-c-text-muted mt-1">
                Generate Team Meeting and Steering Committee reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'selector', label: 'Generate', icon: Sparkles },
              { id: 'history', label: 'History', icon: History },
              { id: 'templates', label: 'Templates', icon: Wand2 },
              { id: 'schedule', label: 'Schedule', icon: CalendarClock },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as ViewModeExtended)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-c-accent-soft text-c-accent'
                      : 'hover:bg-c-surface-raised dark:hover:bg-white/10 text-c-text-secondary'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
            {viewMode !== 'selector' && (
              <button
                onClick={() => setViewMode('selector')}
                className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:opacity-90 text-white rounded-lg font-medium transition-colors"
              >
                <Plus size={18} />
                <span>New Report</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {viewMode === 'selector' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles size={20} className="text-c-accent" />
                <h2 className="text-lg font-semibold text-c-text">Generate New Report</h2>
              </div>

              {projectsLoadError && (
                <div role="alert" className="mb-4 text-sm text-red-600 dark:text-red-300">
                  Failed to load projects. Report generation is unavailable until projects can be
                  loaded.
                </div>
              )}

              <ReportTypeSelector
                reportType={reportType}
                scope={scope}
                selectedProjectId={selectedProjectId}
                periodDays={periodDays}
                projects={projects}
                includeSections={includeSections}
                excludeSections={excludeSections}
                onReportTypeChange={(type) => {
                  setReportType(type);
                  // Reset sections when report type changes
                  setIncludeSections([]);
                  setExcludeSections([]);
                  if (type === 'PORTFOLIO_HEALTH') {
                    setScope('PORTFOLIO');
                    setSelectedProjectId(undefined);
                  }
                  if (type === 'TEAM_MEETING' || type === 'TEAM_WEEKLY') {
                    setScope('PROJECT');
                  }
                }}
                onScopeChange={(nextScope) => {
                  if (reportType === 'PORTFOLIO_HEALTH') return;
                  setScope(nextScope);
                }}
                onProjectChange={setSelectedProjectId}
                onPeriodChange={setPeriodDays}
                onSectionsChange={(include, exclude) => {
                  setIncludeSections(include);
                  setExcludeSections(exclude);
                }}
              />

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-c-border-subtle">
                  <h3 className="text-sm font-semibold text-c-text-secondary mb-3">
                    Output Format
                  </h3>
                  <div className="flex gap-3">
                    {(['PDF', 'PPTX'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setOutputFormat(format)}
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          outputFormat === format
                            ? 'border-c-accent bg-c-accent-soft text-c-accent dark:text-c-accent'
                            : 'border-c-border-subtle text-c-text-muted hover:border-c-accent'
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-c-text-muted">
                    Export controls are available after generation.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-c-border-subtle">
                  <h3 className="text-sm font-semibold text-c-text-secondary mb-3">Schedule</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setScheduleMode('ONE_TIME')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        scheduleMode === 'ONE_TIME'
                          ? 'border-c-accent bg-c-accent-soft text-c-accent dark:text-c-accent'
                          : 'border-c-border-subtle text-c-text-muted hover:border-c-accent'
                      }`}
                    >
                      One-time
                    </button>
                    <button
                      onClick={() => setScheduleMode('RECURRING')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        scheduleMode === 'RECURRING'
                          ? 'border-c-accent bg-c-accent-soft text-c-accent dark:text-c-accent'
                          : 'border-c-border-subtle text-c-text-muted hover:border-c-accent'
                      }`}
                    >
                      Recurring
                    </button>
                  </div>
                  {scheduleMode === 'RECURRING' && (
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <label className="block text-xs text-c-text-muted mb-1">Frequency</label>
                        <select
                          value={scheduleFrequency}
                          onChange={(event) =>
                            setScheduleFrequency(
                              event.target.value as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
                            )
                          }
                          className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="BIWEEKLY">Bi-weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                      {scheduleFrequency !== 'MONTHLY' ? (
                        <div>
                          <label className="block text-xs text-c-text-muted mb-1">
                            Day of week
                          </label>
                          <select
                            value={scheduleDayOfWeek}
                            onChange={(event) => setScheduleDayOfWeek(Number(event.target.value))}
                            className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                          >
                            <option value={1}>Monday</option>
                            <option value={2}>Tuesday</option>
                            <option value={3}>Wednesday</option>
                            <option value={4}>Thursday</option>
                            <option value={5}>Friday</option>
                            <option value={6}>Saturday</option>
                            <option value={0}>Sunday</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs text-c-text-muted mb-1">
                            Day of month
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={scheduleDayOfMonth}
                            onChange={(event) => setScheduleDayOfMonth(Number(event.target.value))}
                            className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-c-text-muted mb-1">Time</label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(event) => setScheduleTime(event.target.value)}
                            className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-c-text-muted mb-1">Timezone</label>
                          <input
                            value={scheduleTimezone}
                            onChange={(event) => setScheduleTimezone(event.target.value)}
                            className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-c-text-muted mb-1">
                          Recipients (emails or user IDs)
                        </label>
                        <input
                          value={scheduleRecipients}
                          onChange={(event) => setScheduleRecipients(event.target.value)}
                          placeholder="name@example.com, user-id-123"
                          className="w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-c-border-subtle">
                <button
                  onClick={handleGenerateReport}
                  disabled={generating || (scope === 'PROJECT' && !selectedProjectId)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-c-accent hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-semibold text-lg transition-colors"
                >
                  {generating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Generating Report...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Generate Report</span>
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-sm text-c-text-muted">
                  AI will analyze your data and generate a comprehensive report with insights.
                </p>
              </div>
            </div>

            {/* PMO Standards info */}
            <div className="mt-6 p-4 bg-c-surface-raised rounded-xl">
              <h3 className="text-sm font-semibold text-c-text-secondary mb-2">
                PMO Standards Compliance
              </h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-c-text-muted">
                <div>
                  <span className="font-medium">ISO 21500:2021</span>
                  <p>Project Performance Measurement</p>
                </div>
                <div>
                  <span className="font-medium">PMBOK 7th Edition</span>
                  <p>Measurement Performance Domain</p>
                </div>
                <div>
                  <span className="font-medium">PRINCE2</span>
                  <p>Checkpoint & Highlight Reports</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'preview' && currentReport && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Export Controls */}
            <div className="flex items-center justify-between bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4">
              <div className="text-sm text-c-text-muted">
                Report ID:{' '}
                <code className="px-1 py-0.5 bg-c-surface-raised rounded">{currentReport.id}</code>
              </div>
              <ExportControls
                reportId={currentReport.id}
                onExportPDF={handleExportPDF}
                onExportPPTX={handleExportPPTX}
                onShare={handleShare}
              />
            </div>

            {/* Report Content with Suspense */}
            <Suspense fallback={<ReportSkeleton reportType={currentReport.reportType} />}>
              {currentReport.reportType === 'TEAM_MEETING' ||
              currentReport.reportType === 'TEAM_WEEKLY' ? (
                <TeamMeetingReport report={currentReport} />
              ) : currentReport.reportType === 'PORTFOLIO_HEALTH' ? (
                <PortfolioHealthReport report={currentReport} />
              ) : currentReport.reportType === 'RAID' ? (
                <RaidReport report={currentReport} />
              ) : (
                <SteeringCommitteeReport report={currentReport} />
              )}
            </Suspense>
          </div>
        )}

        {viewMode === 'history' && (
          <div className="max-w-6xl mx-auto">
            <ReportHistoryTable
              reports={reportHistory}
              loading={historyLoading}
              filters={historyFilters}
              onFilterChange={handleHistoryFilterChange}
              page={historyPage}
              pageSize={historyPageSize}
              total={historyTotal}
              onPageChange={setHistoryPage}
              onViewReport={handleViewReport}
              onDownloadPDF={(id) => window.open(`/api/management-reports/${id}/pdf`, '_blank')}
              onDownloadPPTX={(id) => window.open(`/api/management-reports/${id}/pptx`, '_blank')}
              onShare={(id) => {
                Api.post(`/api/management-reports/${id}/share`, { expiresInDays: 7 })
                  .then((res) => {
                    if (res.data?.shareUrl) {
                      navigator.clipboard.writeText(window.location.origin + res.data.shareUrl);
                      toast.success(
                        t('reports.toast.shareLinkCopied', 'Link do udostępniania skopiowany')
                      );
                    }
                  })
                  .catch(() =>
                    toast.error(t('reports.toast.shareLinkError', 'Nie udało się utworzyć linku'))
                  );
              }}
            />
          </div>
        )}

        {viewMode === 'templates' && (
          <div className="max-w-5xl mx-auto">
            <ReportTemplatesView />
          </div>
        )}

        {viewMode === 'schedule' && (
          <div className="max-w-5xl mx-auto">
            <ReportScheduleView />
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-6 space-y-4">
              <h2 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <Settings size={18} />
                Reporting Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-c-border-subtle p-4">
                  <p className="font-medium text-c-text-secondary mb-2">Default Output</p>
                  <p className="text-c-text-muted">Current default: {outputFormat}</p>
                </div>
                <div className="rounded-lg border border-c-border-subtle p-4">
                  <p className="font-medium text-c-text-secondary mb-2">Schedule Timezone</p>
                  <p className="text-c-text-muted">{scheduleTimezone}</p>
                </div>
              </div>
              <p className="text-xs text-c-text-muted">
                Settings are applied when creating new reports or schedules.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementReportsView;
