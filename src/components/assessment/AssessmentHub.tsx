/**
 * AssessmentHub
 * New simplified Assessment module with 3 tabs (Assessment, Reports, Initiatives)
 * Uses shared ModuleHub components
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Download,
  FileText,
  Globe,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Monitor,
  Presentation,
  Trash2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ErrorState } from '@/components/ui/primitives';
import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import {
  MetaChip,
  PriorityChip,
  type PriorityLevel,
  StatusChip,
  type StatusTone,
} from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext } from '@/types/workspace';

import { InitiativeCompactPanel } from '../Initiatives/InitiativeCompactPanel';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import { DecisionDetailView } from '../MyWork/DecisionDetailView';
import { useConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { TaskDetailView } from '../MyWork/TaskDetailView';
import {
  ASSESSMENT_STATUSES,
  type BulkAction,
  BulkActionBar,
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
  useTableSelection,
  ViewMode,
} from '../shared/ModuleHub';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { type AssessmentItem, AssessmentItemPreview } from './AssessmentItemPreview';
import { AssessmentMenu3ActionBar } from './AssessmentMenu3ActionBar';
import { ImportedReportDetailView } from './ImportedReportDetailView';
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
  }
> = {
  DRD: {
    name: 'Digital Readiness Diagnosis',
    shortName: 'DRD',
    icon: <Activity size={16} />,
    color: 'blue',
  },
  SIRI: {
    name: 'Smart Industry Readiness Index',
    shortName: 'SIRI',
    icon: <Cpu size={16} />,
    color: 'emerald',
  },
  ADMA: {
    name: 'Advanced Digital Maturity Assessment',
    shortName: 'ADMA',
    icon: <Database size={16} />,
    color: 'violet',
  },
  CMMI: {
    name: 'Capability Maturity Model Integration',
    shortName: 'CMMI',
    icon: <Layers size={16} />,
    color: 'amber',
  },
  LEAN: {
    name: 'Lean 4.0',
    shortName: 'LEAN',
    icon: <Workflow size={16} />,
    color: 'rose',
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

const ASSESSMENT_HUB_CACHE_KEY = 'assessment.hub.cached-list.v1';

function readCachedAssessmentHubList(): AssessmentFromAPI[] {
  try {
    const raw = window.sessionStorage.getItem(ASSESSMENT_HUB_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssessmentFromAPI[]) : [];
  } catch {
    return [];
  }
}

function writeCachedAssessmentHubList(items: AssessmentFromAPI[]): void {
  try {
    window.sessionStorage.setItem(ASSESSMENT_HUB_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore browser storage failures and keep runtime continuity.
  }
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

const isAssessmentModuleInitiative = (row: any): boolean => {
  if (!row?.id) return false;
  const st = String(row?.source_type || row?.sourceType || '').toLowerCase();
  const sid = String(row?.source_id || row?.sourceId || '').trim();
  if (!sid) return false;
  // Include assessment-derived initiatives only (avoid mixing manual / other sources).
  return (
    st === 'assessment' ||
    st === 'assessment_report' ||
    st === 'assessment_drd' ||
    st === 'assessment_siri' ||
    st === 'assessment_adma'
  );
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isEnabled } = useFeatureFlagsContext();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const createConversation = useConversationStore((s) => s.createConversation);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
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

  // Report import state
  const [importedReports, setImportedReports] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compact panel (preview) state
  const [previewInitiativeId, setPreviewInitiativeId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Report slide-over: assessment report id + (optional) linked report builder id
  const [slideOverReportId, setSlideOverReportId] = useState<string | null>(null);
  const [slideOverBuilderReportId, setSlideOverBuilderReportId] = useState<string | null>(null);
  const [slideOverReportOpen, setSlideOverReportOpen] = useState(false);
  // canon §7.1: selected row for side-preview (assessment 'list' tab)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  // API data state
  const [assessments, setAssessments] = useState<AssessmentFromAPI[]>([]);
  const [reports, setReports] = useState<ReportBuilderReportFromAPI[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [hubChatId, setHubChatId] = useState<string | null>(null);

  // Deep link support:
  // - /assessment?assessmentId=<id>
  // - /assessment?reportId=<id>
  useEffect(() => {
    const assessmentId = searchParams.get('assessmentId');
    const reportId = searchParams.get('reportId');
    if (!assessmentId && !reportId) return;

    if (reportId) {
      const next = new URLSearchParams(searchParams);
      next.delete('reportId');
      setSearchParams(next, { replace: true });
      navigate(`/reports/builder/${reportId}`);
      return;
    }

    if (assessmentId) {
      const fromList = assessments.find((a) => a.id === assessmentId);
      if (fromList?.type) {
        const framework = String(fromList.type).toLowerCase();
        const next = new URLSearchParams(searchParams);
        next.delete('assessmentId');
        setSearchParams(next, { replace: true });
        navigate(`/assessment/${framework}/${assessmentId}`);
      }
    }
  }, [searchParams, setSearchParams, navigate, assessments]);

  // Safety net: if an "assessment" document is opened in this hub, always redirect to the real editor.
  // This prevents the placeholder card screen from ever being the primary UX.
  useEffect(() => {
    if (!activeDocumentId) return;
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    if (doc?.type !== 'assessment') return;
    const framework = (doc.subType?.toString().toLowerCase() || 'drd') as string;
    navigate(`/assessment/${framework}/${doc.id}`);
  }, [activeDocumentId, openDocuments, navigate]);

  const loadAssessmentListCore = useCallback(async (): Promise<string | null> => {
    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    const transientDelayBaseMs = import.meta.env.MODE === 'test' ? 5 : 500;
    const isTransient = (e: any) => {
      const status = Number(e?.status);
      if ([429, 502, 503, 504].includes(status)) return true;
      const msg = String(e?.message || '').toLowerCase();
      return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('load failed')
      );
    };

    const maxAttempts = 5;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const assessmentResponse = await Api.listAssessments({ limit: 200, offset: 0 });
        const assessmentData = (assessmentResponse as any)?.items || [];
        const normalized = Array.isArray(assessmentData) ? assessmentData : [];
        setAssessments(normalized);
        writeCachedAssessmentHubList(normalized);
        return null;
      } catch (e: any) {
        lastErr = e;
        if (attempt < maxAttempts && isTransient(e)) {
          await sleep(transientDelayBaseMs * attempt);
          continue;
        }
        break;
      }
    }

    const cached = readCachedAssessmentHubList();
    if (cached.length > 0) {
      setAssessments(cached);
      return Number(lastErr?.status) === 429
        ? t(
            'assessment.hub.warnings.rateLimitedCached',
            'Assessment data is temporarily rate limited. Showing the last available list while staging recovers.'
          )
        : t(
            'assessment.hub.warnings.cached',
            'Assessment data could not be refreshed. Showing the last available list.'
          );
    }

    setAssessments([]);
    return Number(lastErr?.status) === 429
      ? t(
          'assessment.hub.warnings.rateLimitedEmpty',
          'Assessment data is temporarily rate limited. Retry in a moment or create a new assessment while staging recovers.'
        )
      : lastErr?.message || t('assessment.hub.errors.load', 'Failed to load assessments');
  }, [t]);

  const loadSupplementaryData = useCallback(async () => {
    const [reportsRes, initiativesRes, importsRes] = await Promise.allSettled([
      Api.getAssessmentReports(undefined),
      Api.get('/initiatives?source=assessment'),
      Api.listReportImports(),
    ]);

    if (reportsRes.status === 'fulfilled') {
      setReports(Array.isArray(reportsRes.value) ? reportsRes.value : []);
    }

    if (initiativesRes.status === 'fulfilled') {
      const rawInits = Array.isArray(initiativesRes.value) ? initiativesRes.value : [];
      setInitiatives(rawInits.filter(isAssessmentModuleInitiative));
    }

    if (importsRes.status === 'fulfilled') {
      const importsData = importsRes.value?.data || [];
      setImportedReports(Array.isArray(importsData) ? importsData : []);
    }
  }, []);

  // Load data from API
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setLoadWarning(null);

      const warning = await loadAssessmentListCore();
      if (cancelled) return;

      setLoadWarning(warning);
      if (warning) {
        console.warn('[AssessmentHub] Core assessment load warning:', warning);
      }
      setIsLoading(false);

      void loadSupplementaryData().catch((err) => {
        console.warn('[AssessmentHub] Supplementary load warning:', err);
      });
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [loadAssessmentListCore, loadSupplementaryData]);

  // Refresh function for manual reload
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoadWarning(null);
    try {
      const warning = await loadAssessmentListCore();
      setLoadWarning(warning);
      await loadSupplementaryData();
      if (warning) {
        toast.error(warning);
      }
    } catch {
      toast.error(t('common.refreshFailed', 'Failed to refresh'));
    } finally {
      setIsLoading(false);
    }
  }, [loadAssessmentListCore, loadSupplementaryData, t]);

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
  }, [activeTab, assessments, reports, initiatives, importedReports]);

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
        count: reports.length + importedReports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ],
    [assessments.length, reports, initiatives, importedReports]
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
        color: 'bg-c-text-muted',
      })),
      render: (row) => {
        const meta = FRAMEWORK_META[row.framework as AssessmentFramework];
        if (!meta)
          return <span className="text-xs text-c-text-muted">{row.framework}</span>;
        return (
          <div className="flex items-center gap-2">
            <span className="text-c-text-muted">{meta.icon}</span>
            <span className="font-mono text-xs font-bold text-c-text-secondary">
              {meta.shortName}
            </span>
          </div>
        );
      },
    };
    const nameCol: TableColumn = {
      id: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-c-text">{row.name}</span>
          {row._isImported && <MetaChip icon={Upload} label="PDF import" />}
        </div>
      ),
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
          width: '180px',
          filterable: true,
          filterOptions: Object.values(REPORT_STATUSES).map((s) => ({
            value: s.id,
            label: s.label,
            color: s.bgColor,
          })),
          render: (row) => {
            if (row._isImported) {
              const importStatusConfig: Record<string, { label: string; tone: StatusTone }> = {
                pending: { label: 'Uploaded', tone: 'neutral' },
                detecting: { label: 'Detecting...', tone: 'warning' },
                extracting: { label: 'Extracting...', tone: 'warning' },
                ready_for_review: { label: 'Ready for review', tone: 'success' },
                assessment_created: { label: 'Assessment created', tone: 'info' },
                initiatives_created: { label: 'Initiatives created', tone: 'info' },
                completed: { label: 'Completed', tone: 'success' },
                failed: { label: 'Failed', tone: 'danger' },
              };
              const cfg = importStatusConfig[row._importStatus] || importStatusConfig.pending;
              return <StatusChip label={cfg.label} tone={cfg.tone} />;
            }
            return undefined;
          },
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
              className="text-xs text-c-text-muted truncate block max-w-[180px]"
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
            { value: 'DRAFT', label: 'Draft', color: 'bg-c-text-muted' },
            { value: 'REVIEW', label: 'In Review', color: 'bg-amber-500' },
            { value: 'PLANNING', label: 'Planning', color: 'bg-blue-500' },
            { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-500' },
            { value: 'EXECUTING', label: 'Executing', color: 'bg-blue-500' },
            { value: 'CANCELLED', label: 'Cancelled', color: 'bg-danger-500' },
          ],
        },
        {
          id: 'priority',
          label: 'Priority',
          width: '100px',
          filterable: true,
          filterOptions: [
            { value: 'critical', label: 'Critical', color: 'bg-danger-500' },
            { value: 'high', label: 'High', color: 'bg-amber-500' },
            { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
            { value: 'low', label: 'Low', color: 'bg-c-text-muted' },
          ],
          render: (row) => {
            const levels: Record<string, PriorityLevel> = {
              critical: 'urgent',
              high: 'high',
              medium: 'medium',
              low: 'low',
            };
            const level = levels[row.priority] || 'medium';
            return <PriorityChip level={level} label={row.priority || 'medium'} />;
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

      // For imported reports, open in dynamic tab
      if (docType === 'report' && row._isImported) {
        const doc: OpenDocument = {
          id: row.id,
          type: 'report',
          subType: 'imported',
          name: row.name,
          status: row._importStatus?.toUpperCase() || 'PENDING',
        };
        setOpenDocuments((prev) => {
          if (prev.find((d) => d.id === doc.id)) return prev;
          return [...prev, doc];
        });
        setActiveDocumentId(row.id);
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

  const handleOpenTaskFromInitiative = useCallback((taskId: string) => {
    const doc: OpenDocument = {
      id: taskId,
      type: 'task',
      subType: 'TASK',
      name: `Task ${taskId.slice(0, 8)}`,
      status: 'DRAFT',
    };
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(taskId);
  }, []);

  const handleOpenDecisionFromInitiative = useCallback((decisionId: string) => {
    const doc: OpenDocument = {
      id: decisionId,
      type: 'decision',
      subType: 'DECISION',
      name: `Decision ${decisionId.slice(0, 8)}`,
      status: 'DRAFT',
    };
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(decisionId);
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
      case 'reports': {
        const builderReports = reports.map((item) => ({
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
          _isImported: false,
        }));

        const importedRows = importedReports.map((imp) => ({
          id: `import-${imp.id}`,
          _importId: imp.id,
          name: imp.sourceFileName || 'Imported Report',
          framework: mapApiFramework(imp.detectedFramework),
          status: imp.status,
          builderReportId: null,
          progress: imp.coveragePercent || 0,
          updatedAt: imp.createdAt ? new Date(imp.createdAt) : new Date(),
          assessmentName: null,
          _isImported: true,
          _importStatus: imp.status,
          _coveragePercent: imp.coveragePercent || 0,
          _targetId: imp.targetId,
          _initiativesCreated: imp.initiativesCreated || 0,
        }));

        data = [...importedRows, ...builderReports];
        break;
      }
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
  }, [activeTab, assessments, reports, initiatives, importedReports, searchQuery, statusFilter]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item) => ({
      ...item,
      type: item.framework,
      typeColor: FRAMEWORK_META[item.framework as AssessmentFramework]?.color || 'slate',
    }));
  }, [currentData]);

  const emptyStateMessage =
    activeTab === 'list' && loadWarning
      ? 'Assessment list is temporarily unavailable. Retry or create a new assessment while staging recovers.'
      : 'No assessments found. Create your first assessment to get started.';

  // canon §3.5 — leading selection column prepended to the per-tab columns.
  const tableColumnsWithSelect: TableColumn[] = useMemo(
    () => [{ id: 'select', label: '', type: 'select', width: '44px' }, ...tableColumns],
    [tableColumns]
  );

  // canon §3.5 — row selection + bulk delete. The delete endpoint is tab-aware
  // (assessment / report / initiative), matching the single-row delete flow.
  const selection = useTableSelection(currentData.map((r: any) => String(r.id)));
  const { dialog: bulkConfirmDialog, confirm: confirmBulkDelete } = useConfirmDialog();
  const bulkActions = useMemo<BulkAction[]>(() => {
    const docType =
      activeTab === 'initiatives'
        ? 'initiative'
        : activeTab === 'reports'
          ? 'report'
          : 'assessment';
    const deletePath = (id: string) =>
      docType === 'report'
        ? `/assessment-reports/${id}`
        : docType === 'initiative'
          ? `/initiatives/${id}`
          : `/assessment-workflow-v2/${id}`;
    return [
      {
        id: 'delete',
        label: t('common.delete', 'Delete'),
        icon: Trash2,
        variant: 'danger',
        onRun: async (sel) => {
          const ok = await confirmBulkDelete({
            title: t('assessment.bulk.confirmDeleteTitle', 'Usunąć zaznaczone pozycje?'),
            description: t(
              'assessment.bulk.confirmDeleteDesc',
              'Trwale usuniesz {{count}} pozycji. Tej operacji nie można cofnąć.',
              { count: sel.count }
            ),
            confirmLabel: t('common.delete', 'Delete'),
            cancelLabel: t('common.cancel', 'Anuluj'),
            variant: 'danger',
          });
          if (!ok) return;
          await sel.runBulk((id) => Api.delete(deletePath(id)), {
            successNoun: t('assessment.bulk.deletedNoun', 'usunięto'),
          });
          refreshData();
        },
      },
    ];
  }, [activeTab, confirmBulkDelete, refreshData, t]);

  const hubWorkspaceContext = useMemo(
    () =>
      createWorkspaceContext(AppView.ASSESSMENT_OVERVIEW, 'assessment', {
        entityName: 'Assessment Hub',
        projectId: currentProjectId || undefined,
        entityData: {
          activeTab,
          openDocumentCount: openDocuments.length,
          assessmentCount: assessments.length,
          reportCount: reports.length + importedReports.length,
          initiativeCount: initiatives.length,
        },
      }),
    [
      activeTab,
      assessments.length,
      currentProjectId,
      importedReports.length,
      initiatives.length,
      openDocuments.length,
      reports.length,
    ]
  );

  const isHubChatActive =
    Boolean(hubChatId) && activeConversationId === hubChatId && !isChatCollapsed;

  const openInterpretationDraft = useCallback(() => {
    const targetAssessment = assessments[0];
    if (!targetAssessment?.id) return;
    navigate(
      `/assessment/${String(targetAssessment.type || 'drd').toLowerCase()}/${targetAssessment.id}`
    );
  }, [assessments, navigate]);

  const handleOpenHubChat = useCallback(async () => {
    try {
      if (hubChatId && activeConversationId === hubChatId && !isChatCollapsed) {
        toggleChatCollapse();
        return;
      }

      if (hubChatId) {
        setActiveConversation(hubChatId);
      } else {
        const conversation = await createConversation({
          title: `Assessment Hub: ${tabs.find((tab) => tab.id === activeTab)?.label || 'Assessment'}`,
          projectId: currentProjectId || undefined,
          pmoContext: {
            assessmentId: activeTab === 'list' ? assessments[0]?.id : undefined,
          },
        });
        setHubChatId(conversation.id);
      }

      setWorkspaceContext(hubWorkspaceContext);
      if (isChatCollapsed) {
        toggleChatCollapse();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to open AI chat');
    }
  }, [
    activeConversationId,
    activeTab,
    assessments,
    createConversation,
    currentProjectId,
    hubChatId,
    hubWorkspaceContext,
    isChatCollapsed,
    setActiveConversation,
    setWorkspaceContext,
    tabs,
    toggleChatCollapse,
  ]);

  const hubMenu3Chips = useMemo(
    () => [
      {
        id: 'active-tab',
        label:
          activeTab === 'reports'
            ? 'Reports lane'
            : activeTab === 'initiatives'
              ? 'Initiatives lane'
              : 'Assessment lane',
        badge: currentData.length,
        active: true,
      },
      {
        id: 'status-filter',
        label: statusFilter === 'all' ? 'All statuses' : `Status ${statusFilter}`,
      },
      {
        id: 'documents',
        label: openDocuments.length > 0 ? 'Focused documents' : 'List workspace',
        badge: openDocuments.length || null,
      },
    ],
    [activeTab, currentData.length, openDocuments.length, statusFilter]
  );

  const thirdHubAction = useMemo(() => {
    if (activeTab === 'reports') {
      return {
        id: 'report',
        label: 'Generate Report',
        icon: FileText,
        onClick: () => setShowNewReportModal(true),
        active: false,
        disabled: assessments.length === 0,
      };
    }

    if (activeTab === 'initiatives') {
      return {
        id: 'initiative',
        label: 'Initiative Pack',
        icon: Lightbulb,
        onClick: () => setShowInitiativesWizard(true),
        active: false,
        disabled: assessments.length === 0,
      };
    }

    return {
      id: 'interpretation',
      label: 'Interpretation Draft',
      icon: Lightbulb,
      onClick: openInterpretationDraft,
      active: false,
      disabled: assessments.length === 0,
    };
  }, [activeTab, assessments.length, openInterpretationDraft]);

  const hubMenu3Actions = useMemo(
    () => [
      {
        id: 'triage',
        label: 'AI Triage',
        icon: Layers,
        onClick: () => void handleOpenHubChat(),
        active: isHubChatActive,
        disabled: isLoading,
      },
      {
        id: 'chat',
        label: 'Chat',
        icon: MessageSquare,
        onClick: () => void handleOpenHubChat(),
        active: isHubChatActive,
        disabled: isLoading,
      },
      thirdHubAction,
    ],
    [handleOpenHubChat, isHubChatActive, isLoading, thirdHubAction]
  );

  const hubCommandRowContent = useMemo(
    () => <AssessmentMenu3ActionBar chips={hubMenu3Chips} actions={hubMenu3Actions} />,
    [hubMenu3Actions, hubMenu3Chips]
  );

  // NOTE: right-side actions are rendered by AssessmentMenu3ActionBar (inside hubCommandRowContent)
  // via MENU_3_INNER_CLASS (flex items-center justify-between). ModuleNavBar voids
  // commandRowRightContent, so all Menu 3 content lives in commandRowContent.

  // Render content based on active document or list
  const renderContent = () => {
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);

      // Show Task artifact in dynamic tab inside Assessment module
      if (doc && doc.type === 'task') {
        return (
          <TaskDetailView
            taskId={doc.id}
            onClose={() => handleCloseDocument(doc.id)}
            onSaved={() => refreshData()}
          />
        );
      }

      // Show Decision artifact in dynamic tab inside Assessment module
      if (doc && doc.type === 'decision') {
        return (
          <DecisionDetailView
            decisionId={doc.id}
            onClose={() => handleCloseDocument(doc.id)}
            onSaved={() => refreshData()}
          />
        );
      }

      // Show Initiative Document View for initiatives
      if (doc && doc.type === 'initiative') {
        return (
          <InitiativeDocumentView
            initiativeId={doc.id}
            onBack={handleShowList}
            onStatusChange={refreshData}
            sourceModule="assessment"
            onOpenTask={handleOpenTaskFromInitiative}
            onOpenDecision={handleOpenDecisionFromInitiative}
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
                  <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
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
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
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
                        className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg transition-colors"
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

      // Imported report — show detail view in dynamic tab
      if (doc && doc.type === 'report' && doc.subType === 'imported') {
        const importId = doc.id.replace('import-', '');
        return (
          <ImportedReportDetailView
            importId={importId}
            onBack={handleShowList}
            onAssessmentCreated={() => refreshData()}
            onInitiativesCreated={() => refreshData()}
          />
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

    // canon §2+§7.1: Assessment 'list' tab → TableWithPreviewLayout + side preview
    if (activeTab === 'list') {
      type AssessmentItemWithTitle = AssessmentItem & { title: string };
      const toItem = (row: any): AssessmentItemWithTitle => ({
        ...(row as AssessmentItem),
        title: (row.name as string) || 'Assessment',
      });
      const selectedRow = selectedAssessmentId
        ? (currentData.find((r: any) => r.id === selectedAssessmentId) ?? null)
        : null;
      const selectedItem: AssessmentItemWithTitle | null = selectedRow ? toItem(selectedRow) : null;

      return (
        <TableWithPreviewLayout<AssessmentItemWithTitle>
          selectedId={selectedAssessmentId}
          selectedItem={selectedItem}
          onSelect={setSelectedAssessmentId}
          onOpenFull={(id) => {
            const row = currentData.find((r: any) => r.id === id);
            if (row) handleOpenDocument(row);
          }}
          itemIds={currentData.map((r: any) => r.id as string)}
          getItemById={(id) => {
            const r = currentData.find((x: any) => x.id === id);
            return r ? toItem(r) : null;
          }}
          renderPreview={(item) => (
            <AssessmentItemPreview
              item={item as AssessmentItem}
              onOpen={() => {
                const row = currentData.find((r: any) => r.id === item.id);
                if (row) handleOpenDocument(row);
              }}
              onClose={() => setSelectedAssessmentId(null)}
            />
          )}
        >
          <div className="flex flex-col pl-4 pr-1.5 pt-1 pb-4">
            <BulkActionBar selection={selection} actions={bulkActions} className="pb-2" />
            {bulkConfirmDialog}
            <FilterableTable
              columns={tableColumnsWithSelect}
              data={currentData}
              selection={selection.selectionProp}
              onRowClick={(row) => setSelectedAssessmentId((row as any).id as string)}
              onRowDoubleClick={handleOpenDocument}
              onRowAction={handleRowAction}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              emptyMessage={emptyStateMessage}
            />
          </div>
        </TableWithPreviewLayout>
      );
    }

    return (
      <div className="flex flex-col">
        <BulkActionBar selection={selection} actions={bulkActions} className="px-1 pb-2" />
        {bulkConfirmDialog}
        <FilterableTable
          columns={tableColumnsWithSelect}
          data={currentData}
          selection={selection.selectionProp}
          onRowClick={handleOpenDocument}
          onRowAction={handleRowAction}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={emptyStateMessage}
        />
      </div>
    );
  };

  // Handle PDF file upload
  const handleUploadPDF = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Only PDF files are supported');
        return;
      }

      setIsUploading(true);
      const toastId = toast.loading('Uploading DRD report...');

      try {
        const result = await Api.uploadReportImport(file);
        const importId = result?.data?.id;

        if (!importId) {
          throw new Error('Upload failed: no import ID returned');
        }

        toast.loading('Processing PDF...', { id: toastId });

        // Trigger detection + extraction
        await Api.detectReportImport(importId);

        toast.success('Report uploaded and processed!', { id: toastId });
        await refreshData();

        // Open the imported report detail view
        const doc: OpenDocument = {
          id: `import-${importId}`,
          type: 'report',
          subType: 'imported',
          name: file.name,
          status: 'PENDING_REVIEW',
        };
        setOpenDocuments((prev) => {
          if (prev.find((d) => d.id === doc.id)) return prev;
          return [...prev, doc];
        });
        setActiveDocumentId(doc.id);
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload report', { id: toastId });
        console.error('[AssessmentHub] Upload error:', err);
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [refreshData]
  );

  // Status dropdown component for right controls (+ upload button on Reports tab)
  const statusDropdownControl = (
    <div className="flex items-center gap-2">
      {activeTab === 'reports' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUploadPDF}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium
              text-slate-700 dark:text-slate-300
              hover:bg-slate-100/70 dark:hover:bg-white/[0.05]
              border border-slate-200/60 dark:border-white/10
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload DRD report (PDF)"
          >
            {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Upload PDF
          </button>
        </>
      )}
      <StatusDropdown
        context={statusContext}
        value={statusFilter}
        onChange={setStatusFilter}
        counts={statusCounts}
        size="md"
      />
    </div>
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
      <div className="p-6">
        <SharedLoadingState template="list" rows={6} />
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
        commandRowContent={hubCommandRowContent}
      >
        <div className="space-y-3">
          {loadWarning &&
            !(activeTab === 'list' && !activeDocumentId && assessments.length === 0) && (
              <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                    <p>{loadWarning}</p>
                  </div>
                  <button
                    onClick={() => refreshData()}
                    className="shrink-0 rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/10"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          {loadWarning && activeTab === 'list' && !activeDocumentId && assessments.length === 0 ? (
            // Hard failure (no cached data): show ErrorState with retry instead of the
            // empty-list CTA, which would falsely imply the user has 0 assessments.
            <ErrorState message={loadWarning} retry={() => void refreshData()} />
          ) : (
            renderContent()
          )}
        </div>
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

      {/* Report Slide-Over Panel — compact summary */}
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
          {/* Slide-over panel — compact width */}
          <div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <FileText size={14} className="text-indigo-400" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
                  Report Summary
                </h3>
              </div>
              <button
                onClick={() => {
                  setSlideOverReportOpen(false);
                  setTimeout(() => {
                    setSlideOverReportId(null);
                    setSlideOverBuilderReportId(null);
                  }, 300);
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Content — compact report summary (scrollable) */}
            <div className="flex-1 overflow-auto p-5">
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
                <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400 text-sm">
                  No report selected
                </div>
              )}
            </div>
            {/* Sticky footer — Open Full Editor */}
            {slideOverReportId && (
              <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-navy-700 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm">
                <button
                  onClick={() => {
                    setSlideOverReportOpen(false);
                    const targetId = slideOverBuilderReportId || slideOverReportId;
                    if (targetId) navigate(`/reports/builder/${targetId}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors"
                >
                  Open Full Editor
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
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
// Status helpers for compact report summary
// ============================================
const REPORT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: 'clock' | 'check' | 'spinner' }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-500/20 border-slate-500/30',
    icon: 'clock',
  },
  GENERATING: {
    label: 'Generating...',
    color: 'text-amber-600 dark:text-amber-300',
    bgColor: 'bg-amber-500/20 border-amber-500/30',
    icon: 'spinner',
  },
  FINAL: {
    label: 'Final',
    color: 'text-indigo-600 dark:text-indigo-300',
    bgColor: 'bg-indigo-500/20 border-indigo-500/30',
    icon: 'check',
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    color: 'text-amber-600 dark:text-amber-300',
    bgColor: 'bg-amber-500/20 border-amber-500/30',
    icon: 'clock',
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-300',
    bgColor: 'bg-emerald-500/20 border-emerald-500/30',
    icon: 'check',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-danger-600 dark:text-danger-300',
    bgColor: 'bg-danger-500/20 border-danger-500/30',
    icon: 'clock',
  },
  UTILIZED: {
    label: 'Utilized',
    color: 'text-blue-600 dark:text-blue-300',
    bgColor: 'bg-blue-500/20 border-blue-500/30',
    icon: 'check',
  },
};

// ============================================
// Report Slide-Over Content — compact summary
// ============================================
// Format config for export items
const EXPORT_FORMAT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  pdf: {
    label: 'PDF',
    icon: <FileText size={14} />,
    color: 'text-danger-400',
    bgColor: 'bg-danger-500/15',
  },
  pptx: {
    label: 'PowerPoint',
    icon: <Presentation size={14} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
  },
  docx: {
    label: 'Word',
    icon: <Globe size={14} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
  },
  web: {
    label: 'Web Preview',
    icon: <Monitor size={14} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
  },
};

const ReportSlideOverContent: React.FC<{
  assessmentReportId: string;
  builderReportId?: string;
  onOpenFull: () => void;
}> = ({ assessmentReportId, builderReportId, onOpenFull }) => {
  const [report, setReport] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [exports, setExports] = React.useState<any[]>([]);
  const [exportsLoading, setExportsLoading] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch report data
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

  // Fetch export records
  React.useEffect(() => {
    const reportId = builderReportId || assessmentReportId;
    if (!reportId) return;
    let cancelled = false;
    setExportsLoading(true);
    Api.get(`/report-builder/${reportId}/exports`)
      .then((data: any) => {
        if (!cancelled) setExports(data?.exports || []);
      })
      .catch(() => {
        if (!cancelled) setExports([]);
      })
      .finally(() => {
        if (!cancelled) setExportsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [builderReportId, assessmentReportId]);

  // Download an export file
  const handleDownloadExport = React.useCallback(
    async (format: string) => {
      const reportId = builderReportId || assessmentReportId;
      if (!reportId) return;
      setDownloadingId(format);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/report-builder/${reportId}/export/${format}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`Export failed (${format})`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = (report?.name || report?.title || 'report').replace(
          /[^\p{L}\p{N}_-]+/gu,
          '_'
        );
        a.download = `${safeTitle}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`${format.toUpperCase()} downloaded`);
      } catch (err) {
        console.error(`Download ${format} failed:`, err);
        toast.error(`Failed to download ${format.toUpperCase()}`);
      } finally {
        setDownloadingId(null);
      }
    },
    [builderReportId, assessmentReportId, report?.name, report?.title]
  );

  // Open web preview in full editor
  const handleOpenWebPreview = React.useCallback(() => {
    const targetId = builderReportId || assessmentReportId;
    if (targetId) navigate(`/reports/builder/${targetId}`);
  }, [builderReportId, assessmentReportId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-8">
        <p className="text-sm">Report not found or could not be loaded.</p>
      </div>
    );
  }

  const statusKey = String(report.status || 'DRAFT').toUpperCase();
  const statusCfg = REPORT_STATUS_CONFIG[statusKey] || REPORT_STATUS_CONFIG.DRAFT;
  const reportName = report.name || report.title || 'Untitled Report';
  const templateId = report.templateId || report.template_id || null;
  const framework =
    templateId?.split('_')?.[0]?.toUpperCase() || report.assessmentType?.toUpperCase() || null;
  const frameworkMeta = framework ? FRAMEWORK_META[framework as AssessmentFramework] : null;
  const sectionCount = report.sections?.length || 0;

  return (
    <div className="space-y-4">
      {/* Report title & framework */}
      <div>
        <h4 className="text-slate-900 dark:text-white font-semibold text-base leading-snug mb-1.5">
          {reportName}
        </h4>
        {frameworkMeta && (
          <div className="flex items-center gap-1.5">
            <span className={`text-${frameworkMeta.color}-400`}>{frameworkMeta.icon}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{frameworkMeta.name}</span>
          </div>
        )}
      </div>

      {/* Status badge — prominent */}
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${statusCfg.bgColor}`}
      >
        {statusCfg.icon === 'check' ? (
          <CheckCircle2 size={16} className={statusCfg.color} />
        ) : statusCfg.icon === 'spinner' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400" />
        ) : (
          <Clock size={16} className={statusCfg.color} />
        )}
        <div>
          <span className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {statusKey === 'DRAFT' && 'Report is being prepared'}
            {statusKey === 'GENERATING' && 'AI is generating report content'}
            {statusKey === 'FINAL' && 'Report content is finalized'}
            {statusKey === 'PENDING_APPROVAL' && 'Awaiting stakeholder approval'}
            {statusKey === 'APPROVED' && 'Report has been approved'}
            {statusKey === 'REJECTED' && 'Report was rejected — needs revision'}
            {statusKey === 'UTILIZED' && 'Report has been delivered & used'}
          </p>
        </div>
      </div>

      {/* Key details */}
      <div className="bg-slate-50/50 dark:bg-navy-800/50 rounded-xl border border-slate-200/60 dark:border-navy-700/60 divide-y divide-slate-200/40 dark:divide-navy-700/40">
        {templateId && (
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Template</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {templateId}
            </span>
          </div>
        )}
        {report.assessmentName && (
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Source Assessment</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]">
              {report.assessmentName}
            </span>
          </div>
        )}
        {sectionCount > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Sections</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {sectionCount}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar size={11} /> Created
          </span>
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock size={11} /> Last updated
          </span>
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {report.updatedAt ? new Date(report.updatedAt).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>

      {/* Generated Reports / Exports */}
      <div className="bg-slate-50/50 dark:bg-navy-800/50 rounded-xl border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-200/40 dark:border-navy-700/40">
          <h5 className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Download size={11} />
            Generated Reports
          </h5>
        </div>

        {exportsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-slate-500 dark:text-slate-400" />
          </div>
        ) : exports.length > 0 ? (
          <div className="divide-y divide-slate-200/30 dark:divide-navy-700/30">
            {exports.map((exp: any) => {
              const fmt = (exp.format || '').toLowerCase();
              const cfg = EXPORT_FORMAT_CONFIG[fmt] || EXPORT_FORMAT_CONFIG.pdf;
              const exportDate = exp.exportedAt || exp.exported_at;
              return (
                <button
                  key={exp.id}
                  onClick={() => handleDownloadExport(fmt)}
                  disabled={downloadingId === fmt}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-100 dark:hover:bg-navy-700/40 transition-colors group"
                >
                  <div
                    className={`w-7 h-7 rounded-lg ${cfg.bgColor} flex items-center justify-center ${cfg.color} shrink-0`}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {cfg.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {exportDate
                        ? new Date(exportDate).toLocaleDateString('pl-PL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                      {exp.fileSize ? ` · ${(exp.fileSize / 1024).toFixed(0)} KB` : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {downloadingId === fmt ? (
                      <Loader2 size={14} className="animate-spin text-slate-500 dark:text-slate-400" />
                    ) : (
                      <Download
                        size={14}
                        className="text-slate-600 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300 transition-colors"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Quick-generate buttons when no exports exist */
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">No exports yet. Generate now:</p>
            <div className="grid grid-cols-3 gap-2">
              {(['pdf', 'pptx', 'docx'] as const).map((fmt) => {
                const cfg = EXPORT_FORMAT_CONFIG[fmt];
                return (
                  <button
                    key={fmt}
                    onClick={() => handleDownloadExport(fmt)}
                    disabled={!!downloadingId}
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border border-slate-200/60 dark:border-navy-700/60 hover:border-slate-300 dark:hover:border-navy-600 hover:bg-slate-100 dark:hover:bg-navy-700/40 transition-all disabled:opacity-50 group`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${cfg.bgColor} flex items-center justify-center ${cfg.color}`}
                    >
                      {downloadingId === fmt ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        cfg.icon
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Web preview link — always visible */}
        <div className="border-t border-slate-200/40 dark:border-navy-700/40">
          <button
            onClick={handleOpenWebPreview}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-100 dark:hover:bg-navy-700/40 transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
              <Monitor size={14} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Web Preview
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Open in editor</div>
            </div>
            <ArrowRight
              size={14}
              className="text-slate-600 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300 transition-colors shrink-0"
            />
          </button>
        </div>
      </div>

      {/* Executive Summary — truncated */}
      {report.executiveSummary && (
        <div className="bg-slate-50/50 dark:bg-navy-800/50 rounded-xl p-3.5 border border-slate-200/60 dark:border-navy-700/60">
          <h5 className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
            Executive Summary
          </h5>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4">
            {report.executiveSummary}
          </p>
        </div>
      )}

      {/* Sections overview — compact list */}
      {sectionCount > 0 && (
        <div className="bg-slate-50/50 dark:bg-navy-800/50 rounded-xl p-3.5 border border-slate-200/60 dark:border-navy-700/60">
          <h5 className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-2">
            Report Scope
          </h5>
          <div className="space-y-1">
            {report.sections.slice(0, 6).map((section: any, idx: number) => {
              const sectionTitle =
                typeof section === 'string'
                  ? section
                  : section?.title || section?.name || `Section ${idx + 1}`;
              return (
                <div key={idx} className="flex items-center gap-2 py-1">
                  <span className="w-4 h-4 rounded bg-indigo-500/15 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {sectionTitle}
                  </span>
                </div>
              );
            })}
            {sectionCount > 6 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
                +{sectionCount - 6} more sections
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentHub;
