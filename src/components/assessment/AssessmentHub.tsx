/**
 * AssessmentHub
 * New simplified Assessment module with 3 tabs (Assessment, Reports, Initiatives)
 * Uses shared ModuleHub components
 */

import { Activity, Cpu, Database, FileText, Layers, Lightbulb, Workflow, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Api } from '@/services/api';

import { InitiativeCompactPanel } from '../Initiatives/InitiativeCompactPanel';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import {
  ASSESSMENT_STATUSES,
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleContext,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  REPORT_STATUSES,
  StatusDropdown,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { InitiativesGenerationWizardModal } from './InitiativesGenerationWizardModal';
import { NewAssessmentReportModal } from './modals/NewAssessmentReportModal';
import { NewAssessmentData, NewAssessmentModal } from './NewAssessmentModal';

// Assessment Framework Types
type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

// Assessment workflow statuses (own lifecycle)
type AssessmentStatusType =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

// Report statuses (own lifecycle)
type ReportStatusType =
  | 'DRAFT'
  | 'GENERATING'
  | 'FINAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'UTILIZED';

// Initiative statuses (canonical 13)
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

// Map API status to assessment status (preserves assessment-native statuses)
const mapAssessmentApiStatus = (status: string): AssessmentStatusType => {
  const s = status?.toUpperCase() || 'DRAFT';
  const statusMap: Record<string, AssessmentStatusType> = {
    DRAFT: 'DRAFT',
    IN_REVIEW: 'IN_REVIEW',
    PENDING_REVIEW: 'IN_REVIEW',
    AWAITING_APPROVAL: 'AWAITING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    ARCHIVED: 'ARCHIVED',
    COMPLETED: 'APPROVED',
  };
  return statusMap[s] || 'DRAFT';
};

// Map API status to report status (preserves report-native statuses)
const mapReportApiStatus = (status: string): ReportStatusType => {
  const s = status?.toUpperCase() || 'DRAFT';
  const statusMap: Record<string, ReportStatusType> = {
    DRAFT: 'DRAFT',
    GENERATING: 'GENERATING',
    FINAL: 'FINAL',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    UTILIZED: 'UTILIZED',
  };
  return statusMap[s] || 'DRAFT';
};

// Map API status to initiative status (canonical 13)
const mapInitiativeApiStatus = (status: string): InitiativeStatusType => {
  const s = status?.toUpperCase() || 'DRAFT';
  const statusMap: Record<string, InitiativeStatusType> = {
    DRAFT: 'DRAFT',
    PENDING_REVIEW: 'PENDING_REVIEW',
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
    ARCHIVED: 'CANCELLED',
  };
  return statusMap[s] || 'DRAFT';
};

// In Assessment module we treat initiatives as "source artifacts" (phase 1 only)
const isAssessmentModuleInitiative = (row: any): boolean => {
  const s = String(row?.status || '').toUpperCase();
  return s === 'DRAFT' || s === 'PENDING_REVIEW';
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

  // Compact panel (preview) state
  const [previewInitiativeId, setPreviewInitiativeId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Report slide-over: assessment report id + (optional) linked report builder id
  const [slideOverReportId, setSlideOverReportId] = useState<string | null>(null);
  const [slideOverBuilderReportId, setSlideOverBuilderReportId] = useState<string | null>(null);
  const [slideOverReportOpen, setSlideOverReportOpen] = useState(false);

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
        const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
        const isTransient = (e: any) => {
          const status = Number(e?.status);
          if ([502, 503, 504].includes(status)) return true;
          // Some browsers throw TypeError("Failed to fetch") on network issues.
          const msg = String(e?.message || '').toLowerCase();
          return (
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('load failed')
          );
        };

        // Warm-start / cold-backend safety:
        // AssessmentHub is often the first module hit in a session; on cold backend/DB
        // the first request can return 502/503/504. Retrying avoids forcing users to "switch modules".
        const maxAttempts = 4;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // Fetch assessments (required)
            const assessmentResponse = await Api.get('/assessments/my-assessments');
            const assessmentData = assessmentResponse?.assessments || [];
            setAssessments(Array.isArray(assessmentData) ? assessmentData : []);

            // Fetch ALL reports linked to user's assessments (all statuses).
            // Status filtering is done client-side via the status dropdown.
            const reportsResponse = await Api.get('/assessment-reports').catch(() => null);
            const reportData = reportsResponse?.reports || [];
            setReports(Array.isArray(reportData) ? reportData : []);

            // Fetch initiatives derived from assessments
            const initiativesResponse = await Api.get('/initiatives?source=assessment').catch(
              () => []
            );
            const rawInits = Array.isArray(initiativesResponse) ? initiativesResponse : [];
            setInitiatives(rawInits.filter(isAssessmentModuleInitiative));

            lastErr = null;
            break;
          } catch (e: any) {
            lastErr = e;
            if (attempt < maxAttempts && isTransient(e)) {
              await sleep(350 * attempt);
              continue;
            }
            throw e;
          }
        }

        if (lastErr) throw lastErr;
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
    setError(null);
    try {
      const [assessmentsRes, reportsRes, initiativesRes] = await Promise.all([
        Api.get('/assessments/my-assessments').catch(() => null),
        Api.get('/assessment-reports').catch(() => null),
        Api.get('/initiatives?source=assessment').catch(() => []),
      ]);

      setAssessments(assessmentsRes?.assessments || []);
      setReports(reportsRes?.reports || []);
      const rawInits = Array.isArray(initiativesRes) ? initiativesRes : [];
      setInitiatives(rawInits.filter(isAssessmentModuleInitiative));
    } catch (err: any) {
      toast.error('Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get status dropdown context based on active tab
  // Each tab uses its own status family
  const statusContext: ModuleContext = useMemo(() => {
    switch (activeTab) {
      case 'reports':
        return 'assessment_reports'; // Report statuses (DRAFT, GENERATING, FINAL, APPROVED, etc.)
      case 'initiatives':
        return 'assessment_initiatives'; // Source-phase only (DRAFT, PENDING_REVIEW)
      default:
        return 'assessment_list'; // Assessment workflow statuses (DRAFT, IN_REVIEW, APPROVED, etc.)
    }
  }, [activeTab]);

  // Reset status filter when tab changes — show all items by default
  useEffect(() => {
    setStatusFilter('all');
  }, [activeTab]);

  // Calculate status counts for dropdown — each tab uses its own status mapper
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
      let status: string;
      if (activeTab === 'reports') {
        status = mapReportApiStatus(String(item.status || 'DRAFT'));
      } else if (activeTab === 'initiatives') {
        status = mapInitiativeApiStatus(String(item.status || 'DRAFT'));
      } else {
        status = mapAssessmentApiStatus(String(item.status || 'DRAFT'));
      }
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
        count: initiatives.length,
      },
    ],
    [assessments.length, reports, initiatives]
  );

  // Table columns for assessments
  // Dynamic columns per active tab
  const tableColumns: TableColumn[] = useMemo(() => {
    // Common columns
    const frameworkCol: TableColumn = {
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
        if (!meta) return <span className="text-xs text-slate-400">{row.framework}</span>;
        return (
          <div className="flex items-center gap-2">
            <span className={`text-${meta.color}-400`}>{meta.icon}</span>
            <span className="font-mono text-xs font-bold text-slate-300">{meta.shortName}</span>
          </div>
        );
      },
    };
    const nameCol: TableColumn = {
      id: 'name',
      label: 'Name',
      render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
    };
    const progressCol: TableColumn = { id: 'progress', label: 'Progress', width: '150px' };
    const updatedCol: TableColumn = {
      id: 'updatedAt',
      label: 'Updated',
      width: '120px',
      sortable: true,
    };

    if (activeTab === 'reports') {
      return [
        frameworkCol,
        nameCol,
        {
          id: 'status',
          label: 'Status',
          width: '160px',
          filterable: true,
          filterOptions: Object.values(REPORT_STATUSES).map((s) => ({
            value: s.id,
            label: s.label,
            color: s.bgColor,
          })),
        },
        progressCol,
        updatedCol,
      ];
    }

    if (activeTab === 'initiatives') {
      return [
        frameworkCol,
        nameCol,
        {
          id: 'sourceReport',
          label: 'Source Report',
          width: '200px',
          render: (row) => (
            <span
              className="text-xs text-slate-400 truncate block max-w-[180px]"
              title={row.sourceReport || ''}
            >
              {row.sourceReport || '—'}
            </span>
          ),
        },
        {
          id: 'status',
          label: 'Status',
          width: '140px',
          filterable: true,
          filterOptions: [
            { value: 'DRAFT', label: 'Draft', color: 'bg-slate-500' },
            { value: 'REVIEW', label: 'In Review', color: 'bg-amber-500' },
            { value: 'PLANNING', label: 'Planning', color: 'bg-indigo-500' },
            { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-500' },
            { value: 'EXECUTING', label: 'Executing', color: 'bg-cyan-500' },
            { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-500' },
          ],
        },
        {
          id: 'priority',
          label: 'Priority',
          width: '100px',
          filterable: true,
          filterOptions: [
            { value: 'critical', label: 'Critical', color: 'bg-red-500' },
            { value: 'high', label: 'High', color: 'bg-orange-500' },
            { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
            { value: 'low', label: 'Low', color: 'bg-slate-500' },
          ],
          render: (row) => {
            const colors: Record<string, string> = {
              critical: 'text-red-400 bg-red-500/10',
              high: 'text-orange-400 bg-orange-500/10',
              medium: 'text-blue-400 bg-blue-500/10',
              low: 'text-slate-400 bg-slate-500/10',
            };
            const c = colors[row.priority] || colors.medium;
            return (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c}`}>
                {row.priority || 'medium'}
              </span>
            );
          },
        },
        updatedCol,
      ];
    }

    // Default: assessment list
    return [
      frameworkCol,
      nameCol,
      {
        id: 'status',
        label: 'Status',
        width: '160px',
        filterable: true,
        filterOptions: Object.values(ASSESSMENT_STATUSES).map((s) => ({
          value: s.id,
          label: s.label,
          color: s.bgColor,
        })),
      },
      progressCol,
      updatedCol,
    ];
  }, [activeTab]);

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

      // For reports, open in slide-over panel
      if (docType === 'report') {
        setSlideOverReportId(row.id);
        setSlideOverBuilderReportId(
          (row as any).builderReportId || (row as any).builder_report_id || null
        );
        setSlideOverReportOpen(true);
        return;
      }

      // For initiatives, row click opens quick preview panel
      if (docType === 'initiative') {
        setPreviewInitiativeId(row.id);
        setIsPreviewOpen(true);
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
    async (action: string, row: any) => {
      if (action === 'preview') {
        // Open compact side panel for quick preview
        if (activeTab === 'initiatives') {
          setPreviewInitiativeId(row.id);
          setIsPreviewOpen(true);
        } else {
          handleOpenDocument(row);
        }
      } else if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      } else if (action === 'duplicate') {
        // Duplicate assessment
        const docType =
          activeTab === 'initiatives'
            ? 'initiative'
            : activeTab === 'reports'
              ? 'report'
              : 'assessment';
        const toastId = toast.loading(`Duplicating ${docType}...`);
        try {
          if (docType === 'assessment') {
            const resp = await Api.post(`/assessment-workflow-v2/${row.id}/duplicate`, {});
            toast.success('Assessment duplicated', { id: toastId });
            refreshData();
            if (resp?.id) {
              const fw = (row.framework || 'drd').toString().toLowerCase();
              navigate(`/assessment/${fw}/${resp.id}`);
            }
          } else if (docType === 'report') {
            const builderId =
              (row as any).builderReportId || (row as any).builder_report_id || null;
            if (!builderId) throw new Error('Missing linked Report Builder id');
            const newTitle = `${row.name || 'Report'} (Copy)`;
            const resp: any = await Api.post(
              `/report-builder/${encodeURIComponent(String(builderId))}/duplicate`,
              { title: newTitle }
            );
            const newId = String(resp?.report?.id || resp?.id || '');
            toast.success('Report duplicated', { id: toastId });
            refreshData();
            if (newId) navigate(`/reports/builder/${encodeURIComponent(newId)}`);
          } else if (docType === 'initiative') {
            const resp: any = await Api.post(
              `/initiatives/${encodeURIComponent(row.id)}/duplicate`,
              {
                title: `${row.name || 'Initiative'} (Copy)`,
              }
            );
            const newId = String(resp?.id || resp?.initiative?.id || '');
            toast.success('Initiative duplicated', { id: toastId });
            refreshData();
            if (newId) {
              setOpenDocuments((prev) => {
                if (prev.find((d) => d.id === newId)) return prev;
                return [
                  ...prev,
                  {
                    id: newId,
                    type: 'initiative',
                    subType: row.sourceType,
                    name: `${row.name || 'Initiative'} (Copy)`,
                    status: 'DRAFT',
                  } as any,
                ];
              });
              setActiveDocumentId(newId);
            }
          }
        } catch (e: any) {
          toast.error(e?.message || 'Failed to duplicate', { id: toastId });
        }
      } else if (action === 'delete') {
        // Delete with confirmation
        const docType =
          activeTab === 'initiatives'
            ? 'initiative'
            : activeTab === 'reports'
              ? 'report'
              : 'assessment';
        if (
          !window.confirm(`Are you sure you want to delete this ${docType}? This cannot be undone.`)
        )
          return;
        const toastId = toast.loading(`Deleting ${docType}...`);
        try {
          if (docType === 'assessment') {
            await Api.delete(`/assessment-workflow-v2/${row.id}`);
          } else if (docType === 'report') {
            await Api.delete(`/assessment-reports/${row.id}`);
          } else if (docType === 'initiative') {
            await Api.delete(`/initiatives/${row.id}`);
          }
          toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} deleted`, {
            id: toastId,
          });
          refreshData();
        } catch (e: any) {
          toast.error(e?.message || 'Failed to delete', { id: toastId });
        }
      } else if (action === 'rename') {
        // "Edit" action — open full editor (vs "Open" = slide-over / preview)
        if (activeTab === 'reports') {
          const builderId =
            (row as any).builderReportId || (row as any).builder_report_id || row.id;
          navigate(`/reports/builder/${encodeURIComponent(String(builderId))}`);
          return;
        }
        if (activeTab === 'initiatives') {
          setOpenDocuments((prev) => {
            if (prev.find((d) => d.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                type: 'initiative',
                subType: row.sourceType,
                name: row.name || row.title,
                status: row.status,
              } as any,
            ];
          });
          setActiveDocumentId(row.id);
          return;
        }
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument, activeTab, refreshData, navigate]
  );

  // Close compact preview panel
  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setTimeout(() => setPreviewInitiativeId(null), 300);
  }, []);

  // Open full card from compact panel
  const handleOpenFullFromPreview = useCallback(
    (initiative: any) => {
      handleClosePreview();
      // Open as document
      const doc: OpenDocument = {
        id: initiative.id,
        type: 'initiative',
        subType: initiative.sourceType,
        name: initiative.name || initiative.title,
        status: initiative.status,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(initiative.id);
    },
    [handleClosePreview]
  );

  // Transform API data to display format — each tab uses its own status mapper
  const currentData = useMemo(() => {
    let data: any[] = [];

    switch (activeTab) {
      case 'list':
        data = assessments.map((item) => ({
          id: item.id,
          name: item.name,
          framework: mapApiFramework(item.type),
          status: mapAssessmentApiStatus(item.status),
          progress: item.progress ?? 0,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }));
        break;
      case 'reports':
        data = reports.map((item) => ({
          id: item.id,
          name: (item as any).name || (item as any).title,
          framework: mapApiFramework((item as any).assessmentType),
          status: mapReportApiStatus(item.status),
          builderReportId: (item as any).builderReportId || (item as any).builder_report_id || null,
          progress:
            mapReportApiStatus(item.status) === 'APPROVED'
              ? 100
              : mapReportApiStatus(item.status) === 'UTILIZED'
                ? 100
                : mapReportApiStatus(item.status) === 'FINAL'
                  ? 80
                  : 40,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          assessmentName: (item as any).assessmentName,
        }));
        break;
      case 'initiatives':
        data = initiatives.map((item) => ({
          id: item.id,
          name: item.name || item.title,
          framework: mapApiFramework(item.sourceType),
          status: mapInitiativeApiStatus(item.status),
          progress: 100,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          priority: item.priority || 'medium',
          impact: item.impact || 'medium',
          sourceReport: item.reportName || item.report_name || null,
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

      // Reports – navigate to the full Report Builder
      if (doc) {
        navigate(`/reports/builder/${encodeURIComponent(doc.id)}`);
        return null;
      }

      return null;
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
        columns={tableColumns}
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
      // Simplified: single "New Initiative" button → open wizard
      setShowInitiativesWizard(true);
    } else {
      handleNewAssessment();
    }
  }, [activeTab, handleNewAssessment]);

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
            onClick={() => refreshData()}
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
        onCreated={(reportId) => navigate(`/reports/builder/${reportId}`)}
      />

      {/* Initiative Compact Side Panel (Quick Preview) */}
      <InitiativeCompactPanel
        initiative={null}
        initiativeId={previewInitiativeId || undefined}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onOpenFull={handleOpenFullFromPreview}
        onUpdate={() => refreshData()}
      />

      {/* Report Slide-Over Panel */}
      {slideOverReportOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 transition-opacity"
            onClick={() => {
              setSlideOverReportOpen(false);
              setTimeout(() => {
                setSlideOverReportId(null);
                setSlideOverBuilderReportId(null);
              }, 300);
            }}
          />
          {/* Slide-over panel */}
          <div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-3xl bg-navy-900 border-l border-navy-700 shadow-2xl overflow-hidden flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700 bg-navy-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText size={16} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Report Preview</h3>
                  <p className="text-xs text-slate-400">Assessment Report</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (slideOverReportId) navigate(`/reports/builder/${slideOverReportId}`);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                >
                  Open Full Editor
                </button>
                <button
                  onClick={() => {
                    setSlideOverReportOpen(false);
                    setTimeout(() => {
                      setSlideOverReportId(null);
                      setSlideOverBuilderReportId(null);
                    }, 300);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Content — iframe to report builder */}
            <div className="flex-1 overflow-auto p-6">
              {slideOverReportId ? (
                <ReportSlideOverContent
                  assessmentReportId={slideOverReportId}
                  builderReportId={slideOverBuilderReportId || undefined}
                  onOpenFull={() => {
                    setSlideOverReportOpen(false);
                    const targetId = slideOverBuilderReportId || slideOverReportId;
                    if (targetId) navigate(`/reports/builder/${targetId}`);
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-500">
                  No report selected
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
};

// ============================================
// Report Slide-Over Content (lazy loaded data)
// ============================================
const ReportSlideOverContent: React.FC<{
  assessmentReportId: string;
  builderReportId?: string;
  onOpenFull: () => void;
}> = ({ assessmentReportId, builderReportId, onOpenFull }) => {
  const [report, setReport] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Api.get(`/assessment-reports/${assessmentReportId}/full`)
      .then((data: any) => {
        if (!cancelled) setReport(data?.report || data);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assessmentReportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center text-slate-500 py-12">
        <p>Report not found or could not be loaded.</p>
      </div>
    );
  }

  if (builderReportId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Report Builder
            </div>
            <div className="text-sm text-slate-200 truncate">
              {report.name || report.title || 'Untitled Report'}
            </div>
          </div>
          <button
            onClick={onOpenFull}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
          >
            Open full
          </button>
        </div>
        <div className="rounded-xl overflow-hidden border border-navy-700 bg-navy-900/40">
          <iframe
            title="Report Builder"
            src={`/reports/builder/${encodeURIComponent(builderReportId)}`}
            className="w-full"
            style={{ height: 'calc(100vh - 260px)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report header info */}
      <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
        <h4 className="text-white font-semibold text-lg mb-2">
          {report.name || report.title || 'Untitled Report'}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Status</span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  report.status === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : report.status === 'FINAL'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : report.status === 'DRAFT'
                        ? 'bg-slate-500/20 text-slate-300'
                        : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {String(report.status || 'DRAFT').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Template</span>
            <div className="mt-1 text-slate-300">
              {report.templateId || report.template_id || '—'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Created</span>
            <div className="mt-1 text-slate-300">
              {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Updated</span>
            <div className="mt-1 text-slate-300">
              {report.updatedAt ? new Date(report.updatedAt).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {report.executiveSummary && (
        <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
          <h5 className="text-slate-300 font-semibold text-sm mb-2 uppercase tracking-wider">
            Executive Summary
          </h5>
          <p className="text-slate-200 text-sm leading-relaxed">{report.executiveSummary}</p>
        </div>
      )}

      {/* Sections */}
      {report.sections && report.sections.length > 0 && (
        <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
          <h5 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
            Sections
          </h5>
          <div className="space-y-2">
            {report.sections.map((section: any, idx: number) => {
              const sectionTitle =
                typeof section === 'string'
                  ? section
                  : section?.title || section?.name || `Section ${idx + 1}`;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg bg-navy-900/50 border border-navy-700/50"
                >
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-300">{sectionTitle}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentHub;
