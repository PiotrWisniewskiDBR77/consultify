import {
  Bot,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Flower2,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquarePlus,
  Minus,
  Network,
  PenTool,
  Plus,
  Rocket,
  Sparkles,
  Sprout,
  Square,
  Star,
  Table2,
  Tag,
  Trash2,
  TreePine,
  User,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';

export type IdeaStage = 'spark' | 'incubating' | 'shaping' | 'ready' | 'promoted';

export type MyIdea = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  sourceType?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  stage?: IdeaStage;
  potential?: string | null;
  complexity?: string | null;
  aiExpansion?: string | null;
  promotedTo?: string | null;
  area?: string | null;
  priority?: number | null;
  branch?: string | null;
  mapItems?: number | null;
  mapNodes?: number | null;
  mapEdges?: number | null;
  openMap?: boolean;
  preferredTool?: string | null;
};

export type IdeasViewMode = 'list' | 'cards' | 'garden';

export type IdeasBulkBarPayload = {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  selectAllVisible: () => void;
  clearSelection: () => void;
  convert: () => void;
  tag: () => void;
  deleteSelected: () => void;
};

interface MyIdeasListContentProps {
  viewMode?: IdeasViewMode;
  searchQuery: string;
  stageFilter?: IdeaStage | 'all';
  onIdeaClick: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea: () => void;
  onCountsChange: (counts: {
    total: number;
    spark: number;
    incubating: number;
    shaping: number;
    ready: number;
    promoted: number;
  }) => void;
  onBulkBarChange?: (payload: IdeasBulkBarPayload | null) => void;
  refreshTrigger?: number;
}

const STAGE_CONFIG: Record<
  IdeaStage,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  spark: {
    icon: Lightbulb,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-400/30 dark:border-amber-500/20',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  incubating: {
    icon: Sprout,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    borderColor: 'border-emerald-400/30 dark:border-emerald-500/20',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
  },
  shaping: {
    icon: TreePine,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    borderColor: 'border-blue-400/30 dark:border-blue-500/20',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
  },
  ready: {
    icon: CheckCircle2,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/15',
    borderColor: 'border-purple-400/30 dark:border-purple-500/20',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
  },
  promoted: {
    icon: Rocket,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/15',
    borderColor: 'border-rose-400/30 dark:border-rose-500/20',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-600 dark:text-rose-400',
  },
};

const TOOL_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    labelPl: string;
  }
> = {
  mindmap: {
    icon: Network,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10 dark:bg-violet-500/15',
    borderColor: 'border-violet-400/30',
    label: 'Mind Map',
    labelPl: 'Mind Map',
  },
  table: {
    icon: Table2,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10 dark:bg-sky-500/15',
    borderColor: 'border-sky-400/30',
    label: 'Table',
    labelPl: 'Tabela',
  },
  process_flow: {
    icon: Workflow,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    borderColor: 'border-emerald-400/30',
    label: 'Process Flow',
    labelPl: 'Proces',
  },
  whiteboard: {
    icon: PenTool,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-400/30',
    label: 'Whiteboard',
    labelPl: 'Whiteboard',
  },
};

function getToolConfig(tool?: string | null) {
  const t = String(tool || '').toLowerCase();
  return TOOL_CONFIG[t] || TOOL_CONFIG.mindmap;
}

function mapRawStageToStage(raw?: string | null): IdeaStage {
  if (!raw) return 'spark';
  const s = raw.toLowerCase();
  if (s === 'done' || s === 'summary' || s === 'shaping') return 'shaping';
  if (s === 'expanding' || s === 'researching' || s === 'proposing' || s === 'incubating')
    return 'incubating';
  if (s === 'ready') return 'ready';
  if (s === 'promoted') return 'promoted';
  return 'spark';
}

type SortField = 'title' | 'stage' | 'tool' | 'date' | 'tags';
type SortDir = 'asc' | 'desc';

export const MyIdeasListContent: React.FC<MyIdeasListContentProps> = ({
  viewMode = 'list',
  searchQuery,
  stageFilter = 'all',
  onIdeaClick,
  onCreateIdea,
  onCountsChange,
  onBulkBarChange,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  // activeTag is only used in the Tags (garden) view
  const [activeTag, setActiveTag] = useState<string>('all');
  const [convertIdea, setConvertIdea] = useState<MyIdea | null>(null);
  const [converting, setConverting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [mapMetrics, setMapMetrics] = useState<
    Record<string, { items: number; nodes: number; edges: number }>
  >({});
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getMyIdeas({ q: searchQuery || undefined, limit: 200 });
      const mapped = ((data || []) as any[]).map((raw) => ({
        ...raw,
        stage: mapRawStageToStage(raw.stage),
      }));
      setIdeas(mapped as MyIdea[]);

      try {
        const ids = mapped.map((i) => String(i?.id || '')).filter(Boolean);
        const res = await Api.getMyIdeaMapMetrics(ids);
        const metrics = res?.metrics && typeof res.metrics === 'object' ? res.metrics : {};
        const next: Record<string, { items: number; nodes: number; edges: number }> = {};
        for (const id of ids) {
          const m = metrics[id];
          const nodes = Number(m?.nodes || 0);
          const edges = Number(m?.edges || 0);
          next[id] = { nodes, edges, items: Number(m?.items || nodes + edges) };
        }
        setMapMetrics(next);
      } catch {
        setMapMetrics({});
      }
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas, refreshTrigger]);

  useEffect(() => {
    const counts = {
      total: ideas.length,
      spark: 0,
      incubating: 0,
      shaping: 0,
      ready: 0,
      promoted: 0,
    };
    for (const idea of ideas) {
      const s = (idea.stage || 'spark') as IdeaStage;
      if (s in counts) counts[s]++;
    }
    onCountsChange(counts);
  }, [ideas, onCountsChange]);

  const filteredIdeas = useMemo(() => {
    let list = ideas;
    if (viewMode !== 'garden' && stageFilter !== 'all') {
      list = list.filter((i) => (i.stage || 'spark') === stageFilter);
    }
    if (viewMode === 'garden' && activeTag !== 'all') {
      list = list.filter((i) =>
        (i.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag)
      );
    }
    return list;
  }, [ideas, stageFilter, activeTag, viewMode]);

  const sortedIdeas = useMemo(() => {
    const list = [...filteredIdeas];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'stage': {
          const order: Record<string, number> = {
            spark: 0,
            incubating: 1,
            shaping: 2,
            ready: 3,
            promoted: 4,
          };
          cmp = (order[a.stage || 'spark'] || 0) - (order[b.stage || 'spark'] || 0);
          break;
        }
        case 'tool':
          cmp = (a.preferredTool || 'mindmap').localeCompare(b.preferredTool || 'mindmap');
          break;
        case 'tags':
          cmp = ((a.tags || [])[0] || '').localeCompare((b.tags || [])[0] || '');
          break;
        case 'date':
        default: {
          const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
          cmp = ta - tb;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [filteredIdeas, sortField, sortDir]);

  const visibleIdeaIds = useMemo(() => new Set(sortedIdeas.map((i) => i.id)), [sortedIdeas]);

  useEffect(() => {
    if (sortedIdeas.length === 0) {
      setFocusedIndex(-1);
      return;
    }
    setFocusedIndex((idx) => {
      if (idx < 0) return 0;
      if (idx >= sortedIdeas.length) return sortedIdeas.length - 1;
      return idx;
    });
  }, [sortedIdeas.length]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIdeaIds.has(id)) next.add(id);
      return next;
    });
  }, [visibleIdeaIds]);

  const focusedIdea = useMemo(() => {
    if (focusedIndex < 0 || focusedIndex >= sortedIdeas.length) return null;
    return sortedIdeas[focusedIndex] || null;
  }, [focusedIndex, sortedIdeas]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(sortedIdeas.map((i) => i.id)));
  }, [sortedIdeas]);

  const allSelected = sortedIdeas.length > 0 && selectedIds.size === sortedIdeas.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const openFocusedIdea = useCallback(() => {
    if (!focusedIdea) return;
    onIdeaClick(focusedIdea.id, focusedIdea);
  }, [focusedIdea, onIdeaClick]);

  const openConvertForSelection = useCallback(() => {
    if (selectedIds.size === 0 && focusedIdea) {
      setConvertIdea(focusedIdea);
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const first = sortedIdeas.find((i) => i.id === firstId) || focusedIdea;
    if (first) setConvertIdea(first);
  }, [focusedIdea, selectedIds, sortedIdeas]);

  const bulkAddTag = useCallback(async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkBusy(true);
    try {
      await Promise.all(
        ids.map(async (id) => {
          const idea = ideas.find((i) => i.id === id);
          const nextTags = Array.from(new Set([...(idea?.tags || []).map((x) => String(x)), tag]));
          await Api.updateMyIdea(id, { tags: nextTags });
        })
      );
      trackFunnelEvent('idea_triaged', { action: 'tag', count: ids.length, tag });
      trackFunnelEvent('idea_bulk_tag_added', { count: ids.length, tag });
      toast.success(
        isPolish ? `Dodano tag do ${ids.length} pomysłów` : `Added tag to ${ids.length} ideas`
      );
      setTagModalOpen(false);
      setTagInput('');
      clearSelection();
      await fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
    } finally {
      setBulkBusy(false);
    }
  }, [tagInput, selectedIds, ideas, fetchIdeas, clearSelection, isPolish]);

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await showConfirm({
      title: isPolish ? 'Usunąć zaznaczone pomysły?' : 'Delete selected ideas?',
      description: isPolish
        ? `${ids.length} pomysłów zostanie trwale usuniętych.`
        : `${ids.length} idea(s) will be permanently deleted.`,
      confirmLabel: isPolish ? 'Usuń' : 'Delete',
      cancelLabel: isPolish ? 'Anuluj' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => Api.deleteMyIdea(id)));
      trackFunnelEvent('idea_triaged', { action: 'delete', count: ids.length });
      trackFunnelEvent('idea_bulk_deleted', { count: ids.length });
      toast.success(isPolish ? 'Usunięto' : 'Deleted');
      clearSelection();
      await fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, showConfirm, fetchIdeas, clearSelection, isPolish]);

  useEffect(() => {
    if (!onBulkBarChange) return;
    if (selectedIds.size === 0) {
      onBulkBarChange(null);
      return;
    }
    onBulkBarChange({
      selectedCount: selectedIds.size,
      allSelected,
      someSelected,
      selectAllVisible,
      clearSelection,
      convert: openConvertForSelection,
      tag: () => setTagModalOpen(true),
      deleteSelected: bulkDelete,
    });
  }, [
    selectedIds.size,
    allSelected,
    someSelected,
    onBulkBarChange,
    selectAllVisible,
    clearSelection,
    openConvertForSelection,
    bulkDelete,
  ]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    enabled: true,
    onNavigateDown: () => setFocusedIndex((i) => Math.min(sortedIdeas.length - 1, i + 1)),
    onNavigateUp: () => setFocusedIndex((i) => Math.max(0, i - 1)),
    onNavigateFirst: () => setFocusedIndex(sortedIdeas.length ? 0 : -1),
    onNavigateLast: () => setFocusedIndex(sortedIdeas.length ? sortedIdeas.length - 1 : -1),
    onNew: onCreateIdea,
    onOpen: openFocusedIdea,
    onToggleSelection: () => {
      if (!focusedIdea) return;
      toggleSelect(focusedIdea.id);
    },
    onSelectAll: selectAllVisible,
    onClearSelection: clearSelection,
    onSearch: () => {
      window.dispatchEvent(new CustomEvent('mywork-focus-search'));
    },
    onCancel: () => {
      if (selectedIds.size > 0) {
        clearSelection();
        return;
      }
      if (convertIdea) {
        setConvertIdea(null);
        return;
      }
      if (tagModalOpen) {
        setTagModalOpen(false);
        return;
      }
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      const isEditable = target?.isContentEditable;
      if (isInput || isEditable) return;

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onCreateIdea();
      }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openFocusedIdea();
      }
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openConvertForSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCreateIdea, openConvertForSelection, openFocusedIdea]);

  const handleConvert = useCallback(
    async (target: 'initiative' | 'task_set' | 'decision' | 'team_chat') => {
      if (!convertIdea?.id) return;
      try {
        setConverting(true);
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const result = await Api.convertMyIdea(convertIdea.id, {
          target,
          options: { language: i18n.language },
        });
        trackFunnelEvent(`idea_converted_${target}`, {
          ideaId: convertIdea.id,
          surface: 'ideas-list',
        });
        trackFunnelEvent('mywork_convert_completed', {
          from: 'idea',
          toType: target,
          has_source: Boolean(result?.sourceSessionId),
        });
        if (result?.sourceSessionId) {
          trackFunnelEvent('mywork_session_materialized', {
            source: 'idea_convert',
            sourceEntityId: convertIdea.id,
            target,
            sessionId: result.sourceSessionId,
          });
        }
        toast.success(isPolish ? 'Gotowe' : 'Done');
        setConvertIdea(null);
        await fetchIdeas();
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
      } finally {
        setConverting(false);
      }
    },
    [convertIdea?.id, fetchIdeas, i18n.language, isPolish]
  );

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'date' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  const toggleTagCollapse = useCallback((tag: string) => {
    setCollapsedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  // ── Shared renderers ──

  const renderStageBadge = (stage: IdeaStage) => {
    const cfg = STAGE_CONFIG[stage];
    const Icon = cfg.icon;
    const labels: Record<IdeaStage, { en: string; pl: string }> = {
      spark: { en: 'Spark', pl: 'Iskra' },
      incubating: { en: 'Growing', pl: 'Rośnie' },
      shaping: { en: 'Shaping', pl: 'Kształtuje się' },
      ready: { en: 'Ready', pl: 'Gotowy' },
      promoted: { en: 'Promoted', pl: 'Promowany' },
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
      >
        <Icon size={10} />
        {isPolish ? labels[stage].pl : labels[stage].en}
      </span>
    );
  };

  const renderToolBadge = (tool?: string | null) => {
    const tc = getToolConfig(tool);
    const Icon = tc.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tc.bgColor} ${tc.color}`}
      >
        <Icon size={10} />
        {isPolish ? tc.labelPl : tc.label}
      </span>
    );
  };

  const renderTagBadges = (ideaTags?: string[], max = 3) => {
    if (!ideaTags || ideaTags.length === 0) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {ideaTags.slice(0, max).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700"
          >
            {tag}
          </span>
        ))}
        {ideaTags.length > max && (
          <span className="text-[9px] text-slate-400">+{ideaTags.length - max}</span>
        )}
      </div>
    );
  };

  const tagGroups = useMemo(() => {
    const groups: Record<string, MyIdea[]> = {};
    const untagged: MyIdea[] = [];

    for (const idea of sortedIdeas) {
      const ideaTags = (idea.tags || []).map((t) => String(t).toLowerCase());
      if (ideaTags.length === 0) {
        untagged.push(idea);
      } else {
        for (const tag of ideaTags) {
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(idea);
        }
      }
    }

    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    if (untagged.length > 0) {
      sorted.push([isPolish ? 'Bez tagów' : 'Untagged', untagged]);
    }
    return sorted;
  }, [sortedIdeas, isPolish]);

  // ── Loading ──

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ minHeight: 300 }}>
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // ── Convert modal ──

  const convertModal = convertIdea ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => !converting && setConvertIdea(null)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-navy-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-500" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Konwertuj pomysł' : 'Convert idea'}
            </div>
          </div>
          <button
            onClick={() => setConvertIdea(null)}
            disabled={converting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">{convertIdea.title}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                target: 'initiative' as const,
                icon: Rocket,
                color: 'text-amber-500',
                label: isPolish ? 'Inicjatywa' : 'Initiative',
                desc: isPolish ? 'Utwórz inicjatywę w PMO' : 'Create a PMO initiative',
              },
              {
                target: 'task_set' as const,
                icon: CheckCircle2,
                color: 'text-emerald-500',
                label: isPolish ? 'Taski' : 'Tasks',
                desc: isPolish ? 'Z next steps (jeśli są)' : 'From next steps (if available)',
              },
              {
                target: 'decision' as const,
                icon: Star,
                color: 'text-blue-500',
                label: isPolish ? 'Decyzja' : 'Decision',
                desc: isPolish ? 'Artefakt decyzyjny' : 'Decision artifact',
              },
              {
                target: 'team_chat' as const,
                icon: MessageSquarePlus,
                color: 'text-purple-500',
                label: isPolish ? 'Team Chat' : 'Team Chat',
                desc: isPolish ? 'Wątek do omówienia' : 'Discussion thread',
              },
            ].map(({ target, icon: Icon, color, label, desc }) => (
              <button
                key={target}
                onClick={() => handleConvert(target)}
                disabled={converting}
                className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <Icon size={16} className={color} />
                  {label}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={() => setConvertIdea(null)}
            disabled={converting}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {isPolish ? 'Zamknij' : 'Close'}
          </button>
          {converting && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              {isPolish ? 'Tworzę…' : 'Creating…'}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  // ── Tag modal ──

  const tagModal = tagModalOpen ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => !bulkBusy && setTagModalOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-navy-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-amber-500" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Dodaj tag' : 'Add tag'}
            </div>
          </div>
          <button
            onClick={() => setTagModalOpen(false)}
            disabled={bulkBusy}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? `Zostanie dodany do ${selectedIds.size} pomysłów`
              : `Will be added to ${selectedIds.size} ideas`}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={isPolish ? 'np. backlog' : 'e.g. backlog'}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={() => setTagModalOpen(false)}
            disabled={bulkBusy}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={bulkAddTag}
            disabled={bulkBusy || !tagInput.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {bulkBusy && <Loader2 size={14} className="animate-spin" />}
            {isPolish ? 'Dodaj' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Empty state ──

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
      <div className="relative mb-4">
        <Flower2 size={48} className="text-amber-400" />
        <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-500 animate-pulse" />
      </div>
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
        {isPolish ? 'Twój ogród pomysłów czeka' : 'Your Idea Garden awaits'}
      </h3>
      <p className="text-sm text-slate-500 mb-4 max-w-md">
        {isPolish
          ? 'Zasiej pierwszy pomysł — AI pomoże go rozwinąć, zbada kontekst i zaproponuje kreatywne warianty.'
          : 'Plant your first idea — AI will help it grow, research context, and propose creative variants.'}
      </p>
      <button
        onClick={onCreateIdea}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
      >
        <Plus size={16} />
        {isPolish ? 'Zasiej pomysł' : 'Plant an idea'}
      </button>
    </div>
  );

  // ── Sort indicator ──

  const SortIndicator: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return (
      <ChevronDown
        size={10}
        className={`ml-0.5 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`}
      />
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW (Inbox-style table) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (viewMode === 'list') {
    if (sortedIdeas.length === 0) {
      return (
        <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950 p-4">
          {convertModal}
          {tagModal}
          {confirmDialog}
          <div className="mt-4">{renderEmpty()}</div>
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        {convertModal}
        {tagModal}
        {confirmDialog}

        <div className="overflow-x-auto">
          <table className="w-full table-fixed" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                <th className="w-10 px-2 py-2">
                  <button
                    onClick={() => {
                      if (allSelected) clearSelection();
                      else selectAllVisible();
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      allSelected
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : someSelected
                          ? 'bg-primary-500/50 border-primary-500 text-white'
                          : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
                    }`}
                  >
                    {allSelected ? (
                      <CheckSquare size={14} />
                    ) : someSelected ? (
                      <Minus size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 w-[40%]"
                  onClick={() => handleSort('title')}
                >
                  <span className="inline-flex items-center">
                    {isPolish ? 'Tytuł' : 'Title'}
                    <SortIndicator field="title" />
                  </span>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 w-[12%]"
                  onClick={() => handleSort('stage')}
                >
                  <span className="inline-flex items-center">
                    {isPolish ? 'Etap' : 'Stage'}
                    <SortIndicator field="stage" />
                  </span>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[15%]">
                  {isPolish ? 'Tagi' : 'Tags'}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 w-[12%]"
                  onClick={() => handleSort('tool')}
                >
                  <span className="inline-flex items-center">
                    {isPolish ? 'Narzędzie' : 'Tool'}
                    <SortIndicator field="tool" />
                  </span>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 w-[11%]"
                  onClick={() => handleSort('date')}
                >
                  <span className="inline-flex items-center">
                    {isPolish ? 'Data' : 'Date'}
                    <SortIndicator field="date" />
                  </span>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-[10%]" />
              </tr>
            </thead>
            <tbody>
              {sortedIdeas.map((idea, idx) => {
                const stage = (idea.stage || 'spark') as IdeaStage;
                const tc = getToolConfig(idea.preferredTool);
                const isFocused = focusedIndex === idx;
                const isSelected = selectedIds.has(idea.id);

                return (
                  <tr
                    key={idea.id}
                    onClick={() => onIdeaClick(idea.id, idea)}
                    className={`border-b border-slate-100 dark:border-navy-800/50 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-navy-800/40 ${
                      isSelected
                        ? 'bg-primary-50/50 dark:bg-primary-900/10'
                        : isFocused
                          ? 'bg-amber-50/30 dark:bg-amber-900/5'
                          : ''
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(idea.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-500 focus:ring-primary-500/30"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {idea.title}
                      </div>
                      {idea.body && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {idea.body}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{renderStageBadge(stage)}</td>
                    <td className="px-3 py-2.5">{renderTagBadges(idea.tags)}</td>
                    <td className="px-3 py-2.5">{renderToolBadge(idea.preferredTool)}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {idea.updatedAt
                        ? new Date(idea.updatedAt).toLocaleDateString()
                        : idea.createdAt
                          ? new Date(idea.createdAt).toLocaleDateString()
                          : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setConvertIdea(idea)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold hover:bg-purple-500/15 transition-colors"
                          title={isPolish ? 'Konwertuj' : 'Convert'}
                        >
                          <Sparkles size={10} />
                          {isPolish ? 'Konwertuj' : 'Convert'}
                        </button>
                        <ConvertToOutputMenu
                          sourceType="idea"
                          sourceId={idea.id}
                          sourceTitle={idea.title || ''}
                          onConvertComplete={() => fetchIdeas()}
                          variant="dropdown"
                          className="shrink-0"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── CARDS VIEW (tool-colored cards) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (viewMode === 'cards') {
    if (sortedIdeas.length === 0) {
      return (
        <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950 p-4">
          {convertModal}
          {tagModal}
          <div className="mt-4">{renderEmpty()}</div>
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        {convertModal}
        {tagModal}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedIdeas.map((idea) => {
              const stage = (idea.stage || 'spark') as IdeaStage;
              const tc = getToolConfig(idea.preferredTool);
              const ToolIcon = tc.icon;
              const isSelected = selectedIds.has(idea.id);

              return (
                <div
                  key={idea.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onIdeaClick(idea.id, idea)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onIdeaClick(idea.id, idea);
                    }
                  }}
                  className={[
                    'group relative text-left overflow-hidden',
                    'p-4 rounded-xl',
                    `border-l-[3px] border ${tc.borderColor} border-slate-200/60 dark:border-white/[0.06]`,
                    'bg-slate-50/80 dark:bg-navy-800/60',
                    'hover:bg-white dark:hover:bg-navy-800/80 hover:shadow-md transition-all duration-150',
                    isSelected ? 'ring-2 ring-primary-500/40' : '',
                  ].join(' ')}
                >
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(idea.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-500 focus:ring-primary-500/30"
                    />
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`flex-shrink-0 p-2 rounded-xl ${tc.bgColor} group-hover:scale-110 transition-transform`}
                    >
                      <ToolIcon size={20} className={tc.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {idea.title}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {renderStageBadge(stage)}
                        {renderToolBadge(idea.preferredTool)}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {idea.updatedAt
                            ? new Date(idea.updatedAt).toLocaleDateString()
                            : idea.createdAt
                              ? new Date(idea.createdAt).toLocaleDateString()
                              : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {idea.body && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-2">
                      {idea.body}
                    </div>
                  )}

                  {(idea.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(idea.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={`${idea.id}-${tag}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/20 dark:border-amber-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {(idea.tags || []).length > 4 && (
                        <span className="text-[10px] text-slate-500">
                          +{(idea.tags || []).length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setConvertIdea(idea)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-semibold hover:bg-purple-500/15 transition-colors"
                    >
                      <Sparkles size={12} />
                      {isPolish ? 'Konwertuj' : 'Convert'}
                    </button>
                    <ConvertToOutputMenu
                      sourceType="idea"
                      sourceId={idea.id}
                      sourceTitle={idea.title || ''}
                      onConvertComplete={() => fetchIdeas()}
                      variant="dropdown"
                      className="shrink-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── TAGS VIEW (grouped by AI tags, collapsible sections) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (sortedIdeas.length === 0) {
    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950 p-4">
        {convertModal}
        {tagModal}
        {renderEmpty()}
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
      {convertModal}
      {tagModal}
      {confirmDialog}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-violet-400/20 dark:from-amber-500/15 dark:to-violet-500/15">
            <Tag size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Pomysły wg tagów' : 'Ideas by Tags'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isPolish
                ? `${tagGroups.length} grup · ${sortedIdeas.length} pomysłów`
                : `${tagGroups.length} groups · ${sortedIdeas.length} ideas`}
            </p>
          </div>
        </div>

        {tagGroups.map(([tag, groupIdeas]) => {
          const isCollapsed = collapsedTags.has(tag);
          return (
            <div
              key={tag}
              className="rounded-xl border border-slate-200/60 dark:border-navy-700/50 overflow-hidden"
            >
              <button
                onClick={() => toggleTagCollapse(tag)}
                className="w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50/80 dark:bg-navy-900/50 hover:bg-slate-100/80 dark:hover:bg-navy-800/50 transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-slate-400" />
                ) : (
                  <ChevronDown size={14} className="text-slate-400" />
                )}
                <Tag size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {tag}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {groupIdeas.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-slate-100 dark:divide-navy-800/50">
                  {groupIdeas.map((idea) => {
                    const stage = (idea.stage || 'spark') as IdeaStage;
                    const tc = getToolConfig(idea.preferredTool);
                    const ToolIcon = tc.icon;

                    return (
                      <div
                        key={`${tag}-${idea.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onIdeaClick(idea.id, idea)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onIdeaClick(idea.id, idea);
                          }
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-navy-800/30 cursor-pointer transition-colors"
                      >
                        <div className={`flex-shrink-0 p-1.5 rounded-lg ${tc.bgColor}`}>
                          <ToolIcon size={14} className={tc.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {idea.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {renderStageBadge(stage)}
                          {renderToolBadge(idea.preferredTool)}
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {idea.updatedAt
                              ? new Date(idea.updatedAt).toLocaleDateString()
                              : idea.createdAt
                                ? new Date(idea.createdAt).toLocaleDateString()
                                : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default MyIdeasListContent;
