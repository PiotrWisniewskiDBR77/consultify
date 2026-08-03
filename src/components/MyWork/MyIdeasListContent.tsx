import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit2,
  ExternalLink,
  Flower2,
  Folder,
  FolderMinus,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  type LucideIcon,
  MessageSquare,
  MessageSquarePlus,
  Network,
  PenTool,
  Presentation,
  Rocket,
  Sparkles,
  Sprout,
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

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { ErrorState } from '@/components/ui/primitives';
import { MetaChip, ToolChip } from '@/components/ui/primitives/chips';
import { CHIP_TONE_VAR, ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';
import type { FilterOption, TableFilters } from '@/components/ui/ResizableTable';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { tokenService } from '@/services/tokenService';
import { isIdeasPreviewOverlayEnabled } from '@/utils/ideasPreviewOverlayFlag';
import { formatListDate } from '@/utils/listDateFormat';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import { useFavoriteIdeas } from './hooks/useFavoriteIdeas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRecentIdeas } from './hooks/useRecentIdeas';
import {
  bucketIdeaStageForList,
  IDEA_STAGE_BUCKET_LABELS,
  type IdeaStageV5,
  normalizeStageToV5,
} from './ideaEntryTypes';
import type { CanvasToolType } from './ideaSelectionTypes';
import { IdeasTableContent } from './IdeasTableContent';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import type {
  IdeasBulkBarPayload,
  IdeasHomeShellPayload,
  IdeaStage,
  IdeasViewMode,
  MyIdea,
  SortDir,
  SortField,
} from './myIdeasTypes';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';

export type {
  IdeasBulkBarPayload,
  IdeaStage,
  IdeasViewMode,
  MyIdea,
  SortDir,
  SortField,
} from './myIdeasTypes';

interface MyIdeasListContentProps {
  viewMode?: IdeasViewMode;
  searchQuery: string;
  stageFilter?: IdeaStage | 'all';
  onIdeaClick: (
    ideaId: string,
    ideaData?: MyIdea,
    options?: { openMap?: boolean; initialTool?: 'process_flow' }
  ) => void;
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
  /**
   * S1-U1: publishes folders/starred/recents state UP so the hub's Command Row
   * absorbs them as dropdown chips (single dynamic line, no extra rows).
   */
  onHomeShellChange?: (payload: IdeasHomeShellPayload | null) => void;
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
    badgeBg: 'border border-amber-200/70 bg-amber-50 dark:border-amber-300/15 dark:bg-amber-300/10',
    badgeText: 'text-amber-800 dark:text-amber-200',
  },
  incubating: {
    icon: Sprout,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    borderColor: 'border-emerald-400/30 dark:border-emerald-500/20',
    badgeBg:
      'border border-emerald-200/70 bg-emerald-50 dark:border-emerald-300/15 dark:bg-emerald-300/10',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
  },
  shaping: {
    icon: TreePine,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    borderColor: 'border-blue-400/30 dark:border-blue-500/20',
    badgeBg: 'border border-blue-200/70 bg-blue-50 dark:border-blue-300/15 dark:bg-blue-300/10',
    badgeText: 'text-blue-800 dark:text-blue-200',
  },
  ready: {
    icon: CheckCircle2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    borderColor: 'border-blue-400/30 dark:border-blue-500/20',
    badgeBg: 'border border-blue-200/70 bg-blue-50 dark:border-blue-300/15 dark:bg-blue-300/10',
    badgeText: 'text-blue-800 dark:text-blue-200',
  },
  promoted: {
    icon: Rocket,
    color: 'text-danger-500',
    bgColor: 'bg-danger-500/10 dark:bg-danger-500/15',
    borderColor: 'border-danger-400/30 dark:border-danger-500/20',
    badgeBg:
      'border border-danger-200/70 bg-danger-50 dark:border-danger-300/15 dark:bg-danger-300/10',
    badgeText: 'text-danger-800 dark:text-danger-200',
  },
};

// Icon/color styling only — the label TEXT is not duplicated here. It comes
// from the single SSOT `getIdeaWorkspaceToolLabel` (IdeaWorkspaceToolbar.tsx),
// so the list, the canvas rail, and every other tool-name reader agree
// (2026-07-24: was three drifted copies — "Recommendation map"/"Mapa
// rekomendacji" here, "Proces"/"Przepływ" elsewhere — now "Mind Map"/"Mapa
// myśli", "Process Flow" everywhere).
const TOOL_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeClass: string;
    badgeIconClass: string;
  }
> = {
  mindmap: {
    icon: Network,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    borderColor: 'border-blue-400/30',
    badgeClass: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    // Crimson-leak fix (canon rule #3, the brand token is banned outside
    // critical semantics): this dead/unused field now matches the mindmap
    // `color` above (blue) instead of the brand accent shade.
    badgeIconClass: 'text-blue-600 dark:text-blue-300',
  },
  table: {
    icon: Table2,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10 dark:bg-sky-500/15',
    borderColor: 'border-sky-400/30',
    badgeClass: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    badgeIconClass: 'text-sky-600 dark:text-sky-300',
  },
  process_flow: {
    icon: Workflow,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    borderColor: 'border-emerald-400/30',
    badgeClass: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    badgeIconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  whiteboard: {
    icon: PenTool,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-400/30',
    badgeClass: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    badgeIconClass: 'text-amber-600 dark:text-amber-300',
  },
};

function getToolConfig(tool?: string | null) {
  const t = String(tool || '').toLowerCase();
  return TOOL_CONFIG[t] || TOOL_CONFIG.mindmap;
}

/** Stage → signal-tone dot color (canon §4.0a: neutral chip shell, color only in dot). */
const STAGE_DOT_VAR: Record<IdeaStage, string | undefined> = {
  spark: CHIP_TONE_VAR.warning,
  incubating: CHIP_TONE_VAR.success,
  shaping: CHIP_TONE_VAR.info,
  ready: CHIP_TONE_VAR.info,
  promoted: CHIP_TONE_VAR.accent,
};

/** Tool → canonical ToolChip icon color (semantic c.* var, §4.2). */
const TOOL_ICON_COLOR_VAR: Record<string, string> = {
  mindmap: 'var(--c-accent)',
  table: 'var(--c-info)',
  process_flow: 'var(--c-success)',
  whiteboard: 'var(--c-warning)',
};

const IDEAS_TABLE_VIEW_STORAGE_KEY = 'consultify.mywork.ideas.tableView';
const IDEAS_TABLE_COLUMN_WIDTH_VERSION = 3;
const DEFAULT_IDEAS_TABLE_FILTERS: TableFilters = {};
const DEFAULT_IDEAS_COLUMN_WIDTHS = {
  select: 40,
  title: 560,
  stage: 150,
  tags: 230,
  tool: 190,
  date: 128,
  actions: 56,
};

function normalizeIdeasColumnWidths(
  widths?: Partial<typeof DEFAULT_IDEAS_COLUMN_WIDTHS>,
  options: { migrateFromLegacy?: boolean } = {}
): typeof DEFAULT_IDEAS_COLUMN_WIDTHS {
  if (!options.migrateFromLegacy) {
    return {
      ...DEFAULT_IDEAS_COLUMN_WIDTHS,
      ...(widths || {}),
      select: DEFAULT_IDEAS_COLUMN_WIDTHS.select,
      actions: DEFAULT_IDEAS_COLUMN_WIDTHS.actions,
    };
  }

  return {
    select: DEFAULT_IDEAS_COLUMN_WIDTHS.select,
    title: Math.max(DEFAULT_IDEAS_COLUMN_WIDTHS.title, widths?.title || 0),
    stage: Math.max(DEFAULT_IDEAS_COLUMN_WIDTHS.stage, widths?.stage || 0),
    tags: Math.max(DEFAULT_IDEAS_COLUMN_WIDTHS.tags, widths?.tags || 0),
    tool: Math.max(DEFAULT_IDEAS_COLUMN_WIDTHS.tool, widths?.tool || 0),
    date: Math.max(DEFAULT_IDEAS_COLUMN_WIDTHS.date, widths?.date || 0),
    actions: DEFAULT_IDEAS_COLUMN_WIDTHS.actions,
  };
}

function getIdeasTableViewStorageKey(): string {
  try {
    const token = tokenService.getToken();
    const payload = token
      ? (tokenService.decodeToken(token) as Record<string, unknown> | null)
      : null;
    const userId = String(payload?.id || 'anonymous').trim() || 'anonymous';
    const orgId = String(payload?.organizationId || 'unknown-org').trim() || 'unknown-org';
    return `${IDEAS_TABLE_VIEW_STORAGE_KEY}.${orgId}.${userId}`;
  } catch {
    return IDEAS_TABLE_VIEW_STORAGE_KEY;
  }
}

function loadIdeasTableViewState(): {
  sortField: SortField;
  sortDir: SortDir;
  tableFilters: TableFilters;
  columnWidths: typeof DEFAULT_IDEAS_COLUMN_WIDTHS;
} {
  try {
    const raw = window.localStorage.getItem(getIdeasTableViewStorageKey());
    if (!raw) {
      return {
        sortField: 'date',
        sortDir: 'desc',
        tableFilters: DEFAULT_IDEAS_TABLE_FILTERS,
        columnWidths: normalizeIdeasColumnWidths(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<{
      sortField: SortField;
      sortDir: SortDir;
      tableFilters: TableFilters;
      columnWidths: Partial<typeof DEFAULT_IDEAS_COLUMN_WIDTHS>;
      columnWidthVersion: number;
    }>;
    const migrateFromLegacy = parsed.columnWidthVersion !== IDEAS_TABLE_COLUMN_WIDTH_VERSION;

    return {
      sortField: parsed.sortField || 'date',
      sortDir: parsed.sortDir || 'desc',
      tableFilters: parsed.tableFilters || DEFAULT_IDEAS_TABLE_FILTERS,
      columnWidths: normalizeIdeasColumnWidths(parsed.columnWidths, { migrateFromLegacy }),
    };
  } catch {
    return {
      sortField: 'date',
      sortDir: 'desc',
      tableFilters: DEFAULT_IDEAS_TABLE_FILTERS,
      columnWidths: normalizeIdeasColumnWidths(),
    };
  }
}

/**
 * Etapy idei w kolejności cyklu życia — SSOT dla bloku 2 kebaba.
 *
 * Wartości 1:1 z `IdeaStage` (`myIdeasTypes.ts`) i z tym, co przyjmuje
 * `PUT /my-work/my-idea/:id`. Ikony dobrane tak, żeby czytały się jako
 * postęp: iskra → kiełek → kształtowanie → gotowe → wypromowane.
 */
const ETAPY_IDEI: Array<{
  id: IdeaStage;
  icon: React.ElementType;
  label: (pl: boolean) => string;
}> = [
  { id: 'spark', icon: Sparkles, label: (pl) => (pl ? 'Iskra' : 'Spark') },
  { id: 'incubating', icon: Sprout, label: (pl) => (pl ? 'Inkubacja' : 'Incubating') },
  { id: 'shaping', icon: PenTool, label: (pl) => (pl ? 'Kształtowanie' : 'Shaping') },
  { id: 'ready', icon: CheckCircle2, label: (pl) => (pl ? 'Gotowa' : 'Ready') },
  { id: 'promoted', icon: Rocket, label: (pl) => (pl ? 'Wypromowana' : 'Promoted') },
];

export const MyIdeasListContent: React.FC<MyIdeasListContentProps> = ({
  viewMode = 'table',
  searchQuery,
  stageFilter = 'all',
  onIdeaClick,
  onCreateIdea,
  onCountsChange,
  onBulkBarChange,
  onHomeShellChange,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const openChatWithContext = useOpenChatWithContext();
  const persistedTableView = useMemo(() => loadIdeasTableViewState(), []);
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // activeTag is only used in the Tags (garden) view
  const [activeTag, setActiveTag] = useState<string>('all');
  const [convertIdea, setConvertIdea] = useState<MyIdea | null>(null);
  const [converting, setConverting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  /* P-4: rozwijanie treści w bloku DETAILS — akcja kebaba ⋮ podglądu. */
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sortField, setSortField] = useState<SortField>(persistedTableView.sortField);
  const [sortDir, setSortDir] = useState<SortDir>(persistedTableView.sortDir);
  const [tableFilters, setTableFilters] = useState<TableFilters>(persistedTableView.tableFilters);
  const [columnWidths, setColumnWidths] = useState(persistedTableView.columnWidths);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [mapMetrics, setMapMetrics] = useState<
    Record<string, { items: number; nodes: number; edges: number }>
  >({});
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getMyIdeas({ q: searchQuery || undefined, limit: 200 });
      const mapped = ((data || []) as any[]).map((raw) => ({
        ...raw,
        stageV5: normalizeStageToV5(raw.stage),
        stage: bucketIdeaStageForList(raw.stage),
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
      setLoadError(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t]);

  const { recentIds, record: recordRecent } = useRecentIdeas();
  const { isFavorite, toggleFavorite, hydrateFromServer } = useFavoriteIdeas();
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [foldersAvailable, setFoldersAvailable] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  // Grid/garden side-preview selection (canon §7/§8.1 — single-click opens preview, not navigation).
  const [previewIdeaId, setPreviewIdeaId] = useState<string | null>(null);

  // Record opens (for the "Recently opened" rail), then delegate to the host.
  const openIdea = useCallback(
    (...args: Parameters<typeof onIdeaClick>) => {
      recordRecent(args[0]);
      onIdeaClick(...args);
    },
    [onIdeaClick, recordRecent]
  );

  const openIdeaInProcessFlow = useCallback(
    (idea: MyIdea) => {
      openIdea(idea.id, idea, { openMap: true, initialTool: 'process_flow' });
    },
    [openIdea]
  );

  // "Recently opened" rail data: map stored recent IDs back to live ideas,
  // dropping any that no longer exist, capped for a compact rail.
  const recentIdeas = useMemo(
    () =>
      recentIds
        .map((id) => ideas.find((i) => i.id === id))
        .filter((i): i is MyIdea => Boolean(i))
        .slice(0, 6),
    [recentIds, ideas]
  );

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas, refreshTrigger]);

  // Seed local favorites from server-side `isFavorite` (cross-device). Union-merge
  // (see useFavoriteIdeas) so this is safe before the M2 migration is applied.
  useEffect(() => {
    hydrateFromServer(ideas.filter((i: any) => i?.isFavorite).map((i: any) => String(i.id)));
  }, [ideas, hydrateFromServer]);

  // Load folders. The endpoint 503s until the M2 migration lands; we only show
  // the folders UI once it resolves (foldersAvailable), so nothing breaks early.
  useEffect(() => {
    let cancelled = false;
    Api.getMyIdeaFolders()
      .then((list) => {
        if (cancelled) return;
        setFolders(Array.isArray(list) ? list.map((f: any) => ({ id: f.id, name: f.name })) : []);
        setFoldersAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setFoldersAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  /**
   * Zmiana etapu idei prosto z listy — blok 2 kebaba (kanon A6).
   *
   * Ten sam wzorzec optymistyczny co `handleMoveToFolder` obok: najpierw
   * lokalnie (żeby chip w wierszu odpowiedział od razu), potem zapis, a przy
   * błędzie cofnięcie przez `fetchIdeas()`.
   */
  const handleZmienEtap = useCallback(
    async (idea: MyIdea, stage: IdeaStage) => {
      if ((idea.stage || 'spark') === stage) return;
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? ({ ...i, stage } as MyIdea) : i)));
      try {
        await Api.updateMyIdea(idea.id, { stage });
        toast.success(
          t('myWork.ideasList.stageChanged', isPolish ? 'Etap zmieniony' : 'Stage updated'),
          {
            duration: 800,
          }
        );
      } catch {
        toast.error(
          t(
            'myWork.ideasList.stageChangeFailed',
            isPolish ? 'Nie udało się zmienić etapu' : 'Failed to update stage'
          )
        );
        fetchIdeas();
      }
    },
    [isPolish, fetchIdeas, t]
  );

  const handleMoveToFolder = useCallback(
    async (idea: MyIdea, folderId: string | null) => {
      // Optimistic local update, then persist.
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? ({ ...i, folderId } as MyIdea) : i)));
      try {
        await Api.setIdeaFolder(idea.id, folderId);
        toast.success(t('myWork.ideasList.toastSuccess', 'Moved'), { duration: 800 });
      } catch {
        toast.error(t('myWork.ideasList.toastError', 'Failed to move idea'));
        fetchIdeas();
      }
    },
    [isPolish, fetchIdeas]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = window.prompt(t('myWork.ideasList.windowPrompt', 'Folder name'))?.trim();
    if (!name) return;
    try {
      const created = await Api.createMyIdeaFolder({ name });
      setFolders((prev) => [...prev, { id: created.id, name: created.name }]);
    } catch {
      toast.error(t('myWork.ideasList.toastError2', 'Failed to create folder'));
    }
  }, [isPolish]);

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      try {
        await Api.deleteMyIdeaFolder(folderId);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        fetchIdeas(); // ideas were unfiled server-side
      } catch {
        toast.error(t('myWork.ideasList.toastError3', 'Failed to delete folder'));
      }
    },
    [activeFolderId, fetchIdeas, isPolish]
  );

  // S1-U1: folders + starred + recents are NOT extra rows above the table any
  // more — the state is published UP to the hub, which absorbs it into the
  // single Command Row (Menu 3) as dropdown chips.
  const starredCount = useMemo(
    () => ideas.reduce((acc, i) => acc + (isFavorite(i.id) ? 1 : 0), 0),
    [ideas, isFavorite]
  );

  useEffect(() => {
    if (!onHomeShellChange) return;
    onHomeShellChange({
      foldersAvailable,
      folders,
      activeFolderId,
      starredCount,
      showStarredOnly,
      recents: recentIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title || t('myWork.ideasList.untitled', 'Untitled'),
      })),
      selectFolder: (folderId) => setActiveFolderId(folderId),
      createFolder: handleCreateFolder,
      deleteFolder: handleDeleteFolder,
      toggleStarredOnly: () => setShowStarredOnly((v) => !v),
      openRecent: (ideaId) => {
        const idea = ideas.find((i) => i.id === ideaId);
        if (idea) openIdea(idea.id, idea);
      },
    });
    return () => onHomeShellChange(null);
  }, [
    onHomeShellChange,
    foldersAvailable,
    folders,
    activeFolderId,
    starredCount,
    showStarredOnly,
    recentIdeas,
    ideas,
    isPolish,
    handleCreateFolder,
    handleDeleteFolder,
    openIdea,
  ]);

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

  useEffect(() => {
    if (viewMode !== 'table') {
      setTableFilters({});
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        getIdeasTableViewStorageKey(),
        JSON.stringify({
          sortField,
          sortDir,
          tableFilters,
          columnWidths,
          columnWidthVersion: IDEAS_TABLE_COLUMN_WIDTH_VERSION,
        })
      );
    } catch {
      /* ignore persistence errors */
    }
  }, [sortField, sortDir, tableFilters, columnWidths]);

  const baseFilteredIdeas = useMemo(() => {
    let list = ideas;
    if (showStarredOnly) {
      list = list.filter((i) => isFavorite(i.id));
    }
    if (activeFolderId) {
      list = list.filter((i) => (i as any).folderId === activeFolderId);
    }
    if (viewMode !== 'garden' && stageFilter !== 'all') {
      list = list.filter((i) => (i.stage || 'spark') === stageFilter);
    }
    if (viewMode === 'garden' && activeTag !== 'all') {
      list = list.filter((i) =>
        (i.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag)
      );
    }
    return list;
  }, [ideas, stageFilter, activeTag, viewMode, showStarredOnly, isFavorite, activeFolderId]);

  const availableStageOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    const order: IdeaStage[] = ['spark', 'incubating', 'shaping', 'ready', 'promoted'];
    for (const idea of baseFilteredIdeas) {
      seen.add((idea.stage || 'spark') as IdeaStage);
    }
    return order
      .filter((stage) => seen.has(stage))
      .map((stage) => ({
        value: stage,
        label: isPolish ? IDEA_STAGE_BUCKET_LABELS[stage].pl : IDEA_STAGE_BUCKET_LABELS[stage].en,
      }));
  }, [baseFilteredIdeas, isPolish]);

  const availableToolOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    for (const idea of baseFilteredIdeas) {
      const tool = String(idea.preferredTool || 'mindmap').toLowerCase();
      seen.add(tool);
    }
    return Array.from(seen).map((tool) => ({
      value: tool,
      label: getIdeaWorkspaceToolLabel(tool as CanvasToolType, isPolish),
    }));
  }, [baseFilteredIdeas, isPolish]);

  const availableTagOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const idea of baseFilteredIdeas) {
      for (const tag of idea.tags || []) {
        const normalized = String(tag).trim();
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({
        value: tag.toLowerCase(),
        label: `${tag} (${count})`,
      }));
  }, [baseFilteredIdeas]);

  const filteredIdeas = useMemo(() => {
    let list = baseFilteredIdeas;
    if (viewMode !== 'table') return list;

    const stageValues = (tableFilters.stage as string[] | undefined) || [];
    const tagValues = (tableFilters.tags as string[] | undefined) || [];
    const toolValues = (tableFilters.tool as string[] | undefined) || [];

    if (stageValues.length > 0) {
      list = list.filter((idea) => stageValues.includes(String(idea.stage || 'spark')));
    }

    if (toolValues.length > 0) {
      list = list.filter((idea) =>
        toolValues.includes(String(idea.preferredTool || 'mindmap').toLowerCase())
      );
    }

    if (tagValues.length > 0) {
      list = list.filter((idea) => {
        const normalizedTags = (idea.tags || []).map((tag) => String(tag).toLowerCase());
        return tagValues.some((value) => normalizedTags.includes(value));
      });
    }

    return list;
  }, [baseFilteredIdeas, tableFilters, viewMode]);

  useEffect(() => {
    const hasPersistedTableFilters = Object.values(tableFilters).some(
      (value) => Array.isArray(value) && value.length > 0
    );
    if (!hasPersistedTableFilters) return;
    if (viewMode !== 'table') return;
    if (baseFilteredIdeas.length === 0) return;
    if (filteredIdeas.length > 0) return;

    // Stale browser-local filters can hide all Ideas after account/demo switches.
    setTableFilters(DEFAULT_IDEAS_TABLE_FILTERS);
  }, [baseFilteredIdeas.length, filteredIdeas.length, tableFilters, viewMode]);

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
      // Keep the previous identity when nothing was pruned — a fresh Set every
      // pass re-renders and can loop when upstream memo identities are unstable.
      return next.size === prev.size ? prev : next;
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
    openIdea(focusedIdea.id, focusedIdea);
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
      toast.error(err?.message || t('myWork.ideasList.failed', 'Failed'));
    } finally {
      setBulkBusy(false);
    }
  }, [tagInput, selectedIds, ideas, fetchIdeas, clearSelection, isPolish]);

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await showConfirm({
      title: t('myWork.ideasList.title', 'Delete selected ideas?'),
      description: isPolish
        ? `${ids.length} pomysłów zostanie trwale usuniętych.`
        : `${ids.length} idea(s) will be permanently deleted.`,
      confirmLabel: t('myWork.ideasList.confirmLabel', 'Delete'),
      cancelLabel: t('myWork.ideasList.cancelLabel', 'Cancel'),
      variant: 'danger',
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => Api.deleteMyIdea(id)));
      trackFunnelEvent('idea_triaged', { action: 'delete', count: ids.length });
      trackFunnelEvent('idea_bulk_deleted', { count: ids.length });
      toast.success(t('myWork.ideasList.toastSuccess2', 'Deleted'));
      clearSelection();
      await fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message || t('myWork.ideasList.failed2', 'Failed'));
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, showConfirm, fetchIdeas, clearSelection, isPolish]);

  const handleDeleteSingleIdea = useCallback(
    async (idea: MyIdea) => {
      const ok = await showConfirm({
        title: t('myWork.ideasList.title2', 'Delete idea?'),
        description: isPolish
          ? `„${idea.title || 'Bez tytułu'}" zostanie trwale usunięty.`
          : `"${idea.title || 'Untitled'}" will be permanently deleted.`,
        confirmLabel: t('myWork.ideasList.confirmLabel2', 'Delete'),
        cancelLabel: t('myWork.ideasList.cancelLabel2', 'Cancel'),
        variant: 'danger',
      });
      if (!ok) return;
      try {
        await Api.deleteMyIdea(idea.id);
        trackFunnelEvent('idea_triaged', { action: 'delete', count: 1 });
        toast.success(t('myWork.ideasList.toastSuccess3', 'Deleted'));
        await fetchIdeas();
      } catch (err: any) {
        toast.error(err?.message || t('myWork.ideasList.failedToDelete', 'Failed to delete'));
      }
    },
    [showConfirm, fetchIdeas, isPolish]
  );

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
    // Z3 audit (2026-07-24): widened from the original 4-target union to also
    // accept 'report'/'presentation' — the row kebab (IdeasTableContent.tsx
    // "output" zone) now passes these through onConvertIdeaToTarget. The body
    // below is a generic passthrough to Api.convertMyIdea (already typed for
    // all 6 live targets), so no behavioral change is needed, only the type.
    async (
      target: 'initiative' | 'task_set' | 'decision' | 'team_chat' | 'report' | 'presentation',
      ideaOverride?: MyIdea
    ) => {
      const sourceIdea = ideaOverride ?? convertIdea;
      if (!sourceIdea?.id) return;
      try {
        setConverting(true);
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const result = await Api.convertMyIdea(sourceIdea.id, {
          target,
          options: { language: i18n.language },
        });
        trackFunnelEvent(`idea_converted_${target}`, {
          ideaId: sourceIdea.id,
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
            sourceEntityId: sourceIdea.id,
            target,
            sessionId: result.sourceSessionId,
          });
        }
        toast.success(t('myWork.ideasList.toastSuccess4', 'Done'));
        if (!ideaOverride) {
          setConvertIdea(null);
        }
        await fetchIdeas();
      } catch (err: any) {
        toast.error(err?.message || t('myWork.ideasList.failed3', 'Failed'));
      } finally {
        setConverting(false);
      }
    },
    [convertIdea, fetchIdeas, i18n.language, isPolish]
  );

  const handleOpenIdeaAiChat = useCallback(
    async (idea: MyIdea) => {
      try {
        await openChatWithContext({
          entityType: 'idea',
          entityId: idea.id,
          entityName: idea.title,
          contextData: {
            ...idea,
            source: 'my-work-ideas-row-menu',
          },
        });
      } catch (err: any) {
        toast.error(err?.message || t('myWork.ideasList.failedToOpenChat', 'Failed to open chat'));
      }
    },
    [isPolish, openChatWithContext]
  );

  const handleOpenIdeaAiInsights = useCallback(
    async (idea: MyIdea) => {
      try {
        await openChatWithContext({
          entityType: 'idea',
          entityId: idea.id,
          entityName: `${idea.title} - AI Insights`,
          contextData: {
            ...idea,
            source: 'my-work-ideas-row-menu',
            requestedAnalysis: 'ai_insights',
            promptHint: t(
              'myWork.ideasList.promptHint',
              'Prepare concise AI insights for this idea: potential, risks, next steps and possible conversions.'
            ),
          },
        });
      } catch (err: any) {
        toast.error(
          err?.message || t('myWork.ideasList.failedToOpenAI', 'Failed to open AI Insights')
        );
      }
    },
    [isPolish, openChatWithContext]
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

  // Canon §4.0a: neutral chip shell, color only in the leading signal dot.
  const renderStageBadge = (stage: IdeaStage) => {
    return (
      <ChipBase size="sm" leading={<ChipDot colorVar={STAGE_DOT_VAR[stage]} size="sm" />}>
        {isPolish ? IDEA_STAGE_BUCKET_LABELS[stage].pl : IDEA_STAGE_BUCKET_LABELS[stage].en}
      </ChipBase>
    );
  };

  // Canonical ToolChip: colored tool icon on a neutral (c-token) surface.
  const renderToolBadge = (tool?: string | null) => {
    const tc = getToolConfig(tool);
    const key = String(tool || 'mindmap').toLowerCase();
    return (
      <ToolChip
        icon={tc.icon as LucideIcon}
        iconColor={TOOL_ICON_COLOR_VAR[key] || TOOL_ICON_COLOR_VAR.mindmap}
        label={getIdeaWorkspaceToolLabel(key as CanvasToolType, isPolish)}
      />
    );
  };

  // Canonical neutral metadata chips (MetaChip) — tags are never colored (§4.0a).
  const renderTagBadges = (ideaTags?: string[], max = 3) => {
    if (!ideaTags || ideaTags.length === 0) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {ideaTags.slice(0, max).map((tag) => (
          <MetaChip key={tag} label={tag} />
        ))}
        {ideaTags.length > max && <MetaChip label={`+${ideaTags.length - max}`} />}
      </div>
    );
  };

  // ── Grid/garden side preview (canon §7/§8.1) ──
  const previewIdea = useMemo(
    () => (previewIdeaId ? sortedIdeas.find((i) => i.id === previewIdeaId) || null : null),
    [previewIdeaId, sortedIdeas]
  );
  const previewIdeaIds = useMemo(() => sortedIdeas.map((i) => i.id), [sortedIdeas]);

  // Drop a stale preview selection when the underlying idea disappears.
  useEffect(() => {
    if (previewIdeaId && !sortedIdeas.some((i) => i.id === previewIdeaId)) {
      setPreviewIdeaId(null);
    }
  }, [sortedIdeas, previewIdeaId]);

  const renderIdeaPreview = (idea: MyIdea) => {
    const stage = (idea.stage || 'spark') as IdeaStage;
    const tc = getToolConfig(idea.preferredTool);
    const toolKey = String(idea.preferredTool || 'mindmap').toLowerCase() as CanvasToolType;
    const metaPills: MetaPill[] = [
      {
        label: isPolish ? IDEA_STAGE_BUCKET_LABELS[stage].pl : IDEA_STAGE_BUCKET_LABELS[stage].en,
        icon: tc.icon,
      },
      { label: getIdeaWorkspaceToolLabel(toolKey, isPolish), icon: tc.icon },
    ];
    const metaTrailing = (
      <span className="text-[11px] font-medium text-c-text-muted">
        {idea.updatedAt
          ? formatListDate(idea.updatedAt)
          : idea.createdAt
            ? formatListDate(idea.createdAt)
            : '—'}
      </span>
    );
    return (
      <div className="space-y-4">
        <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
          {idea.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <MetaChip key={tag} label={String(tag)} />
              ))}
            </div>
          ) : null}
        </PreviewMetaCard>
        {/**
         * P-4 (Piotr, OBR-07, 2026-07-27): „Nie ma tutaj tych kebabów/hamburgerów
         * nad treścią, żeby uzupełniać czy tam przerabiać. Nie jest to dobre okno."
         *
         * Blok DETAILS dostawał sam `text`, bez ani jednej akcji — a kebab ⋮
         * renderuje się dopiero, gdy jakaś jest (`hasMenu` w
         * `PreviewDetailsSection`). Stąd Ideas był jedynym podglądem bez niego:
         * Inbox, Tasks i Decisions swoje akcje podawały.
         */}
        <PreviewDetailsSection
          text={idea.body || ''}
          label={t('myWork.ideasList.label', 'Details')}
          expanded={detailsExpanded}
          onToggleExpanded={() => setDetailsExpanded((v) => !v)}
          customActions={[
            {
              id: 'toggle',
              label: detailsExpanded
                ? t('myWork.ideasList.collapse', isPolish ? 'Zwiń' : 'Collapse')
                : t('myWork.ideasList.expand', isPolish ? 'Rozwiń' : 'Expand'),
              icon: ChevronDown,
              onClick: () => setDetailsExpanded((v) => !v),
            },
            {
              id: 'edit',
              label: t('myWork.ideasList.editIdea', isPolish ? 'Edytuj' : 'Edit'),
              icon: Edit2,
              onClick: () => openIdea(idea.id, idea),
            },
            {
              id: 'copy',
              label: t('myWork.ideasList.copyContent', isPolish ? 'Kopiuj treść' : 'Copy content'),
              icon: Copy,
              onClick: () => {
                void navigator.clipboard?.writeText(
                  [idea.title, idea.body].filter(Boolean).join('\n\n')
                );
              },
            },
          ]}
        />
      </div>
    );
  };

  const renderIdeaPreviewFooter = (idea: MyIdea) => {
    const aiHints = isPolish
      ? ['Dlaczego pilne?', 'Plan działania', 'Kto może pomóc?']
      : ['Why urgent?', 'Action plan', 'Who can help?'];
    const relationItems: RelationItem[] = [];
    if ((idea as any).sourceType) {
      relationItems.push({
        label: `${t('myWork.ideasList.source', 'Source')}: ${(idea as any).sourceType}`,
        tone: 'text-c-text-secondary',
      });
    }
    const actionRows: ActionRow[] = [
      {
        columns: 3,
        buttons: [
          {
            label: t('myWork.ideasList.label2', 'Convert'),
            icon: Sparkles,
            onClick: () => setConvertIdea(idea),
            colorScheme: 'primary',
          },
          {
            label: t('myWork.ideasList.label3', 'Open Flow'),
            icon: Workflow,
            onClick: () => openIdeaInProcessFlow(idea),
            // Nawigacyjne, nic nie zamyka -> neutral (§7.3b), zgodnie z tym samym
            // przyciskiem w IdeasTableContent.tsx. Bylo 'emerald', rozjechane.
            colorScheme: 'neutral',
          },
          {
            label: t('myWork.ideasList.label4', 'Delete'),
            icon: Trash2,
            onClick: () => handleDeleteSingleIdea(idea),
            colorScheme: 'red',
          },
        ],
      },
    ];
    return (
      <div className="space-y-0">
        <PreviewAIHintStrip hints={aiHints} />
        <div className="border-t border-c-border-subtle my-3" />
        <PreviewRelations
          items={relationItems}
          emptyLabel={t('myWork.ideasList.emptyLabel', 'No linked documents')}
        />
        <div className="border-t border-c-border-subtle my-3" />
        <PreviewActionBar rows={actionRows} />
        <div className="mt-2">
          <ConvertToOutputMenu
            sourceType="idea"
            sourceId={idea.id}
            sourceTitle={idea.title || ''}
            onConvertComplete={() => fetchIdeas()}
            variant="dropdown"
          />
        </div>
      </div>
    );
  };

  // Card ⋮ — canon §8.0: IDENTICAL sections/positions to the Ideas table row.
  const buildIdeaCardSections = (idea: MyIdea): RowActionSection[] => [
    {
      id: 'open',
      kind: 'open',
      actions: [
        {
          id: 'open',
          label: t('myWork.ideasList.label5', 'Open'),
          icon: ExternalLink,
          onClick: () => openIdea(idea.id, idea),
        },
        {
          id: 'flow',
          label: 'Process Flow',
          icon: Workflow,
          onClick: () => openIdeaInProcessFlow(idea),
        },
      ],
    },
    /**
     * Blok 2 kanonu A6 — PRZEJŚCIA STANU.
     *
     * Przegląd 128 zrzutów: kebab Ideas miał ~20 pozycji i ani jednej, która
     * zmienia Stage — „brak bloku 2, nie da się zmienić Stage" (OBR-03).
     * Etap widniał w kolumnie i w chipie podglądu, ale przestawić go dało się
     * wyłącznie wchodząc w ideę. Tasks robi to poprawnie od dawna
     * (To do / In progress / Blocked), Inbox też (Focus →), Decisions też
     * (Approve / Reject) — Ideas było jedynym wyjątkiem.
     *
     * Zapis działa: `PUT /my-work/my-ideas/:id` przyjmuje `stage`
     * (`my-work.routes.ts`), więc to była luka W UI, nie w backendzie.
     * Bieżący etap jest wyłączony — klikanie go byłoby zapisem bez zmiany.
     */
    {
      id: 'stage',
      kind: 'manage',
      actions: ETAPY_IDEI.map((etap) => ({
        id: `stage_${etap.id}`,
        label: etap.label(isPolish),
        icon: etap.icon,
        disabled: (idea.stage || 'spark') === etap.id,
        onClick: () => void handleZmienEtap(idea, etap.id),
      })),
    },
    {
      id: 'ai',
      kind: 'ai',
      actions: [
        {
          id: 'ai_chat',
          label: 'AI Chat',
          icon: MessageSquare,
          onClick: () => handleOpenIdeaAiChat(idea),
        },
        {
          id: 'ai_insights',
          label: 'AI Insights',
          icon: Bot,
          onClick: () => handleOpenIdeaAiInsights(idea),
        },
      ],
    },
    {
      id: 'convert',
      kind: 'convert',
      label: t('myWork.ideasList.label6', 'Convert to'),
      actions: [
        {
          id: 'convert_initiative',
          label: t('myWork.ideasList.label7', 'Initiative'),
          icon: Rocket,
          onClick: () => handleConvert('initiative', idea),
        },
        {
          id: 'convert_tasks',
          label: t('myWork.ideasList.label8', 'Tasks'),
          icon: CheckCircle2,
          onClick: () => handleConvert('task_set', idea),
        },
        {
          id: 'convert_decision',
          label: t('myWork.ideasList.label9', 'Decision'),
          icon: Star,
          onClick: () => handleConvert('decision', idea),
        },
        {
          id: 'convert_team_chat',
          label: 'Team Chat',
          icon: MessageSquarePlus,
          onClick: () => handleConvert('team_chat', idea),
        },
      ],
    },
    ...(foldersAvailable && folders.length > 0
      ? [
          {
            id: 'folder',
            kind: 'manage' as const,
            label: t('myWork.ideasList.label10', 'Folder'),
            actions: [
              {
                id: 'folder-none',
                label: t('myWork.ideasList.label11', 'No folder'),
                icon: FolderMinus,
                onClick: () => handleMoveToFolder(idea, null),
                disabled: !(idea as any).folderId,
              },
              ...folders.map((f) => ({
                id: `folder-${f.id}`,
                label: f.name,
                icon: Folder,
                onClick: () => handleMoveToFolder(idea, f.id),
                rightLabel: (idea as any).folderId === f.id ? '✓' : undefined,
              })),
            ],
          },
        ]
      : []),
    // DÓŁ — FIXED BOTTOM MANIFEST (canon §9.2). Ideas have no `due_date` → no Delay slot.
    {
      id: 'fixed',
      kind: 'manage',
      actions: [
        {
          id: 'open-preview',
          label: t('myWork.ideasList.label12', 'Open preview'),
          icon: ChevronRight,
          onClick: () => setPreviewIdeaId(idea.id),
        },
        {
          id: 'edit',
          label: t('myWork.ideasList.label13', 'Edit'),
          icon: Edit2,
          onClick: () => openIdea(idea.id, idea),
        },
        {
          id: 'archive',
          label: t('myWork.ideasList.label14', 'Archive'),
          icon: Archive,
          disabled: true,
          description: t('myWork.ideasList.description', 'Coming soon (backend)'),
          onClick: () => {},
        },
      ],
    },
    {
      id: 'output',
      kind: 'output',
      actions: [
        {
          // Z3 audit (2026-07-24): 'presentation' is `status: 'live'` in the SSOT
          // (ideaConvertTargets.ts) with a real server handler (my-work.routes.ts,
          // `target === 'presentation'`). Card kebab canon §8.0 requires this to
          // stay IDENTICAL to the Ideas table row kebab (IdeasTableContent.tsx) —
          // fixed there in the same pass, mirrored here.
          id: 'output_presentation',
          label: t('myWork.ideasList.label15', 'Presentation'),
          icon: Presentation,
          onClick: () => handleConvert('presentation', idea),
        },
        {
          // Z3 audit (2026-07-24): 'report' is `status: 'live'` in the SSOT with a
          // real server handler (`target === 'report'`). See note above.
          id: 'output_report',
          label: t('myWork.ideasList.label16', 'Report'),
          icon: GitBranch,
          onClick: () => handleConvert('report', idea),
        },
        {
          // Z3 audit (2026-07-24): 'table' is NOT a convert target anywhere in the
          // system — absent from IdeaConvertTarget (SSOT) and from
          // LIVE_CONVERT_TARGETS on the server; a real request would 400. Stays
          // disabled — this one is genuinely "soon", not a placeholder removed on faith.
          id: 'output_table',
          label: t('myWork.ideasList.label17', 'Table'),
          icon: Table2,
          disabled: true,
          rightLabel: t('myWork.ideasList.rightLabel3', 'soon'),
          onClick: () => undefined,
        },
      ],
    },
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'delete',
          label: t('myWork.ideasList.label18', 'Delete'),
          icon: Trash2,
          variant: 'danger',
          onClick: () => handleDeleteSingleIdea(idea),
        },
      ],
    },
  ];

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
      sorted.push([t('myWork.ideasList.untagged', 'Untagged'), untagged]);
    }
    return sorted;
  }, [sortedIdeas, isPolish]);

  // ── Loading ──

  if (loading) {
    return (
      <div className="w-full p-4" style={{ minHeight: 300 }}>
        <SharedLoadingState template="list" rows={6} />
      </div>
    );
  }

  // Distinguish error from empty: on a failed load, show ErrorState with retry —
  // NOT the empty "Idea Garden" CTA (which falsely implies the user has 0 ideas).
  if (loadError) {
    return (
      <div className="w-full flex items-center justify-center" style={{ minHeight: 300 }}>
        <ErrorState message={loadError} retry={fetchIdeas} />
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
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-500" />
            <div className="text-sm font-semibold text-c-text">
              {t('myWork.ideasList.convertIdea', 'Convert idea')}
            </div>
          </div>
          <button
            onClick={() => setConvertIdea(null)}
            disabled={converting}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text-secondary transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-c-text-muted">{convertIdea.title}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                target: 'initiative' as const,
                icon: Rocket,
                color: 'text-amber-500',
                label: t('myWork.ideasList.label19', 'Initiative'),
                desc: t('myWork.ideasList.desc', 'Create a PMO initiative'),
              },
              {
                target: 'task_set' as const,
                icon: CheckCircle2,
                color: 'text-emerald-500',
                label: t('myWork.ideasList.label20', 'Tasks'),
                desc: t('myWork.ideasList.desc2', 'From next steps (if available)'),
              },
              {
                target: 'decision' as const,
                icon: Star,
                color: 'text-blue-500',
                label: t('myWork.ideasList.label21', 'Decision'),
                desc: t('myWork.ideasList.desc3', 'Decision artifact'),
              },
              {
                target: 'team_chat' as const,
                icon: MessageSquarePlus,
                color: 'text-blue-500',
                label: t('myWork.ideasList.label22', 'Team Chat'),
                desc: t('myWork.ideasList.desc4', 'Discussion thread'),
              },
            ].map(({ target, icon: Icon, color, label, desc }) => (
              <button
                key={target}
                onClick={() => handleConvert(target)}
                disabled={converting}
                className="text-left p-3 rounded-xl border border-c-border-subtle hover:bg-black/[0.04] dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-c-text-secondary">
                  <Icon size={16} className={color} />
                  {label}
                </div>
                <div className="mt-1 text-[11px] text-c-text-muted">{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised">
          <button
            onClick={() => setConvertIdea(null)}
            disabled={converting}
            className="px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:text-c-text transition-colors disabled:opacity-50"
          >
            {t('myWork.ideasList.close', 'Close')}
          </button>
          {converting && (
            <div className="flex items-center gap-2 text-xs text-c-text-muted">
              <Loader2 size={14} className="animate-spin" />
              {t('myWork.ideasList.creating', 'Creating…')}
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
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-amber-500" />
            <div className="text-sm font-semibold text-c-text">
              {t('myWork.ideasList.addTag', 'Add tag')}
            </div>
          </div>
          <button
            onClick={() => setTagModalOpen(false)}
            disabled={bulkBusy}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text-secondary transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-c-text-muted">
            {isPolish
              ? `Zostanie dodany do ${selectedIds.size} pomysłów`
              : `Will be added to ${selectedIds.size} ideas`}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={t('myWork.ideasList.placeholder', 'e.g. backlog')}
            className="w-full h-10 px-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised">
          <button
            onClick={() => setTagModalOpen(false)}
            disabled={bulkBusy}
            className="px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:text-c-text transition-colors disabled:opacity-50"
          >
            {t('myWork.ideasList.cancel', 'Cancel')}
          </button>
          <button
            onClick={bulkAddTag}
            disabled={bulkBusy || !tagInput.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {bulkBusy && <Loader2 size={14} className="animate-spin" />}
            {t('myWork.ideasList.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Empty state ──

  // Empty state is context-aware: an empty *folder* must NOT show the global
  // "Idea Garden awaits" CTA (misleading when ALL=110). It shows a folder-scoped
  // message plus a clear way back to "All".
  const activeFolder = activeFolderId
    ? (folders.find((f) => f.id === activeFolderId) ?? null)
    : null;

  const renderEmpty = () => {
    if (activeFolder) {
      return (
        <div
          className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl"
          data-testid="ideas-folder-empty"
        >
          <div className="relative mb-4">
            <Folder size={44} className="text-c-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-c-text-secondary mb-2">
            {t('myWork.ideasList.thisFolderIsEmpty', 'This folder is empty')}
          </h3>
          <p className="text-sm text-c-text-muted mb-4 max-w-md">
            {isPolish
              ? `Nie przypisano jeszcze żadnych pomysłów do „${activeFolder.name}". Przypisz istniejące pomysły z menu ⋮ albo wróć do wszystkich.`
              : `No ideas assigned to "${activeFolder.name}" yet. Assign existing ideas from the ⋮ menu, or go back to all.`}
          </p>
          <button
            type="button"
            onClick={() => setActiveFolderId(null)}
            data-testid="ideas-folder-empty-back"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-800"
          >
            <ChevronLeft size={15} />
            {t('myWork.ideasList.backToAllIdeas', 'Back to all ideas')}
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
        <div className="relative mb-4">
          <Flower2 size={48} className="text-amber-400" />
          <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-500 animate-pulse" />
        </div>
        <h3 className="text-lg font-medium text-c-text-secondary mb-2">
          {t('myWork.ideasList.yourIdeaGardenAwaits', 'Your Idea Garden awaits')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4 max-w-md">
          {t(
            'myWork.ideasList.plantYourFirstIdea',
            'Plant your first idea — AI will help it grow, research context, and propose creative variants.'
          )}
        </p>
        <button
          onClick={onCreateIdea}
          className="inline-flex h-9 items-center justify-center rounded-full border border-c-text bg-c-text px-4 text-sm font-semibold text-c-bg transition-colors duration-150 hover:bg-c-text-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 dark:border-c-text dark:bg-c-text dark:hover:bg-c-text-secondary"
        >
          {t('myWork.ideasList.plantAnIdea', 'Plant an idea')}
        </button>
      </div>
    );
  };

  // ── Sort indicator ──

  // ════════════════════════════════════════════════════════════════════════════
  // ── TABLE VIEW (App Table + Preview) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (viewMode === 'table') {
    if (sortedIdeas.length === 0) {
      return (
        <div className="w-full h-full overflow-y-auto bg-c-bg p-4">
          {convertModal}
          {tagModal}
          {confirmDialog}
          <div className="mt-4 px-4 pb-4">{renderEmpty()}</div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-c-bg">
        {convertModal}
        {tagModal}
        {confirmDialog}
        {/* Match Tasks/Inbox: bounded height so table scrolls inside row and preview stays viewport-high */}
        <div className="flex flex-col flex-1 min-h-0">
          <IdeasTableContent
            ideas={sortedIdeas}
            isPolish={isPolish}
            tableFilters={tableFilters}
            availableStageOptions={availableStageOptions}
            availableTagOptions={availableTagOptions}
            availableToolOptions={availableToolOptions}
            columnWidths={columnWidths}
            selectedIds={selectedIds}
            allSelected={allSelected}
            someSelected={someSelected}
            focusedIndex={focusedIndex}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onFocusIndexChange={setFocusedIndex}
            onToggleSelect={toggleSelect}
            onSelectAllVisible={selectAllVisible}
            onClearSelection={clearSelection}
            onColumnResize={(columnId, value) =>
              setColumnWidths((prev) => ({
                ...prev,
                [columnId]: value,
              }))
            }
            onTableFilterChange={(columnId, value) =>
              setTableFilters((prev) => ({
                ...prev,
                [columnId]: value.length > 0 ? value : undefined,
              }))
            }
            onOpenIdea={(idea) => openIdea(idea.id, idea)}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            folders={foldersAvailable ? folders : undefined}
            onMoveToFolder={foldersAvailable ? handleMoveToFolder : undefined}
            onOpenIdeaInProcessFlow={openIdeaInProcessFlow}
            onOpenIdeaAiChat={handleOpenIdeaAiChat}
            onOpenIdeaAiInsights={handleOpenIdeaAiInsights}
            onStartConvert={setConvertIdea}
            onConvertIdeaToTarget={(idea, target) => handleConvert(target, idea)}
            onDeleteIdea={handleDeleteSingleIdea}
            onRefresh={fetchIdeas}
          />
        </div>

        <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── CARDS VIEW (tool-colored cards) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (viewMode === 'grid') {
    if (sortedIdeas.length === 0) {
      return (
        <div className="w-full h-full overflow-y-auto bg-c-bg p-4">
          {convertModal}
          {tagModal}
          {confirmDialog}
          <div className="mt-4 px-4 pb-4">{renderEmpty()}</div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-c-bg">
        {convertModal}
        {tagModal}
        {confirmDialog}
        <div className="flex flex-col flex-1 min-h-0">
          <TableWithPreviewLayout<MyIdea>
            selectedId={previewIdeaId}
            selectedItem={previewIdea}
            onSelect={setPreviewIdeaId}
            previewOpen={Boolean(previewIdeaId)}
            autoOpenPreview={false}
            desktopPreviewOverlay={isIdeasPreviewOverlayEnabled()}
            onOpenFull={(id) => {
              const idea = sortedIdeas.find((item) => item.id === id);
              if (idea) openIdea(idea.id, idea);
            }}
            itemIds={previewIdeaIds}
            getItemById={(id) => sortedIdeas.find((idea) => idea.id === id) || null}
            renderPreview={renderIdeaPreview}
            renderPreviewFooter={renderIdeaPreviewFooter}
          >
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedIdeas.map((idea) => {
                  const stage = (idea.stage || 'spark') as IdeaStage;
                  const isSelected = selectedIds.has(idea.id);
                  const isPreviewSelected = previewIdeaId === idea.id;

                  return (
                    // Card — canon §8.1 4-zone GridCard. Single-click → side preview;
                    // double-click → full view. Neutral surface, NO border-l accent.
                    <div
                      key={idea.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewIdeaId(idea.id)}
                      onDoubleClick={() => openIdea(idea.id, idea)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          openIdea(idea.id, idea);
                        }
                      }}
                      className={[
                        'group relative cursor-pointer rounded-xl p-4 text-left',
                        'border border-c-border-subtle',
                        'bg-c-surface',
                        'hover:shadow-md hover:-translate-y-px transition-all duration-150',
                        isPreviewSelected || isSelected
                          ? 'ring-2 ring-c-border-strong dark:ring-white/20'
                          : '',
                      ].join(' ')}
                    >
                      {/* Zone 1 — Badge row (stage · tool) + kebab */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {renderStageBadge(stage)}
                          {renderToolBadge(idea.preferredTool)}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(idea.id);
                            }}
                            aria-label={isFavorite(idea.id) ? 'Unstar' : 'Star'}
                            aria-pressed={isFavorite(idea.id)}
                            className={`rounded p-0.5 transition-opacity ${
                              isFavorite(idea.id)
                                ? 'text-amber-400 opacity-100'
                                : 'text-c-text-muted opacity-0 hover:text-amber-400 group-hover:opacity-100 focus:opacity-100'
                            }`}
                          >
                            <Star
                              size={15}
                              className={isFavorite(idea.id) ? 'fill-amber-400 text-amber-400' : ''}
                            />
                          </button>
                          {/* Kebab — same RowActionsMenu/sections as the table row (§8.0) */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <RowActionsMenu sections={buildIdeaCardSections(idea)} />
                          </div>
                        </div>
                      </div>

                      {/* Zone 2 — Title */}
                      <h4
                        className="font-semibold text-sm text-c-text line-clamp-2 leading-snug"
                        title={idea.title || ''}
                      >
                        {idea.title || t('myWork.ideasList.untitled2', 'Untitled')}
                      </h4>

                      {/* Zone 3 — Description (when available) */}
                      {idea.body && (
                        <p className="mt-1 text-xs text-c-text-muted line-clamp-2">{idea.body}</p>
                      )}

                      {/* Zone 4 — Stats footer: tags · updated date */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-c-text-muted border-t border-c-border-subtle mt-3 pt-3">
                        <div className="min-w-0 flex-1">
                          {(idea.tags || []).length > 0 ? (
                            renderTagBadges(idea.tags, 2)
                          ) : (
                            <span className="text-c-text-muted">—</span>
                          )}
                        </div>
                        <span className="shrink-0">
                          {idea.updatedAt
                            ? formatListDate(idea.updatedAt)
                            : idea.createdAt
                              ? formatListDate(idea.createdAt)
                              : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TableWithPreviewLayout>
        </div>

        <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── TAGS VIEW (grouped by AI tags, collapsible sections) ──
  // ════════════════════════════════════════════════════════════════════════════

  if (sortedIdeas.length === 0) {
    return (
      <div className="w-full h-full overflow-y-auto bg-c-bg p-4">
        {convertModal}
        {tagModal}
        {confirmDialog}
        <div className="p-4">{renderEmpty()}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-c-bg">
      {convertModal}
      {tagModal}
      {confirmDialog}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-primary-400/20 dark:from-amber-500/15 dark:to-primary-500/15">
            <Tag size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-c-text">
              {t('myWork.ideasList.ideasByTags', 'Ideas by Tags')}
            </h2>
            <p className="text-[11px] text-c-text-muted">
              {isPolish
                ? `${tagGroups.length} grup · ${sortedIdeas.length} pomysłów`
                : `${tagGroups.length} groups · ${sortedIdeas.length} ideas`}
            </p>
          </div>
        </div>

        {tagGroups.map(([tag, groupIdeas]) => {
          const isCollapsed = collapsedTags.has(tag);
          return (
            <div key={tag} className="rounded-xl border border-c-border-subtle overflow-hidden">
              <button
                onClick={() => toggleTagCollapse(tag)}
                aria-expanded={!isCollapsed}
                className="w-full flex items-center gap-2.5 px-4 py-3 bg-c-surface-raised hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-c-text-muted" />
                ) : (
                  <ChevronDown size={14} className="text-c-text-muted" />
                )}
                <Tag size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-c-text-secondary">{tag}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {groupIdeas.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-c-border-subtle">
                  {groupIdeas.map((idea) => {
                    const stage = (idea.stage || 'spark') as IdeaStage;
                    const tc = getToolConfig(idea.preferredTool);
                    const ToolIcon = tc.icon;

                    return (
                      <div
                        key={`${tag}-${idea.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openIdea(idea.id, idea)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openIdea(idea.id, idea);
                          }
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <div className={`flex-shrink-0 p-1.5 rounded-lg ${tc.bgColor}`}>
                          <ToolIcon size={14} className={tc.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-c-text truncate">
                            {idea.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(idea.id);
                            }}
                            aria-label={isFavorite(idea.id) ? 'Unstar' : 'Star'}
                            aria-pressed={isFavorite(idea.id)}
                            className={`rounded p-0.5 transition-colors ${
                              isFavorite(idea.id)
                                ? 'text-amber-400'
                                : 'text-c-text-muted hover:text-amber-400'
                            }`}
                          >
                            <Star
                              size={13}
                              className={isFavorite(idea.id) ? 'fill-amber-400 text-amber-400' : ''}
                            />
                          </button>
                          {renderStageBadge(stage)}
                          {renderToolBadge(idea.preferredTool)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openIdeaInProcessFlow(idea);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 transition-colors"
                            title={t('myWork.ideasList.title3', 'Open in Process Flow')}
                          >
                            <Workflow size={10} />
                            Flow
                          </button>
                          <span className="text-[10px] text-c-text-muted whitespace-nowrap">
                            {idea.updatedAt
                              ? formatListDate(idea.updatedAt)
                              : idea.createdAt
                                ? formatListDate(idea.createdAt)
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
