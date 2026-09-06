/**
 * InitiativesManagementPanel - Professional initiatives management for assessments
 * Displays initiatives table with status, priority, and actions
 * Design follows TeamManagementPanel patterns (ClickUp-style)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Flag,
  Lightbulb,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { GeneratorInicjatywModal } from '@/components/Initiatives/Generator/GeneratorInicjatywModal';
import { adapterAssessment } from '@/components/Initiatives/Generator/adapters/assessment';
import { CanonicalInitiativeRegister } from '@/components/Initiatives/CanonicalInitiativeRegister';
import type { InitiativeRegisterRow } from '@/components/Initiatives/initiativeRegisterColumns.shared';
import { Api } from '@/services/api';
import { getStatusActions, InitiativeStatus } from '@/types/initiative';
import { cn } from '@/utils/cn';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';

// ============================================
// Types
// ============================================

export type InitiativePriority = 'low' | 'medium' | 'high' | 'critical';
export type InitiativeRisk = 'low' | 'medium' | 'high';

export interface Initiative {
  id: string;
  title: string;
  description?: string;
  status: InitiativeStatus;
  priority: InitiativePriority;
  risk?: InitiativeRisk;
  category?: string;
  assessmentId?: string;
  batchId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
  dueDate?: string;
  owner?: string;
  ownerName?: string;
  impact?: number;
  effort?: number;
}

export interface InitiativeBatch {
  id: string;
  methodologyId: string;
  initiativesCount: number;
  includeChatContext: boolean;
  generatedBy: string;
  generatedByName: string;
  createdAt: string;
  provenance?: {
    assessmentRunId?: string | null;
    assessmentDefinitionId?: string | null;
    assessmentDefinitionVersion?: string | null;
    workbenchRunState?: string | null;
    interpretationReviewState?: string | null;
    scoreReviewState?: string | null;
  } | null;
}

export interface InitiativesManagementPanelProps {
  assessmentId: string;
  assessmentName?: string;
  workflowStatus: string;
  canManage: boolean;
  canGenerateInitiatives: boolean;
  onRefresh: () => Promise<void>;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG: Partial<
  Record<
    InitiativeStatus,
    {
      /** i18n key segment under assessment.initiativesPanel.status.* */
      labelKey: string;
      label: string;
      color: string;
      bgColor: string;
      borderColor: string;
      icon: FC<{ size?: number; className?: string }>;
    }
  >
> = {
  [InitiativeStatus.DRAFT]: {
    labelKey: 'draft',
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Edit3,
  },
  [InitiativeStatus.PENDING_REVIEW]: {
    labelKey: 'pendingReview',
    label: 'Pending Review',
    // Pułapka #1 (kanon): `primary`=crimson; status informacyjny → niebieski, nie crimson.
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Clock,
  },
  [InitiativeStatus.REVIEW]: {
    labelKey: 'review',
    label: 'Review',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Eye,
  },
  [InitiativeStatus.PROMOTED]: {
    labelKey: 'promoted',
    label: 'Promoted',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: TrendingUp,
  },
  [InitiativeStatus.PLANNING]: {
    labelKey: 'planning',
    label: 'Planning',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Calendar,
  },
  [InitiativeStatus.APPROVED]: {
    labelKey: 'approved',
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  [InitiativeStatus.SCHEDULED]: {
    labelKey: 'scheduled',
    label: 'Scheduled',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Calendar,
  },
  [InitiativeStatus.EXECUTING]: {
    labelKey: 'executing',
    label: 'Executing',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    icon: Play,
  },
  [InitiativeStatus.BLOCKED]: {
    labelKey: 'blocked',
    label: 'Blocked',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/10',
    borderColor: 'border-danger-200 dark:border-danger-500/30',
    icon: AlertCircle,
  },
  [InitiativeStatus.DONE]: {
    labelKey: 'done',
    label: 'Done',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  [InitiativeStatus.TRACKING]: {
    labelKey: 'tracking',
    label: 'Tracking',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Target,
  },
  [InitiativeStatus.CANCELLED]: {
    labelKey: 'cancelled',
    label: 'Cancelled',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/10',
    borderColor: 'border-danger-200 dark:border-danger-500/30',
    icon: X,
  },
  [InitiativeStatus.ARCHIVED]: {
    labelKey: 'archived',
    label: 'Archived',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Archive,
  },
};

const PRIORITY_CONFIG: Record<
  InitiativePriority,
  {
    /** i18n key segment under assessment.initiativesPanel.priority.* */
    labelKey: string;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  low: {
    labelKey: 'low',
    label: 'Low',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
  },
  medium: {
    labelKey: 'medium',
    label: 'Medium',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
  },
  high: {
    labelKey: 'high',
    label: 'High',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
  },
  critical: {
    labelKey: 'critical',
    label: 'Critical',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
  },
};

const METHODOLOGY_OPTIONS = [
  { value: 'impact-feasibility', key: 'impactFeasibility', label: 'Impact x Feasibility' },
  { value: 'moscow', key: 'moscow', label: 'MoSCoW' },
  { value: 'rice', key: 'rice', label: 'RICE' },
  { value: 'value-effort', key: 'valueEffort', label: 'Value x Effort' },
  { value: 'strategic-fit', key: 'strategicFit', label: 'Strategic Fit' },
];

const STATUS_FILTER_OPTIONS: InitiativeStatus[] = [
  InitiativeStatus.DRAFT,
  InitiativeStatus.PENDING_REVIEW,
  InitiativeStatus.REVIEW,
  InitiativeStatus.PROMOTED,
  InitiativeStatus.PLANNING,
  InitiativeStatus.APPROVED,
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
  InitiativeStatus.TRACKING,
  InitiativeStatus.DONE,
  InitiativeStatus.ARCHIVED,
];

/**
 * Wspólny formatter daty — 1:1 z dawnym formatDate wiersza tabeli (przed migracją
 * do StandardTable). Locale idzie za aktywnym językiem UI (parytet pl/en, wzór
 * z ReportsTable.tsx) — wcześniej było przybite `'pl-PL'`, więc data zostawała
 * polska nawet w interfejsie angielskim.
 */
const dateLocale = (language?: string): string => (language?.startsWith('pl') ? 'pl-PL' : 'en-US');

const formatInitiativeDate = (dateStr: string, language?: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(dateLocale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};


// ============================================
// Main Component
// ============================================

export const InitiativesManagementPanel: FC<InitiativesManagementPanelProps> = ({
  assessmentId,
  assessmentName,
  workflowStatus,
  canManage,
  canGenerateInitiatives,
  onRefresh,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [batches, setBatches] = useState<InitiativeBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegisterRowId, setSelectedRegisterRowId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualPriority, setManualPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [manualRisk, setManualRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [manualCategory, setManualCategory] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInitiativeId, setEditInitiativeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [editRisk, setEditRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [editCategory, setEditCategory] = useState('');
  // Multi-select status filter; empty array means "all"
  const [statusFilter, setStatusFilter] = useState<InitiativeStatus[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);

  const isApproved = workflowStatus === 'APPROVED';

  /** Etykieta statusu/priorytetu przez t(); STATUS_CONFIG niesie tylko klucz + angielski domyślny. */
  const statusLabel = useCallback(
    (status: InitiativeStatus): string => {
      const cfg = STATUS_CONFIG[status];
      if (!cfg) return String(status);
      return t(`assessment.initiativesPanel.status.${cfg.labelKey}`, cfg.label);
    },
    [t]
  );

  const priorityLabel = useCallback(
    (priority: InitiativePriority): string => {
      const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
      return t(`assessment.initiativesPanel.priority.${cfg.labelKey}`, cfg.label);
    },
    [t]
  );

  // Fetch initiatives for this assessment
  const fetchInitiatives = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [initiativesResp, batchesResp] = await Promise.all([
        fetch(`/api/assessment-workflow-v2/${assessmentId}/generated-initiatives`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch(`/api/assessment-workflow-v2/${assessmentId}/initiative-generation-runs`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      if (initiativesResp?.ok) {
        const data = await initiativesResp.json();
        setInitiatives(data.initiatives || []);
      }
      if (batchesResp?.ok) {
        const data = await batchesResp.json();
        setBatches(
          Array.isArray(data.runs)
            ? data.runs.map((run: any) => ({
                id: String(run.id),
                methodologyId: String(run.methodologyId || 'impact-feasibility'),
                initiativesCount: Number(run.requestedCount || 0),
                includeChatContext: true,
                generatedBy: String(run.createdBy || 'system'),
                generatedByName: String(run.createdBy || 'AI'),
                createdAt: String(run.createdAt || new Date().toISOString()),
                provenance: run.provenance || null,
              }))
            : []
        );
      }
    } catch (err) {
      console.error('[InitiativesManagementPanel] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchInitiatives();
  }, [fetchInitiatives]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchInitiatives();
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateManualInitiative = async (payload: {
    title: string;
    description?: string;
    category?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    risk: 'low' | 'medium' | 'high';
  }) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/assessment-workflow-v2/${assessmentId}/initiatives`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error ||
          err?.message ||
          t('assessment.initiativesPanel.toast.createFailed', 'Failed to create initiative')
      );
    }
    await fetchInitiatives();
  };

  const handleDuplicateInitiative = async (initiative: Initiative) => {
    const title = `${initiative.title} ${t('assessment.initiativesPanel.copySuffix', '(copy)')}`;
    await handleCreateManualInitiative({
      title,
      description: initiative.description || '',
      category: initiative.category || '',
      priority: initiative.priority || 'medium',
      risk: (initiative.risk as any) || 'medium',
    });
  };

  const openEditModal = (initiative: Initiative) => {
    setEditInitiativeId(initiative.id);
    setEditTitle(initiative.title || '');
    setEditDescription(initiative.description || '');
    setEditPriority((initiative.priority as any) || 'medium');
    setEditRisk((initiative.risk as any) || 'medium');
    setEditCategory(initiative.category || '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editInitiativeId) return;
    const title = editTitle.trim();
    if (title.length < 3) {
      toast.error(t('initiatives.form.titleTooShort', 'Title is too short'));
      return;
    }
    try {
      await Api.updateInitiative(editInitiativeId, {
        title,
        name: title,
        description: editDescription.trim() || undefined,
        priority: editPriority,
        riskLevel: editRisk,
        category: editCategory.trim() || undefined,
      });
      toast.success(t('assessment.initiativesPanel.toast.updated', 'Initiative updated'));
      setEditModalOpen(false);
      await fetchInitiatives();
    } catch (e: any) {
      toast.error(
        e?.message ||
          t('assessment.initiativesPanel.toast.updateFailed', 'Failed to update initiative')
      );
    }
  };

  const handleUpdateStatus = async (initiativeId: string, status: InitiativeStatus) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/initiatives/${initiativeId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error ||
          err?.message ||
          t('assessment.initiativesPanel.toast.updateStatusFailed', 'Failed to update status')
      );
    }
    await fetchInitiatives();
  };

  const handleDelete = async (initiativeId: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/initiatives/${initiativeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchInitiatives();
  };

  const handleOpenInitiative = (initiativeId: string) => {
    navigate(`/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`);
  };

  // Close status filter popover on outside click / ESC
  useEffect(() => {
    if (!statusFilterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatusFilterOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const el = statusFilterRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setStatusFilterOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [statusFilterOpen]);

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    let result = initiatives;

    if (statusFilter.length > 0) {
      const selected = new Set(statusFilter);
      result = result.filter((i) => selected.has(i.status));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query)) ||
          (i.category && i.category.toLowerCase().includes(query))
      );
    }

    return result;
  }, [initiatives, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(
    () => ({
      total: initiatives.length,
      draft: initiatives.filter((i) => i.status === InitiativeStatus.DRAFT).length,
      pendingReview: initiatives.filter((i) => i.status === InitiativeStatus.PENDING_REVIEW).length,
      review: initiatives.filter((i) => i.status === InitiativeStatus.REVIEW).length,
      executing: initiatives.filter((i) => i.status === InitiativeStatus.EXECUTING).length,
      done: initiatives.filter((i) => i.status === InitiativeStatus.DONE).length,
    }),
    [initiatives]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_FILTER_OPTIONS) {
      counts[s] = initiatives.filter((i) => i.status === s).length;
    }
    return counts as Record<InitiativeStatus, number>;
  }, [initiatives]);

  const statusFilterLabel = useMemo(() => {
    if (statusFilter.length === 0)
      return t('assessment.initiativesPanel.filter.allStatuses', 'All statuses');
    if (statusFilter.length === 1) return statusLabel(statusFilter[0]);
    return t('assessment.initiativesPanel.filter.selected', '{{count}} selected', {
      count: statusFilter.length,
    });
  }, [statusFilter, statusLabel, t]);

  // ── A19 + A13 (uwagi właściciela 2026-09-05) ────────────────────────────────
  // „Czemu to jest inna tabela inicjatyw — powinniśmy mieć jedną" oraz „to ma
  // być normalna tabela inicjatyw na pełną szerokość, nie raport w raporcie".
  //
  // Było: własny `<StandardTable>` z `density="compact"`, bez podglądu, bez
  // sortowania domyślnego i z własnym pustym stanem — te same 10 kolumn, ale
  // inna POWŁOKA niż moduł Inicjatywy. Jest: DOKŁADNIE ten sam komponent, który
  // renderuje `/initiatives` (`CanonicalInitiativeRegister`) — jedna tabela,
  // jeden podgląd kanoniczny, jeden kebab, jeden pstryczek kolumn.
  //
  // Kontekst Oceny wchodzi jako OPCJONALNA kolumna tej samej definicji
  // (`includeSource` → „Źródło"), nigdy jako druga tabela.
  const registerRows = useMemo<InitiativeRegisterRow[]>(
    () =>
      filteredInitiatives.map(
        (initiative) =>
          ({
            ...initiative,
            name: initiative.title,
            summary: initiative.description,
            sourceLabel: assessmentName
              ? t('assessment.initiativesPanel.source.assessment', 'Ocena: {{name}}', {
                  name: assessmentName,
                })
              : t('assessment.initiativesPanel.source.assessmentFallback', 'Ocena'),
          }) as unknown as InitiativeRegisterRow
      ),
    [filteredInitiatives, assessmentName, t]
  );

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg">
                <Lightbulb size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('assessment.initiativesPanel.header.title', 'Initiatives')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('assessment.initiativesPanel.header.counts', {
                    defaultValue: '{{initiatives}} • {{batches}}',
                    initiatives: t(
                      'assessment.initiativesPanel.header.initiativeCount',
                      '{{count}} initiatives',
                      {
                        count: stats.total,
                      }
                    ),
                    batches: t(
                      'assessment.initiativesPanel.header.batchCount',
                      '{{count}} batches',
                      {
                        count: batches.length,
                      }
                    ),
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title={t('common.refresh', 'Refresh')}
                aria-label={t('common.refresh', 'Refresh')}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
              {canManage && (
                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 transition-colors"
                >
                  <Plus size={16} />
                  {t('assessment.initiativesPanel.actions.new', 'New')}
                </button>
              )}
              {/* DEC-413: dwa przyciski („Quick" + „Wizard (50+)" za flaga
                  `assessmentInitiativesWizard`, defaultValue=false) zlaly sie
                  w JEDEN generator. Doktryna gestosci zabrania zdublowanej
                  akcji, a wersja chwalona przez wlasciciela byla domyslnie
                  wylaczona — teraz jest jedyna i zawsze dostepna. */}
              {canManage && canGenerateInitiatives && (
                <button
                  data-testid="assessment-generate-initiatives"
                  onClick={() => setShowGenerateModal(true)}
                  disabled={!isApproved}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isApproved
                      ? 'bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    !isApproved
                      ? t(
                          'assessment.initiativesPanel.actions.needsApprovalTooltip',
                          'Assessment must be approved to generate initiatives'
                        )
                      : undefined
                  }
                >
                  <Sparkles size={16} />
                  {t('assessment.initiativesPanel.actions.generate', 'Generuj inicjatywy')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Warning */}
        {!isApproved && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                  {t('assessment.initiativesPanel.notApproved.title', 'Assessment not approved')}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {t(
                    'assessment.initiativesPanel.notApproved.description',
                    'Initiatives can only be generated from approved assessments. Current status:'
                  )}{' '}
                  <strong>
                    {t(
                      `assessment.initiativesPanel.workflowStatus.${workflowStatus}`,
                      workflowStatus
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Row (dropdown, multi-select) */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
          <div className="flex items-center justify-between gap-3">
            <div ref={statusFilterRef} className="relative">
              <button
                type="button"
                onClick={() => setStatusFilterOpen((v) => !v)}
                className={cn(
                  'h-10 inline-flex items-center gap-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                  'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700',
                  // Pułapka #1 (kanon): `primary`=crimson; stan aktywny filtra → neutralny, nie crimson.
                  statusFilter.length > 0 &&
                    'border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10'
                )}
              >
                <Filter
                  size={14}
                  className={
                    statusFilter.length > 0
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-slate-500'
                  }
                />
                <span className="text-slate-700 dark:text-slate-200">
                  {t('assessment.initiativesPanel.filter.status', 'Status')}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{statusFilterLabel}</span>
                <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
              </button>

              <AnimatePresence>
                {statusFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 mt-2 w-[320px] rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 shadow-2xl overflow-hidden z-20"
                  >
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('assessment.initiativesPanel.filter.byStatus', 'Filter by status')}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStatusFilter([])}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          {t('assessment.initiativesPanel.filter.all', 'All')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter([])}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title={t(
                            'assessment.initiativesPanel.filter.clearSelection',
                            'Clear selection'
                          )}
                        >
                          {t('assessment.initiativesPanel.filter.clear', 'Clear')}
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[280px] overflow-auto py-1">
                      {STATUS_FILTER_OPTIONS.map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        if (!cfg) return null;
                        const Icon = cfg.icon;
                        const checked = statusFilter.includes(s);
                        const count = statusCounts[s] || 0;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setStatusFilter((prev) =>
                                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                              );
                            }}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-900/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                readOnly
                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-c-focus"
                              />
                              <Icon
                                size={14}
                                className={
                                  checked ? cfg.color : 'text-slate-500 dark:text-slate-400'
                                }
                              />
                              <span
                                className={cn(
                                  'text-sm truncate',
                                  checked
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-700 dark:text-slate-200'
                                )}
                              >
                                {statusLabel(s)}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('assessment.initiativesPanel.filter.showingOf', 'Showing {{shown}} of {{total}}', {
                shown: filteredInitiatives.length,
                total: stats.total,
              })}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800">
          <div className="relative max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'assessment.initiativesPanel.search.placeholder',
                'Search initiatives...'
              )}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus/30 focus:border-c-focus transition-colors"
            />
          </div>
        </div>

        {/* Tabela inicjatyw — TA SAMA co /initiatives (A19/A13).
            Host (`AssessmentManagePanel`) daje tylko `<div className="p-4">` bez
            wysokosci, a `TableWithPreviewLayout` stoi na `h-full` — bez tego
            kontenera wysokosc procentowa nie mialaby sie do czego odniesc i
            podglad kanoniczny nie mialby miejsca. To SAMA wysokosc, zero ramki:
            bez obramowania, tla i zaokraglen (kanon: nie „raport w raporcie"). */}
        <div className="flex h-[calc(100vh-320px)] min-h-[420px] flex-col">
          <CanonicalInitiativeRegister
            rows={registerRows}
            selectedId={selectedRegisterRowId}
            onSelect={(row) => setSelectedRegisterRowId(row ? String(row.id) : null)}
            onOpen={(row) => handleOpenInitiative(String(row.id))}
            persistKey="assessment.manage.initiatives.list"
            loading={loading}
            columnOptions={{ includeSource: true }}
            emptyTitle={
              searchQuery
                ? t('assessment.initiativesPanel.empty.noMatch', 'No initiatives match your search')
                : t('assessment.initiativesPanel.empty.none', 'No initiatives yet')
            }
            emptyDescription={
              isApproved
                ? t(
                    'assessment.initiativesPanel.empty.hintApproved',
                    'Generate initiatives from the assessment data'
                  )
                : t(
                    'assessment.initiativesPanel.empty.hintNotApproved',
                    'Approve the assessment to generate initiatives'
                  )
            }
            emptyActionLabel={t(
              'assessment.initiativesPanel.empty.generate',
              'Generate Initiatives'
            )}
            onEmptyAction={
              isApproved && canManage && canGenerateInitiatives
                ? () => setShowGenerateModal(true)
                : undefined
            }
          />
        </div>

        {/* Batches Section */}
        {batches.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t('assessment.initiativesPanel.batches.title', 'Generation Batches')}
            </div>
            <div className="flex flex-wrap gap-2">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs"
                >
                  <Zap size={12} className="text-violet-500" />
                  <div className="flex flex-col">
                    <span className="text-slate-700 dark:text-slate-300">
                      {t(
                        'assessment.initiativesPanel.batches.summary',
                        '{{methodology}} • {{count}} items',
                        {
                          methodology: t(
                            `assessment.initiativesPanel.methodology.${
                              METHODOLOGY_OPTIONS.find((o) => o.value === batch.methodologyId)
                                ?.key || batch.methodologyId
                            }`,
                            batch.methodologyId
                          ),
                          count: batch.initiativesCount,
                        }
                      )}
                    </span>
                    {batch.provenance?.assessmentRunId ? (
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">
                        {t('assessment.initiativesPanel.batches.run', 'run {{id}}', {
                          id: batch.provenance.assessmentRunId,
                        })}
                        {batch.provenance.workbenchRunState
                          ? ` • ${t(
                              `assessment.initiativesPanel.runState.${batch.provenance.workbenchRunState}`,
                              String(batch.provenance.workbenchRunState).replace(/_/g, ' ')
                            )}`
                          : ''}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">
                    {new Date(batch.createdAt).toLocaleDateString(dateLocale(i18n.language))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-blue-500" />
              <span>{t('assessment.initiativesPanel.legend.planned', 'Planned')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Play size={12} className="text-amber-500" />
              <span>{t('assessment.initiativesPanel.legend.inProgress', 'In Progress')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>{t('assessment.initiativesPanel.legend.completed', 'Completed')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flag size={12} className="text-danger-500" />
              <span>
                {t('assessment.initiativesPanel.legend.criticalPriority', 'Critical Priority')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Create Modal */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowManualModal(false)}
            />
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <div className="text-base font-semibold text-navy-900 dark:text-white">
                  {t('initiatives.form.newInitiative')} (
                  {t('assessment.initiativesPanel.draftSuffix', 'draft')})
                </div>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.title')}
                  </label>
                  <input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    placeholder={t('initiatives.form.titlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.descriptionOptional')}
                  </label>
                  <textarea
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    rows={4}
                    placeholder={t('initiatives.form.summaryPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('initiatives.form.priority')}
                    </label>
                    <select
                      value={manualPriority}
                      onChange={(e) => setManualPriority(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">{t('initiatives.priority.low')}</option>
                      <option value="medium">{t('initiatives.priority.medium')}</option>
                      <option value="high">{t('initiatives.priority.high')}</option>
                      <option value="critical">{t('initiatives.priority.critical')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('initiatives.form.risk')}
                    </label>
                    <select
                      value={manualRisk}
                      onChange={(e) => setManualRisk(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">{t('initiatives.risk.low')}</option>
                      <option value="medium">{t('initiatives.risk.medium')}</option>
                      <option value="high">{t('initiatives.risk.high')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.categoryOptional')}
                  </label>
                  <input
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    placeholder={t('initiatives.form.categoryPlaceholder')}
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowManualModal(false)}
                  className="h-10 px-4 rounded-lg border border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  {t('initiatives.form.cancel')}
                </button>
                <button
                  onClick={async () => {
                    const title = manualTitle.trim();
                    if (title.length < 3) {
                      toast.error(t('initiatives.form.titleTooShort'));
                      return;
                    }

                    // B8.2: Check for duplicates including archived/cancelled/rejected history
                    let allInitiativesForDupeCheck = initiatives;
                    try {
                      const allRes = await Api.get(
                        `/api/assessment-workflow-v2/${assessmentId}/generated-initiatives?includeArchived=true`
                      );
                      if (allRes?.initiatives) allInitiativesForDupeCheck = allRes.initiatives;
                    } catch {
                      /* fallback to current initiatives */
                    }
                    const duplicateName = checkDuplicateInitiative(
                      title,
                      allInitiativesForDupeCheck
                    );
                    if (duplicateName) {
                      const shouldProceed = window.confirm(
                        `${t('initiatives.form.duplicateWarning', { name: duplicateName })}\n\n${t('initiatives.form.duplicateWarningDesc')}\n\n${t('assessment.initiativesPanel.proceedAnyway', 'Do you want to proceed anyway?')}`
                      );
                      if (!shouldProceed) {
                        return;
                      }
                      // Show warning toast but allow proceeding
                      toast.error(t('initiatives.form.duplicateWarning', { name: duplicateName }), {
                        duration: 5000,
                      });
                    }

                    try {
                      await handleCreateManualInitiative({
                        title,
                        description: manualDescription.trim() || undefined,
                        category: manualCategory.trim() || undefined,
                        priority: manualPriority,
                        risk: manualRisk,
                      });
                      setShowManualModal(false);
                      setManualTitle('');
                      setManualDescription('');
                      setManualCategory('');
                      setManualPriority('medium');
                      setManualRisk('medium');
                      toast.success(t('initiatives.form.initiativeCreated'));
                    } catch (e: any) {
                      toast.error(e?.message || t('initiatives.form.createFailed'));
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold"
                >
                  {t('initiatives.form.create')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setEditModalOpen(false)} />
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <div className="text-base font-semibold text-navy-900 dark:text-white">
                  {t('assessment.initiativesPanel.editModal.title', 'Edit initiative')}
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.title', 'Title')}
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.descriptionOptional', 'Description (optional)')}
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('initiatives.form.priority', 'Priority')}
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">{t('initiatives.priority.low', 'Low')}</option>
                      <option value="medium">{t('initiatives.priority.medium', 'Medium')}</option>
                      <option value="high">{t('initiatives.priority.high', 'High')}</option>
                      <option value="critical">
                        {t('initiatives.priority.critical', 'Critical')}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {t('initiatives.form.risk', 'Risk')}
                    </label>
                    <select
                      value={editRisk}
                      onChange={(e) => setEditRisk(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">{t('initiatives.risk.low', 'Low')}</option>
                      <option value="medium">{t('initiatives.risk.medium', 'Medium')}</option>
                      <option value="high">{t('initiatives.risk.high', 'High')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('initiatives.form.categoryOptional', 'Category (optional)')}
                  </label>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="h-10 px-4 rounded-lg border border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  {t('initiatives.form.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold"
                >
                  {t('assessment.initiativesPanel.editModal.save', 'Save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JEDEN generator inicjatyw (DEC-413) — ten sam modal, co w Wywiadzie,
          Narzedziach i Audytach; adapter `assessment` odtwarza dotychczasowe
          zachowanie 1:1 (trzy tryby zrodla, ocena, raport, template). */}
      <GeneratorInicjatywModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        adaptery={[adapterAssessment]}
        wstepnyWybor={assessmentId ? [assessmentId] : undefined}
        onCompleted={() => handleRefresh()}
      />
    </div>
  );
};

export default InitiativesManagementPanel;
