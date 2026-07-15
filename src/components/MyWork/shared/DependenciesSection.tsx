/**
 * DependenciesSection
 * Gantt-style task dependency management.
 *
 * Two groups:
 *   • Predecessors  — tasks that must complete/start before this one
 *   • Successors    — tasks that depend on this one
 *
 * Each link carries a dependency type (FS / SS / FF / SF),
 * optional lag/lead, and shows the target task's artifact code,
 * title, status, and priority.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  MessageSquare,
  Minus,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';
import { Api } from '@/services/api';
import { buildArtifactCode } from '@/utils/artifactLinks';

// ── Types ────────────────────────────────────────────────────────────────────

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
  id: string;
  /** When rendered outside a single task context (e.g. initiative aggregation), this is the "current" task id for API ops */
  sourceTaskId?: string;
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  taskPriority?: string;
  taskIndexCode?: string;
  dependencyType: DependencyType;
  lagDays: number;
  notes?: string;
  direction: 'predecessor' | 'successor';
  createdAt?: string;
}

interface SearchResult {
  id: string;
  title: string;
  status: string;
  priority: string;
  initiativeName?: string;
}

interface ConnectedTask {
  id: string;
  title: string;
  status?: string;
  priority?: string;
}

interface DependenciesSectionProps {
  /** Current task ID (optional — omit for initiative-level usage) */
  taskId?: string;
  /** Called when user clicks to open a linked task */
  onOpenTask?: (taskId: string) => void;
  /** Read-only mode (no add/remove) */
  readOnly?: boolean;
  /** Existing task links from the global connection system */
  connectedTasks?: ConnectedTask[];
  /** External dependencies — when provided, skip API fetch and use these directly */
  externalDependencies?: TaskDependency[];
  /** Optional refresher for externalDependencies after mutations (initiative aggregation) */
  onRefreshExternalDependencies?: () => void | Promise<void>;
  /** Show read-only sample rows when dependency list is empty */
  showSampleDataWhenEmpty?: boolean;
  /** Initiative ID + tasks for initiative-level add (when taskId is omitted) */
  initiativeId?: string;
  initiativeTasks?: { id: string; title: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-sky-500',
  done: 'bg-emerald-500',
  blocked: 'bg-danger-500',
  cancelled: 'bg-slate-300',
};

const STATUS_LABELS: Record<string, { en: string; pl: string }> = {
  todo: { en: 'To Do', pl: 'Do zrobienia' },
  in_progress: { en: 'In Progress', pl: 'W toku' },
  review: { en: 'Review', pl: 'Przegląd' },
  done: { en: 'Done', pl: 'Gotowe' },
  blocked: { en: 'Blocked', pl: 'Zablokowane' },
  cancelled: { en: 'Cancelled', pl: 'Anulowane' },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-danger-500',
  high: 'text-amber-500',
  medium: 'text-amber-500',
  low: 'text-slate-500 dark:text-slate-400',
};

const DEP_TYPE_LABELS: Record<
  DependencyType,
  { en: string; pl: string; desc_en: string; desc_pl: string }
> = {
  FS: {
    en: 'Finish → Start',
    pl: 'Koniec → Start',
    desc_en: 'Predecessor must finish before successor can start',
    desc_pl: 'Poprzednik musi się zakończyć, zanim następnik może się rozpocząć',
  },
  SS: {
    en: 'Start → Start',
    pl: 'Start → Start',
    desc_en: 'Both tasks start at the same time',
    desc_pl: 'Oba zadania rozpoczynają się w tym samym czasie',
  },
  FF: {
    en: 'Finish → Finish',
    pl: 'Koniec → Koniec',
    desc_en: 'Both tasks finish at the same time',
    desc_pl: 'Oba zadania kończą się w tym samym czasie',
  },
  SF: {
    en: 'Start → Finish',
    pl: 'Start → Koniec',
    desc_en: 'Predecessor must start before successor can finish',
    desc_pl: 'Poprzednik musi się rozpocząć, zanim następnik może się zakończyć',
  },
};

// No example dependencies — real data comes from the API

// ── Component ────────────────────────────────────────────────────────────────

export const DependenciesSection: React.FC<DependenciesSectionProps> = ({
  taskId,
  onOpenTask,
  readOnly = false,
  connectedTasks = [],
  externalDependencies,
  onRefreshExternalDependencies,
  showSampleDataWhenEmpty = false,
  initiativeId,
  initiativeTasks = [],
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // ── State ────────────────────────────────────────────────────
  const [predecessors, setPredecessors] = useState<TaskDependency[]>([]);
  const [successors, setSuccessors] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [addDirection, setAddDirection] = useState<'predecessor' | 'successor' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDepType, setSelectedDepType] = useState<DependencyType>('FS');
  const [lagDays, setLagDays] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);
  const [editingDependency, setEditingDependency] = useState<TaskDependency | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedSourceTaskId, setSelectedSourceTaskId] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveTaskId = taskId || selectedSourceTaskId;

  const displayedDependencies = [...predecessors, ...successors];
  const sampleDependencies = useMemo<TaskDependency[]>(
    () => [
      {
        id: 'sample-dep-1',
        taskId: 'sample-task-1',
        taskTitle: 'Kick-off workshop with key stakeholders',
        taskStatus: 'done',
        taskPriority: 'high',
        taskIndexCode: 'sample-task-1',
        dependencyType: 'FS',
        lagDays: 0,
        notes:
          'Sample data: process definition starts after the stakeholder kick-off is completed.',
        direction: 'predecessor',
      },
      {
        id: 'sample-dep-2',
        taskId: 'sample-task-2',
        taskTitle: 'Configure pilot environment and integrations',
        taskStatus: 'in_progress',
        taskPriority: 'medium',
        taskIndexCode: 'sample-task-2',
        dependencyType: 'SS',
        lagDays: 2,
        notes: 'Sample data: pilot setup starts with a 2-day lead overlap.',
        direction: 'successor',
      },
    ],
    []
  );
  const isShowingSampleData =
    showSampleDataWhenEmpty && !loading && displayedDependencies.length === 0;
  const visibleDependencies = isShowingSampleData ? sampleDependencies : displayedDependencies;
  const visiblePredecessors = isShowingSampleData
    ? sampleDependencies.filter((d) => d.direction === 'predecessor')
    : predecessors;
  const availableConnectedTasks = connectedTasks.filter(
    (t) => t.id && t.id !== taskId && !displayedDependencies.some((d) => d.taskId === t.id)
  );

  // ── Fetch dependencies ───────────────────────────────────────
  const fetchDependencies = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    try {
      const data = await Api.get(`/tasks/${taskId}/dependencies`);
      setPredecessors(
        (data.predecessors || []).map((d: any) => ({ ...d, direction: 'predecessor' as const }))
      );
      setSuccessors(
        (data.successors || []).map((d: any) => ({ ...d, direction: 'successor' as const }))
      );
    } catch (err) {
      console.error('[DependenciesSection] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // When external dependencies are provided, populate state from them directly
  useEffect(() => {
    if (externalDependencies) {
      setPredecessors(externalDependencies.filter((d) => d.direction === 'predecessor'));
      setSuccessors(externalDependencies.filter((d) => d.direction === 'successor'));
      setLoading(false);
    }
  }, [externalDependencies]);

  useEffect(() => {
    if (!externalDependencies) {
      fetchDependencies();
    }
  }, [fetchDependencies, externalDependencies]);

  // Close action menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [openMenuId]);

  // ── Search tasks ─────────────────────────────────────────────
  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const data = await Api.get(
          `/tasks/search?q=${encodeURIComponent(query)}&exclude=${taskId}`
        );
        setSearchResults(data.tasks || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [taskId]
  );

  const handleSearchChange = (value: string) => {
    // If user pastes an internal URL, extract the task ID for cleaner display
    let cleanedValue = value;
    try {
      if (value.includes('artifact=')) {
        const url = new URL(value.startsWith('http') ? value : `http://${value}`);
        const artifact = url.searchParams.get('artifact');
        if (artifact) {
          const decoded = decodeURIComponent(artifact);
          const match = decoded.match(/^task:(.+)$/);
          if (match) {
            cleanedValue = match[1];
          }
        }
      }
    } catch {
      // Not a URL — use as-is
    }
    setSearchQuery(cleanedValue);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(cleanedValue), 300);
  };

  // ── Add dependency ───────────────────────────────────────────
  const handleAddDependency = async (targetTask: SearchResult) => {
    if (!addDirection || addingTaskId) return;
    const baseId = effectiveTaskId;
    if (!baseId) {
      toast.error(t('myWork.dependencies.toastError', 'Select a source task first'));
      return;
    }
    setAddingTaskId(targetTask.id);

    try {
      const res = await Api.post(`/tasks/${baseId}/dependencies`, {
        targetTaskId: targetTask.id,
        direction: addDirection,
        dependencyType: selectedDepType,
        lagDays,
        notes: noteText || undefined,
      });

      if (res?.success || res?.dependency) {
        const depRes = res?.dependency || {};
        const newDep: TaskDependency = {
          id: depRes.id || `${targetTask.id}-${Date.now()}`,
          taskId: depRes.taskId || targetTask.id,
          taskTitle: depRes.taskTitle || targetTask.title,
          taskStatus: depRes.taskStatus || targetTask.status,
          taskPriority: depRes.taskPriority || targetTask.priority,
          taskIndexCode: depRes.taskId || targetTask.id,
          dependencyType: selectedDepType,
          lagDays,
          notes: noteText || undefined,
          direction: depRes.direction || addDirection,
        };

        if (addDirection === 'predecessor') {
          setPredecessors((prev) => [newDep, ...prev]);
        } else {
          setSuccessors((prev) => [newDep, ...prev]);
        }

        toast.success(t('myWork.dependencies.toastSuccess', 'Dependency added'));
        closeModal();
        if (taskId) fetchDependencies();
        await onRefreshExternalDependencies?.();
      } else {
        toast.error(t('myWork.dependencies.toastError2', 'Failed to add dependency'));
      }
    } catch (err: any) {
      const msg = String(err?.response?.data?.error || err?.message || '').toLowerCase();
      if (msg.includes('circular')) {
        toast.error(
          t(
            'myWork.dependencies.cannotAddWouldCreate',
            'Cannot add — would create a circular dependency'
          )
        );
      } else if (msg.includes('already exists') || msg.includes('już istnieje')) {
        toast.error(t('myWork.dependencies.toastError3', 'This dependency already exists'));
      } else {
        toast.error(t('myWork.dependencies.toastError4', 'Failed to add dependency'));
      }
    } finally {
      setAddingTaskId(null);
    }
  };

  // ── Remove dependency ────────────────────────────────────────
  const handleRemove = async (dep: TaskDependency) => {
    const baseTaskId = effectiveTaskId || dep.sourceTaskId;
    if (!baseTaskId) {
      toast.error(t('myWork.dependencies.missingTaskContext', 'Missing task context'));
      return;
    }
    try {
      await Api.delete(`/tasks/${baseTaskId}/dependencies/${dep.id}`);
      // Remove from both lists (initiative aggregation can render same dep.id in both arrays)
      setPredecessors((prev) => prev.filter((d) => d.id !== dep.id));
      setSuccessors((prev) => prev.filter((d) => d.id !== dep.id));
      toast.success(t('myWork.dependencies.toastSuccess2', 'Dependency removed'));
      await onRefreshExternalDependencies?.();
    } catch {
      toast.error(t('myWork.dependencies.toastError5', 'Failed to remove'));
    }
  };

  const handleDuplicate = async (dep: TaskDependency) => {
    const baseTaskId = effectiveTaskId || dep.sourceTaskId;
    if (!baseTaskId) {
      toast.error(t('myWork.dependencies.missingTaskContext2', 'Missing task context'));
      return;
    }
    try {
      const res = await Api.post(`/tasks/${baseTaskId}/dependencies`, {
        targetTaskId: dep.taskId,
        direction: dep.direction,
        dependencyType: dep.dependencyType,
        lagDays: dep.lagDays,
      });
      if (res?.success) {
        toast.success(t('myWork.dependencies.toastSuccess3', 'Duplicate added'));
        if (taskId) fetchDependencies();
        await onRefreshExternalDependencies?.();
      } else {
        toast.error(
          t('myWork.dependencies.failedToDuplicateDependency', 'Failed to duplicate dependency')
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('already exists')) {
        toast.error(t('myWork.dependencies.toastError6', 'This dependency already exists'));
      } else {
        toast.error(
          t('myWork.dependencies.failedToDuplicateDependency2', 'Failed to duplicate dependency')
        );
      }
    }
  };

  // ── Modal helpers ────────────────────────────────────────────
  const openModal = (dir: 'predecessor' | 'successor', depToEdit?: TaskDependency) => {
    setAddDirection(dir);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedDepType(depToEdit?.dependencyType || 'FS');
    setLagDays(depToEdit?.lagDays ?? 0);
    setNoteText(depToEdit?.notes || '');
    setEditingDependency(depToEdit || null);
    setSelectedSourceTaskId(!taskId && initiativeTasks.length > 0 ? initiativeTasks[0].id : null);
  };

  const closeModal = () => {
    setAddDirection(null);
    setSearchQuery('');
    setSearchResults([]);
    setAddingTaskId(null);
    setEditingDependency(null);
    setNoteText('');
    setSelectedSourceTaskId(null);
  };

  const handleEditDependency = async () => {
    if (!editingDependency || !addDirection) return;
    const baseTaskId = effectiveTaskId || editingDependency.sourceTaskId;
    if (!baseTaskId) {
      toast.error(t('myWork.dependencies.missingTaskContext3', 'Missing task context'));
      return;
    }

    const unchanged =
      editingDependency.direction === addDirection &&
      editingDependency.dependencyType === selectedDepType &&
      editingDependency.lagDays === lagDays &&
      (editingDependency.notes || '') === noteText;
    if (unchanged) {
      closeModal();
      return;
    }

    try {
      // No PATCH endpoint exists for dependencies, so recreate link.
      await Api.delete(`/tasks/${baseTaskId}/dependencies/${editingDependency.id}`);
      await Api.post(`/tasks/${baseTaskId}/dependencies`, {
        targetTaskId: editingDependency.taskId,
        direction: addDirection,
        dependencyType: selectedDepType,
        lagDays,
        notes: noteText || undefined,
      });
      toast.success(t('myWork.dependencies.toastSuccess4', 'Dependency updated'));
      closeModal();
      if (taskId) fetchDependencies();
      await onRefreshExternalDependencies?.();
    } catch {
      toast.error(t('myWork.dependencies.failedToUpdateDependency', 'Failed to update dependency'));
    }
  };

  // ── Render helpers ───────────────────────────────────────────
  const formatLag = (lagDaysValue: number) => {
    if (lagDaysValue === 0) return '—';
    const formatted = t('myWork.dependencies.lagDays', { count: Math.abs(lagDaysValue) });
    return lagDaysValue > 0 ? `+${formatted}` : `-${formatted}`;
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              {t('myWork.dependencies.dependencies', 'Dependencies')}
            </h2>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {visibleDependencies.length}
            </span>
            {isShowingSampleData && (
              <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">
                {t('myWork.dependencies.sampleData', 'sample data')}
              </span>
            )}
          </div>
          {!readOnly && (taskId || (externalDependencies && initiativeTasks.length > 0)) && (
            <button
              onClick={() => openModal('predecessor')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <Plus size={12} />
              {t('myWork.dependencies.addDependency', 'Add dependency')}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : visibleDependencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-3">
                <ArrowDown
                  size={18}
                  className="text-slate-500 dark:text-slate-400 dark:text-slate-500"
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {t('myWork.dependencies.noDependenciesYet', 'No dependencies yet')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                {t(
                  'myWork.dependencies.useTheButtonAbove',
                  'Use the button above to add a dependency to another task.'
                )}
              </p>
            </div>
          ) : (
            <>
              {/* ── Combined dependencies table ───────────────── */}
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
                <table
                  /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm"
                >
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
                      <th className="text-left py-2.5 pl-3 pr-2">
                        {t('myWork.dependencies.direction', 'Direction')}
                      </th>
                      <th className="text-left py-2.5 pr-2">
                        {t('myWork.dependencies.task', 'Task')}
                      </th>
                      <th className="text-left py-2.5 pr-2">
                        {t('myWork.dependencies.type', 'Type')}
                      </th>
                      <th className="text-left py-2.5 pr-2">
                        {t('myWork.dependencies.lag', 'Lag')}
                      </th>
                      <th className="text-left py-2.5 pr-2">
                        {t('myWork.dependencies.status', 'Status')}
                      </th>
                      <th className="text-left py-2.5 pr-2">
                        {t('myWork.dependencies.priority', 'Priority')}
                      </th>
                      <th className="text-right py-2.5 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                    {visibleDependencies.map((dep) => {
                      const code = buildArtifactCode('task', dep.taskIndexCode || dep.taskId);
                      const statusLabel = STATUS_LABELS[dep.taskStatus || 'todo'];
                      const isPredecessor = dep.direction === 'predecessor';
                      const isBlocking =
                        isPredecessor &&
                        dep.taskStatus !== 'done' &&
                        dep.taskStatus !== 'cancelled';
                      return (
                        <tr
                          key={`${dep.id}-${dep.direction}-${dep.taskId}`}
                          className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                        >
                          <td className="py-2.5 pl-3 pr-2 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                isPredecessor
                                  ? 'border-blue-300/50 text-blue-600 dark:text-blue-400 bg-blue-500/10'
                                  : 'border-amber-300/50 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              {isPredecessor ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                              {isPredecessor
                                ? t('myWork.dependencies.predecessor', 'Predecessor')
                                : t('myWork.dependencies.successor', 'Successor')}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[dep.taskStatus || 'todo']}`}
                              />
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                {code}
                              </span>
                              {onOpenTask ? (
                                <button
                                  onClick={() => onOpenTask(dep.taskId)}
                                  className="text-slate-700 dark:text-slate-300 truncate hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline transition-colors text-left"
                                  title={t('myWork.dependencies.title', 'Open task')}
                                >
                                  {dep.taskTitle}
                                </button>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-300 truncate">
                                  {dep.taskTitle}
                                </span>
                              )}
                              {dep.notes && (
                                <span title={dep.notes} className="shrink-0">
                                  <MessageSquare
                                    size={12}
                                    className="text-slate-500 dark:text-slate-400"
                                  />
                                </span>
                              )}
                              {isBlocking && (
                                <span
                                  title={t('myWork.dependencies.title2', 'Blocking this task')}
                                  className="shrink-0"
                                >
                                  <AlertTriangle size={13} className="text-amber-500" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 font-mono font-semibold">
                              {dep.dependencyType}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {formatLag(dep.lagDays)}
                          </td>
                          <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                            {isPolish ? statusLabel?.pl : statusLabel?.en}
                          </td>
                          <td className="py-2.5 pr-2 text-xs">
                            {dep.taskPriority ? (
                              <span
                                className={`font-medium ${PRIORITY_COLORS[dep.taskPriority] || 'text-slate-500 dark:text-slate-400'}`}
                              >
                                {dep.taskPriority}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId((prev) => (prev === dep.id ? null : dep.id));
                              }}
                              className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                              title={t('myWork.dependencies.title3', 'Actions')}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openMenuId === dep.id && (
                              <div className="absolute right-3 top-9 z-30 w-44 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 backdrop-blur-lg p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                                {isShowingSampleData && (
                                  <div className="px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 italic">
                                    {t('myWork.dependencies.sampleData2', 'Sample data')}
                                  </div>
                                )}
                                {onOpenTask && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onOpenTask(dep.taskId);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${isShowingSampleData ? 'opacity-50 pointer-events-none' : ''}`}
                                  >
                                    <ExternalLink
                                      size={13}
                                      className="text-slate-500 dark:text-slate-400"
                                    />
                                    {t('myWork.dependencies.openCard', 'Open card')}
                                  </button>
                                )}
                                {!readOnly && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      openModal(dep.direction, dep);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${isShowingSampleData ? 'opacity-50 pointer-events-none' : ''}`}
                                  >
                                    <Edit3
                                      size={13}
                                      className="text-slate-500 dark:text-slate-400"
                                    />
                                    {t('myWork.dependencies.edit', 'Edit')}
                                  </button>
                                )}
                                {!readOnly && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleDuplicate(dep);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${isShowingSampleData ? 'opacity-50 pointer-events-none' : ''}`}
                                  >
                                    <Copy
                                      size={13}
                                      className="text-slate-500 dark:text-slate-400"
                                    />
                                    {t('myWork.dependencies.copy', 'Copy')}
                                  </button>
                                )}
                                {!readOnly && (
                                  <>
                                    <div className="my-1 border-t border-slate-200 dark:border-navy-700/50" />
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleRemove(dep);
                                      }}
                                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors ${isShowingSampleData ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                      <Trash2 size={13} />
                                      {t('myWork.dependencies.delete', 'Delete')}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Blocking warning ──────────────────── */}
              {visiblePredecessors.some(
                (d) => d.taskStatus !== 'done' && d.taskStatus !== 'cancelled'
              ) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {t(
                        'myWork.dependencies.thisTaskHasIncomplete',
                        'This task has incomplete predecessors — it may be blocked.'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Legend ─────────────────────────────── */}
              <div className="pt-2 border-t border-slate-200 dark:border-navy-700/50">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-1.5">
                  {t('myWork.dependencies.dependencyTypes', 'Dependency types:')}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map((dt) => (
                    <span
                      key={dt}
                      className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500"
                    >
                      <span className="font-mono font-medium text-slate-500 dark:text-slate-400">
                        {dt}
                      </span>{' '}
                      {isPolish ? DEP_TYPE_LABELS[dt].pl : DEP_TYPE_LABELS[dt].en}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Add / Edit Dependency Modal ──────────────────────────── */}
      <AnimatePresence>
        {addDirection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200 dark:border-navy-700/60"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700/70 bg-gradient-to-r from-indigo-50/40 via-white to-white dark:from-indigo-500/5 dark:via-navy-900 dark:to-navy-900">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      editingDependency
                        ? 'bg-amber-100 dark:bg-amber-500/15'
                        : 'bg-indigo-100 dark:bg-indigo-500/15'
                    }`}
                  >
                    {editingDependency ? (
                      <Edit3 size={16} className="text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Plus size={16} className="text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                      {editingDependency
                        ? t('myWork.dependencies.editDependency', 'Edit Dependency')
                        : t('myWork.dependencies.newDependency', 'New Dependency')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
                      {editingDependency
                        ? t(
                            'myWork.dependencies.modifySettingsForThis',
                            'Modify settings for this dependency'
                          )
                        : t(
                            'myWork.dependencies.configureAndSelectA',
                            'Configure and select a task to link'
                          )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Scrollable body ────────────────────── */}
              <div className="overflow-y-auto max-h-[calc(80vh-140px)]">
                {/* ── Section: Source task (initiative mode) ─── */}
                {!taskId && initiativeTasks.length > 0 && !editingDependency && (
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                      {t('myWork.dependencies.sourceTask', 'Source task')}
                    </label>
                    <select
                      value={selectedSourceTaskId || ''}
                      onChange={(e) => setSelectedSourceTaskId(e.target.value || null)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-200"
                    >
                      {initiativeTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title || t.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* ── Section: Linked Task (edit mode) ─── */}
                {editingDependency && (
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2 block">
                      {t('myWork.dependencies.linkedTask', 'Linked Task')}
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/30 px-3.5 py-2.5 group/card">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[editingDependency.taskStatus || 'todo']}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {editingDependency.taskTitle}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {buildArtifactCode(
                              'task',
                              editingDependency.taskIndexCode || editingDependency.taskId
                            )}
                          </span>
                          {editingDependency.taskStatus && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {isPolish
                                ? STATUS_LABELS[editingDependency.taskStatus]?.pl
                                : STATUS_LABELS[editingDependency.taskStatus]?.en}
                            </span>
                          )}
                          {editingDependency.taskPriority && (
                            <span
                              className={`text-[10px] font-medium ${PRIORITY_COLORS[editingDependency.taskPriority] || ''}`}
                            >
                              {editingDependency.taskPriority}
                            </span>
                          )}
                        </div>
                      </div>
                      {editingDependency.taskStatus === 'done' && (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                      {onOpenTask && (
                        <button
                          onClick={() => {
                            closeModal();
                            onOpenTask(editingDependency.taskId);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors opacity-60 group-hover/card:opacity-100"
                          title={t('myWork.dependencies.title4', 'Open task')}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Section: Direction ────────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2.5 block">
                    {t('myWork.dependencies.direction2', 'Direction')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAddDirection('predecessor')}
                      className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center ${
                        addDirection === 'predecessor'
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-sm shadow-blue-500/10'
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-800/50'
                      }`}
                    >
                      <ArrowDown
                        size={16}
                        className={
                          addDirection === 'predecessor'
                            ? 'text-blue-500'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      />
                      <span
                        className={`text-xs font-semibold ${addDirection === 'predecessor' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        {t('myWork.dependencies.predecessor2', 'Predecessor')}
                      </span>
                      <span
                        className={`text-[10px] leading-tight ${addDirection === 'predecessor' ? 'text-blue-500/70 dark:text-blue-400/60' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}
                      >
                        {t('myWork.dependencies.thisTaskDependsOn', 'This task depends on another')}
                      </span>
                    </button>
                    <button
                      onClick={() => setAddDirection('successor')}
                      className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center ${
                        addDirection === 'successor'
                          ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-sm shadow-amber-500/10'
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-800/50'
                      }`}
                    >
                      <ArrowUp
                        size={16}
                        className={
                          addDirection === 'successor'
                            ? 'text-amber-500'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      />
                      <span
                        className={`text-xs font-semibold ${addDirection === 'successor' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        {t('myWork.dependencies.successor2', 'Successor')}
                      </span>
                      <span
                        className={`text-[10px] leading-tight ${addDirection === 'successor' ? 'text-amber-500/70 dark:text-amber-400/60' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}
                      >
                        {t(
                          'myWork.dependencies.anotherTaskDependsOn',
                          'Another task depends on this'
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* ── Section: Relationship Type ───────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2.5 block">
                    {t('myWork.dependencies.relationshipType', 'Relationship Type')}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map((dt) => (
                      <button
                        key={dt}
                        onClick={() => setSelectedDepType(dt)}
                        className={`group relative px-2 py-2.5 rounded-xl text-center transition-all ${
                          selectedDepType === dt
                            ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/50'
                            : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700/50'
                        }`}
                      >
                        <span className="block text-sm font-mono font-bold">{dt}</span>
                        <span
                          className={`block text-[9px] leading-tight mt-1 ${
                            selectedDepType === dt
                              ? 'text-white/70'
                              : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {isPolish ? DEP_TYPE_LABELS[dt].pl : DEP_TYPE_LABELS[dt].en}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Type description */}
                  <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-800/30 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700/30">
                    {isPolish
                      ? DEP_TYPE_LABELS[selectedDepType].desc_pl
                      : DEP_TYPE_LABELS[selectedDepType].desc_en}
                  </p>
                </div>

                {/* ── Section: Lag / Lead ───────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2.5 block">
                    {t('myWork.dependencies.lagLead', 'Lag / Lead')}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLagDays((v) => Math.max(-90, v - 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        value={lagDays}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setLagDays(isNaN(val) ? 0 : Math.max(-90, Math.min(90, val)));
                        }}
                        className="w-20 px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 text-center font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => setLagDays((v) => Math.min(90, v + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                      {t('myWork.dependencies.days', 'days')}
                    </span>
                  </div>

                  {/* Lag visual feedback */}
                  <div
                    className={`mt-2.5 flex items-center gap-2 text-[11px] rounded-lg px-3 py-1.5 ${
                      lagDays > 0
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20'
                        : lagDays < 0
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20'
                          : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-navy-800/30 border border-slate-200 dark:border-navy-700/30'
                    }`}
                  >
                    <span>
                      {lagDays > 0
                        ? isPolish
                          ? `⏳ ${lagDays} ${lagDays === 1 ? 'dzień' : 'dni'} opóźnienia po zakończeniu`
                          : `⏳ ${lagDays} day${lagDays === 1 ? '' : 's'} delay after completion`
                        : lagDays < 0
                          ? isPolish
                            ? `⚡ ${Math.abs(lagDays)} ${Math.abs(lagDays) === 1 ? 'dzień' : 'dni'} wyprzedzenia (overlap)`
                            : `⚡ ${Math.abs(lagDays)} day${Math.abs(lagDays) === 1 ? '' : 's'} lead (overlap)`
                          : t(
                              'myWork.dependencies.noDelayTasksConnect',
                              '→ No delay — tasks connect directly'
                            )}
                    </span>
                  </div>

                  {Math.abs(lagDays) > 30 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500">
                      <AlertTriangle size={12} />
                      <span>
                        {t(
                          'myWork.dependencies.largeLagValueMake',
                          'Large lag value — make sure this is correct'
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Section: Notes ────────────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
                    <MessageSquare size={11} />
                    {t('myWork.dependencies.notes', 'Notes')}
                    <span className="text-[9px] font-normal text-slate-700 dark:text-slate-400 ml-1">
                      ({t('myWork.dependencies.optional', 'optional')})
                    </span>
                    <span className="ml-auto">
                      <AIFieldEnhancer
                        fieldKey="dependencies.notes"
                        sectionLabel={t('myWork.dependencies.sectionLabel', 'Dependency — notes')}
                        currentValue={noteText}
                        onApply={setNoteText}
                        artifactContext={{
                          type: taskId ? 'task' : 'initiative',
                          title: editingDependency?.taskTitle || 'dependency',
                          status: editingDependency?.taskStatus || '',
                          priority: editingDependency?.taskPriority || '',
                        }}
                        iconOnly
                        outputFormat="paragraph"
                      />
                    </span>
                  </label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={t(
                      'myWork.dependencies.addContextConditionsOr',
                      'Add context, conditions, or notes about this dependency...'
                    )}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 transition-all resize-none"
                  />
                </div>

                {/* ── Section: Find Task (add mode) ────── */}
                {!editingDependency && (
                  <div className="px-6 py-4">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-2.5 block">
                      {t('myWork.dependencies.selectTask', 'Select Task')}
                    </label>
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder={t(
                          'myWork.dependencies.typeTaskNameTo',
                          'Type task name to search...'
                        )}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 transition-all"
                        autoFocus
                      />
                    </div>

                    {/* Search loading */}
                    {isSearching && (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="mt-3 max-h-48 overflow-y-auto space-y-0.5 rounded-xl border border-slate-200 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-800/20 p-1.5">
                        {searchResults.map((task) => {
                          const code = buildArtifactCode('task', task.id);
                          const isAdding = addingTaskId === task.id;
                          return (
                            <button
                              key={task.id}
                              onClick={() => handleAddDependency(task)}
                              disabled={isAdding}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white dark:hover:bg-navy-800 transition-colors text-left disabled:opacity-50 group"
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[task.status || 'todo']}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    {code}
                                  </span>
                                  {task.priority && (
                                    <span
                                      className={`text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || ''}`}
                                    >
                                      {task.priority}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                  {task.title}
                                </p>
                                {task.initiativeName && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {task.initiativeName}
                                  </p>
                                )}
                              </div>
                              {isAdding ? (
                                <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Plus size={14} className="text-indigo-500" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* No results */}
                    {searchQuery && searchResults.length === 0 && !isSearching && (
                      <div className="mt-4 text-center py-4">
                        <Search
                          size={20}
                          className="mx-auto text-slate-700 dark:text-slate-400 mb-2"
                        />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t('myWork.dependencies.noTasksFound', 'No tasks found')}
                        </p>
                        <p className="text-[11px] text-slate-700 dark:text-slate-400 mt-0.5">
                          {t(
                            'myWork.dependencies.tryADifferentSearch',
                            'Try a different search term'
                          )}
                        </p>
                      </div>
                    )}

                    {/* Empty state */}
                    {!searchQuery && searchResults.length === 0 && !isSearching && (
                      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 py-2">
                        {t(
                          'myWork.dependencies.startTypingToSearch',
                          'Start typing to search for a task to link'
                        )}
                      </p>
                    )}

                    {/* Connected tasks quick-add */}
                    {availableConnectedTasks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            {t('myWork.dependencies.connectedTasks', 'Connected Tasks')}
                          </span>
                          <span className="text-[10px] text-slate-700 dark:text-slate-400">
                            {t('myWork.dependencies.quickAdd', 'quick add')}
                          </span>
                        </div>
                        <div className="space-y-0.5 rounded-xl border border-slate-200 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-800/20 p-1.5">
                          {availableConnectedTasks.slice(0, 6).map((task) => (
                            <button
                              key={`linked-${task.id}`}
                              onClick={() =>
                                handleAddDependency({
                                  id: task.id,
                                  title: task.title,
                                  status: task.status || 'todo',
                                  priority: task.priority || 'medium',
                                })
                              }
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-navy-800 transition-colors text-left group"
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[task.status || 'todo'] || 'bg-slate-400'}`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                  {task.title}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {buildArtifactCode('task', task.id)}
                                </p>
                              </div>
                              <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Plus size={14} className="text-indigo-500" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Footer (edit mode) ─────────────────── */}
              {editingDependency && (
                <div className="px-6 py-3.5 border-t border-slate-200 dark:border-navy-700/70 bg-slate-50/30 dark:bg-navy-800/20 flex items-center justify-between">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t(
                      'myWork.dependencies.changesWillBeSaved',
                      'Changes will be saved immediately'
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      {t('myWork.dependencies.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleEditDependency}
                      className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-all hover:shadow-md hover:shadow-indigo-500/25"
                    >
                      {t('myWork.dependencies.saveChanges', 'Save Changes')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DependenciesSection;
