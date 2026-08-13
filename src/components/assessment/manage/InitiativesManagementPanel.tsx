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

import { InitiativesGenerationWizardModal } from '@/components/assessment/InitiativesGenerationWizardModal';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { LoadingState } from '@/components/ui/primitives';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
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
  onGenerateInitiatives?: (config: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => Promise<void>;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG: Partial<
  Record<
    InitiativeStatus,
    {
      label: string;
      color: string;
      bgColor: string;
      borderColor: string;
      icon: FC<{ size?: number; className?: string }>;
    }
  >
> = {
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Edit3,
  },
  [InitiativeStatus.PENDING_REVIEW]: {
    label: 'Pending Review',
    // Pułapka #1 (kanon): `primary`=crimson; status informacyjny → niebieski, nie crimson.
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Clock,
  },
  [InitiativeStatus.REVIEW]: {
    label: 'Review',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Eye,
  },
  [InitiativeStatus.PROMOTED]: {
    label: 'Promoted',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: TrendingUp,
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Calendar,
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  [InitiativeStatus.SCHEDULED]: {
    label: 'Scheduled',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Calendar,
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    icon: Play,
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/10',
    borderColor: 'border-danger-200 dark:border-danger-500/30',
    icon: AlertCircle,
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  [InitiativeStatus.TRACKING]: {
    label: 'Tracking',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Target,
  },
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/10',
    borderColor: 'border-danger-200 dark:border-danger-500/30',
    icon: X,
  },
  [InitiativeStatus.ARCHIVED]: {
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
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  low: {
    label: 'Low',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
  },
  high: {
    label: 'High',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
  },
  critical: {
    label: 'Critical',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
  },
};

const METHODOLOGY_OPTIONS = [
  { value: 'impact-feasibility', label: 'Impact x Feasibility' },
  { value: 'moscow', label: 'MoSCoW' },
  { value: 'rice', label: 'RICE' },
  { value: 'value-effort', label: 'Value x Effort' },
  { value: 'strategic-fit', label: 'Strategic Fit' },
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

/** Wspólny formatter daty — 1:1 z dawnym formatDate wiersza tabeli (przed migracją do StandardTable). */
const formatInitiativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// ============================================
// Generate Modal Component
// ============================================

const GenerateInitiativesModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => Promise<void>;
}> = ({ isOpen, onClose, onGenerate }) => {
  const [methodologyId, setMethodologyId] = useState('impact-feasibility');
  const [count, setCount] = useState(5);
  const [includeChatContext, setIncludeChatContext] = useState(true);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate({ methodologyId, count, includeChatContext });
      onClose();
    } catch (err) {
      toast.error('Failed to generate initiatives');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-slate-500/10 to-amber-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy-900 text-white rounded-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Generate Initiatives
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AI-powered initiative generation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Prioritization Methodology
            </label>
            <select
              value={methodologyId}
              onChange={(e) => setMethodologyId(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
            >
              {METHODOLOGY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Number of Initiatives
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
            >
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} initiatives
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/50 cursor-pointer">
            <input
              type="checkbox"
              checked={includeChatContext}
              onChange={(e) => setIncludeChatContext(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-c-focus"
            />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Include chat context
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Use conversation history for better suggestions
              </div>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
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
  onGenerateInitiatives,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlagsContext();
  const wizardEnabled = isEnabled('assessmentInitiativesWizard');
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [batches, setBatches] = useState<InitiativeBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
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

  const handleGenerate = async (config: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => {
    if (onGenerateInitiatives) {
      await onGenerateInitiatives(config);
      await fetchInitiatives();
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
      throw new Error(err?.error || err?.message || 'Failed to create initiative');
    }
    await fetchInitiatives();
  };

  const handleDuplicateInitiative = async (initiative: Initiative) => {
    const title = `${initiative.title} (copy)`;
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
      toast.error('Title is too short');
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
      toast.success('Initiative updated');
      setEditModalOpen(false);
      await fetchInitiatives();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update initiative');
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
      throw new Error(err?.error || err?.message || 'Failed to update status');
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
    if (statusFilter.length === 0) return 'All statuses';
    if (statusFilter.length === 1) {
      const cfg = STATUS_CONFIG[statusFilter[0]];
      return cfg?.label || String(statusFilter[0]);
    }
    return `${statusFilter.length} selected`;
  }, [statusFilter]);

  // Triada standard (migracja bespoke tabeli, kanon TRIADA reguła #1): kolumny
  // deklaratywne StandardTable — 1:1 z dawnymi komórkami <InitiativeRow>.
  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: 'Initiative',
        width: '260px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-c-text truncate">{initiative.title}</div>
                {initiative.category && (
                  <div className="text-xs text-c-text-muted truncate">{initiative.category}</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'priority',
        label: 'Priority',
        width: '110px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          const cfg = PRIORITY_CONFIG[initiative.priority] || PRIORITY_CONFIG.medium;
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bgColor} ${cfg.color}`}
            >
              <Flag size={10} />
              {cfg.label}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '170px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          const cfg = STATUS_CONFIG[initiative.status] || STATUS_CONFIG[InitiativeStatus.DRAFT]!;
          const actions = getStatusActions(initiative.status);
          const canMutate = canManage && actions.length > 0;
          return (
            <div className="relative">
              <EntityStatusChip status={initiative.status} label={cfg.label} />
              {canMutate && (
                <select
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      void handleUpdateStatus(initiative.id, e.target.value as InitiativeStatus);
                    }
                  }}
                >
                  <option value="">{cfg.label}</option>
                  {actions.map((a) => (
                    <option key={a.targetStatus} value={a.targetStatus}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        },
      },
      {
        id: 'impactEffort',
        label: 'Impact/Effort',
        width: '110px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          if (initiative.impact === undefined || initiative.effort === undefined) {
            return <span className="text-xs text-c-text-muted">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp size={12} className="text-emerald-500" />
                <span className="text-c-text-secondary">{initiative.impact}</span>
              </div>
              <span className="text-c-text-muted">/</span>
              <div className="flex items-center gap-1 text-xs">
                <Target size={12} className="text-blue-500" />
                <span className="text-c-text-secondary">{initiative.effort}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'owner',
        label: 'Owner',
        width: '110px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          const name = initiative.ownerName || initiative.owner;
          if (!name) return <span className="text-xs text-c-text-muted">—</span>;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-medium text-white shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-c-text-secondary truncate">{name.split(' ')[0]}</span>
            </div>
          );
        },
      },
      {
        id: 'createdAt',
        label: 'Created',
        width: '110px',
        sortable: true,
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <span className="text-xs text-c-text-muted">
              {formatInitiativeDate(initiative.createdAt)}
            </span>
          );
        },
      },
    ],
    [canManage, handleUpdateStatus]
  );

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): moduł deklaruje
  // TYLKO bloki 1-3; StandardTable SAM dokłada bloki 4 (Open preview · Edit ·
  // Archive) i 5 (Delete). 1:1 z dawnym dropdownem "More Actions" wiersza.
  const buildRowMenu = useCallback(
    (initiative: Initiative): StandardRowMenu => ({
      primary: [
        {
          id: 'open-in-initiatives',
          label: 'Open in Initiatives',
          icon: ExternalLink,
          onClick: () =>
            navigate(`/initiatives?open=${encodeURIComponent(initiative.id)}&mode=doc`),
        },
        ...(canManage
          ? [
              {
                id: 'duplicate',
                label: 'Duplicate',
                icon: Copy,
                onClick: () => {
                  void (async () => {
                    try {
                      await handleDuplicateInitiative(initiative);
                      toast.success('Initiative duplicated');
                    } catch {
                      toast.error('Failed to duplicate initiative');
                    }
                  })();
                },
              },
            ]
          : []),
      ],
      statusTransitions: getStatusActions(initiative.status).map((action) => ({
        id: `status-${action.targetStatus}`,
        label: action.label,
        icon: ArrowRight,
        onClick: () => {
          void handleUpdateStatus(initiative.id, action.targetStatus);
        },
      })),
      universalHandlers: {
        preview: () => handleOpenInitiative(initiative.id),
        edit: canManage ? () => openEditModal(initiative) : undefined,
        // Brak API archiwizacji inicjatywy z poziomu tego panelu — disabled z
        // notą (StandardTable dokłada ją sama, blok 4).
      },
      destructive: canManage
        ? {
            onClick: () => {
              if (!confirm(`Delete initiative "${initiative.title}"?`)) return;
              void (async () => {
                try {
                  await handleDelete(initiative.id);
                  toast.success('Initiative deleted');
                } catch {
                  toast.error('Failed to delete initiative');
                }
              })();
            },
          }
        : {},
    }),
    [
      canManage,
      navigate,
      handleDuplicateInitiative,
      handleUpdateStatus,
      handleOpenInitiative,
      openEditModal,
      handleDelete,
    ]
  );

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg">
                <Lightbulb size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Initiatives
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.total} initiative{stats.total !== 1 ? 's' : ''} • {batches.length} batch
                  {batches.length !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
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
                  New
                </button>
              )}
              {canManage && canGenerateInitiatives && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    disabled={!isApproved}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isApproved
                        ? 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700'
                        : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    }`}
                    title={
                      !isApproved
                        ? 'Assessment must be approved to generate initiatives'
                        : undefined
                    }
                  >
                    <Sparkles size={16} />
                    Quick
                  </button>
                  {wizardEnabled && (
                    <button
                      onClick={() => setShowWizardModal(true)}
                      disabled={!isApproved}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isApproved
                          ? 'bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      }`}
                      title={
                        !isApproved
                          ? 'Assessment must be approved to generate initiatives'
                          : undefined
                      }
                    >
                      <Sparkles size={16} />
                      Wizard (50+)
                    </button>
                  )}
                </div>
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
                  Assessment not approved
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Initiatives can only be generated from approved assessments. Current status:{' '}
                  <strong>{workflowStatus}</strong>
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
                <span className="text-slate-700 dark:text-slate-200">Status</span>
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
                        Filter by status
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStatusFilter([])}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter([])}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="Clear selection"
                        >
                          Clear
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
                                {cfg.label}
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
              Showing{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {filteredInitiatives.length}
              </span>{' '}
              of{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{stats.total}</span>
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
              placeholder="Search initiatives..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus/30 focus:border-c-focus transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <LoadingState variant="spinner" />
          ) : filteredInitiatives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 mb-3">
                <Lightbulb size={24} className="text-slate-500 dark:text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {searchQuery ? 'No initiatives match your search' : 'No initiatives yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isApproved
                  ? 'Generate initiatives from the assessment data'
                  : 'Approve the assessment to generate initiatives'}
              </p>
              {isApproved && canManage && canGenerateInitiatives && (
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold transition-colors"
                >
                  <Sparkles size={16} />
                  Generate Initiatives
                </button>
              )}
            </div>
          ) : (
            <StandardTable
              columns={columns}
              data={
                filteredInitiatives as unknown as Array<Record<string, unknown> & { id: string }>
              }
              onRowDoubleClick={(row) =>
                handleOpenInitiative(String((row as unknown as Initiative).id))
              }
              rowDescription={() => null}
              persistKey="assessment.manage.initiatives.list"
              density="compact"
              canvasClassName="p-0"
              rowMenu={(row) => buildRowMenu(row as unknown as Initiative)}
            />
          )}
        </div>

        {/* Batches Section */}
        {batches.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Generation Batches
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
                      {batch.methodologyId} • {batch.initiativesCount} items
                    </span>
                    {batch.provenance?.assessmentRunId ? (
                      <span className="text-[10px] text-slate-600 dark:text-slate-500">
                        run {batch.provenance.assessmentRunId}
                        {batch.provenance.workbenchRunState
                          ? ` • ${String(batch.provenance.workbenchRunState).replace(/_/g, ' ')}`
                          : ''}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-slate-600 dark:text-slate-500">
                    {new Date(batch.createdAt).toLocaleDateString('pl-PL')}
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
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Play size={12} className="text-amber-500" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flag size={12} className="text-danger-500" />
              <span>Critical Priority</span>
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
                  {t('initiatives.form.newInitiative')} (draft)
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
                        `${t('initiatives.form.duplicateWarning', { name: duplicateName })}\n\n${t('initiatives.form.duplicateWarningDesc')}\n\n${t('common.confirm', 'Do you want to proceed anyway?')}`
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
                  Edit initiative
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
                    Title
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Description (optional)
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
                      Priority
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Risk
                    </label>
                    <select
                      value={editRisk}
                      onChange={(e) => setEditRisk(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Category (optional)
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <GenerateInitiativesModal
            isOpen={showGenerateModal}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerate}
          />
        )}
      </AnimatePresence>

      {/* Wizard Modal */}
      <AnimatePresence>
        {showWizardModal && (
          <InitiativesGenerationWizardModal
            isOpen={showWizardModal}
            onClose={() => setShowWizardModal(false)}
            initialAssessmentId={assessmentId}
            onCompleted={() => handleRefresh()}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default InitiativesManagementPanel;
