/**
 * ReportsHub
 * Unified Management Reports module with 3 tabs (Reports, Templates, Schedules)
 * Uses shared ModuleHub components for consistent UX
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Download,
  Eye,
  FileBarChart2,
  FileText,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../../../services/api';

import {
  ManagementReport,
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '../../../types';
import {
  FilterableTable,
  FilterChip,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../../shared/ModuleHub';
import { ReportGeneratorDrawer } from './ReportGeneratorDrawer';
import { PortfolioHealthReport } from './PortfolioHealthReport';
import { RaidReport } from './RaidReport';
import { SteeringCommitteeReport } from './SteeringCommitteeReport';
import { TeamMeetingReport } from './TeamMeetingReport';

// Report type metadata
const REPORT_TYPE_META: Record<
  ManagementReportType,
  { label: string; shortLabel: string; icon: React.ReactNode; color: string }
> = {
  TEAM_MEETING: {
    label: 'Team Meeting',
    shortLabel: 'TM',
    icon: <Users size={14} />,
    color: 'text-blue-400',
  },
  TEAM_WEEKLY: {
    label: 'Team Weekly',
    shortLabel: 'TW',
    icon: <Users size={14} />,
    color: 'text-sky-400',
  },
  STEERING_COMMITTEE: {
    label: 'Steering Committee',
    shortLabel: 'SC',
    icon: <Building2 size={14} />,
    color: 'text-violet-400',
  },
  PORTFOLIO_HEALTH: {
    label: 'Portfolio Health',
    shortLabel: 'PH',
    icon: <Briefcase size={14} />,
    color: 'text-emerald-400',
  },
  RAID: {
    label: 'RAID',
    shortLabel: 'RAID',
    icon: <AlertTriangle size={14} />,
    color: 'text-amber-400',
  },
};

const SCOPE_META: Record<ManagementReportScope, { label: string; color: string }> = {
  PROJECT: { label: 'Project', color: 'bg-slate-600' },
  PORTFOLIO: { label: 'Portfolio', color: 'bg-emerald-600' },
};

const STATUS_META: Record<ManagementReportStatus, { label: string; dotColor: string }> = {
  DRAFT: { label: 'Draft', dotColor: 'bg-amber-400' },
  FINAL: { label: 'Final', dotColor: 'bg-emerald-400' },
  ARCHIVED: { label: 'Archived', dotColor: 'bg-slate-400' },
};

interface ReportHistoryItem {
  id: string;
  title: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  status: ManagementReportStatus;
  generatedBy: string;
  generatedByName: string;
  projectName?: string;
  createdAt: string;
  periodStart?: string;
  periodEnd?: string;
  pdfPath?: string;
  pptxPath?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: ManagementReportType;
  sections: string[];
  createdAt: string;
  createdByName?: string;
}

interface ReportSchedule {
  id: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  projectId?: string;
  projectName?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  nextScheduledAt?: string;
  recipients?: string[];
}

interface ReportsHubProps {
  initialTab?: ModuleTab;
}

export const ReportsHub: React.FC<ReportsHubProps> = ({ initialTab = 'list' }) => {
  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGeneratorDrawer, setShowGeneratorDrawer] = useState(false);
  const [currentReport, setCurrentReport] = useState<ManagementReport | null>(null);

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [reportsRes, templatesRes, schedulesRes] = await Promise.all([
          Api.get('/api/management-reports/history?limit=50'),
          Api.get('/api/management-reports/templates'),
          Api.get('/api/management-reports/schedules'),
        ]);

        setReports(reportsRes.data?.reports || []);
        setTemplates(templatesRes.data?.templates || []);
        setSchedules(schedulesRes.data?.schedules || []);
      } catch (err) {
        console.error('[ReportsHub] Failed to load:', err);
        toast.error('Failed to load reports data');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: reports.length,
      draft: reports.filter((r) => r.status === 'DRAFT').length,
      final: reports.filter((r) => r.status === 'FINAL').length,
      thisWeek: reports.filter((r) => {
        const date = new Date(r.createdAt);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
      }).length,
    }),
    [reports]
  );

  // Filter reports
  const filteredReports = useMemo(() => {
    let result = reports;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          (r.projectName || '').toLowerCase().includes(query)
      );
    }

    activeFilters.forEach((filter: FilterChip) => {
      if (filter.column === 'reportType') {
        result = result.filter((r) => r.reportType === filter.value);
      }
      if (filter.column === 'status') {
        result = result.filter((r) => r.status === filter.value);
      }
      if (filter.column === 'scope') {
        result = result.filter((r) => r.scope === filter.value);
      }
    });

    return result;
  }, [reports, searchQuery, activeFilters]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Reports',
        icon: <FileBarChart2 size={16} />,
        count: filteredReports.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Templates',
        icon: <Wand2 size={16} />,
        count: templates.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Schedules',
        icon: <CalendarClock size={16} />,
        count: schedules.filter((s) => s.isActive).length,
      },
    ],
    [filteredReports.length, templates.length, schedules]
  );

  // Table columns for Reports
  const reportColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: 'Type',
        width: '100px',
        render: (row: ReportHistoryItem) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2">
              <span className={meta.color}>{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-300">{meta.shortLabel}</span>
            </div>
          );
        },
      },
      {
        id: 'title',
        label: 'Title',
        render: (row: ReportHistoryItem) => (
          <div>
            <span className="text-sm text-white font-medium">{row.title}</span>
            {row.projectName && (
              <p className="text-xs text-slate-400 mt-0.5">{row.projectName}</p>
            )}
          </div>
        ),
      },
      {
        id: 'scope',
        label: 'Scope',
        width: '100px',
        render: (row: ReportHistoryItem) => {
          const meta = SCOPE_META[row.scope];
          return (
            <span className={`px-2 py-1 text-xs font-medium rounded ${meta.color} text-white`}>
              {meta.label}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '100px',
        filterable: true,
        filterOptions: Object.entries(STATUS_META).map(([value, meta]) => ({
          value,
          label: meta.label,
          color: meta.dotColor,
        })),
        render: (row: ReportHistoryItem) => {
          const meta = STATUS_META[row.status];
          return (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-sm text-slate-300">{meta.label}</span>
            </div>
          );
        },
      },
      {
        id: 'createdAt',
        label: 'Generated',
        width: '140px',
        sortable: true,
        render: (row: ReportHistoryItem) => (
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Calendar size={14} className="text-slate-500" />
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{row.generatedByName}</p>
          </div>
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: '120px',
        render: (row: ReportHistoryItem) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewReport(row.id);
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="View report"
            >
              <Eye size={16} className="text-slate-400" />
            </button>
            {row.pdfPath && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadPDF(row.id);
                }}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Download PDF"
              >
                <FileText size={16} className="text-red-400" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare(row.id);
              }}
              className="p-2 hover:bg-violet-500/20 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 size={16} className="text-violet-400" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  // Table columns for Templates
  const templateColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: 'Type',
        width: '100px',
        render: (row: ReportTemplate) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2">
              <span className={meta.color}>{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-300">{meta.shortLabel}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row: ReportTemplate) => (
          <div>
            <span className="text-sm text-white font-medium">{row.name}</span>
            {row.description && <p className="text-xs text-slate-400 mt-0.5">{row.description}</p>}
          </div>
        ),
      },
      {
        id: 'sections',
        label: 'Sections',
        width: '100px',
        render: (row: ReportTemplate) => (
          <span className="text-sm text-slate-300">{row.sections.length} sections</span>
        ),
      },
      {
        id: 'createdAt',
        label: 'Created',
        width: '140px',
        render: (row: ReportTemplate) => (
          <div>
            <div className="text-sm text-slate-300">
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
            {row.createdByName && <p className="text-xs text-slate-500">{row.createdByName}</p>}
          </div>
        ),
      },
    ],
    []
  );

  // Table columns for Schedules
  const scheduleColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: 'Type',
        width: '100px',
        render: (row: ReportSchedule) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2">
              <span className={meta.color}>{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-300">{meta.shortLabel}</span>
            </div>
          );
        },
      },
      {
        id: 'scope',
        label: 'Scope',
        render: (row: ReportSchedule) => (
          <div>
            <span className="text-sm text-white font-medium">
              {row.scope === 'PROJECT' ? row.projectName || 'Project' : 'Portfolio'}
            </span>
          </div>
        ),
      },
      {
        id: 'frequency',
        label: 'Frequency',
        width: '120px',
        render: (row: ReportSchedule) => (
          <span className="text-sm text-slate-300">{row.frequency}</span>
        ),
      },
      {
        id: 'schedule',
        label: 'Schedule',
        width: '140px',
        render: (row: ReportSchedule) => (
          <div className="text-sm text-slate-300">
            {row.timeOfDay} {row.timezone}
          </div>
        ),
      },
      {
        id: 'next',
        label: 'Next Run',
        width: '140px',
        render: (row: ReportSchedule) => (
          <div>
            {row.nextScheduledAt ? (
              <div className="text-sm text-slate-300">
                {new Date(row.nextScheduledAt).toLocaleDateString()}
              </div>
            ) : (
              <span className="text-sm text-slate-500">Not scheduled</span>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: '80px',
        render: (row: ReportSchedule) => (
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              row.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-300'
            }`}
          >
            {row.isActive ? 'Active' : 'Paused'}
          </span>
        ),
      },
    ],
    []
  );

  // Handlers
  const handleViewReport = useCallback(async (reportId: string) => {
    try {
      const response = await Api.get(`/api/management-reports/${reportId}`);
      if (response.data?.report) {
        setCurrentReport(response.data.report);

        const report = response.data.report;
        const meta = REPORT_TYPE_META[report.reportType as ManagementReportType];

        const doc: OpenDocument = {
          id: report.id,
          type: 'report',
          subType: meta.shortLabel,
          name: report.title,
          status: report.status === 'FINAL' ? 'completed' : 'draft',
        };

        setOpenDocuments((prev) => {
          if (prev.find((d) => d.id === doc.id)) return prev;
          return [...prev, doc];
        });
        setActiveDocumentId(report.id);
      }
    } catch (error) {
      toast.error('Failed to load report');
    }
  }, []);

  const handleDownloadPDF = useCallback(async (reportId: string) => {
    try {
      const response = await Api.get(`/api/management-reports/${reportId}/pdf`);
      if (response.data?.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
        toast.success('PDF download started');
      }
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  }, []);

  const handleShare = useCallback(async (reportId: string) => {
    try {
      const response = await Api.post(`/api/management-reports/${reportId}/share`, {
        expiresInDays: 7,
      });
      if (response.data?.shareUrl) {
        navigator.clipboard.writeText(window.location.origin + response.data.shareUrl);
        toast.success('Share link copied to clipboard');
      }
    } catch (error) {
      toast.error('Failed to create share link');
    }
  }, []);

  const handleOpenDocument = useCallback(
    (row: ReportHistoryItem) => {
      handleViewReport(row.id);
    },
    [handleViewReport]
  );

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setCurrentReport(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setCurrentReport(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleNewReport = useCallback(() => {
    setShowGeneratorDrawer(true);
  }, []);

  const handleReportGenerated = useCallback((report: ManagementReport) => {
    setReports((prev) => [
      {
        id: report.id,
        title: report.title,
        reportType: report.reportType as ManagementReportType,
        scope: report.scope as ManagementReportScope,
        status: report.status as ManagementReportStatus,
        generatedBy: report.generatedBy || '',
        generatedByName: report.generatedByName || '',
        projectName: '',
        createdAt: report.createdAt || new Date().toISOString(),
      },
      ...prev,
    ]);
    setShowGeneratorDrawer(false);
    setCurrentReport(report);

    const meta = REPORT_TYPE_META[report.reportType as ManagementReportType];
    const doc: OpenDocument = {
      id: report.id,
      type: 'report',
      subType: meta.shortLabel,
      name: report.title,
      status: 'draft',
    };

    setOpenDocuments((prev) => [...prev, doc]);
    setActiveDocumentId(report.id);
    toast.success('Report generated successfully!');
  }, []);

  // Render report preview
  const renderReportPreview = () => {
    if (!currentReport) return null;

    const reportType = currentReport.reportType as ManagementReportType;

    switch (reportType) {
      case 'TEAM_MEETING':
      case 'TEAM_WEEKLY':
        return <TeamMeetingReport report={currentReport} />;
      case 'STEERING_COMMITTEE':
        return <SteeringCommitteeReport report={currentReport} />;
      case 'PORTFOLIO_HEALTH':
        return <PortfolioHealthReport report={currentReport} />;
      case 'RAID':
        return <RaidReport report={currentReport} />;
      default:
        return <div className="p-6 text-slate-400">Unknown report type</div>;
    }
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      );
    }

    // Show report preview if document is open
    if (activeDocumentId && currentReport) {
      return <div className="overflow-auto h-full p-6">{renderReportPreview()}</div>;
    }

    // Tab: Reports (default)
    if (activeTab === 'list') {
      if (filteredReports.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileBarChart2 className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No reports yet</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md">
              Generate your first management report to track project status, team progress, and
              portfolio health.
            </p>
            <button
              onClick={handleNewReport}
              className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
            >
              <Sparkles size={18} />
              Generate Report
            </button>
          </div>
        );
      }

      return (
        <FilterableTable
          columns={reportColumns}
          data={filteredReports}
          onRowClick={(row: any) => handleOpenDocument(row as ReportHistoryItem)}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage="No reports found."
        />
      );
    }

    // Tab: Templates
    if (activeTab === 'reports') {
      if (templates.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Wand2 className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No templates yet</h3>
            <p className="text-sm text-slate-400 mb-6">
              Create templates to quickly generate reports with predefined sections.
            </p>
          </div>
        );
      }

      return (
        <FilterableTable
          columns={templateColumns}
          data={templates}
          onRowClick={() => {}}
          activeFilters={[]}
          onFilterChange={() => {}}
          emptyMessage="No templates found."
        />
      );
    }

    // Tab: Schedules
    if (activeTab === 'initiatives') {
      if (schedules.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarClock className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No schedules yet</h3>
            <p className="text-sm text-slate-400 mb-6">
              Set up recurring schedules to automatically generate reports.
            </p>
          </div>
        );
      }

      return (
        <FilterableTable
          columns={scheduleColumns}
          data={schedules}
          onRowClick={() => {}}
          activeFilters={[]}
          onFilterChange={() => {}}
          emptyMessage="No schedules found."
        />
      );
    }

    return null;
  };

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={(id) => {
          setActiveDocumentId(id);
          const report = reports.find((r) => r.id === id);
          if (report) {
            handleViewReport(report.id);
          }
        }}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewReport}
        newItemLabel="New Report"
        availableViewModes={['table']}
      >
        {renderContent()}
      </ModuleHub>

      {/* Report Generator Drawer */}
      {showGeneratorDrawer && (
        <ReportGeneratorDrawer
          isOpen={showGeneratorDrawer}
          onClose={() => setShowGeneratorDrawer(false)}
          onReportGenerated={handleReportGenerated}
        />
      )}
    </>
  );
};

export default ReportsHub;
