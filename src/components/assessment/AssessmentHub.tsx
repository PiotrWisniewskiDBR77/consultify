/**
 * AssessmentHub
 * New simplified Assessment module with 3 tabs (Assessment, Reports, Initiatives)
 * Uses shared ModuleHub components
 */

import { Activity, Cpu, Database, FileText, Layers, Lightbulb, Workflow } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Api } from '@/services/api';

import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleContext,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  StatusDropdown,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { InitiativesGenerationWizardModal } from './InitiativesGenerationWizardModal';
import { NewAssessmentReportModal } from './modals/NewAssessmentReportModal';
import { NewAssessmentData, NewAssessmentModal } from './NewAssessmentModal';

// Assessment Framework Types
type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

// Canonical Initiative Status (13 statuses)
// Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
type InitiativeStatusType =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REVIEW'
  | 'PROMOTED'
  | 'PLANNING'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'BLOCKED'
  | 'DONE'
  | 'TRACKING'
  | 'CANCELLED';

// Framework metadata
const FRAMEWORK_META: Record<
  AssessmentFramework,
  {
    name: string;
    shortName: string;
    icon: React.ReactNode;
    color: string;
    filterColor: string;
  }
> = {
  DRD: {
    name: 'Digital Readiness Diagnosis',
    shortName: 'DRD',
    icon: <Activity size={16} />,
    color: 'purple',
    filterColor: 'border-l-purple-500',
  },
  SIRI: {
    name: 'Smart Industry Readiness Index',
    shortName: 'SIRI',
    icon: <Cpu size={16} />,
    color: 'blue',
    filterColor: 'border-l-blue-500',
  },
  ADMA: {
    name: 'Advanced Digital Maturity Assessment',
    shortName: 'ADMA',
    icon: <Database size={16} />,
    color: 'teal',
    filterColor: 'border-l-teal-500',
  },
  CMMI: {
    name: 'Capability Maturity Model Integration',
    shortName: 'CMMI',
    icon: <Layers size={16} />,
    color: 'orange',
    filterColor: 'border-l-orange-500',
  },
  LEAN: {
    name: 'Lean 4.0',
    shortName: 'LEAN',
    icon: <Workflow size={16} />,
    color: 'green',
    filterColor: 'border-l-green-500',
  },
};

// API Response interface
interface AssessmentFromAPI {
  id: string;
  name: string;
  description?: string;
  status: string;
  type?: string;
  progress?: number;
  overallScore?: number;
  createdAt?: string;
  updatedAt?: string;
  organizationId?: string;
}

interface ReportBuilderReportFromAPI {
  id: string;
  name: string;
  status: string;
  assessmentId?: string;
  assessmentName?: string;
  assessmentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Map API status to canonical InitiativeStatus
const mapApiStatus = (status: string): InitiativeStatusType => {
  const s = status?.toUpperCase() || 'DRAFT';
  // Map legacy statuses to new canonical statuses
  const statusMap: Record<string, InitiativeStatusType> = {
    DRAFT: 'DRAFT',
    PENDING_REVIEW: 'PENDING_REVIEW',
    IN_REVIEW: 'PENDING_REVIEW', // Legacy mapping
    AWAITING_APPROVAL: 'PENDING_REVIEW', // Legacy mapping
    REVIEW: 'REVIEW',
    PROMOTED: 'PROMOTED',
    PLANNING: 'PLANNING',
    APPROVED: 'APPROVED',
    SCHEDULED: 'SCHEDULED',
    EXECUTING: 'EXECUTING',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
    COMPLETED: 'DONE',
    TRACKING: 'TRACKING',
    CANCELLED: 'CANCELLED',
    ARCHIVED: 'CANCELLED', // Map legacy ARCHIVED to CANCELLED
  };
  return statusMap[s] || 'DRAFT';
};

const mapReportBuilderStatusToHubStatus = (status: string): InitiativeStatusType => {
  const s = status?.toUpperCase() || 'DRAFT';
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'FINAL') return 'PENDING_REVIEW';
  if (s === 'ARCHIVED') return 'CANCELLED';
  if (s === 'DRAFT') return 'DRAFT';
  return 'DRAFT';
};

// Map API type to AssessmentFramework
const mapApiFramework = (type: string | undefined): AssessmentFramework => {
  if (!type) return 'DRD';
  const upper = type.toUpperCase();
  if (['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'].includes(upper)) {
    return upper as AssessmentFramework;
  }
  return 'DRD';
};

interface AssessmentHubProps {
  initialTab?: ModuleTab;
}

export const AssessmentHub: React.FC<AssessmentHubProps> = ({ initialTab = 'list' }) => {
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const wizardEnabled = isEnabled('assessmentInitiativesWizard');
  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInitiativesWizard, setShowInitiativesWizard] = useState(false);
  const [showNewReportModal, setShowNewReportModal] = useState(false);

  // API data state
  const [assessments, setAssessments] = useState<AssessmentFromAPI[]>([]);
  const [reports, setReports] = useState<ReportBuilderReportFromAPI[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safety net: if an "assessment" document is opened in this hub, always redirect to the real editor.
  // This prevents the placeholder card screen from ever being the primary UX.
  useEffect(() => {
    if (!activeDocumentId) return;
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    if (doc?.type !== 'assessment') return;
    const framework = (doc.subType?.toString().toLowerCase() || 'drd') as string;
    navigate(`/assessment/${framework}/${doc.id}`);
  }, [activeDocumentId, openDocuments, navigate]);

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch assessments
        const assessmentResponse = await Api.get('/assessments/my-assessments');
        const assessmentData = assessmentResponse?.assessments || [];
        setAssessments(Array.isArray(assessmentData) ? assessmentData : []);

        // Fetch APPROVED + FINAL (legacy) reports.
        // UI still defaults to APPROVED-only visibility, but this prevents "disappearing" legacy FINAL reports.
        const reportsResponse = await Api.get('/assessment-reports?status=APPROVED,FINAL').catch(
          () => null
        );
        const reportData = reportsResponse?.reports || [];
        setReports(Array.isArray(reportData) ? reportData : []);

        // Fetch initiatives derived from assessments
        const initiativesResponse = await Api.get('/initiatives?source=assessment').catch(() => []);
        setInitiatives(Array.isArray(initiativesResponse) ? initiativesResponse : []);
      } catch (err: any) {
        const message = err?.message || 'Failed to load assessments';
        setError(message);
        console.error('[AssessmentHub] Load error:', err);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Refresh function for manual reload
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assessmentsRes, reportsRes, initiativesRes] = await Promise.all([
        Api.get('/assessments/my-assessments').catch(() => null),
        Api.get('/assessment-reports?status=APPROVED,FINAL').catch(() => null),
        Api.get('/initiatives?source=assessment').catch(() => []),
      ]);

      setAssessments(assessmentsRes?.assessments || []);
      setReports(reportsRes?.reports || []);
      setInitiatives(Array.isArray(initiativesRes) ? initiativesRes : []);
    } catch (err: any) {
      toast.error('Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get status dropdown context based on active tab
  // Assessment tab shows DRAFT only, Initiatives tab shows full lifecycle
  const statusContext: ModuleContext = useMemo(() => {
    switch (activeTab) {
      case 'reports':
        return 'reporting'; // Reports can see all statuses
      case 'initiatives':
        return 'initiatives'; // Full initiative lifecycle
      default:
        return 'assessment'; // DRAFT only
    }
  }, [activeTab]);

  // Reset status filter when tab changes
  useEffect(() => {
    // Reports tab: default to showing only globally visible reports (APPROVED).
    // Other tabs: no status filter (all).
    setStatusFilter(activeTab === 'reports' ? 'APPROVED' : 'all');
  }, [activeTab]);

  // Calculate status counts for dropdown
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };

    let data: any[] = [];
    switch (activeTab) {
      case 'list':
        data = assessments;
        break;
      case 'reports':
        data = reports;
        break;
      case 'initiatives':
        data = initiatives;
        break;
    }

    counts.all = data.length;
    data.forEach((item) => {
      const status =
        activeTab === 'reports'
          ? mapReportBuilderStatusToHubStatus(String(item.status || 'DRAFT'))
          : mapApiStatus(item.status);
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }, [activeTab, assessments, reports, initiatives]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Assessment',
        icon: <FileText size={16} />,
        count: assessments.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Reports',
        icon: <FileText size={16} />,
        // Count all report documents (APPROVED + legacy FINAL),
        // while the default filter still shows APPROVED only.
        count: reports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        count: initiatives.filter((i) => String(i?.status || '').toUpperCase() !== 'DRAFT').length,
      },
    ],
    [assessments.length, reports, initiatives]
  );

  // Table columns for assessments
  const assessmentColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'framework',
        label: 'Type',
        width: '120px',
        filterable: true,
        filterOptions: Object.entries(FRAMEWORK_META).map(([key, meta]) => ({
          value: key,
          label: meta.shortName,
          color: `bg-${meta.color}-500`,
        })),
        render: (row) => {
          const meta = FRAMEWORK_META[row.framework as AssessmentFramework];
          return (
            <div className="flex items-center gap-2">
              <span className={`text-${meta.color}-400`}>{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-300">{meta.shortName}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
      },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'DRAFT', label: 'Draft', color: 'bg-slate-400' },
          { value: 'REVIEW', label: 'In Review', color: 'bg-amber-400' },
          { value: 'PROMOTED', label: 'Promoted', color: 'bg-blue-400' },
          { value: 'PLANNING', label: 'Planning', color: 'bg-indigo-400' },
          { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-400' },
          { value: 'SCHEDULED', label: 'Scheduled', color: 'bg-purple-400' },
          { value: 'EXECUTING', label: 'Executing', color: 'bg-cyan-400' },
          { value: 'BLOCKED', label: 'Blocked', color: 'bg-red-400' },
          { value: 'DONE', label: 'Done', color: 'bg-green-400' },
          { value: 'TRACKING', label: 'Tracking', color: 'bg-teal-400' },
          { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-400' },
        ],
      },
      {
        id: 'progress',
        label: 'Progress',
        width: '150px',
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        width: '120px',
        sortable: true,
      },
    ],
    []
  );

  // Handlers
  const handleOpenDocument = useCallback(
    (row: any) => {
      // Determine document type based on active tab
      const docType =
        activeTab === 'initiatives'
          ? 'initiative'
          : activeTab === 'reports'
            ? 'report'
            : 'assessment';

      // For assessments, open the actual editor route (instead of placeholder card)
      if (docType === 'assessment') {
        // Give immediate UX feedback: editor boot can take ~1–2s on first load.
        const tid = toast.loading('Opening assessment…');
        window.setTimeout(() => toast.dismiss(tid), 1500);

        const framework = (row.framework || row.type || 'DRD').toString().toLowerCase();
        // Resume last known position (DRD only for now)
        if (framework === 'drd') {
          try {
            const raw = window.localStorage.getItem(`assessment.nav.${row.id}`);
            if (raw) {
              const pos = JSON.parse(raw) as { axisId?: number; areaId?: string; level?: number };
              if (pos?.axisId && pos?.areaId && pos?.level) {
                navigate(
                  `/assessment/${framework}/${row.id}?axis=${encodeURIComponent(String(pos.axisId))}&area=${encodeURIComponent(
                    String(pos.areaId)
                  )}&level=${encodeURIComponent(String(pos.level))}`
                );
                return;
              }
            }
          } catch {
            // ignore
          }
        }
        navigate(`/assessment/${framework}/${row.id}`);
        return;
      }

      // For reports, open the report builder editor directly
      if (docType === 'report') {
        const tid = toast.loading('Opening report…');
        window.setTimeout(() => toast.dismiss(tid), 1500);
        navigate(`/assessment-reports/${row.id}`);
        return;
      }

      const doc: OpenDocument = {
        id: row.id,
        type: docType,
        subType: row.framework || row.sourceType,
        name: row.name,
        status: row.status,
      };

      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(row.id);
    },
    [activeTab, navigate]
  );

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleNewAssessment = useCallback(() => {
    setShowNewAssessmentModal(true);
  }, []);

  const handleAssessmentCreated = useCallback(
    (assessment: NewAssessmentData) => {
      // Refresh data to include new assessment
      refreshData();
      // Immediately open the actual editor
      navigate(`/assessment/${assessment.assessmentType.toLowerCase()}/${assessment.id}`);
    },
    [refreshData, navigate]
  );

  const handleRowAction = useCallback(
    (action: string, row: any) => {
      console.log('Row action:', action, row);
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  // Transform API data to display format
  const currentData = useMemo(() => {
    let data: any[] = [];

    switch (activeTab) {
      case 'list':
        data = assessments.map((item) => ({
          id: item.id,
          name: item.name,
          framework: mapApiFramework(item.type),
          status: mapApiStatus(item.status),
          progress: item.progress ?? 0,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }));
        break;
      case 'reports':
        data = reports.map((item) => ({
          id: item.id,
          name: (item as any).name || (item as any).title,
          framework: mapApiFramework((item as any).assessmentType),
          status: mapReportBuilderStatusToHubStatus(item.status),
          progress: mapReportBuilderStatusToHubStatus(item.status) === 'APPROVED' ? 100 : 60,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }));
        break;
      case 'initiatives':
        data = initiatives
          .filter((item) => String(item.status || '').toUpperCase() !== 'DRAFT')
          .map((item) => ({
            id: item.id,
            name: item.name || item.title,
            framework: mapApiFramework(item.sourceType),
            status: mapApiStatus(item.status),
            progress: 100,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            priority: item.priority || 'medium',
            impact: item.impact || 'medium',
          }));
        break;
      default:
        data = [];
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter((item) => item.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      data = data.filter((item) => {
        const name = item.name?.toLowerCase() || '';
        const framework = item.framework?.toLowerCase() || '';
        const status = item.status?.toLowerCase() || '';
        return name.includes(query) || framework.includes(query) || status.includes(query);
      });
    }

    return data;
  }, [activeTab, assessments, reports, initiatives, searchQuery, statusFilter]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item) => ({
      ...item,
      type: item.framework,
      typeColor: FRAMEWORK_META[item.framework as AssessmentFramework]?.color || 'slate',
    }));
  }, [currentData]);

  // Render content based on active document or list
  const renderContent = () => {
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);

      // Show Initiative Document View for initiatives
      if (doc && (doc.type === 'initiative' || activeTab === 'initiatives')) {
        return (
          <InitiativeDocumentView
            initiativeId={doc.id}
            onBack={handleShowList}
            onStatusChange={refreshData}
            sourceModule="assessment"
          />
        );
      }

      // Show Assessment Editor for assessments
      if (doc && doc.type === 'assessment') {
        const framework = doc.subType?.toUpperCase() || 'DRD';
        return (
          <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
            {/* Assessment Editor Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleShowList}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5 text-slate-500" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                    {doc.name}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {framework} Assessment · {doc.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'DRAFT'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : doc.status === 'REVIEW'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : doc.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}
                >
                  {doc.status}
                </span>
              </div>
            </div>

            {/* Assessment Editor Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-8">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-navy-900 dark:text-white mb-2">
                      {doc.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                      Framework: {framework}
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => navigate(`/assessment/${framework.toLowerCase()}/${doc.id}`)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                      >
                        Open Full Editor
                      </button>
                      <button
                        onClick={handleShowList}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                      >
                        Back to List
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Show document editor (placeholder for reports)
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <p className="text-lg">Editing: {doc?.name}</p>
            <p className="text-sm">
              ({doc?.subType} - {doc?.status})
            </p>
            <p className="mt-4 text-xs">Editor placeholder - report editor will be here</p>
          </div>
        </div>
      );
    }

    // Show list/grid view
    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={handleOpenDocument}
          onItemAction={handleRowAction}
          onNewItem={handleNewAssessment}
          newItemLabel="New Assessment"
        />
      );
    }

    return (
      <FilterableTable
        columns={assessmentColumns}
        data={currentData}
        onRowClick={handleOpenDocument}
        onRowAction={handleRowAction}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage="No assessments found. Create your first assessment to get started."
      />
    );
  };

  // Status dropdown component for right controls
  const statusDropdownControl = (
    <StatusDropdown
      context={statusContext}
      value={statusFilter}
      onChange={setStatusFilter}
      counts={statusCounts}
      size="md"
    />
  );

  // Dynamic new item handler based on active tab
  const handleNewItem = useCallback(() => {
    if (activeTab === 'reports') {
      setShowNewReportModal(true);
    } else if (activeTab === 'initiatives') {
      if (!wizardEnabled) {
        toast.error('Initiatives wizard is disabled (feature flag).');
        return;
      }
      setShowInitiativesWizard(true);
    } else {
      handleNewAssessment();
    }
  }, [activeTab, handleNewAssessment, wizardEnabled]);

  // Dynamic new item label based on active tab
  const getNewItemLabel = () => {
    if (activeTab === 'reports') return 'New Report';
    if (activeTab === 'initiatives') return 'New Initiative';
    return 'New Assessment';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading assessments...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewItem}
        newItemLabel={getNewItemLabel()}
        rightControls={statusDropdownControl}
      >
        {renderContent()}
      </ModuleHub>

      <InitiativesGenerationWizardModal
        isOpen={showInitiativesWizard}
        onClose={() => setShowInitiativesWizard(false)}
        assessments={assessments.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status,
        }))}
        onCompleted={() => refreshData()}
      />

      {/* New Assessment Modal */}
      <NewAssessmentModal
        isOpen={showNewAssessmentModal}
        onClose={() => setShowNewAssessmentModal(false)}
        onSuccess={handleAssessmentCreated}
      />

      <NewAssessmentReportModal
        isOpen={showNewReportModal}
        onClose={() => setShowNewReportModal(false)}
        assessments={assessments.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status,
        }))}
        onCreated={(reportId) => navigate(`/assessment-reports/${reportId}`)}
      />
    </>
  );
};

export default AssessmentHub;
