/**
 * AssessmentHub
 * New simplified Assessment module with 3 tabs (Assessment, Reports, Initiatives).
 * Behind `assessmentFiveSurfacesV1` (ASM-001A): 5 stable, URL-synced tab ids
 * (Library/Processes/Outputs/Reports/Initiatives) — see `fiveSurfacesEnabled`.
 * Uses shared ModuleHub components
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Library,
  Lightbulb,
  Loader2,
  Monitor,
  Package,
  Presentation,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
} from '@/components/standard';
import { ErrorState } from '@/components/ui/primitives';
import {
  MetaChip,
  PriorityChip,
  type PriorityLevel,
  StatusChip,
  statusChipTone,
  type StatusTone,
} from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext } from '@/types/workspace';
import { formatListDate, formatListDateTime } from '@/utils/listDateFormat';

import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import { DecisionDetailView } from '../MyWork/DecisionDetailView';
import { TaskDetailView } from '../MyWork/TaskDetailView';
import {
  ASSESSMENT_STATUSES,
  FilterChip,
  getStatusesForModule,
  GridItem,
  GridView,
  ModuleContext,
  ModuleTab,
  OpenDocument,
  REPORT_STATUSES,
  StatusDropdown,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import {
  MENU_3_INNER_CLASS,
  Menu3BulkRow,
  Menu3Chip,
} from '../shared/ModuleMenu3';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { AssessmentMenu3ActionBar } from './AssessmentMenu3ActionBar';
import { AssessmentOutputsTab } from './AssessmentOutputsTab';
import { AssessmentQualityReviewPanel } from './AssessmentQualityReviewPanel';
import { ImportedReportDetailView } from './ImportedReportDetailView';
import { InitiativesGenerationWizardModal } from './InitiativesGenerationWizardModal';
import { AssessmentLibraryTab } from './library/AssessmentLibraryTab';
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
  // #69: list endpoint is `SELECT * FROM assessments` (server/AssessmentController.listAssessments),
  // so raw rows carry snake_case created_by even though this type isn't formally normalized.
  createdBy?: string;
  created_by?: string;
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
  // #69: /assessment-reports list endpoint already maps r.created_by → createdBy.
  createdBy?: string;
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

// ASM-001A: the 5 stable tab ids behind `assessmentFiveSurfacesV1`. `list` is
// the pre-ASM-001A id ('processes' content is byte-identical) — kept as a
// compat target so old bookmarks/links (`?tab=list`) keep working, and as the
// catch-all for any other unrecognized `?tab=` value.
const FIVE_SURFACES_TAB_IDS = new Set<string>([
  'library',
  'processes',
  'outputs',
  'reports',
  'initiatives',
]);

function resolveFiveSurfacesTabFromUrl(raw: string | null): ModuleTab | null {
  if (!raw) return null;
  if (raw === 'list') return 'processes';
  if (FIVE_SURFACES_TAB_IDS.has(raw)) return raw as ModuleTab;
  // Unknown value (typo'd link, stale bookmark from a future tab id, etc.) —
  // fall back to the closest living equivalent of the old default tab.
  return 'processes';
}

export const AssessmentHub: React.FC<AssessmentHubProps> = ({ initialTab }) => {
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
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const wizardEnabled = isEnabled('assessmentInitiativesWizard');
  // ASM-001A: five-surface Hub (Library default tab + `?tab=` as source of
  // truth). OFF = today's exact behavior — see resolveFiveSurfacesTabFromUrl
  // and the effect below, both no-ops when this is false.
  const fiveSurfacesEnabled = isEnabled('assessmentFiveSurfacesV1');
  // State
  const [activeTab, setActiveTabState] = useState<ModuleTab>(() => {
    if (initialTab) return initialTab;
    if (!fiveSurfacesEnabled) return 'list';
    return resolveFiveSurfacesTabFromUrl(searchParams.get('tab')) || 'library';
  });
  // Tab changes go through this wrapper so the URL stays the source of truth
  // when the flag is ON; when it's OFF this is byte-identical to calling the
  // state setter directly (no `?tab=` read/write at all).
  const setActiveTab = useCallback(
    (tab: ModuleTab) => {
      setActiveTabState(tab);
      if (!fiveSurfacesEnabled) return;
      const next = new URLSearchParams(searchParams);
      next.set('tab', String(tab));
      setSearchParams(next);
    },
    [fiveSurfacesEnabled, searchParams, setSearchParams]
  );
  // Keeps `activeTab` in sync with the URL for cases `setActiveTab` doesn't
  // cover itself: browser back/forward, a shared link landing directly on a
  // tab, and a first mount with no `?tab=` at all (canonicalized here so the
  // URL always reflects what's on screen once the flag is ON).
  useEffect(() => {
    if (!fiveSurfacesEnabled) return;
    const raw = searchParams.get('tab');
    const mapped = resolveFiveSurfacesTabFromUrl(raw) || 'library';
    // Canonicalize: missing (`?tab=` absent) or legacy/unknown values get
    // rewritten to the resolved tab id, so the URL is always the single
    // source of truth once the flag is ON.
    if (!raw || mapped !== raw) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', String(mapped));
      setSearchParams(next, { replace: true });
    }
    if (mapped !== activeTab) {
      setActiveTabState(mapped);
    }
  }, [fiveSurfacesEnabled, searchParams, activeTab, setSearchParams]);
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

  // #73: canon §7.1 selected-row-for-side-preview state, one per tab (StandardTable
  // + StandardPreview aside — same pattern as 'list', previously the only tab that
  // had it). Replaces the old previewInitiativeId/isPreviewOpen (InitiativeCompactPanel
  // overlay) and slideOverReportId/slideOverBuilderReportId/slideOverReportOpen
  // (bespoke full-viewport backdrop drawer) — both were reported (#73,
  // _PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md) to paint over the whole screen instead of
  // a contained right-hand panel.
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedReportRowId, setSelectedReportRowId] = useState<string | null>(null);
  const [selectedInitiativeRowId, setSelectedInitiativeRowId] = useState<string | null>(null);
  // Triada standard §A4/§A6: checkbox selection on the 'list' tab → Menu 3 bulk mode.
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());

  // API data state
  const [assessments, setAssessments] = useState<AssessmentFromAPI[]>([]);
  const [reports, setReports] = useState<ReportBuilderReportFromAPI[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  // Count of the org-wide Outputs Library (AssessmentOutputsTab, rendered
  // below whenever no assessment is selected on the Processes tab) — drives
  // the 'outputs' tab badge. `null` = load error, distinct from a genuine 0.
  const [outputsCount, setOutputsCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [hubChatId, setHubChatId] = useState<string | null>(null);
  const isPolish = !!i18n.language?.startsWith('pl');

  // #69: org users, for resolving createdBy → display name in the Author column
  // (wzór: DiscoveryToolsHub.tsx, commit 94403b4f57).
  const [orgUsers, setOrgUsers] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    Api.getUsers()
      .then((fetched) => {
        if (!cancelled) setOrgUsers(fetched || []);
      })
      .catch((err) => console.error('[AssessmentHub] Failed to load users for Author column', err));
    return () => {
      cancelled = true;
    };
  }, []);
  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of orgUsers) {
      map.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id);
    }
    return map;
  }, [orgUsers]);
  const getAuthorLabel = useCallback(
    (createdBy?: string | null) => {
      if (!createdBy) return '';
      return authorNameById.get(createdBy) || createdBy;
    },
    [authorNameById]
  );

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
    if (Number(lastErr?.status) === 429) {
      return t(
        'assessment.hub.warnings.rateLimitedEmpty',
        'Assessment data is temporarily rate limited. Retry in a moment or create a new assessment while staging recovers.'
      );
    }

    // MPQ audit #2: this used to fall back to `lastErr?.message`, leaking raw
    // exception text (e.g. "MPQ audit: simulated network failure") straight
    // into the UI banner/ErrorState. The user gets a friendly, translated
    // message keyed off what we actually know (HTTP status / network
    // failure); the real error still goes to the console for diagnosis.
    console.error('[AssessmentHub] loadAssessmentListCore failed:', lastErr);
    const status = Number(lastErr?.status);
    const rawMsg = String(lastErr?.message || '').toLowerCase();
    const isNetworkError =
      !status ||
      rawMsg.includes('failed to fetch') ||
      rawMsg.includes('networkerror') ||
      rawMsg.includes('load failed');
    if (status === 403) {
      return t('assessment.hub.errors.forbidden', "You don't have access to this assessment data.");
    }
    if (status === 404) {
      return t('assessment.hub.errors.notFound', 'Assessment data could not be found.');
    }
    if (status >= 500) {
      return t(
        'assessment.hub.errors.server',
        'The server had a problem loading assessments. Please try again.'
      );
    }
    if (isNetworkError) {
      return t('assessment.hub.errors.connectionError', 'Connection error');
    }
    return t('assessment.hub.errors.load', 'Failed to load assessments');
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
      case 'processes':
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

  // Tab configuration — ASM-001A: 5 stable tab ids behind
  // `assessmentFiveSurfacesV1`. OFF keeps the original 3 tabs verbatim
  // (same ids/labels/counts as before this change).
  const tabs = useMemo(() => {
    if (!fiveSurfacesEnabled) {
      return [
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
      ];
    }
    return [
      {
        id: 'library' as ModuleTab,
        label: 'Library',
        icon: <Library size={16} />,
      },
      {
        // Former 'list' — identical content (same table, columns, preview),
        // only the tab id + label changed.
        id: 'processes' as ModuleTab,
        label: 'Processes',
        icon: <FileText size={16} />,
        count: assessments.length,
      },
      {
        id: 'outputs' as ModuleTab,
        label: 'Outputs',
        icon: <Package size={16} />,
        count: outputsCount ?? undefined,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Reports',
        icon: <FileText size={16} />,
        count: reports.length + importedReports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ];
  }, [fiveSurfacesEnabled, assessments.length, reports, initiatives, importedReports, outputsCount]);

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
        if (!meta) return <span className="text-xs text-c-text-muted">{row.framework}</span>;
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
    // #69: Author column — wzór DiscoveryToolsHub.tsx (commit 94403b4f57):
    // resolve row.createdBy against org users, fall back to raw id, then '—'.
    const authorCol: TableColumn = {
      id: 'createdBy',
      label: t('assessment.hub.table.author', 'Author'),
      width: '140px',
      render: (row) => {
        const label = getAuthorLabel(row?.createdBy);
        return label ? (
          <span className="text-sm text-c-text truncate">{label}</span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        );
      },
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
        authorCol,
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
        authorCol,
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
      authorCol,
      updatedCol,
    ];
  }, [activeTab, t, getAuthorLabel]);

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

      // #73: "Open" (double-click / kebab primary) — for non-imported reports,
      // navigate straight into the real Report Builder. Previously this opened
      // the same bespoke "compact summary" slide-over as row single-click (no
      // Open/Preview distinction at all) — that slide-over is now the
      // StandardPreview aside's content instead (see renderContent's 'reports'
      // branch + selectedReportRow), so "Open" needs its own, deeper action.
      if (docType === 'report') {
        const builderId = (row as any).builderReportId || (row as any).builder_report_id || row.id;
        navigate(`/reports/builder/${encodeURIComponent(String(builderId))}`);
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
        // #73: "Preview" selects the row for the docked StandardPreview aside
        // (canon §7.1, same as 'list') instead of opening the full document —
        // this used to be indistinguishable from "Open" on every tab.
        if (activeTab === 'initiatives') {
          setSelectedInitiativeRowId(String(row.id));
        } else if (activeTab === 'reports') {
          setSelectedReportRowId(String(row.id));
        } else {
          setSelectedAssessmentId(String(row.id));
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
        // "Edit" action — open full editor (vs "Preview" = docked side panel)
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

  // Transform API data to display format — each tab uses its own status mapper
  const currentData = useMemo(() => {
    let data: any[] = [];

    switch (activeTab) {
      case 'list':
      case 'processes':
        data = assessments.map((item) => {
          // Codex fix #4 (frontend half): GET /api/v8/assessment (list) never
          // sent `progress` — that field doesn't exist in the API response at
          // all (see V8AssessmentListItem / assessment.routes.ts `router.get('/')`).
          // The list route derives DRD completion server-side and returns it
          // under `completionPercent`/`completion_percent` (camelCase always
          // present when derived; snake_case always present as the raw
          // persisted column via `...row`, same keys the single-record
          // GET /:id endpoint already used). Reading the non-existent
          // `item.progress` silently fell back to `?? 0`, so Processes always
          // showed 0% regardless of what the backend computed. `item.progress`
          // stays as a last-resort fallback for any caller that still sends it.
          const rawItem = item as unknown as {
            completionPercent?: number;
            completion_percent?: number;
          };
          return {
            id: item.id,
            name: item.name,
            framework: mapApiFramework(item.type),
            status: mapAssessmentApiStatus(item.status),
            progress: rawItem.completionPercent ?? rawItem.completion_percent ?? item.progress ?? 0,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            // #69: raw list rows are `SELECT *` — createdBy arrives as snake_case.
            createdBy: item.createdBy || item.created_by,
          };
        });
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
          createdBy: (item as any).createdBy,
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
          // #69: server/InitiativeController.getInitiatives now maps i.created_by → createdBy.
          createdBy: item.createdBy,
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
    (activeTab === 'list' || activeTab === 'processes') && loadWarning
      ? 'Assessment list is temporarily unavailable. Retry or create a new assessment while staging recovers.'
      : 'No assessments found. Create your first assessment to get started.';

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

  // #70: shared "open/focus the hub chat" plumbing, extracted so AI Triage can
  // reuse it and additionally post a framing message (see handleOpenHubTriage
  // below) instead of being a byte-for-byte duplicate of Chat's onClick.
  // Returns opened=false when this call only un-collapsed an already-active
  // chat (so the caller can skip posting a message on repeat clicks).
  const ensureHubChatOpen = useCallback(async (): Promise<{
    convId: string | null;
    opened: boolean;
  }> => {
    if (hubChatId && activeConversationId === hubChatId && !isChatCollapsed) {
      toggleChatCollapse();
      return { convId: hubChatId, opened: false };
    }

    let convId = hubChatId;
    if (hubChatId) {
      setActiveConversation(hubChatId);
    } else {
      const conversation = await createConversation({
        title: `Assessment Hub: ${tabs.find((tab) => tab.id === activeTab)?.label || 'Assessment'}`,
        projectId: currentProjectId || undefined,
        pmoContext: {
          assessmentId:
            activeTab === 'list' || activeTab === 'processes' ? assessments[0]?.id : undefined,
        },
      });
      convId = conversation.id;
      setHubChatId(conversation.id);
    }

    setWorkspaceContext(hubWorkspaceContext);
    if (isChatCollapsed) {
      toggleChatCollapse();
    }
    return { convId, opened: true };
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

  // #70: "AI Triage" used to be a byte-for-byte duplicate of "Chat" (same
  // onClick, same active state) — a pill that promised AI prioritization but
  // did nothing "Chat" didn't already do. Gave it real, distinct behavior:
  // open the hub chat AND kick it off with a framing prompt that asks the AI
  // to triage the current tab's list, instead of an empty conversation. Only
  // sends the message on a genuinely fresh open (not when the click just
  // un-collapses an already-open chat), so repeat clicks don't spam messages.
  const handleOpenHubTriage = useCallback(async () => {
    try {
      const { convId, opened } = await ensureHubChatOpen();
      if (!convId || !opened) return;
      const laneLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Assessment';
      await addChatMessage({
        conversationId: convId,
        role: 'user',
        messageType: 'text',
        content: t(
          'assessment.hub.triagePrompt',
          'Give me an AI pre-screen of the "{{lane}}" list ({{count}} items): what needs attention first, and why?',
          { lane: laneLabel, count: currentData.length }
        ),
      });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to open AI pre-screen');
    }
  }, [ensureHubChatOpen, tabs, activeTab, addChatMessage, t, currentData.length]);

  // #71: Tools-parity — behind ff assessmentMenu3StatusChips (default OFF).
  // DiscoveryToolsHub's CommandRowContent renders Menu 3 LEFT as a clickable
  // status-filter chip row (dot + count, active=filled) for every non-Library
  // tab, driven by the same per-tab status list that already backs the
  // StatusDropdown (Menu 2, `statusContext`). AssessmentHub's `statusFilter`
  // is currently only settable via that Menu 2 dropdown — Menu 3 shows three
  // static, non-interactive info badges instead (kanon §A2 "Bez liczników w
  // Menu 2 (liczniki mieszkają w Menu 3)"). Reuses `getStatusesForModule`
  // (same source as StatusDropdown) instead of a bespoke status list.
  const menu3StatusChipsEnabled = isEnabled('assessmentMenu3StatusChips');
  const statusChipOptions = useMemo(() => getStatusesForModule(statusContext), [statusContext]);
  const statusFilterChips = useMemo(
    () =>
      statusChipOptions.map((opt) => ({
        id: `status-${opt.id}`,
        label: isPolish ? opt.labelPL : opt.label,
        badge: statusCounts[opt.id] ?? 0,
        active: statusFilter === opt.id,
        icon: <span className={`h-1.5 w-1.5 rounded-full ${opt.bgColor}`} />,
        onClick: () => setStatusFilter(statusFilter === opt.id ? 'all' : opt.id),
        title: t('assessment.hub.statusFilterTooltip', 'Filter the list by status "{{status}}".', {
          status: isPolish ? opt.labelPL : opt.label,
        }),
      })),
    [isPolish, statusChipOptions, statusCounts, statusFilter, t]
  );

  const hubMenu3InfoChips = useMemo(
    () => [
      {
        // #70: was "Reports lane"/"Initiatives lane"/"Assessment lane" — "lane" is
        // internal jargon that doesn't tell the user what the pill means. Renamed
        // to plainly name the current tab (matches the visible tab label); the
        // badge count is explained via tooltip instead of a vague word.
        id: 'active-tab',
        label:
          activeTab === 'reports'
            ? 'Reports'
            : activeTab === 'initiatives'
              ? 'Initiatives'
              : activeTab === 'library'
                ? 'Library'
                : activeTab === 'outputs'
                  ? 'Outputs'
                  : 'Assessment',
        badge: currentData.length,
        active: true,
        title: t(
          'assessment.hub.activeTabTooltip',
          'Currently open tab and the number of items in its list.'
        ),
      },
      {
        id: 'status-filter',
        label: statusFilter === 'all' ? 'All statuses' : `Status ${statusFilter}`,
        title: t(
          'assessment.hub.statusFilterAppliedTooltip',
          'Status filter applied to the list (click a status in the table to set it).'
        ),
      },
      {
        id: 'documents',
        label: openDocuments.length > 0 ? 'Focused documents' : 'List workspace',
        badge: openDocuments.length || null,
        title: t(
          'assessment.hub.documentsTooltip',
          'Number of documents (assessment/report/initiative) currently open in this module.'
        ),
      },
    ],
    [activeTab, currentData.length, openDocuments.length, statusFilter, t]
  );

  const hubMenu3Chips = menu3StatusChipsEnabled ? statusFilterChips : hubMenu3InfoChips;

  /**
   * P-20 (Piotr, OBR-84…86, 2026-07-27): „Nie wiem, po co powstały te trzy
   * dodatkowe przyciski. Są zupełnie zbędne tutaj w menu trzecim."
   *
   * Kanon TRIADA A3: po PRAWEJ stronie Menu 3 stoją WYŁĄCZNIE przyciski AI
   * (dosłowny przykład z kanonu: `AI Priorities` w Tasks). Z trójki, która
   * tu stała, legalny był tylko `AI Triage`:
   *   - `Generate Report`  → wołał `setShowNewReportModal(true)`, czyli DOKŁADNIE
   *     to samo co CTA `New Report` z Menu 2 (patrz handler primaryCta niżej) → D-01
   *   - `Initiative Pack`  → to samo wobec CTA `New Initiative` → D-01
   *   - `Chat`             → funkcja, nie akcja AI kontekstowa; ten sam czat
   *     otwiera `AI Triage`, tylko z gotowym promptem
   *   - `Resume latest assessment` → skrót do najnowszego rekordu, który i tak
   *     stoi pierwszy w tabeli (sort po updated_at DESC)
   */
  const hubMenu3Actions = useMemo(
    () => [
      {
        // #70: label kept ("AI Triage" is the example the owner asked for), but
        // the click now does something Chat doesn't: opens the hub chat AND
        // posts a framing prompt asking the AI to prioritize the current tab's
        // list (see handleOpenHubTriage).
        id: 'triage',
        label: 'AI Triage',
        icon: Layers,
        onClick: () => void handleOpenHubTriage(),
        active: isHubChatActive,
        disabled: isLoading,
        title: t(
          'assessment.hub.aiTriageTooltip',
          'Opens AI chat with a ready-made prompt: what in this list needs attention first.'
        ),
      },
    ],
    [handleOpenHubTriage, isHubChatActive, isLoading, t]
  );

  // Triada standard (canon A3/A6): checkbox selection on the 'list' tab
  // switches Menu 3 into bulk mode (1:1 markup with StandardModuleBar.bulk).
  const handleBulkDeleteList = useCallback(async () => {
    if (selectedListIds.size === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedListIds.size} assessment(s)? This cannot be undone.`
      )
    )
      return;
    const ids = Array.from(selectedListIds);
    for (const id of ids) {
      const row = currentData.find((r: any) => r.id === id);
      if (row) await handleRowAction('delete', row);
    }
    setSelectedListIds(new Set());
  }, [selectedListIds, currentData, handleRowAction]);

  const bulkCommandRowContent =
    (activeTab === 'list' || activeTab === 'processes') && selectedListIds.size > 0 ? (
      <Menu3BulkRow
        selectedLabel={`${selectedListIds.size} selected`}
        selectAllLabel="Select all"
        clearLabel="Clear"
        onSelectAll={() => setSelectedListIds(new Set(currentData.map((r: any) => r.id)))}
        onClear={() => setSelectedListIds(new Set())}
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            onClick: () => void handleBulkDeleteList(),
            variant: 'danger',
          },
        ]}
      />
    ) : null;

  /**
   * MPQ audit #1 (main cause of Library's 26/30 FAIL): this used to render
   * unconditionally for every tab. `hubMenu3Chips`/`hubMenu3Actions` are both
   * derived from `currentData`/`statusCounts`, and neither has a 'library' (or
   * 'outputs') case — `currentData` stays `[]` and `statusCounts` stays all
   * zeros for those tabs (see the switches above), so the bar rendered 7
   * status chips reading "0" on Library, a catalog with no status dimension
   * at all. `filterControls`/`onNewItem` already skip library/outputs below
   * (existing condition) — this mirrors that condition so the whole Menu 3
   * command row is omitted (not just its chips) rather than showing a
   * half-populated bar. `ModuleNavBar` renders nothing for a `null`
   * `commandRowContent` (no right content, no active filters), so the row
   * disappears cleanly instead of leaving empty space.
   */
  const hubCommandRowContent = useMemo(
    () =>
      activeTab === 'library' || activeTab === 'outputs'
        ? null
        : (bulkCommandRowContent ?? (
            <AssessmentMenu3ActionBar chips={hubMenu3Chips} actions={hubMenu3Actions} />
          )),
    [activeTab, bulkCommandRowContent, hubMenu3Actions, hubMenu3Chips]
  );

  // NOTE: right-side actions are rendered by AssessmentMenu3ActionBar (inside hubCommandRowContent)
  // via MENU_3_INNER_CLASS (flex items-center justify-between). ModuleNavBar voids
  // commandRowRightContent, so all Menu 3 content lives in commandRowContent.

  // Triada standard (StandardPreview, canon A7): selected row + actions for the
  // 'list' tab preview pane. Computed at top level so the Esc/shortcut effect
  // below can depend on it (renderContent() is a plain render function, not a
  // component — hooks cannot live inside it).
  const selectedListRow: any = selectedAssessmentId
    ? (currentData.find((r: any) => r.id === selectedAssessmentId) ?? null)
    : null;

  /**
   * Blok „Co dalej" dla otwartej OCENY (kanon, blok opcjonalny StandardPreview).
   *
   * Dwie rzeczy spotykają się tutaj:
   *   1. Przegląd 128 zrzutów: podgląd oceny miał WYŁĄCZNIE `Delete` i
   *      `Duplicate` — „brak jakiejkolwiek akcji pozytywnej, można tylko usunąć
   *      albo zduplikować". Ekran nie mówił, co z tą oceną zrobić dalej.
   *   2. P-20: `Generate Report` i `Initiative Pack` wyleciały z Menu 3, bo tam
   *      dublowały CTA „New Report"/„New Initiative" i łamały kanon A3.
   *
   * W Menu 3 były duplikatem, bo dotyczyły CAŁEJ listy. Tutaj dotyczą JEDNEJ,
   * wybranej oceny — i dopiero w tym miejscu niosą informację: „z tej oceny
   * możesz zrobić raport albo pakiet inicjatyw". To dokładnie przepływ, na
   * którym stoi moduł Tools.
   *
   * `whatsNext` w `StandardPreview` istniał od dawna, ale miał ZERO
   * konsumentów — kanon obiecywał blok, którego nie było na żadnym ekranie.
   */
  const listPreviewWhatsNext = useMemo(
    () =>
      selectedListRow
        ? {
            items: [
              {
                id: 'to-report',
                label: t('assessment.whatsNext.report', 'Report'),
                icon: FileText,
                onClick: () => setShowNewReportModal(true),
              },
              {
                id: 'to-initiatives',
                label: t('assessment.whatsNext.initiatives', 'Initiative pack'),
                icon: Lightbulb,
                onClick: () => setShowInitiativesWizard(true),
              },
            ],
            note: t('assessment.whatsNext.note', 'Uses this assessment as the source.'),
          }
        : undefined,
    [selectedListRow, t]
  );

  const listPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedListRow
        ? {
            resolutions: [
              {
                id: 'delete',
                variant: 'destructive',
                label: t('common.delete', 'Delete'),
                icon: Trash2,
                onClick: () => void handleRowAction('delete', selectedListRow),
              },
            ],
            // canon §7.3 — "Open" usunięte z informational: dublowało onOpenFull
            // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
            informational: [
              {
                id: 'duplicate',
                variant: 'neutral',
                label: t('common.duplicate', 'Duplicate'),
                icon: Copy,
                onClick: () => void handleRowAction('duplicate', selectedListRow),
              },
            ],
          }
        : undefined,
    [selectedListRow, t, handleRowAction, handleOpenDocument]
  );

  // #73: same StandardTable+StandardPreview contract as 'list', now for
  // 'reports' and 'initiatives' — previously these two tabs had no docked
  // preview at all (single click == full open, no Preview/Open distinction).
  const selectedReportRow: any = selectedReportRowId
    ? (currentData.find((r: any) => r.id === selectedReportRowId) ?? null)
    : null;

  const reportPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedReportRow
        ? {
            // Imported PDF reports don't have a linked Report Builder record yet
            // (still mid-review), so Delete/Duplicate aren't wired for them —
            // omit rather than offer an action that would silently no-op.
            resolutions: selectedReportRow._isImported
              ? []
              : [
                  {
                    id: 'delete',
                    variant: 'destructive',
                    label: t('common.delete', 'Delete'),
                    icon: Trash2,
                    onClick: () => void handleRowAction('delete', selectedReportRow),
                  },
                ],
            // canon §7.3 — "Open" usunięte z informational: dublowało onOpenFull
            // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
            informational: [
              ...(selectedReportRow._isImported
                ? []
                : [
                    {
                      id: 'duplicate',
                      variant: 'neutral' as const,
                      label: t('common.duplicate', 'Duplicate'),
                      icon: Copy,
                      onClick: () => void handleRowAction('duplicate', selectedReportRow),
                    },
                  ]),
            ],
          }
        : undefined,
    [selectedReportRow, t, handleRowAction, handleOpenDocument]
  );

  const selectedInitiativeRow: any = selectedInitiativeRowId
    ? (currentData.find((r: any) => r.id === selectedInitiativeRowId) ?? null)
    : null;

  const initiativePreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedInitiativeRow
        ? {
            resolutions: [
              {
                id: 'delete',
                variant: 'destructive',
                label: t('common.delete', 'Delete'),
                icon: Trash2,
                onClick: () => void handleRowAction('delete', selectedInitiativeRow),
              },
            ],
            // canon §7.3 — "Open" usunięte z informational: dublowało onOpenFull
            // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
            informational: [
              {
                id: 'duplicate',
                variant: 'neutral',
                label: t('common.duplicate', 'Duplicate'),
                icon: Copy,
                onClick: () => void handleRowAction('duplicate', selectedInitiativeRow),
              },
            ],
          }
        : undefined,
    [selectedInitiativeRow, t, handleRowAction, handleOpenDocument]
  );

  // Esc closes preview; single-key shortcuts (O) active while preview open
  // (kanon B.24/B.31) — generalized across all 3 tabs (#73).
  useEffect(() => {
    const isProcessesTab = activeTab === 'list' || activeTab === 'processes';
    const selectedRowId = isProcessesTab
      ? selectedAssessmentId
      : activeTab === 'reports'
        ? selectedReportRowId
        : activeTab === 'initiatives'
          ? selectedInitiativeRowId
          : null;
    if (!selectedRowId) return;
    const actions = isProcessesTab
      ? listPreviewActions
      : activeTab === 'reports'
        ? reportPreviewActions
        : initiativePreviewActions;
    const shortcuts = standardPreviewShortcuts(actions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        if (isProcessesTab) setSelectedAssessmentId(null);
        else if (activeTab === 'reports') setSelectedReportRowId(null);
        else if (activeTab === 'initiatives') setSelectedInitiativeRowId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeTab,
    selectedAssessmentId,
    selectedReportRowId,
    selectedInitiativeRowId,
    listPreviewActions,
    reportPreviewActions,
    initiativePreviewActions,
  ]);

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

    // ASM-001A: 'library' — published-definition catalog + Start. Thin
    // adapter component (own StandardTable instance), rendered ahead of the
    // grid/list branches below since it has no relation to `currentData`/
    // `viewMode` (those drive the 'processes'/'reports'/'initiatives' tabs).
    if (activeTab === 'library') {
      return (
        <div className="h-full overflow-hidden">
          <AssessmentLibraryTab />
        </div>
      );
    }

    // ASM-005/006/007: 'outputs' shows the evidence/scoring + manager
    // accept/return + immutable accepted-output surface for the assessment
    // selected on the Processes tab (`selectedAssessmentId`, shared Hub
    // state). No assessment selected yet -> the org-wide Outputs Library
    // (AssessmentOutputsTab: `GET /api/artifacts`, filtered to assessment-
    // origin rows) — a real, useful default rather than a static "pick one
    // first" placeholder, and drives this tab's badge via `outputsCount`.
    if (activeTab === 'outputs') {
      if (selectedAssessmentId) {
        return (
          <div className="h-full overflow-hidden">
            <AssessmentQualityReviewPanel assessmentId={selectedAssessmentId} />
          </div>
        );
      }
      return (
        <div className="h-full overflow-hidden">
          <AssessmentOutputsTab onCountChange={setOutputsCount} />
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

    // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Assessment
    // 'list'/'processes' tab → StandardTable + StandardPreview. Moduł
    // deklaruje TYLKO dane + kontrakt kebaba/akcji; cały chrome pochodzi z
    // fasad Standard*. ('processes' = ASM-001A rename of 'list', identical
    // body — see the tab-id check below.)
    if (activeTab === 'list' || activeTab === 'processes') {
      const selectedRow = selectedListRow;
      const previewActions = listPreviewActions;

      return (
        <div className="h-full flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            <StandardTable
              columns={tableColumns}
              data={currentData}
              loading={isLoading}
              selectedRowId={selectedAssessmentId}
              onRowClick={(row) => setSelectedAssessmentId(String((row as any).id))}
              onRowDoubleClick={(row) => handleOpenDocument(row as any)}
              rowDescription={() => null}
              defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
              persistKey="assessment.hub.list"
              selection={{ selectedIds: selectedListIds, onChange: setSelectedListIds }}
              empty={{
                icon: FileText,
                title: t('assessment.emptyState.title', 'No assessments yet'),
                description: emptyStateMessage,
                actionLabel: t('assessment.emptyState.createFirst', 'Create First Assessment'),
                onAction: handleNewAssessment,
              }}
              rowMenu={(row): StandardRowMenu => ({
                primary: [
                  {
                    id: 'open',
                    label: t('common.open', 'Open'),
                    icon: ExternalLink,
                    onClick: () => handleOpenDocument(row as any),
                  },
                  {
                    id: 'duplicate',
                    label: t('common.duplicate', 'Duplicate'),
                    icon: Copy,
                    onClick: () => void handleRowAction('duplicate', row as any),
                  },
                ],
                universalHandlers: {
                  preview: () => setSelectedAssessmentId(String((row as any).id)),
                  // Brak API archiwizacji assessmentu — pozycja disabled z notą (StandardTable dokłada ją sama).
                },
                destructive: {
                  onClick: () => void handleRowAction('delete', row as any),
                },
              })}
            />
          </div>

          {selectedRow ? (
            <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={selectedRow.name || 'Assessment'}
                onClose={() => setSelectedAssessmentId(null)}
                onOpenFull={() => handleOpenDocument(selectedRow)}
                meta={{
                  pills: [
                    {
                      label: String(selectedRow.status || 'DRAFT'),
                      tone: statusChipTone(selectedRow.status),
                    },
                    {
                      label: `${selectedRow.progress ?? 0}%`,
                      tone: 'neutral',
                    },
                  ],
                  trailing: (
                    <span className="text-[11px] font-semibold text-c-text-secondary">
                      {/* N-94: podglad pokazywal „30 Apr 2026", a tabela obok
                          „30/04/2026" — ta sama data, dwa zapisy, jeden ekran. */}
                      {formatListDate(selectedRow.updatedAt)}
                    </span>
                  ),
                }}
                details={{
                  // N-52 / przeglad 128 zrzutow: to sa WLASCIWOSCI, nie tresc —
                  // szly dotad jako sklejony akapit w bloku na proze.
                  propertyLabel: isPolish ? 'Wlasciwosc' : 'Property',
                  valueLabel: isPolish ? 'Wartosc' : 'Value',
                  properties: [
                    {
                      id: 'type',
                      label: t('assessment.table.type', 'Type'),
                      value:
                        FRAMEWORK_META[selectedRow.framework as AssessmentFramework]?.name ||
                        selectedRow.framework ||
                        '—',
                    },
                    {
                      id: 'progress',
                      label: t('assessment.table.progress', 'Progress'),
                      value: `${selectedRow.progress ?? 0}%`,
                      mono: true,
                    },
                  ],
                  onCopy: () => {
                    void navigator.clipboard?.writeText(
                      `${selectedRow.name} — ${selectedRow.status} (${selectedRow.progress ?? 0}%)`
                    );
                  },
                }}
                ai={{
                  hints: [
                    t('assessment.preview.aiSummarize', 'Summarize assessment'),
                    t('assessment.preview.aiNextSteps', 'Suggest next steps'),
                  ],
                  disabled: true,
                  disabledTooltip: t('common.comingSoon', 'Coming soon'),
                }}
                relations={[]}
                actions={previewActions}
                whatsNext={
                  activeTab === 'list' || activeTab === 'processes'
                    ? listPreviewWhatsNext
                    : undefined
                }
              />
            </aside>
          ) : null}
        </div>
      );
    }

    // #73: 'reports' tab — same StandardTable + StandardPreview contract as
    // 'list' above (was FilterableTable's implicit fallback kebab — a flat,
    // unlabeled Open/Preview/Duplicate/Edit/Delete menu with no sections —
    // and row click opened a bespoke full-viewport backdrop drawer instead of
    // a docked panel; see _PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md #73).
    if (activeTab === 'reports') {
      const selectedRow = selectedReportRow;
      const previewActions = reportPreviewActions;

      return (
        <div className="h-full flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            <StandardTable
              columns={tableColumns}
              data={currentData}
              selectedRowId={selectedReportRowId}
              onRowClick={(row) => setSelectedReportRowId(String((row as any).id))}
              onRowDoubleClick={(row) => handleOpenDocument(row as any)}
              rowDescription={() => null}
              defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
              persistKey="assessment.hub.reports"
              empty={{
                icon: FileText,
                title: t('assessment.reports.emptyState.title', 'No reports yet'),
                description: emptyStateMessage,
                actionLabel: t('assessment.reports.emptyState.generate', 'Generate Report'),
                onAction: () => setShowNewReportModal(true),
              }}
              rowMenu={(row): StandardRowMenu => {
                const isImported = !!(row as any)?._isImported;
                const builderId =
                  (row as any)?.builderReportId || (row as any)?.builder_report_id || row.id;
                return {
                  primary: [
                    {
                      id: 'open',
                      label: t('common.open', 'Open'),
                      icon: ExternalLink,
                      onClick: () => handleOpenDocument(row as any),
                    },
                    ...(isImported
                      ? []
                      : [
                          {
                            id: 'duplicate',
                            label: t('common.duplicate', 'Duplicate'),
                            icon: Copy,
                            onClick: () => void handleRowAction('duplicate', row as any),
                          },
                        ]),
                  ],
                  universalHandlers: {
                    preview: () => setSelectedReportRowId(String((row as any).id)),
                    edit: isImported
                      ? undefined
                      : () => navigate(`/reports/builder/${encodeURIComponent(String(builderId))}`),
                    editNote: isImported
                      ? t(
                          'assessment.hub.editNoteImported',
                          'Edit via the imported-PDF review flow'
                        )
                      : undefined,
                  },
                  destructive: isImported
                    ? undefined
                    : { onClick: () => void handleRowAction('delete', row as any) },
                };
              }}
            />
          </div>

          {selectedRow ? (
            <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={selectedRow.name || 'Report'}
                onClose={() => setSelectedReportRowId(null)}
                onOpenFull={() => handleOpenDocument(selectedRow)}
                meta={{
                  pills: [
                    {
                      label: String(selectedRow.status || 'DRAFT'),
                      tone: statusChipTone(selectedRow.status),
                    },
                  ],
                  trailing: (
                    <span className="text-[11px] font-semibold text-c-text-secondary">
                      {/* N-94: podglad pokazywal „30 Apr 2026", a tabela obok
                          „30/04/2026" — ta sama data, dwa zapisy, jeden ekran. */}
                      {formatListDate(selectedRow.updatedAt)}
                    </span>
                  ),
                }}
                details={{
                  // N-52 / przeglad 128 zrzutow: to sa WLASCIWOSCI, nie tresc —
                  // szly dotad jako sklejony akapit w bloku na proze.
                  propertyLabel: isPolish ? 'Wlasciwosc' : 'Property',
                  valueLabel: isPolish ? 'Wartosc' : 'Value',
                  properties: [
                    {
                      id: 'type',
                      label: t('assessment.table.type', 'Type'),
                      value:
                        FRAMEWORK_META[selectedRow.framework as AssessmentFramework]?.name ||
                        selectedRow.framework ||
                        '—',
                    },
                    ...(selectedRow.assessmentName
                      ? [
                          {
                            id: 'source',
                            label: t('assessment.reports.source', 'Source assessment'),
                            value: selectedRow.assessmentName,
                          },
                        ]
                      : []),
                    {
                      id: 'author',
                      label: t('assessment.hub.table.author', 'Author'),
                      value: getAuthorLabel(selectedRow.createdBy) || '—',
                    },
                  ],
                  onCopy: () => {
                    void navigator.clipboard?.writeText(
                      `${selectedRow.name} — ${selectedRow.status}`
                    );
                  },
                }}
                relations={[]}
                actions={previewActions}
              >
                {/* #73: reuse the existing report-summary component (fetches full
                    report + exports, offers PDF/PPTX/DOCX download + web-preview
                    link) — same content as before, just moved from a bespoke
                    fixed-inset-0 backdrop drawer into the canonical docked
                    StandardPreview aside (the actual "full screen" bug). */}
                {!selectedRow._isImported && (
                  <ReportSlideOverContent
                    assessmentReportId={selectedRow.id}
                    builderReportId={selectedRow.builderReportId}
                    onOpenFull={() => handleOpenDocument(selectedRow)}
                  />
                )}
              </StandardPreview>
            </aside>
          ) : null}
        </div>
      );
    }

    // #73: 'initiatives' tab — same contract; replaces the InitiativeCompactPanel
    // overlay (fixed inset-0 backdrop drawer) that used to open on row click.
    if (activeTab === 'initiatives') {
      const selectedRow = selectedInitiativeRow;
      const previewActions = initiativePreviewActions;

      return (
        <div className="h-full flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            <StandardTable
              columns={tableColumns}
              data={currentData}
              selectedRowId={selectedInitiativeRowId}
              onRowClick={(row) => setSelectedInitiativeRowId(String((row as any).id))}
              onRowDoubleClick={(row) => handleOpenDocument(row as any)}
              rowDescription={() => null}
              defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
              persistKey="assessment.hub.initiatives"
              empty={{
                icon: Lightbulb,
                title: t('assessment.initiatives.emptyState.title', 'No initiatives yet'),
                description: emptyStateMessage,
                actionLabel: t('assessment.initiatives.emptyState.generate', 'Initiative Pack'),
                onAction: () => setShowInitiativesWizard(true),
              }}
              rowMenu={(row): StandardRowMenu => ({
                primary: [
                  {
                    id: 'open',
                    label: t('common.open', 'Open'),
                    icon: ExternalLink,
                    onClick: () => handleOpenDocument(row as any),
                  },
                  {
                    id: 'duplicate',
                    label: t('common.duplicate', 'Duplicate'),
                    icon: Copy,
                    onClick: () => void handleRowAction('duplicate', row as any),
                  },
                ],
                universalHandlers: {
                  preview: () => setSelectedInitiativeRowId(String((row as any).id)),
                },
                destructive: {
                  onClick: () => void handleRowAction('delete', row as any),
                },
              })}
            />
          </div>

          {selectedRow ? (
            <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={selectedRow.name || 'Initiative'}
                onClose={() => setSelectedInitiativeRowId(null)}
                onOpenFull={() => handleOpenDocument(selectedRow)}
                meta={{
                  pills: [
                    {
                      label: String(selectedRow.status || 'DRAFT'),
                      tone: statusChipTone(selectedRow.status),
                    },
                    {
                      label: String(selectedRow.priority || 'medium'),
                      tone: 'neutral',
                    },
                  ],
                  trailing: (
                    <span className="text-[11px] font-semibold text-c-text-secondary">
                      {/* N-94: podglad pokazywal „30 Apr 2026", a tabela obok
                          „30/04/2026" — ta sama data, dwa zapisy, jeden ekran. */}
                      {formatListDate(selectedRow.updatedAt)}
                    </span>
                  ),
                }}
                details={{
                  // N-52 / przeglad 128 zrzutow: to sa WLASCIWOSCI, nie tresc —
                  // szly dotad jako sklejony akapit w bloku na proze.
                  propertyLabel: isPolish ? 'Wlasciwosc' : 'Property',
                  valueLabel: isPolish ? 'Wartosc' : 'Value',
                  properties: [
                    {
                      id: 'type',
                      label: t('assessment.table.type', 'Type'),
                      value:
                        FRAMEWORK_META[selectedRow.framework as AssessmentFramework]?.name ||
                        selectedRow.framework ||
                        '—',
                    },
                    ...(selectedRow.sourceReport
                      ? [
                          {
                            id: 'source-report',
                            label: t('assessment.initiatives.sourceReport', 'Source report'),
                            value: selectedRow.sourceReport,
                          },
                        ]
                      : []),
                    {
                      id: 'author',
                      label: t('assessment.hub.table.author', 'Author'),
                      value: getAuthorLabel(selectedRow.createdBy) || '—',
                    },
                  ],
                  onCopy: () => {
                    void navigator.clipboard?.writeText(
                      `${selectedRow.name} — ${selectedRow.status}`
                    );
                  },
                }}
                relations={[]}
                actions={previewActions}
              />
            </aside>
          ) : null}
        </div>
      );
    }

    return null;
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

  /**
   * MPQ audit #3 ("loading state is a small card instead of column-matched
   * placeholders", both screens): this used to swap the ENTIRE screen —
   * `StandardModuleBar` (tabs, chrome) included — for a bare, generic
   * `LoadingState` block on every initial load, regardless of tab. Two
   * problems: (a) it hid the module bar/tabs, so the loading placeholder had
   * none of the real screen's structure — no header, no columns, nothing to
   * match; (b) it ran even for tabs (Library, Outputs) whose content doesn't
   * depend on this hub's core assessment fetch at all, so switching straight
   * to Library still showed an unrelated generic skeleton instead of
   * Library's own table.
   *
   * Fix: mount `StandardModuleBar` + the tab content unconditionally, same
   * as the loaded state. For 'list'/'processes' (Sessions), `loading={isLoading}`
   * is now forwarded to `StandardTable` below, which (R04-2C) keeps the real
   * header/column geometry and renders row-shaped skeleton bars in the body
   * instead of blanking the whole screen. Library/Outputs mount immediately
   * and manage their own (already column-matched) loading via their own
   * `StandardTable` instances — see `AssessmentLibraryTab`. `assessments`/
   * `reports`/`initiatives` all start as `[]` (safe to render pre-fetch).
   *
   * A full rebuild into a true PER-COLUMN skeleton (bars sized to each
   * column's actual width, not a generic 3-bar row) would require editing
   * `src/components/standard/StandardTable.tsx`'s shared `LoadingState`
   * plumbing, which is out of this agent's file scope (shared across
   * modules, other agents working on it concurrently) — not attempted here.
   */

  return (
    <>
      <h1 className="sr-only">Assessment</h1>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={activeTab === 'library' || activeTab === 'outputs' ? undefined : handleNewItem}
        newItemLabel={getNewItemLabel()}
        filterControls={
          activeTab === 'library' || activeTab === 'outputs' ? undefined : statusDropdownControl
        }
        commandRowContent={hubCommandRowContent}
      >
        {/* min-h-0 flex-1 overflow-hidden: without this the 'list' tab's
            <StandardPreview> aside (h-full chain) collapses to content
            height instead of stretching to the viewport — see the same
            fix already applied in InitiativesHub. */}
        <div className="min-h-0 flex-1 overflow-hidden space-y-3">
          {loadWarning &&
            !(
              (activeTab === 'list' || activeTab === 'processes') &&
              !activeDocumentId &&
              assessments.length === 0
            ) && (
              /* ★ Ten baner był pisany DARK-FIRST i nigdy nie sprawdzony w Light:
                 `text-amber-100` na `bg-amber-500/10` dawało w jasnym motywie
                 kontrast 1.38:1 (próg WCAG AA to 4.5:1) — komunikat o błędzie był
                 praktycznie niewidoczny dokładnie wtedy, gdy jest najbardziej
                 potrzebny. Wykryte dopiero po wymuszeniu stanu błędu w audycie.
                 Tokeny `c-warning` niosą poprawny kontrast w OBU motywach. */
              <div className="mx-4 mt-4 rounded-xl border border-c-warning/30 bg-c-warning/10 px-4 py-3 text-sm text-c-warning">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-c-warning" />
                    <p>{loadWarning}</p>
                  </div>
                  <button
                    onClick={() => refreshData()}
                    className="shrink-0 rounded-lg border border-c-warning/40 px-3 py-1.5 text-xs font-medium text-c-warning hover:bg-c-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          {loadWarning &&
          (activeTab === 'list' || activeTab === 'processes') &&
          !activeDocumentId &&
          assessments.length === 0 ? (
            // Hard failure (no cached data): show ErrorState with retry instead of the
            // empty-list CTA, which would falsely imply the user has 0 assessments.
            <ErrorState message={loadWarning} retry={() => void refreshData()} />
          ) : (
            renderContent()
          )}
        </div>
      </StandardModuleBar>

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

      {/* #73: the old Initiative Compact Side Panel overlay and the bespoke
          Report Slide-Over backdrop drawer (both `fixed inset-0` full-viewport
          overlays — the reported "preview paints across the whole screen"
          bug) are gone. Both tabs now use the same docked StandardTable +
          StandardPreview aside as 'list' — see renderContent() above. */}
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
  // #73: title/framework are shown by the wrapping StandardPreview instead
  // (header title + `details` block) — templateId is still used below in the
  // "Key details" card.
  const templateId = report.templateId || report.template_id || null;
  const sectionCount = report.sections?.length || 0;

  return (
    <div className="space-y-4">
      {/* #73: title+framework header dropped here — this component now renders
          as StandardPreview's `children` (embedded, not a standalone drawer),
          and StandardPreview's own header already shows the title; the Type
          fact is already in StandardPreview's `details` block. Status badge
          below is kept because it adds a one-line explanation the meta pill
          doesn't carry. */}
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
            {report.createdAt ? formatListDate(report.createdAt) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock size={11} /> Last updated
          </span>
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {report.updatedAt ? formatListDate(report.updatedAt) : '—'}
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
                      {/* `pl-PL` na sztywno dawalo polski zapis takze angielskiemu
                          kontu — wspolny formatter idzie za jezykiem konta. */}
                      {formatListDateTime(exportDate)}
                      {exp.fileSize ? ` · ${(exp.fileSize / 1024).toFixed(0)} KB` : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {downloadingId === fmt ? (
                      <Loader2
                        size={14}
                        className="animate-spin text-slate-500 dark:text-slate-400"
                      />
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              No exports yet. Generate now:
            </p>
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
