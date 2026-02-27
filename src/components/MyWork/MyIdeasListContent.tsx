import {
  Bot,
  CheckCircle2,
  Flower2,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquarePlus,
  Plus,
  Rocket,
  Sparkles,
  Sprout,
  Star,
  Tag,
  Trash2,
  TreePine,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type BulkAction, BulkActionBar } from '@/components/ui/ResizableTable';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';

const IdeasMindMap = React.lazy(() => import('./IdeasMindMap'));

class MindMapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

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
  mapItems?: number | null; // nodes+edges
  mapNodes?: number | null;
  mapEdges?: number | null;
  openMap?: boolean;
};

export type IdeasViewMode =
  | 'select'
  | 'overview'
  | 'blank'
  // legacy modes (kept for compatibility / future re-enable)
  | 'list'
  | 'cards'
  | 'garden'
  | 'mindmap';

interface MyIdeasListContentProps {
  viewMode?: IdeasViewMode;
  searchQuery: string;
  onIdeaClick: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea: () => void;
  onCountsChange: (counts: { total: number }) => void;
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

function mapRawStageToStage(raw?: string | null): IdeaStage {
  if (!raw) return 'spark';
  const s = raw.toLowerCase();
  if (s === 'done' || s === 'summary' || s === 'shaping') return 'shaping';
  if (s === 'expanding' || s === 'researching' || s === 'proposing' || s === 'incubating')
    return 'incubating';
  if (s === 'ready') return 'ready';
  if (s === 'promoted') return 'promoted';
  if (s === 'seed' || s === 'spark') return 'spark';
  return 'spark';
}

export const MyIdeasListContent: React.FC<MyIdeasListContentProps> = ({
  viewMode = 'select',
  searchQuery,
  onIdeaClick,
  onCreateIdea,
  onCountsChange,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>('all');
  const [activeArea, setActiveArea] = useState<string>('all');
  const [inboxOnly, setInboxOnly] = useState(false);
  const [convertIdea, setConvertIdea] = useState<MyIdea | null>(null);
  const [converting, setConverting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [creatingBlankMap, setCreatingBlankMap] = useState(false);
  const [mapMetrics, setMapMetrics] = useState<
    Record<string, { items: number; nodes: number; edges: number }>
  >({});
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();

  const effectiveViewMode = useMemo<IdeasViewMode>(() => {
    if (viewMode === 'select') return 'list';
    if (viewMode === 'overview') return 'cards';
    return viewMode;
  }, [viewMode]);

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getMyIdeas({ q: searchQuery || undefined, limit: 200 });
      const mapped = ((data || []) as any[]).map((raw) => ({
        ...raw,
        stage: mapRawStageToStage(raw.stage),
      }));
      setIdeas(mapped as MyIdea[]);

      // Fetch map counts (nodes+edges) for visible ideas to turn list into a "map catalog".
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
        // best-effort
        setMapMetrics({});
      }
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t]);

  const renderMapBadge = (ideaId: string) => {
    const m = mapMetrics[String(ideaId)] || null;
    if (!m) return null;
    const items = Number(m.items || 0);
    const label = isPolish ? 'Mapa' : 'Map';
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-500/10 text-slate-500 dark:text-slate-400"
        title={isPolish ? `Elementy mapy: ${items}` : `Map items: ${items}`}
      >
        <Link2 size={9} />
        {label} {items}
      </span>
    );
  };

  const renderBushBadge = (branch?: string | null) => {
    const b = String(branch || '').trim();
    if (!b) return null;
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
        title={isPolish ? 'Bush / gałąź' : 'Bush / branch'}
      >
        <GitBranch size={9} />
        {b}
      </span>
    );
  };

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas, refreshTrigger]);

  useEffect(() => {
    onCountsChange({ total: ideas.length });
  }, [ideas.length, onCountsChange]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    ideas.forEach((i) => (i.tags || []).forEach((tag) => s.add(String(tag).toLowerCase())));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const areas = useMemo(() => {
    const s = new Set<string>();
    ideas.forEach((i) => {
      const a = String(i.area || '').trim();
      if (a) s.add(a);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const inboxIdeas = useMemo(() => {
    return (ideas || []).filter((i) => {
      const src = String(i.sourceType || '').toLowerCase();
      const isIntakeSrc = src === 'chat' || src === 'signal';
      return isIntakeSrc && (i.stage || 'spark') === 'spark';
    });
  }, [ideas]);

  const inboxCount = inboxIdeas.length;

  const filteredIdeas = useMemo(() => {
    const base = inboxOnly ? inboxIdeas : ideas;
    let out = base;
    if (activeTag !== 'all') {
      out = out.filter((i) =>
        (i.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag)
      );
    }
    if (activeArea !== 'all') {
      const k = activeArea.toLowerCase();
      out = out.filter(
        (i) =>
          String(i.area || '')
            .trim()
            .toLowerCase() === k
      );
    }
    return out;
  }, [ideas, inboxIdeas, inboxOnly, activeArea, activeTag]);

  const sortedIdeas = useMemo(() => {
    const list = [...(filteredIdeas || [])];
    if (!inboxOnly) return list;
    // Inbox: newest first (faster triage)
    return list.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [filteredIdeas, inboxOnly]);

  const visibleIdeaIds = useMemo(() => new Set(sortedIdeas.map((i) => i.id)), [sortedIdeas]);

  useEffect(() => {
    // Keep focused index valid when list changes
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
    // Drop selected ids that are no longer visible in current filter mode
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

  const openFocusedIdea = useCallback(() => {
    if (!focusedIdea) return;
    onIdeaClick(focusedIdea.id, focusedIdea);
  }, [focusedIdea, onIdeaClick]);

  const openConvertForSelection = useCallback(() => {
    if (selectedIds.size === 0 && focusedIdea) {
      setConvertIdea(focusedIdea);
      return;
    }
    // If multi-select, convert sequentially starting from first selected (modal is single-idea UI)
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

  const bulkActions: BulkAction[] = useMemo(
    () => [
      {
        id: 'convert',
        label: isPolish ? 'Konwertuj' : 'Convert',
        icon: <Sparkles size={16} />,
        onClick: openConvertForSelection,
        disabled: bulkBusy,
      },
      {
        id: 'tag',
        label: isPolish ? 'Taguj' : 'Tag',
        icon: <Tag size={16} />,
        onClick: () => setTagModalOpen(true),
        disabled: bulkBusy,
      },
      {
        id: 'delete',
        label: isPolish ? 'Usuń' : 'Delete',
        icon: <Trash2 size={16} />,
        onClick: bulkDelete,
        variant: 'danger',
        disabled: bulkBusy,
      },
    ],
    [bulkBusy, bulkDelete, isPolish, openConvertForSelection]
  );

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    enabled: true,
    onNavigateDown: () => setFocusedIndex((i) => Math.min(sortedIdeas.length - 1, i + 1)),
    onNavigateUp: () => setFocusedIndex((i) => Math.max(0, i - 1)),
    onNavigateFirst: () => setFocusedIndex(sortedIdeas.length ? 0 : -1),
    onNavigateLast: () => setFocusedIndex(sortedIdeas.length ? sortedIdeas.length - 1 : -1),
    onNew: () => handleCreateForMode(),
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

  const createBlankMap = useCallback(async () => {
    if (creatingBlankMap) return;
    setCreatingBlankMap(true);
    try {
      const created = await Api.createMyIdea({
        title: isPolish ? 'Nowe wyzwanie' : 'New challenge',
        body: '',
        tags: [],
        sourceType: 'manual',
      });
      const nextId = String(created?.id || '');
      if (!nextId) throw new Error(isPolish ? 'Nie udało się utworzyć' : 'Failed to create');

      // Ensure map row exists immediately (draft survives refresh).
      try {
        const res = await Api.getMyIdeaMap(nextId, { language: i18n.language });
        const map = res?.map || {};
        const nodes = Array.isArray(map.nodes) ? map.nodes : [];
        const edges = Array.isArray(map.edges) ? map.edges : [];
        await Api.saveMyIdeaMap(nextId, { nodes, edges });
      } catch {
        // best-effort
      }

      onIdeaClick(nextId, { ...(created as any), openMap: true } as any);
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
    } finally {
      setCreatingBlankMap(false);
    }
  }, [creatingBlankMap, i18n.language, isPolish, onIdeaClick]);

  const handleCreateForMode = useMemo(() => {
    return effectiveViewMode === 'blank' ? createBlankMap : onCreateIdea;
  }, [createBlankMap, effectiveViewMode, onCreateIdea]);

  // Ideas-specific single-key shortcuts: c=create, e=open, p=convert
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      const isEditable = target?.isContentEditable;
      if (isInput || isEditable) return;

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleCreateForMode();
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
  }, [handleCreateForMode, openConvertForSelection, openFocusedIdea]);

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

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ minHeight: 300 }}>
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  const convertModal = (
    <MindMapErrorBoundary fallback={null}>
      {convertIdea && (
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
                <button
                  onClick={() => handleConvert('initiative')}
                  disabled={converting}
                  className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <Rocket size={16} className="text-amber-500" />
                    {isPolish ? 'Inicjatywa' : 'Initiative'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Utwórz inicjatywę w PMO' : 'Create a PMO initiative'}
                  </div>
                </button>

                <button
                  onClick={() => handleConvert('task_set')}
                  disabled={converting}
                  className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    {isPolish ? 'Taski' : 'Tasks'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Z next steps (jeśli są)' : 'From next steps (if available)'}
                  </div>
                </button>

                <button
                  onClick={() => handleConvert('decision')}
                  disabled={converting}
                  className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <Star size={16} className="text-blue-500" />
                    {isPolish ? 'Decyzja' : 'Decision'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Artefakt decyzyjny' : 'Decision artifact'}
                  </div>
                </button>

                <button
                  onClick={() => handleConvert('team_chat')}
                  disabled={converting}
                  className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <MessageSquarePlus size={16} className="text-purple-500" />
                    {isPolish ? 'Team Chat' : 'Team Chat'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Wątek do omówienia' : 'Discussion thread'}
                  </div>
                </button>
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
      )}
    </MindMapErrorBoundary>
  );

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
        onClick={handleCreateForMode}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
      >
        <Plus size={16} />
        {isPolish ? 'Zasiej pomysł' : 'Plant an idea'}
      </button>
    </div>
  );

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

  const renderPotentialDot = (potential?: string | null) => {
    if (!potential) return null;
    const colors: Record<string, string> = {
      high: 'bg-emerald-400',
      medium: 'bg-amber-400',
      low: 'bg-slate-400',
    };
    return (
      <span
        className={`w-2 h-2 rounded-full ${colors[potential] || 'bg-slate-300'}`}
        title={potential}
      />
    );
  };

  const renderSourceBadge = (sourceType?: string | null) => {
    const isAI =
      sourceType === 'ai_chat' || sourceType === 'ai_hint' || sourceType === 'ai_suggestion';
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
          isAI
            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
            : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
        }`}
        title={isAI ? 'AI-generated' : 'Created by you'}
      >
        {isAI ? <Bot size={9} /> : <User size={9} />}
        {isAI ? 'AI' : isPolish ? 'Ty' : 'You'}
      </span>
    );
  };

  const areaBadgeStyle = (area?: string | null) => {
    const raw = String(area || '').trim();
    const a = raw.toLowerCase();
    if (!raw) {
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-500 dark:text-slate-400',
        border: 'border-slate-400/20',
      };
    }
    if (a.includes('fin') || a.includes('budget') || a.includes('roi')) {
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-400/20',
      };
    }
    if (a.includes('tech') || a.includes('it') || a.includes('ai') || a.includes('data')) {
      return {
        bg: 'bg-sky-500/10',
        text: 'text-sky-600 dark:text-sky-400',
        border: 'border-sky-400/20',
      };
    }
    if (a.includes('culture') || a.includes('people') || a.includes('hr') || a.includes('org')) {
      return {
        bg: 'bg-violet-500/10',
        text: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-400/20',
      };
    }
    if (
      a.includes('ops') ||
      a.includes('operation') ||
      a.includes('supply') ||
      a.includes('process')
    ) {
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-400/20',
      };
    }
    if (a.includes('sales') || a.includes('market') || a.includes('customer')) {
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-400/20',
      };
    }
    return {
      bg: 'bg-slate-500/10',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-400/20',
    };
  };

  const renderAreaBadge = (area?: string | null) => {
    if (!area) return null;
    const st = areaBadgeStyle(area);
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${st.bg} ${st.text} ${st.border}`}
      >
        <GitBranch size={9} />
        {area}
      </span>
    );
  };

  const renderPriorityBar = (priority?: number | null) => {
    const p = priority ?? 50;
    const w = Math.max(10, Math.min(100, p));
    const color = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';
    return (
      <div
        className="w-12 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden"
        title={`${isPolish ? 'Priorytet' : 'Priority'}: ${p}/100`}
      >
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
      </div>
    );
  };

  // ──────────── BLANK MAP VIEW ────────────
  if (effectiveViewMode === 'blank') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        {convertModal}
        {tagModal}
        {confirmDialog}
        <div className="p-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20">
                <GitBranch size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isPolish ? 'Czysta mapa rekomendacji' : 'Blank recommendation map'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {isPolish
                    ? 'Otwórz nową mapę i zacznij od opisu wyzwania.'
                    : 'Open a new map and start by describing the challenge.'}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <button
                onClick={createBlankMap}
                disabled={creatingBlankMap}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creatingBlankMap ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {isPolish ? 'Otwórz czystą mapę' : 'Open blank map'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────── MIND MAP VIEW ────────────
  if (effectiveViewMode === 'mindmap') {
    return (
      <div className="w-full h-full overflow-hidden">
        {convertModal}
        {tagModal}
        <MindMapErrorBoundary
          fallback={
            <div
              className="w-full flex flex-col items-center justify-center p-8 text-center"
              style={{ minHeight: 300 }}
            >
              <GitBranch size={48} className="text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Nie udało się załadować mapy myśli' : 'Failed to load mind map'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {isPolish
                  ? 'Spróbuj odświeżyć stronę (Cmd+Shift+R)'
                  : 'Try refreshing the page (Cmd+Shift+R)'}
              </p>
            </div>
          }
        >
          <React.Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-amber-500" size={32} />
              </div>
            }
          >
            <IdeasMindMap
              ideas={filteredIdeas}
              onIdeaClick={onIdeaClick}
              onCreateIdea={onCreateIdea}
              isPolish={!!isPolish}
            />
          </React.Suspense>
        </MindMapErrorBoundary>
      </div>
    );
  }

  // ──────────── GARDEN VIEW ────────────
  if (effectiveViewMode === 'garden') {
    if (sortedIdeas.length === 0)
      return <div className="p-4 overflow-y-auto h-full">{renderEmpty()}</div>;

    const allSections: { stage: IdeaStage; ideas: MyIdea[] }[] = [
      { stage: 'spark' as IdeaStage, ideas: sortedIdeas.filter((i) => i.stage === 'spark') },
      {
        stage: 'incubating' as IdeaStage,
        ideas: sortedIdeas.filter((i) => i.stage === 'incubating'),
      },
      { stage: 'shaping' as IdeaStage, ideas: sortedIdeas.filter((i) => i.stage === 'shaping') },
      { stage: 'ready' as IdeaStage, ideas: sortedIdeas.filter((i) => i.stage === 'ready') },
      { stage: 'promoted' as IdeaStage, ideas: sortedIdeas.filter((i) => i.stage === 'promoted') },
    ];
    const gardenSections = allSections.filter((s) => s.ideas.length > 0);

    const sectionLabels: Record<
      IdeaStage,
      { en: string; pl: string; desc_en: string; desc_pl: string }
    > = {
      spark: {
        en: 'New Sparks',
        pl: 'Nowe iskry',
        desc_en: 'Fresh ideas waiting to be developed',
        desc_pl: 'Świeże pomysły czekające na rozwój',
      },
      incubating: {
        en: 'Incubating',
        pl: 'W inkubatorze',
        desc_en: 'AI is expanding and researching these ideas',
        desc_pl: 'AI rozwija i bada te pomysły',
      },
      shaping: {
        en: 'Taking Shape',
        pl: 'Nabierają kształtu',
        desc_en: 'Proposals ready, summary generated',
        desc_pl: 'Propozycje gotowe, podsumowanie wygenerowane',
      },
      ready: {
        en: 'Ready for Team',
        pl: 'Gotowe dla zespołu',
        desc_en: 'Fully developed ideas ready to promote',
        desc_pl: 'W pełni opracowane pomysły gotowe do promocji',
      },
      promoted: {
        en: 'Promoted',
        pl: 'Promowane',
        desc_en: 'Ideas that became initiatives or team discussions',
        desc_pl: 'Pomysły, które stały się inicjatywami lub dyskusjami zespołu',
      },
    };

    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        {convertModal}
        {tagModal}
        <div className="p-4 space-y-6">
          {/* Tag filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() =>
                setInboxOnly((v) => {
                  const next = !v;
                  trackFunnelEvent('idea_inbox_opened', {
                    enabled: next,
                    viewMode,
                    count: inboxCount,
                  });
                  return next;
                })
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                inboxOnly
                  ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
              title={isPolish ? 'Idea Inbox' : 'Idea Inbox'}
            >
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} />
                {isPolish ? 'Inbox' : 'Inbox'}
                {inboxCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/60 dark:bg-navy-800/60">
                    {inboxCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTag('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === 'all'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {t('myWork.ideas.tags.all', 'All')}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === tag
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                title={tag}
              >
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} />
                  {tag}
                </span>
              </button>
            ))}
            {areas.length > 0 && (
              <>
                <span className="mx-1 text-slate-300 dark:text-navy-600">|</span>
                <button
                  onClick={() => setActiveArea('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeArea === 'all'
                      ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                  title={isPolish ? 'Wszystkie obszary' : 'All areas'}
                >
                  <span className="inline-flex items-center gap-1">
                    <GitBranch size={12} />
                    {isPolish ? 'Obszar: wszystkie' : 'Area: all'}
                  </span>
                </button>
                {areas.map((a) => (
                  <button
                    key={`area-${a}`}
                    onClick={() => setActiveArea(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      activeArea.toLowerCase() === a.toLowerCase()
                        ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                    title={a}
                  >
                    {a}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Garden Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-emerald-400/20 dark:from-amber-500/15 dark:to-emerald-500/15">
              <Flower2 size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {inboxOnly
                  ? isPolish
                    ? 'Idea Inbox'
                    : 'Idea Inbox'
                  : isPolish
                    ? 'Ogród Pomysłów'
                    : 'Idea Garden'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isPolish ? `${sortedIdeas.length} pomysłów` : `${sortedIdeas.length} ideas`}
              </p>
            </div>
            <div className="ml-auto">
              <button
                onClick={handleCreateForMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all"
              >
                <Plus size={14} />
                {isPolish ? 'Nowy pomysł' : 'New idea'}
              </button>
            </div>
          </div>

          {/* Garden Sections */}
          {gardenSections.map(({ stage, ideas: sectionIdeas }) => {
            const cfg = STAGE_CONFIG[stage];
            const Icon = cfg.icon;
            const labels = sectionLabels[stage];

            return (
              <div key={stage} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${cfg.bgColor}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {isPolish ? labels.pl : labels.en}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}
                      >
                        {sectionIdeas.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish ? labels.desc_pl : labels.desc_en}
                    </div>
                  </div>
                </div>

                {/* Section cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectionIdeas.map((idea) => (
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
                      className={`group relative text-left p-4 rounded-2xl border ${cfg.borderColor} bg-white dark:bg-navy-900 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 ${
                        selectedIds.has(idea.id)
                          ? 'ring-2 ring-purple-500/40'
                          : focusedIdea?.id === idea.id
                            ? 'ring-2 ring-amber-500/30'
                            : ''
                      }`}
                    >
                      <div className="absolute top-3 right-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(idea.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(idea.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-purple-500 focus:ring-purple-500/30"
                        />
                      </div>
                      <div className="flex items-start gap-2.5 mb-2">
                        <div
                          className={`flex-shrink-0 p-1.5 rounded-lg ${cfg.bgColor} group-hover:scale-110 transition-transform`}
                        >
                          <Icon size={14} className={cfg.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {idea.title}
                          </div>
                        </div>
                        {renderPotentialDot(idea.potential)}
                      </div>
                      {idea.body ? (
                        <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2 ml-8">
                          {idea.body}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5 flex-wrap ml-8">
                        {renderSourceBadge(idea.sourceType)}
                        {renderAreaBadge(idea.area)}
                        {renderPriorityBar(idea.priority)}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {idea.updatedAt
                            ? new Date(idea.updatedAt).toLocaleDateString()
                            : idea.createdAt
                              ? new Date(idea.createdAt).toLocaleDateString()
                              : ''}
                        </span>
                        {(idea.tags || []).length > 0 && (
                          <div className="flex gap-1">
                            {(idea.tags || []).slice(0, 2).map((tag) => (
                              <span
                                key={`${idea.id}-${tag}`}
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${cfg.badgeBg} ${cfg.badgeText}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 ml-8 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConvertIdea(idea);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-semibold hover:bg-purple-500/15 transition-colors"
                          title={isPolish ? 'Konwertuj' : 'Convert'}
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
                  ))}

                  {/* "Plant" card in spark section */}
                  {stage === 'spark' && (
                    <button
                      onClick={handleCreateForMode}
                      className="text-left p-4 rounded-2xl border-2 border-dashed border-amber-300/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-900/5 hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-all duration-200 flex flex-col items-center justify-center min-h-[100px] gap-2"
                    >
                      <div className="p-2 rounded-xl bg-amber-500/10">
                        <Plus size={18} className="text-amber-500" />
                      </div>
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {isPolish ? 'Zasiej nowy pomysł' : 'Plant a new idea'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* If no sections at all but we have ideas (shouldn't happen, but safety) */}
          {gardenSections.length === 0 && sortedIdeas.length > 0 && (
            <div className="text-center py-8 text-sm text-slate-500">
              {isPolish ? 'Brak pomysłów w wybranej kategorii' : 'No ideas matching selected tag'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────── CARDS VIEW ────────────
  if (effectiveViewMode === 'cards') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        {convertModal}
        {tagModal}
        <div className="p-4 space-y-4">
          {/* Tag filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() =>
                setInboxOnly((v) => {
                  const next = !v;
                  trackFunnelEvent('idea_inbox_opened', {
                    enabled: next,
                    viewMode,
                    count: inboxCount,
                  });
                  return next;
                })
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                inboxOnly
                  ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} />
                {isPolish ? 'Inbox' : 'Inbox'}
                {inboxCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/60 dark:bg-navy-800/60">
                    {inboxCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTag('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {t('myWork.ideas.tags.all', 'All')}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === tag
                    ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                title={tag}
              >
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} />
                  {tag}
                </span>
              </button>
            ))}
            {areas.length > 0 && (
              <>
                <span className="mx-1 text-slate-300 dark:text-navy-600">|</span>
                <button
                  onClick={() => setActiveArea('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeArea === 'all'
                      ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                  title={isPolish ? 'Wszystkie obszary' : 'All areas'}
                >
                  <span className="inline-flex items-center gap-1">
                    <GitBranch size={12} />
                    {isPolish ? 'Obszar: wszystkie' : 'Area: all'}
                  </span>
                </button>
                {areas.map((a) => (
                  <button
                    key={`area-${a}`}
                    onClick={() => setActiveArea(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      activeArea.toLowerCase() === a.toLowerCase()
                        ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                    title={a}
                  >
                    {a}
                  </button>
                ))}
              </>
            )}
          </div>

          {sortedIdeas.length === 0 ? (
            renderEmpty()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedIdeas.map((idea) => (
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
                  className={`group relative text-left p-5 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-amber-400/50 dark:hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 dark:hover:shadow-amber-500/10 transition-all duration-200 hover:-translate-y-0.5 ${
                    selectedIds.has(idea.id)
                      ? 'ring-2 ring-purple-500/40'
                      : focusedIdea?.id === idea.id
                        ? 'ring-2 ring-amber-500/30'
                        : ''
                  }`}
                >
                  <div className="absolute top-4 right-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idea.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(idea.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-purple-500 focus:ring-purple-500/30"
                    />
                  </div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30 transition-colors">
                      <Lightbulb size={20} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {idea.title}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {renderSourceBadge(idea.sourceType)}
                        {renderStageBadge(idea.stage || 'spark')}
                        {renderAreaBadge(idea.area)}
                        {renderBushBadge(idea.branch)}
                        {renderMapBadge(idea.id)}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  {idea.body ? (
                    <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-2">
                      {idea.body}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 mb-2">
                    {renderPriorityBar(idea.priority)}
                  </div>
                  {(idea.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(idea.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={`${idea.id}-${tag}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/20 dark:border-amber-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {(idea.tags || []).length > 4 && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          +{(idea.tags || []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onIdeaClick(idea.id, { ...(idea as any), openMap: true } as any);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold hover:bg-amber-500/15 transition-colors"
                      title={isPolish ? 'Otwórz mapę' : 'Open map'}
                    >
                      <GitBranch size={12} />
                      {isPolish ? 'Mapa' : 'Map'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvertIdea(idea);
                      }}
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
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────── LIST VIEW ────────────
  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
      {convertModal}
      {tagModal}
      {confirmDialog}
      <div className="p-4 space-y-4">
        {/* Tag filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() =>
              setInboxOnly((v) => {
                const next = !v;
                trackFunnelEvent('idea_inbox_opened', {
                  enabled: next,
                  viewMode,
                  count: inboxCount,
                });
                return next;
              })
            }
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              inboxOnly
                ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} />
              {isPolish ? 'Inbox' : 'Inbox'}
              {inboxCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/60 dark:bg-navy-800/60">
                  {inboxCount}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTag('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeTag === 'all'
                ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            {t('myWork.ideas.tags.all', 'All')}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === tag
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
              title={tag}
            >
              <span className="inline-flex items-center gap-1">
                <Tag size={12} />
                {tag}
              </span>
            </button>
          ))}
          {areas.length > 0 && (
            <>
              <span className="mx-1 text-slate-300 dark:text-navy-600">|</span>
              <button
                onClick={() => setActiveArea('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeArea === 'all'
                    ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                title={isPolish ? 'Wszystkie obszary' : 'All areas'}
              >
                <span className="inline-flex items-center gap-1">
                  <GitBranch size={12} />
                  {isPolish ? 'Obszar: wszystkie' : 'Area: all'}
                </span>
              </button>
              {areas.map((a) => (
                <button
                  key={`area-${a}`}
                  onClick={() => setActiveArea(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeArea.toLowerCase() === a.toLowerCase()
                      ? 'bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                  title={a}
                >
                  {a}
                </button>
              ))}
            </>
          )}
        </div>

        {sortedIdeas.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-2">
            {sortedIdeas.map((idea) => (
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
                className={`w-full text-left p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors ${
                  selectedIds.has(idea.id)
                    ? 'ring-2 ring-purple-500/40'
                    : focusedIdea?.id === idea.id
                      ? 'ring-2 ring-amber-500/30'
                      : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idea.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(idea.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-purple-500 focus:ring-purple-500/30"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {idea.title}
                      </div>
                      {renderSourceBadge(idea.sourceType)}
                      {renderStageBadge(idea.stage || 'spark')}
                      {renderAreaBadge(idea.area)}
                      {renderBushBadge(idea.branch)}
                      {renderMapBadge(idea.id)}
                      {renderPriorityBar(idea.priority)}
                      {renderPotentialDot(idea.potential)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onIdeaClick(idea.id, { ...(idea as any), openMap: true } as any);
                        }}
                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold hover:bg-amber-500/15 transition-colors"
                        title={isPolish ? 'Otwórz mapę' : 'Open map'}
                      >
                        <GitBranch size={12} />
                        {isPolish ? 'Mapa' : 'Map'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConvertIdea(idea);
                        }}
                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-semibold hover:bg-purple-500/15 transition-colors"
                        title={isPolish ? 'Konwertuj' : 'Convert'}
                      >
                        <Sparkles size={12} />
                        {isPolish ? 'Konwertuj' : 'Convert'}
                      </button>
                      <div onClick={(e) => e.stopPropagation()} className="ml-1">
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
                    {idea.body ? (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {idea.body}
                      </div>
                    ) : null}
                    {(idea.tags || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(idea.tags || []).slice(0, 6).map((tag) => (
                          <span
                            key={`${idea.id}-${tag}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk actions + shortcuts help */}
      <div className="relative">
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          actions={bulkActions}
        />
        <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    </div>
  );
};

export default MyIdeasListContent;
