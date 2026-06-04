import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Folder,
  FolderMinus,
  Lightbulb,
  MessageSquare,
  MessageSquarePlus,
  Network,
  PenTool,
  Presentation,
  Rocket,
  Settings2,
  Sparkles,
  Sprout,
  Star,
  Table2,
  Trash2,
  TreePine,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { MetaChip, ToolChip } from '@/components/ui/primitives/chips';
import type {
  ColumnDef,
  ColumnWidths,
  FilterOption,
  TableFilters,
} from '@/components/ui/ResizableTable';
import { ColumnResizer, FilterDropdown } from '@/components/ui/ResizableTable';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import type { IdeaStage, MyIdea, SortDir, SortField } from './myIdeasTypes';

type IdeaConvertTarget = 'initiative' | 'task_set' | 'decision' | 'team_chat';
type IdeasTableOptionalColumn = 'stage' | 'tags' | 'tool' | 'date';
type IdeasResizableColumn = 'title' | IdeasTableOptionalColumn;

const IDEAS_TABLE_COLUMNS_STORAGE_KEY = 'consultify.mywork.ideas.tableColumns.v1';
const IDEAS_TABLE_ROW_DESCRIPTION_STORAGE_KEY = 'consultify.mywork.ideas.showRowDescription.v1';
const IDEAS_TABLE_OPTIONAL_COLUMNS: Array<{
  id: IdeasTableOptionalColumn;
  label: string;
  labelPl: string;
}> = [
  { id: 'stage', label: 'Stage', labelPl: 'Etap' },
  { id: 'tags', label: 'Tags', labelPl: 'Tagi' },
  { id: 'tool', label: 'Tool', labelPl: 'Narzędzie' },
  { id: 'date', label: 'Updated', labelPl: 'Data' },
];
const IDEAS_RESIZE_BOUNDS: Record<IdeasResizableColumn, { min: number; max: number }> = {
  title: { min: 360, max: 900 },
  stage: { min: 120, max: 220 },
  tags: { min: 170, max: 360 },
  tool: { min: 150, max: 260 },
  date: { min: 110, max: 150 },
};

function loadHiddenIdeaColumns(): IdeasTableOptionalColumn[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(IDEAS_TABLE_COLUMNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((column): column is IdeasTableOptionalColumn =>
      IDEAS_TABLE_OPTIONAL_COLUMNS.some((item) => item.id === column)
    );
  } catch {
    return [];
  }
}

function saveHiddenIdeaColumns(columns: IdeasTableOptionalColumn[]) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IDEAS_TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    /* ignore persistence errors */
  }
}

function loadIdeaRowDescriptionSetting(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(IDEAS_TABLE_ROW_DESCRIPTION_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function saveIdeaRowDescriptionSetting(showDescription: boolean) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IDEAS_TABLE_ROW_DESCRIPTION_STORAGE_KEY, String(showDescription));
  } catch {
    /* ignore persistence errors */
  }
}

const STAGE_META: Record<
  IdeaStage,
  {
    label: string;
    labelPl: string;
    icon: React.ElementType;
    badge: string;
    iconClass: string;
  }
> = {
  spark: {
    label: 'Spark',
    labelPl: 'Iskra',
    icon: Lightbulb,
    badge:
      'border border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-300',
  },
  incubating: {
    label: 'Growing',
    labelPl: 'Rosnie',
    icon: Sprout,
    badge:
      'border border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  shaping: {
    label: 'Shaping',
    labelPl: 'Ksztaltuje',
    icon: TreePine,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
    iconClass: 'text-blue-600 dark:text-blue-300',
  },
  ready: {
    label: 'Ready',
    labelPl: 'Gotowy',
    icon: CheckCircle2,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
    iconClass: 'text-blue-600 dark:text-blue-300',
  },
  promoted: {
    label: 'Promoted',
    labelPl: 'Promowany',
    icon: Rocket,
    badge:
      'border border-rose-300/80 bg-rose-50 text-rose-900 dark:border-rose-300/[0.25] dark:bg-rose-300/[0.12] dark:text-rose-100',
    iconClass: 'text-rose-600 dark:text-rose-300',
  },
};

const TOOL_META: Record<
  string,
  {
    label: string;
    labelPl: string;
    icon: React.ElementType;
    badge: string;
    iconClass: string;
    /** Canonical ToolChip icon color — semantic `c.*` var. */
    iconColorVar: string;
  }
> = {
  mindmap: {
    label: 'Recommendation map',
    labelPl: 'Mapa rekomendacji',
    icon: Network,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-primary-600 dark:text-primary-300',
    iconColorVar: 'var(--c-accent)',
  },
  table: {
    label: 'Table',
    labelPl: 'Tabela',
    icon: Table2,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-sky-600 dark:text-sky-300',
    iconColorVar: 'var(--c-info)',
  },
  process_flow: {
    label: 'Process Flow',
    labelPl: 'Proces',
    icon: Workflow,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
    iconColorVar: 'var(--c-success)',
  },
  whiteboard: {
    label: 'Whiteboard',
    labelPl: 'Whiteboard',
    icon: PenTool,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-amber-600 dark:text-amber-300',
    iconColorVar: 'var(--c-warning)',
  },
};

interface IdeasTableContentProps {
  ideas: MyIdea[];
  isPolish: boolean;
  tableFilters: TableFilters;
  availableStageOptions: FilterOption[];
  availableTagOptions: FilterOption[];
  availableToolOptions: FilterOption[];
  columnWidths: ColumnWidths;
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  focusedIndex: number;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onFocusIndexChange: (index: number) => void;
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onColumnResize: (columnId: string, width: number) => void;
  onTableFilterChange: (columnId: 'stage' | 'tags' | 'tool', value: string[]) => void;
  onOpenIdea: (idea: MyIdea) => void;
  isFavorite?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
  folders?: Array<{ id: string; name: string }>;
  onMoveToFolder?: (idea: MyIdea, folderId: string | null) => void;
  onOpenIdeaInProcessFlow: (idea: MyIdea) => void;
  onOpenIdeaAiChat?: (idea: MyIdea) => void;
  onOpenIdeaAiInsights?: (idea: MyIdea) => void;
  onStartConvert: (idea: MyIdea) => void;
  onConvertIdeaToTarget?: (idea: MyIdea, target: IdeaConvertTarget) => void;
  onDeleteIdea: (idea: MyIdea) => void;
  onRefresh: () => void;
}

function getStageMeta(stage?: IdeaStage) {
  return STAGE_META[(stage || 'spark') as IdeaStage] || STAGE_META.spark;
}

function getToolMeta(tool?: string | null) {
  const key = String(tool || 'mindmap').toLowerCase();
  return TOOL_META[key] || TOOL_META.mindmap;
}

function formatIdeaDate(idea: MyIdea) {
  const value = idea.updatedAt || idea.createdAt;
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return null;
  return (
    <span className="ml-1 inline-flex text-[10px] text-slate-600">
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export const IdeasTableContent: React.FC<IdeasTableContentProps> = ({
  ideas,
  isPolish,
  tableFilters,
  availableStageOptions,
  availableTagOptions,
  availableToolOptions,
  columnWidths,
  selectedIds,
  allSelected,
  someSelected,
  focusedIndex,
  sortField,
  sortDir,
  onSort,
  onFocusIndexChange,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection,
  onColumnResize,
  onTableFilterChange,
  onOpenIdea,
  isFavorite,
  onToggleFavorite,
  folders,
  onMoveToFolder,
  onOpenIdeaInProcessFlow,
  onOpenIdeaAiChat,
  onOpenIdeaAiInsights,
  onStartConvert,
  onConvertIdeaToTarget,
  onDeleteIdea,
  onRefresh,
}) => {
  const [previewIdeaId, setPreviewIdeaId] = useState<string | null>(null);
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const viewSettingsRef = useRef<HTMLDivElement | null>(null);
  const [hiddenColumns, setHiddenColumns] =
    useState<IdeasTableOptionalColumn[]>(loadHiddenIdeaColumns);
  const [showRowDescription, setShowRowDescription] = useState(loadIdeaRowDescriptionSetting);
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const isColumnVisible = useCallback(
    (columnId: IdeasTableOptionalColumn) => !hiddenColumnSet.has(columnId),
    [hiddenColumnSet]
  );

  const updateHiddenColumns = (next: IdeasTableOptionalColumn[]) => {
    setHiddenColumns(next);
    saveHiddenIdeaColumns(next);
  };

  const updateRowDescriptionSetting = (next: boolean) => {
    setShowRowDescription(next);
    saveIdeaRowDescriptionSetting(next);
  };

  const toggleColumnVisibility = (columnId: IdeasTableOptionalColumn) => {
    updateHiddenColumns(
      hiddenColumnSet.has(columnId)
        ? hiddenColumns.filter((item) => item !== columnId)
        : [...hiddenColumns, columnId]
    );
  };

  const getVisibleResizableColumns = useCallback((): IdeasResizableColumn[] => {
    return [
      'title',
      ...(IDEAS_TABLE_OPTIONAL_COLUMNS.map((column) => column.id).filter((columnId) =>
        isColumnVisible(columnId)
      ) as IdeasTableOptionalColumn[]),
    ];
  }, [isColumnVisible]);

  const handleColumnBoundaryResize = useCallback(
    (columnId: string, requestedWidth: number) => {
      const currentColumn = columnId as IdeasResizableColumn;
      const currentBounds = IDEAS_RESIZE_BOUNDS[currentColumn];
      if (!currentBounds) {
        onColumnResize(columnId, requestedWidth);
        return;
      }

      const currentWidth = columnWidths[currentColumn];
      const visibleColumns = getVisibleResizableColumns();
      const nextColumn = visibleColumns[visibleColumns.indexOf(currentColumn) + 1];
      const clampedWidth = Math.max(currentBounds.min, Math.min(currentBounds.max, requestedWidth));

      if (!nextColumn) {
        onColumnResize(currentColumn, clampedWidth);
        return;
      }

      const nextBounds = IDEAS_RESIZE_BOUNDS[nextColumn];
      const nextWidth = columnWidths[nextColumn];
      const requestedDelta = clampedWidth - currentWidth;
      const requestedNextWidth = nextWidth - requestedDelta;
      const clampedNextWidth = Math.max(
        nextBounds.min,
        Math.min(nextBounds.max, requestedNextWidth)
      );
      const appliedDelta = nextWidth - clampedNextWidth;

      onColumnResize(currentColumn, currentWidth + appliedDelta);
      onColumnResize(nextColumn, clampedNextWidth);
    },
    [columnWidths, getVisibleResizableColumns, onColumnResize]
  );

  useEffect(() => {
    if (!viewSettingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (viewSettingsRef.current?.contains(event.target as Node)) return;
      setViewSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewSettingsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewSettingsOpen]);

  useEffect(() => {
    if (!previewIdeaId) return;
    if (!ideas.some((idea) => idea.id === previewIdeaId)) {
      setPreviewIdeaId(null);
    }
  }, [ideas, previewIdeaId]);

  useEffect(() => {
    if (selectedIds.size > 1) {
      setPreviewIdeaId(null);
    }
  }, [selectedIds]);

  const previewIdea = useMemo(
    () => (previewIdeaId ? ideas.find((idea) => idea.id === previewIdeaId) || null : null),
    [ideas, previewIdeaId]
  );

  const ideaIds = useMemo(() => ideas.map((idea) => idea.id), [ideas]);
  const tableMinWidth = useMemo(() => {
    const optionalWidth =
      (isColumnVisible('stage') ? columnWidths.stage : 0) +
      (isColumnVisible('tags') ? columnWidths.tags : 0) +
      (isColumnVisible('tool') ? columnWidths.tool : 0) +
      (isColumnVisible('date') ? columnWidths.date : 0);

    return Math.max(
      1120,
      columnWidths.select + columnWidths.title + optionalWidth + columnWidths.actions
    );
  }, [
    columnWidths.actions,
    columnWidths.date,
    columnWidths.select,
    columnWidths.stage,
    columnWidths.tags,
    columnWidths.title,
    columnWidths.tool,
    isColumnVisible,
  ]);

  const stageColumn: ColumnDef = useMemo(
    () => ({
      id: 'stage',
      label: isPolish ? 'Etap' : 'Stage',
      width: columnWidths.stage,
      minWidth: 120,
      maxWidth: 180,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: availableStageOptions,
    }),
    [availableStageOptions, columnWidths.stage, isPolish]
  );

  const toolColumn: ColumnDef = useMemo(
    () => ({
      id: 'tool',
      label: isPolish ? 'Narzedzie' : 'Tool',
      width: columnWidths.tool,
      minWidth: 150,
      maxWidth: 220,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: availableToolOptions,
    }),
    [availableToolOptions, columnWidths.tool, isPolish]
  );

  const tagsColumn: ColumnDef = useMemo(
    () => ({
      id: 'tags',
      label: isPolish ? 'Tagi' : 'Tags',
      width: columnWidths.tags,
      minWidth: 140,
      maxWidth: 260,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: availableTagOptions,
    }),
    [availableTagOptions, columnWidths.tags, isPolish]
  );

  const renderStageBadge = (stage?: IdeaStage) => {
    const meta = getStageMeta(stage);
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[10px] font-semibold leading-none ${meta.badge}`}
      >
        <Icon size={11} className={meta.iconClass} />
        {isPolish ? meta.labelPl : meta.label}
      </span>
    );
  };

  const renderToolBadge = (tool?: string | null) => {
    const meta = getToolMeta(tool);
    // Canonical ToolChip: colored tool icon on a neutral (c-token) surface.
    return (
      <ToolChip
        icon={meta.icon as LucideIcon}
        iconColor={meta.iconColorVar}
        label={isPolish ? meta.labelPl : meta.label}
      />
    );
  };

  const renderTagBadges = (tags?: string[], max = 2) => {
    if (!tags?.length) {
      return <span className="text-[11px] text-slate-600">—</span>;
    }

    // Canonical neutral metadata chips (MetaChip) — tags are never colored (§N).
    return (
      <div className="flex min-w-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
        {tags.slice(0, max).map((tag) => (
          <MetaChip key={tag} label={tag} />
        ))}
        {tags.length > max ? <MetaChip label={`+${tags.length - max}`} /> : null}
      </div>
    );
  };

  const renderPreview = (idea: MyIdea) => {
    const stageMeta = getStageMeta(idea.stage);
    const StageIcon = stageMeta.icon;
    const toolMeta = getToolMeta(idea.preferredTool);
    const ToolIcon = toolMeta.icon;

    const metaPills: MetaPill[] = [
      {
        label: isPolish ? stageMeta.labelPl : stageMeta.label,
        className: stageMeta.badge,
        icon: StageIcon,
      },
      {
        label: isPolish ? toolMeta.labelPl : toolMeta.label,
        className: toolMeta.badge,
        icon: ToolIcon,
      },
    ];

    const metaTrailing = (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {formatIdeaDate(idea)}
        </span>
      </div>
    );

    const detailsText = idea.body || '';

    const contextParts: string[] = [];
    if (idea.sourceType) contextParts.push(`${isPolish ? 'Źródło' : 'Source'}: ${idea.sourceType}`);
    if (typeof idea.mapItems === 'number')
      contextParts.push(`${isPolish ? 'Elementy' : 'Items'}: ${idea.mapItems}`);
    if (typeof idea.mapNodes === 'number') contextParts.push(`Nodes: ${idea.mapNodes}`);
    if (typeof idea.mapEdges === 'number')
      contextParts.push(`${isPolish ? 'Połączenia' : 'Edges'}: ${idea.mapEdges}`);

    return (
      <div className="space-y-4">
        <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
          {idea.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </PreviewMetaCard>

        <PreviewDetailsSection text={detailsText} label={isPolish ? 'Szczegóły' : 'Details'}>
          {contextParts.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/[0.06]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {isPolish ? 'Kontekst' : 'Context'}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                {contextParts.map((part) => (
                  <span key={part} className="rounded-full bg-slate-100 px-2 py-1 dark:bg-navy-800">
                    {part}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </PreviewDetailsSection>
      </div>
    );
  };

  const renderPreviewFooter = (idea: MyIdea) => {
    const aiHints = isPolish
      ? ['Dlaczego pilne?', 'Plan działania', 'Kto może pomóc?']
      : ['Why urgent?', 'Action plan', 'Who can help?'];

    const relationItems: RelationItem[] = [];
    if (idea.sourceType) {
      relationItems.push({
        label: `${isPolish ? 'Źródło' : 'Source'}: ${idea.sourceType}`,
        tone: 'text-slate-600 dark:text-slate-400',
      });
    }

    const actionRows: ActionRow[] = [
      {
        columns: 3,
        buttons: [
          {
            label: isPolish ? 'Konwertuj' : 'Convert',
            icon: Sparkles,
            onClick: () => onStartConvert(idea),
            colorScheme: 'purple',
          },
          {
            label: isPolish ? 'Otwórz Flow' : 'Open Flow',
            icon: Workflow,
            onClick: () => onOpenIdeaInProcessFlow(idea),
            colorScheme: 'emerald',
          },
          {
            label: isPolish ? 'Usuń' : 'Delete',
            icon: Trash2,
            onClick: () => onDeleteIdea(idea),
            colorScheme: 'red',
          },
        ],
      },
    ];

    return (
      <div className="space-y-0">
        <PreviewAIHintStrip hints={aiHints} />

        <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

        <PreviewRelations
          items={relationItems}
          emptyLabel={isPolish ? 'Brak powiązań' : 'No linked documents'}
        />

        <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

        <PreviewActionBar rows={actionRows} />

        <div className="mt-2">
          <ConvertToOutputMenu
            sourceType="idea"
            sourceId={idea.id}
            sourceTitle={idea.title || ''}
            onConvertComplete={() => onRefresh()}
            variant="dropdown"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 bg-white dark:bg-navy-950">
      <TableWithPreviewLayout<MyIdea>
        selectedId={previewIdeaId}
        selectedItem={previewIdea}
        onSelect={setPreviewIdeaId}
        previewOpen={Boolean(previewIdeaId)}
        autoOpenPreview={false}
        onOpenFull={(id) => {
          const idea = ideas.find((item) => item.id === id);
          if (idea) onOpenIdea(idea);
        }}
        itemIds={ideaIds}
        getItemById={(id) => ideas.find((idea) => idea.id === id) || null}
        renderPreview={renderPreview}
        renderPreviewFooter={renderPreviewFooter}
      >
        <table
          className="w-full table-fixed bg-slate-50/40 dark:bg-navy-950"
          style={{ minWidth: tableMinWidth }}
        >
          <thead className="sticky top-0 z-10 bg-slate-100/95 shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur dark:bg-navy-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]">
            <tr className="border-b border-slate-300/70 dark:border-white/[0.10]">
              <th className="px-2 py-3" style={{ width: columnWidths.select }}>
                <button
                  onClick={() => {
                    if (allSelected) {
                      onClearSelection();
                    } else {
                      onSelectAllVisible();
                    }
                  }}
                  className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] transition-all ${
                    allSelected
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : someSelected
                        ? 'border-primary-500 bg-primary-500/50 text-white'
                        : 'border-slate-400/70 bg-white/70 text-transparent opacity-20 hover:border-primary-500 hover:bg-white hover:text-slate-500 hover:opacity-100 dark:border-white/[0.14] dark:bg-white/[0.03] dark:hover:bg-white/[0.07]'
                  }`}
                  title={isPolish ? 'Zaznacz widoczne' : 'Select visible'}
                >
                  {allSelected ? '✓' : someSelected ? '−' : '□'}
                </button>
              </th>
              <th
                className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                style={{ width: columnWidths.title }}
              >
                <button
                  onClick={() => onSort('title')}
                  className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {isPolish ? 'Tytul' : 'Title'}
                  <SortIndicator active={sortField === 'title'} direction={sortDir} />
                </button>
                <ColumnResizer
                  columnId="title"
                  currentWidth={columnWidths.title}
                  minWidth={IDEAS_RESIZE_BOUNDS.title.min}
                  maxWidth={IDEAS_RESIZE_BOUNDS.title.max}
                  onResize={handleColumnBoundaryResize}
                />
              </th>
              {isColumnVisible('stage') ? (
                <th
                  className="relative px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.stage }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onSort('stage')}
                      className="inline-flex items-center justify-center text-center transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <span
                        className={
                          (tableFilters.stage as string[] | undefined)?.length
                            ? 'text-primary-500'
                            : ''
                        }
                      >
                        {isPolish ? 'Etap' : 'Stage'}
                      </span>
                      <SortIndicator active={sortField === 'stage'} direction={sortDir} />
                    </button>
                    <FilterDropdown
                      column={stageColumn}
                      value={tableFilters.stage as string[] | undefined}
                      onChange={(value) => onTableFilterChange('stage', value as string[])}
                      isOpen={openFilterId === 'stage'}
                      onToggle={() => setOpenFilterId(openFilterId === 'stage' ? null : 'stage')}
                      onClose={() => setOpenFilterId(null)}
                    />
                  </div>
                  <ColumnResizer
                    columnId="stage"
                    currentWidth={columnWidths.stage}
                    minWidth={IDEAS_RESIZE_BOUNDS.stage.min}
                    maxWidth={IDEAS_RESIZE_BOUNDS.stage.max}
                    onResize={handleColumnBoundaryResize}
                  />
                </th>
              ) : null}
              {isColumnVisible('tags') ? (
                <th
                  className="relative px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.tags }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onSort('tags')}
                      className="inline-flex items-center justify-center text-center transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <span
                        className={
                          (tableFilters.tags as string[] | undefined)?.length
                            ? 'text-primary-500'
                            : ''
                        }
                      >
                        {isPolish ? 'Tagi' : 'Tags'}
                      </span>
                      <SortIndicator active={sortField === 'tags'} direction={sortDir} />
                    </button>
                    <FilterDropdown
                      column={tagsColumn}
                      value={tableFilters.tags as string[] | undefined}
                      onChange={(value) => onTableFilterChange('tags', value as string[])}
                      isOpen={openFilterId === 'tags'}
                      onToggle={() => setOpenFilterId(openFilterId === 'tags' ? null : 'tags')}
                      onClose={() => setOpenFilterId(null)}
                    />
                  </div>
                  <ColumnResizer
                    columnId="tags"
                    currentWidth={columnWidths.tags}
                    minWidth={IDEAS_RESIZE_BOUNDS.tags.min}
                    maxWidth={IDEAS_RESIZE_BOUNDS.tags.max}
                    onResize={handleColumnBoundaryResize}
                  />
                </th>
              ) : null}
              {isColumnVisible('tool') ? (
                <th
                  className="relative px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.tool }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onSort('tool')}
                      className="inline-flex items-center justify-center text-center transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <span
                        className={
                          (tableFilters.tool as string[] | undefined)?.length
                            ? 'text-primary-500'
                            : ''
                        }
                      >
                        {isPolish ? 'Narzedzie' : 'Tool'}
                      </span>
                      <SortIndicator active={sortField === 'tool'} direction={sortDir} />
                    </button>
                    <FilterDropdown
                      column={toolColumn}
                      value={tableFilters.tool as string[] | undefined}
                      onChange={(value) => onTableFilterChange('tool', value as string[])}
                      isOpen={openFilterId === 'tool'}
                      onToggle={() => setOpenFilterId(openFilterId === 'tool' ? null : 'tool')}
                      onClose={() => setOpenFilterId(null)}
                    />
                  </div>
                  <ColumnResizer
                    columnId="tool"
                    currentWidth={columnWidths.tool}
                    minWidth={IDEAS_RESIZE_BOUNDS.tool.min}
                    maxWidth={IDEAS_RESIZE_BOUNDS.tool.max}
                    onResize={handleColumnBoundaryResize}
                  />
                </th>
              ) : null}
              {isColumnVisible('date') ? (
                <th
                  className="relative px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.date }}
                >
                  <button
                    onClick={() => onSort('date')}
                    className="inline-flex items-center justify-center text-center transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {isPolish ? 'Data' : 'Updated'}
                    <SortIndicator active={sortField === 'date'} direction={sortDir} />
                  </button>
                  <ColumnResizer
                    columnId="date"
                    currentWidth={columnWidths.date}
                    minWidth={IDEAS_RESIZE_BOUNDS.date.min}
                    maxWidth={IDEAS_RESIZE_BOUNDS.date.max}
                    onResize={handleColumnBoundaryResize}
                  />
                </th>
              ) : null}
              <th
                className="relative px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                style={{ width: columnWidths.actions }}
              >
                <div ref={viewSettingsRef} className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewSettingsOpen((open) => !open);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/70 bg-white/70 text-slate-500 transition-colors hover:border-primary-400/60 hover:bg-primary-50 hover:text-primary-600 active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-slate-400 dark:hover:border-primary-300/40 dark:hover:bg-primary-500/[0.12] dark:hover:text-primary-200"
                    aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                    aria-expanded={viewSettingsOpen}
                    title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                  >
                    <Settings2 size={14} />
                  </button>
                  {viewSettingsOpen ? (
                    <div
                      className="absolute right-3 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-200/80 bg-white p-2 text-left normal-case tracking-normal shadow-xl shadow-slate-900/12 dark:border-white/[0.08] dark:bg-navy-900 dark:shadow-black/35"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="px-2 pb-2 pt-1">
                        <div className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                          {isPolish ? 'Ustawienia widoku' : 'View settings'}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Wybierz widoczne kolumny.' : 'Choose visible columns.'}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-55">
                          <input
                            type="checkbox"
                            checked
                            disabled
                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                          />
                          <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                            {isPolish ? 'Tytuł' : 'Title'}
                          </span>
                          <span className="text-[10px] font-medium text-slate-600">
                            {isPolish ? 'Wymagane' : 'Required'}
                          </span>
                        </label>
                        {IDEAS_TABLE_OPTIONAL_COLUMNS.map((column) => {
                          const checked = isColumnVisible(column.id);
                          return (
                            <label
                              key={column.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.055]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleColumnVisibility(column.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                              />
                              <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                                {isPolish ? column.labelPl : column.label}
                              </span>
                            </label>
                          );
                        })}
                        <label className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-55">
                          <input
                            type="checkbox"
                            checked
                            disabled
                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                          />
                          <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                            {isPolish ? 'Akcje' : 'Actions'}
                          </span>
                          <span className="text-[10px] font-medium text-slate-600">
                            {isPolish ? 'Wymagane' : 'Required'}
                          </span>
                        </label>
                      </div>
                      <div className="mt-2 border-t border-slate-200/70 pt-2 dark:border-white/[0.08]">
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.055]">
                          <input
                            type="checkbox"
                            checked={showRowDescription}
                            onChange={(event) => updateRowDescriptionSetting(event.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                          />
                          <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                            {isPolish ? 'Pokaż opis w wierszu' : 'Show row description'}
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((idea, index) => {
              const isChecked = selectedIds.has(idea.id);
              const isPreviewSelected = previewIdeaId === idea.id;
              const isFocused = focusedIndex === index;
              const rowAccentClass = isPreviewSelected
                ? 'bg-primary-600 dark:bg-primary-300'
                : isFocused
                  ? 'bg-primary-500 dark:bg-primary-300'
                  : isChecked
                    ? 'bg-primary-500 dark:bg-primary-300'
                    : null;
              const selectionCheckboxVisibility =
                isChecked || isPreviewSelected || isFocused
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100';

              const rowActionSections: RowActionSection[] = [
                {
                  id: 'open',
                  kind: 'open',
                  actions: [
                    {
                      id: 'open',
                      label: isPolish ? 'Otwórz' : 'Open',
                      icon: ExternalLink,
                      onClick: () => onOpenIdea(idea),
                    },
                    {
                      id: 'flow',
                      label: 'Process Flow',
                      icon: Workflow,
                      onClick: () => onOpenIdeaInProcessFlow(idea),
                    },
                  ],
                },
                {
                  id: 'ai',
                  kind: 'ai',
                  actions: [
                    {
                      id: 'ai_chat',
                      label: 'AI Chat',
                      icon: MessageSquare,
                      onClick: () => onOpenIdeaAiChat?.(idea),
                      disabled: !onOpenIdeaAiChat,
                    },
                    {
                      id: 'ai_insights',
                      label: 'AI Insights',
                      icon: Bot,
                      onClick: () => onOpenIdeaAiInsights?.(idea),
                      disabled: !onOpenIdeaAiInsights,
                    },
                  ],
                },
                {
                  id: 'convert',
                  kind: 'convert',
                  label: isPolish ? 'Konwertuj do' : 'Convert to',
                  actions: [
                    {
                      id: 'convert_initiative',
                      label: isPolish ? 'Inicjatywa' : 'Initiative',
                      icon: Rocket,
                      onClick: () =>
                        onConvertIdeaToTarget
                          ? onConvertIdeaToTarget(idea, 'initiative')
                          : onStartConvert(idea),
                    },
                    {
                      id: 'convert_tasks',
                      label: isPolish ? 'Zadania' : 'Tasks',
                      icon: CheckCircle2,
                      onClick: () =>
                        onConvertIdeaToTarget
                          ? onConvertIdeaToTarget(idea, 'task_set')
                          : onStartConvert(idea),
                    },
                    {
                      id: 'convert_decision',
                      label: isPolish ? 'Decyzja' : 'Decision',
                      icon: Star,
                      onClick: () =>
                        onConvertIdeaToTarget
                          ? onConvertIdeaToTarget(idea, 'decision')
                          : onStartConvert(idea),
                    },
                    {
                      id: 'convert_team_chat',
                      label: 'Team Chat',
                      icon: MessageSquarePlus,
                      onClick: () =>
                        onConvertIdeaToTarget
                          ? onConvertIdeaToTarget(idea, 'team_chat')
                          : onStartConvert(idea),
                    },
                  ],
                },
                ...(folders && onMoveToFolder
                  ? [
                      {
                        id: 'folder',
                        kind: 'manage' as const,
                        label: isPolish ? 'Folder' : 'Folder',
                        actions: [
                          {
                            id: 'folder-none',
                            label: isPolish ? 'Bez folderu' : 'No folder',
                            icon: FolderMinus,
                            onClick: () => onMoveToFolder(idea, null),
                            disabled: !(idea as any).folderId,
                          },
                          ...folders.map((f) => ({
                            id: `folder-${f.id}`,
                            label: f.name,
                            icon: Folder,
                            onClick: () => onMoveToFolder(idea, f.id),
                            rightLabel: (idea as any).folderId === f.id ? '✓' : undefined,
                          })),
                        ],
                      },
                    ]
                  : []),
                {
                  id: 'output',
                  kind: 'output',
                  actions: [
                    {
                      id: 'output_presentation',
                      label: isPolish ? 'Prezentacja' : 'Presentation',
                      icon: Presentation,
                      disabled: true,
                      rightLabel: isPolish ? 'wkrótce' : 'soon',
                      onClick: () => undefined,
                    },
                    {
                      id: 'output_report',
                      label: isPolish ? 'Raport' : 'Report',
                      icon: FileText,
                      disabled: true,
                      rightLabel: isPolish ? 'wkrótce' : 'soon',
                      onClick: () => undefined,
                    },
                    {
                      id: 'output_table',
                      label: isPolish ? 'Tabela' : 'Table',
                      icon: Table2,
                      disabled: true,
                      rightLabel: isPolish ? 'wkrótce' : 'soon',
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
                      label: isPolish ? 'Usuń' : 'Delete',
                      icon: Trash2,
                      variant: 'danger',
                      onClick: () => onDeleteIdea(idea),
                    },
                  ],
                },
              ];

              return (
                <tr
                  key={idea.id}
                  onClick={() => {
                    setPreviewIdeaId(idea.id);
                    onFocusIndexChange(index);
                  }}
                  onDoubleClick={() => onOpenIdea(idea)}
                  className={`group cursor-pointer border-b border-slate-200/95 transition-colors dark:border-white/[0.085] ${
                    isPreviewSelected
                      ? 'bg-primary-200/70 shadow-[inset_0_0_0_1px_rgba(165,28,48,0.28),inset_4px_0_0_rgba(165,28,48,0.95)] dark:bg-primary-500/[0.20] dark:shadow-[inset_0_0_0_1px_rgba(228,88,104,0.30),inset_4px_0_0_rgba(228,88,104,0.95)]'
                      : isChecked
                        ? 'bg-primary-100/85 shadow-[inset_0_0_0_1px_rgba(165,28,48,0.18),inset_4px_0_0_rgba(165,28,48,0.75)] dark:bg-primary-500/[0.13] dark:shadow-[inset_0_0_0_1px_rgba(228,88,104,0.20),inset_4px_0_0_rgba(228,88,104,0.70)]'
                        : isFocused
                          ? 'bg-primary-100/95 shadow-[inset_0_0_0_1px_rgba(165,28,48,0.24),inset_4px_0_0_rgba(165,28,48,0.82)] dark:bg-primary-500/[0.16] dark:shadow-[inset_0_0_0_1px_rgba(228,88,104,0.24),inset_4px_0_0_rgba(228,88,104,0.80)]'
                          : 'bg-white hover:bg-slate-100/80 hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] dark:bg-navy-950 dark:hover:bg-white/[0.04] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]'
                  }`}
                >
                  <td
                    className="relative px-2 py-3 align-middle"
                    style={{ width: columnWidths.select }}
                  >
                    {rowAccentClass ? (
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${rowAccentClass}`}
                      />
                    ) : null}
                    <label
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-all ${selectionCheckboxVisibility} hover:bg-slate-200/55 dark:hover:bg-white/[0.06]`}
                      aria-label={isPolish ? 'Zaznacz pomysł' : 'Select idea'}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelect(idea.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="h-3.5 w-3.5 rounded-[4px] border-slate-400/70 bg-transparent text-primary-500 shadow-none transition-all checked:border-primary-500 checked:bg-primary-500 checked:opacity-100 focus:ring-2 focus:ring-primary-500/25 focus:ring-offset-0 dark:border-white/[0.18] dark:bg-transparent dark:checked:bg-primary-500"
                      />
                    </label>
                  </td>
                  <td className="px-3 py-3 align-middle" style={{ width: columnWidths.title }}>
                    <div className="flex items-center gap-1.5">
                      {onToggleFavorite ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(idea.id);
                          }}
                          aria-label={
                            isFavorite?.(idea.id)
                              ? isPolish
                                ? 'Usuń z oznaczonych'
                                : 'Remove from starred'
                              : isPolish
                                ? 'Oznacz gwiazdką'
                                : 'Star'
                          }
                          aria-pressed={isFavorite?.(idea.id) ?? false}
                          className="shrink-0 rounded p-0.5 text-slate-600 transition-colors hover:text-amber-400 dark:text-slate-600"
                        >
                          <Star
                            size={14}
                            className={isFavorite?.(idea.id) ? 'fill-amber-400 text-amber-400' : ''}
                          />
                        </button>
                      ) : null}
                      <div className="truncate pr-4 text-[13.5px] font-semibold leading-5 tracking-[-0.01em] text-slate-950 dark:text-slate-100">
                        {idea.title || (isPolish ? 'Bez tytulu' : 'Untitled')}
                      </div>
                    </div>
                    {showRowDescription && idea.body ? (
                      <div className="mt-0.5 max-w-[760px] truncate pr-6 text-[11px] font-normal leading-4 text-slate-950/65 dark:text-slate-100/55">
                        {idea.body}
                      </div>
                    ) : null}
                  </td>
                  {isColumnVisible('stage') ? (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: columnWidths.stage }}
                    >
                      {renderStageBadge(idea.stage)}
                    </td>
                  ) : null}
                  {isColumnVisible('tags') ? (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: columnWidths.tags }}
                    >
                      {renderTagBadges(idea.tags)}
                    </td>
                  ) : null}
                  {isColumnVisible('tool') ? (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: columnWidths.tool }}
                    >
                      {renderToolBadge(idea.preferredTool)}
                    </td>
                  ) : null}
                  {isColumnVisible('date') ? (
                    <td
                      className="px-3 py-3 text-center align-middle text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400"
                      style={{ width: columnWidths.date }}
                    >
                      {formatIdeaDate(idea)}
                    </td>
                  ) : null}
                  <td
                    className="px-3 py-3 text-right align-middle"
                    style={{ width: columnWidths.actions }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <RowActionsMenu
                      sections={rowActionSections}
                      iconVariant="vertical"
                      className="opacity-40 transition-opacity group-hover:opacity-100"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWithPreviewLayout>
    </div>
  );
};

export default IdeasTableContent;
