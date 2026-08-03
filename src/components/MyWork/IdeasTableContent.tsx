import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronRight,
  Edit2,
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
  Sparkles,
  Sprout,
  Star,
  Table2,
  Trash2,
  TreePine,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type TableSettingsColumn,
  TableSettingsPopover,
} from '@/components/shared/ModuleHub/TableSettingsPopover';
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
import {
  FOCUSED_ROW_CLASS,
  PREVIEW_SELECTED_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from '@/components/shared/selectionTokens';
import { EmptyState, ErrorState, SkeletonState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { MetaChip, ToolChip } from '@/components/ui/primitives/chips';
import { CHIP_TONE_VAR, ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';
import type {
  ColumnDef,
  ColumnWidths,
  FilterOption,
  TableFilters,
} from '@/components/ui/ResizableTable';
import { ColumnResizer, FilterDropdown } from '@/components/ui/ResizableTable';
import { formatListDate } from '@/utils/listDateFormat';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import type { IdeaConvertTarget as SsotConvertTarget } from './ideaConvertTargets';
import { IDEA_STAGE_BUCKET_LABELS } from './ideaEntryTypes';
import type { CanvasToolType } from './ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import type { IdeaStage, MyIdea, SortDir, SortField } from './myIdeasTypes';

// Narrowed subset of the SSOT convert union (ideaConvertTargets.ts) — the row kebab
// offers these six live targets (Z3 audit 2026-07-24: 'report'/'presentation' added —
// both are `status: 'live'` in the SSOT with a real server handler; 'table' stays out,
// it isn't a convert target anywhere in the system, see IdeasTableContent output_table).
type IdeaConvertTarget = Extract<
  SsotConvertTarget,
  'initiative' | 'task_set' | 'decision' | 'team_chat' | 'report' | 'presentation'
>;
type IdeasTableOptionalColumn = 'stage' | 'tags' | 'tool' | 'date';
type IdeasResizableColumn = 'title' | IdeasTableOptionalColumn;

// VF1-11 (SPEC-A IdeaTable): honest empty/loading/error states behind a flag,
// default OFF. Piotr approves the visual on a screenshot before the flip —
// see CLAUDE.md "PIOTR NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM".
const VF1_IDEATABLE_SPECA_ENABLED = import.meta.env.VITE_VF1_IDEATABLE_SPECA === 'true';

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

// Icon/badge styling only — label TEXT comes from IDEA_STAGE_BUCKET_LABELS
// (ideaEntryTypes.ts, 2026-07-24 SSOT unification: this dict used to carry its
// own "Rosnie"/"Ksztaltuje" (no diacritics), drifted from the other Ideas-list
// renderers that spelled them "Rośnie"/"Kształtuje się").
const STAGE_META: Record<
  IdeaStage,
  {
    icon: React.ElementType;
    badge: string;
  }
> = {
  spark: {
    icon: Lightbulb,
    badge:
      'border border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
  },
  incubating: {
    icon: Sprout,
    badge:
      'border border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
  },
  shaping: {
    icon: TreePine,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
  },
  ready: {
    icon: CheckCircle2,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
  },
  promoted: {
    icon: Rocket,
    // Canon §4.0: "Promoted" = pozytywny stan końcowy (idea → inicjatywa), NIE alarm.
    // Crimson-leak fix (VF1-11): was raw `primary-*` (bypassed the design tokens AND
    // read as brand-crimson on a non-critical status badge). Neutral shell — same
    // treatment as TOOL_META below — color signal lives in STAGE_DOT_VAR's dot only
    // (canon §4.0a), never in the badge fill/text/border.
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
  },
};

// Icon/badge styling only — label TEXT comes from the single SSOT
// `getIdeaWorkspaceToolLabel` (IdeaWorkspaceToolbar.tsx), so this table agrees
// with the list's card/grid views and the canvas rail (2026-07-24: was
// "Recommendation map"/"Mapa rekomendacji" here, drifted from other copies).
const TOOL_META: Record<
  string,
  {
    icon: React.ElementType;
    badge: string;
    /** Canonical ToolChip icon color — semantic `c.*` var. */
    iconColorVar: string;
  }
> = {
  mindmap: {
    icon: Network,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    // Crimson-leak fix (VF1-11): tool identity is a DATA category, not a brand/CTA
    // moment — tailwind.config.js data-palette guide bans the brand token here
    // ("crimson w danych = dług"). Use the tag category palette instead (violet, tag 3).
    iconColorVar: 'var(--c-tag-3)',
  },
  table: {
    icon: Table2,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-info)',
  },
  process_flow: {
    icon: Workflow,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-success)',
  },
  whiteboard: {
    icon: PenTool,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-warning)',
  },
};

interface IdeasTableContentProps {
  ideas: MyIdea[];
  isPolish: boolean;
  /** SPEC-A state (flag `VITE_VF1_IDEATABLE_SPECA`, default OFF): table is fetching. */
  isLoading?: boolean;
  /** SPEC-A state (flag `VITE_VF1_IDEATABLE_SPECA`, default OFF): load failed. */
  loadError?: string | null;
  onRetryLoad?: () => void;
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

/** Stage → signal-tone dot color (canon §4.0a: neutral chip shell, color only in dot).
 * `promoted` was the brand accent (crimson) — crimson-leak fix (VF1-11): "promoted"
 * is a positive terminal state (idea → initiative), not a brand/CTA moment, so it
 * takes the same success signal as `incubating` rather than the brand token. */
const STAGE_DOT_VAR: Record<IdeaStage, string | undefined> = {
  spark: CHIP_TONE_VAR.warning,
  incubating: CHIP_TONE_VAR.success,
  shaping: CHIP_TONE_VAR.info,
  ready: CHIP_TONE_VAR.info,
  promoted: CHIP_TONE_VAR.success,
};

function getToolMeta(tool?: string | null) {
  const key = String(tool || 'mindmap').toLowerCase();
  return TOOL_META[key] || TOOL_META.mindmap;
}

function formatIdeaDate(idea: MyIdea) {
  const value = idea.updatedAt || idea.createdAt;
  if (!value) return '—';
  return formatListDate(value);
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return null;
  return (
    <span className="ml-1 inline-flex text-[10px] text-c-text-muted">
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export const IdeasTableContent: React.FC<IdeasTableContentProps> = ({
  ideas,
  isPolish,
  isLoading = false,
  loadError = null,
  onRetryLoad,
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
  // Column settings (canon §16): SSOT TableSettingsPopover handles its own portal/anchor.
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
    const resolvedStage = (stage || 'spark') as IdeaStage;
    const dotVar = STAGE_DOT_VAR[resolvedStage];
    // Canon §4.0a: neutral chip shell, color only in the leading signal dot.
    return (
      <ChipBase size="sm" leading={<ChipDot colorVar={dotVar} size="sm" />}>
        {isPolish
          ? IDEA_STAGE_BUCKET_LABELS[resolvedStage].pl
          : IDEA_STAGE_BUCKET_LABELS[resolvedStage].en}
      </ChipBase>
    );
  };

  const renderToolBadge = (tool?: string | null) => {
    const meta = getToolMeta(tool);
    const key = String(tool || 'mindmap').toLowerCase() as CanvasToolType;
    // Canonical ToolChip: colored tool icon on a neutral (c-token) surface.
    return (
      <ToolChip
        icon={meta.icon as LucideIcon}
        iconColor={meta.iconColorVar}
        label={getIdeaWorkspaceToolLabel(key, isPolish)}
      />
    );
  };

  const renderTagBadges = (tags?: string[], max = 2) => {
    if (!tags?.length) {
      return <span className="text-[11px] text-c-text-muted">—</span>;
    }

    // Canonical neutral metadata chips (MetaChip) — tags are never colored (§N).
    return (
      <div className="flex min-w-0 flex-nowrap items-center justify-start gap-1 overflow-hidden">
        {tags.slice(0, max).map((tag) => (
          <MetaChip key={tag} label={tag} />
        ))}
        {tags.length > max ? <MetaChip label={`+${tags.length - max}`} /> : null}
      </div>
    );
  };

  const renderPreview = (idea: MyIdea) => {
    const resolvedStage = (idea.stage || 'spark') as IdeaStage;
    const stageMeta = getStageMeta(idea.stage);
    const StageIcon = stageMeta.icon;
    const toolMeta = getToolMeta(idea.preferredTool);
    const ToolIcon = toolMeta.icon;
    const toolKey = String(idea.preferredTool || 'mindmap').toLowerCase() as CanvasToolType;

    const metaPills: MetaPill[] = [
      {
        label: isPolish
          ? IDEA_STAGE_BUCKET_LABELS[resolvedStage].pl
          : IDEA_STAGE_BUCKET_LABELS[resolvedStage].en,
        className: stageMeta.badge,
        icon: StageIcon,
      },
      {
        label: getIdeaWorkspaceToolLabel(toolKey, isPolish),
        className: toolMeta.badge,
        icon: ToolIcon,
      },
    ];

    const metaTrailing = (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-[11px] font-medium text-c-text-muted">{formatIdeaDate(idea)}</span>
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
                  className="inline-flex items-center rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-c-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </PreviewMetaCard>

        <PreviewDetailsSection text={detailsText} label={isPolish ? 'Szczegóły' : 'Details'}>
          {contextParts.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-c-border-subtle">
              <div className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider mb-2">
                {isPolish ? 'Kontekst' : 'Context'}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-c-text-secondary">
                {contextParts.map((part) => (
                  <span key={part} className="rounded-full bg-c-surface-raised px-2 py-1">
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
        tone: 'text-c-text-secondary',
      });
    }

    // canon §7.3b — tylko dozwolone colorScheme; create-targety idą do „Co dalej" (§7.3a),
    // Usuń żyje w kebabie wiersza (strefa danger) — NIE duplikujemy go tu (§7.3 pkt 4).
    const actionRows: ActionRow[] = [
      {
        columns: 2,
        buttons: [
          {
            label: isPolish ? 'Konwertuj' : 'Convert',
            icon: Sparkles,
            onClick: () => onStartConvert(idea),
            colorScheme: 'primary',
          },
          {
            label: isPolish ? 'Otwórz Flow' : 'Open Flow',
            icon: Workflow,
            onClick: () => onOpenIdeaInProcessFlow(idea),
            colorScheme: 'neutral',
          },
        ],
      },
    ];

    return (
      // canon §7.3 — footer cards stacked with space-y-2.5, NO dividers between framed cards.
      <div className="space-y-2.5">
        <PreviewAIHintStrip hints={aiHints} />

        <PreviewRelations
          items={relationItems}
          emptyLabel={isPolish ? 'Brak powiązań' : 'No linked documents'}
        />

        {/* „Co dalej" — widoczny create-strip (§7.3a), nie ukryty dropdown */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
            {isPolish ? 'Co dalej' : "What's next"}
          </div>
          <ConvertToOutputMenu
            sourceType="idea"
            sourceId={idea.id}
            sourceTitle={idea.title || ''}
            onConvertComplete={() => onRefresh()}
            variant="inline"
          />
        </div>

        <PreviewActionBar rows={actionRows} />
      </div>
    );
  };

  // ── SPEC-A states (VF1-11) — flag `VITE_VF1_IDEATABLE_SPECA`, default OFF. ──
  // Zero behavior change while the flag is off: the caller (MyIdeasListContent)
  // does not pass isLoading/loadError today and already gates ideas.length === 0
  // upstream of this component, so none of these branches fire until wired.
  const hasActiveIdeaFilter = Boolean(
    (tableFilters.stage as string[] | undefined)?.length ||
    (tableFilters.tags as string[] | undefined)?.length ||
    (tableFilters.tool as string[] | undefined)?.length
  );
  const clearIdeaTableFilters = useCallback(() => {
    onTableFilterChange('stage', []);
    onTableFilterChange('tags', []);
    onTableFilterChange('tool', []);
  }, [onTableFilterChange]);

  if (VF1_IDEATABLE_SPECA_ENABLED && loadError) {
    return (
      <div className="flex-1 min-h-0 bg-c-bg">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać pomysłów' : 'Could not load ideas'}
          // Hard rule (shared/states/ErrorState): never interpolate the raw error
          // message here — a calm, human-authored sentence only.
          description={
            isPolish
              ? 'Dane mogły się przenieść albo źródło jest chwilowo niedostępne.'
              : 'The data may have moved, or the source is temporarily unavailable.'
          }
          onRetry={onRetryLoad}
        />
      </div>
    );
  }

  if (VF1_IDEATABLE_SPECA_ENABLED && isLoading) {
    return (
      <div className="flex-1 min-h-0 bg-c-bg p-4">
        <SkeletonState variant="table" rows={8} columns={getVisibleResizableColumns().length + 1} />
      </div>
    );
  }

  if (VF1_IDEATABLE_SPECA_ENABLED && ideas.length === 0) {
    return (
      <div className="flex-1 min-h-0 bg-c-bg">
        <EmptyState
          variant={hasActiveIdeaFilter ? 'filter' : 'new'}
          icon={Lightbulb}
          title={
            hasActiveIdeaFilter
              ? isPolish
                ? 'Brak pomysłów dla tego filtra'
                : 'No ideas match this filter'
              : isPolish
                ? 'Brak pomysłów'
                : 'No ideas yet'
          }
          description={
            hasActiveIdeaFilter
              ? isPolish
                ? 'Zmień lub wyczyść filtry, aby zobaczyć więcej pomysłów.'
                : 'Adjust or clear the filters to see more ideas.'
              : isPolish
                ? 'Zapisane pomysły pojawią się tutaj jako wiersze tabeli.'
                : 'Captured ideas will appear here as table rows.'
          }
          primaryAction={
            hasActiveIdeaFilter
              ? {
                  label: isPolish ? 'Wyczyść filtry' : 'Clear filters',
                  onClick: clearIdeaTableFilters,
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-c-bg">
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
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
          <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */
            className="w-full table-fixed bg-c-surface"
            style={{ minWidth: tableMinWidth }}
          >
            <thead className="sticky top-0 z-10 bg-c-surface-raised shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]">
              <tr className="border-b border-c-border-subtle">
                <th className="px-2 py-3" style={{ width: columnWidths.select }}>
                  <button
                    onClick={() => {
                      if (allSelected) {
                        onClearSelection();
                      } else {
                        onSelectAllVisible();
                      }
                    }}
                    className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      allSelected
                        ? 'border-c-text bg-c-text text-c-surface'
                        : someSelected
                          ? 'border-c-text bg-c-text/60 text-c-surface'
                          : 'border-c-border-strong bg-white/70 text-transparent opacity-20 hover:border-c-border-strong hover:bg-white hover:text-c-text-muted hover:opacity-100 dark:border-white/[0.14] dark:bg-white/[0.03] dark:hover:bg-white/[0.07]'
                    }`}
                    title={isPolish ? 'Zaznacz widoczne' : 'Select visible'}
                  >
                    {allSelected ? '✓' : someSelected ? '−' : '□'}
                  </button>
                </th>
                <th
                  className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                  style={{ width: columnWidths.title }}
                >
                  <button
                    onClick={() => onSort('title')}
                    className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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
                    className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                    style={{ width: columnWidths.stage }}
                  >
                    <div className="flex items-center justify-start gap-1">
                      <button
                        onClick={() => onSort('stage')}
                        className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <span
                          className={
                            (tableFilters.stage as string[] | undefined)?.length
                              ? 'text-c-text-secondary'
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
                    className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                    style={{ width: columnWidths.tags }}
                  >
                    <div className="flex items-center justify-start gap-1">
                      <button
                        onClick={() => onSort('tags')}
                        className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <span
                          className={
                            (tableFilters.tags as string[] | undefined)?.length
                              ? 'text-c-text-secondary'
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
                    className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                    style={{ width: columnWidths.tool }}
                  >
                    <div className="flex items-center justify-start gap-1">
                      <button
                        onClick={() => onSort('tool')}
                        className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <span
                          className={
                            (tableFilters.tool as string[] | undefined)?.length
                              ? 'text-c-text-secondary'
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
                    className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                    style={{ width: columnWidths.date }}
                  >
                    <button
                      onClick={() => onSort('date')}
                      className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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
                  className="relative px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-c-text-muted"
                  style={{ width: columnWidths.actions }}
                >
                  <div className="flex items-center justify-end normal-case tracking-normal">
                    <TableSettingsPopover
                      columns={[
                        {
                          id: 'title',
                          label: isPolish ? 'Tytuł' : 'Title',
                          required: true,
                          visible: true,
                        },
                        ...IDEAS_TABLE_OPTIONAL_COLUMNS.map(
                          (column): TableSettingsColumn => ({
                            id: column.id,
                            label: isPolish ? column.labelPl : column.label,
                            visible: isColumnVisible(column.id),
                          })
                        ),
                        {
                          id: 'actions',
                          label: isPolish ? 'Akcje' : 'Actions',
                          required: true,
                          visible: true,
                        },
                      ]}
                      onToggle={(columnId) =>
                        toggleColumnVisibility(columnId as IdeasTableOptionalColumn)
                      }
                      showDescription={showRowDescription}
                      onToggleDescription={updateRowDescriptionSetting}
                      label={isPolish ? 'Ustawienia widoku' : 'View settings'}
                      columnsHeading={isPolish ? 'Widoczne kolumny' : 'Visible columns'}
                      descriptionLabel={isPolish ? 'Pokaż opis w wierszu' : 'Show row description'}
                    />
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
                  ? 'bg-c-info'
                  : isFocused
                    ? 'bg-c-info'
                    : isChecked
                      ? 'bg-c-info'
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
                        label: isPolish ? 'Diagram procesu' : 'Process Flow',
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
                        label: isPolish ? 'Czat AI' : 'AI Chat',
                        icon: MessageSquare,
                        onClick: () => onOpenIdeaAiChat?.(idea),
                        disabled: !onOpenIdeaAiChat,
                      },
                      {
                        id: 'ai_insights',
                        label: isPolish ? 'Wglądy AI' : 'AI Insights',
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
                        label: isPolish ? 'Czat zespołu' : 'Team Chat',
                        icon: MessageSquarePlus,
                        onClick: () =>
                          onConvertIdeaToTarget
                            ? onConvertIdeaToTarget(idea, 'team_chat')
                            : onStartConvert(idea),
                      },
                    ],
                  },
                  // Create output — przed strefami manage (canon §17: …Convert · Create output · Manage · Danger).
                  {
                    id: 'output',
                    kind: 'output',
                    actions: [
                      {
                        // Z3 audit (2026-07-24): 'presentation' jest `status: 'live'`
                        // w SSOT (ideaConvertTargets.ts) i ma realny handler na
                        // serwerze (server/src/routes/my-work.routes.ts, gałąź
                        // `target === 'presentation'` — tworzy rekord w `presentations`
                        // + link graph). Wcześniejszy `disabled: true` + „wkrótce" był
                        // atrapą obiecującą funkcję, która już działa — usunięte.
                        id: 'output_presentation',
                        label: isPolish ? 'Prezentacja' : 'Presentation',
                        icon: Presentation,
                        onClick: () =>
                          onConvertIdeaToTarget
                            ? onConvertIdeaToTarget(idea, 'presentation')
                            : onStartConvert(idea),
                      },
                      {
                        // Z3 audit (2026-07-24): 'report' jest `status: 'live'` w SSOT
                        // i ma realny handler na serwerze (`target === 'report'` —
                        // tworzy rekord w `reports` + link graph). Odblokowane z tego
                        // samego powodu co Prezentacja powyżej.
                        id: 'output_report',
                        label: isPolish ? 'Raport' : 'Report',
                        icon: FileText,
                        onClick: () =>
                          onConvertIdeaToTarget
                            ? onConvertIdeaToTarget(idea, 'report')
                            : onStartConvert(idea),
                      },
                      {
                        // Z3 audit (2026-07-24): 'table' NIE istnieje jako convert
                        // target NIGDZIE w systemie — brak w `IdeaConvertTarget` (SSOT
                        // ideaConvertTargets.ts), brak w `LIVE_CONVERT_TARGETS`
                        // (server/src/routes/my-work.routes.ts) — serwer zwróciłby 400
                        // „Invalid target". To jedyny z trzech, który zostaje
                        // wyłączony — bo naprawdę nie ma odbiornika, nie „na wiarę".
                        id: 'output_table',
                        label: isPolish ? 'Tabela' : 'Table',
                        icon: Table2,
                        disabled: true,
                        rightLabel: isPolish ? 'wkrótce' : 'soon',
                        onClick: () => undefined,
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
                  // DÓŁ — FIXED BOTTOM MANIFEST (canon §9.2).
                  // Ideas have no `due_date`, so the Delay slot (pos. 4) is N/A.
                  {
                    id: 'fixed',
                    kind: 'manage',
                    actions: [
                      {
                        id: 'open-preview',
                        label: isPolish ? 'Otwórz podgląd' : 'Open preview',
                        icon: ChevronRight,
                        onClick: () => {
                          setPreviewIdeaId(idea.id);
                          onFocusIndexChange(index);
                        },
                      },
                      {
                        id: 'edit',
                        label: isPolish ? 'Edytuj' : 'Edit',
                        icon: Edit2,
                        onClick: () => onOpenIdea(idea),
                      },
                      {
                        id: 'archive',
                        label: isPolish ? 'Archiwizuj' : 'Archive',
                        icon: Archive,
                        disabled: true,
                        description: isPolish ? 'Wkrótce (backend)' : 'Coming soon (backend)',
                        onClick: () => {},
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
                    className={`group cursor-pointer border-b border-slate-200/50 dark:border-white/[0.03] transition-colors ${
                      isPreviewSelected
                        ? SELECTED_ROW_CLASS
                        : isChecked
                          ? SELECTED_ROW_CLASS
                          : isFocused
                            ? FOCUSED_ROW_CLASS
                            : 'bg-c-surface hover:bg-slate-100/80 hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] dark:hover:bg-white/[0.04] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]'
                    }`}
                  >
                    <td
                      className="relative px-2 py-2.5 align-middle"
                      style={{ width: columnWidths.select }}
                    >
                      {rowAccentClass ? (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${rowAccentClass}`}
                        />
                      ) : null}
                      <label
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-all ${selectionCheckboxVisibility} hover:bg-black/[0.05] dark:hover:bg-white/[0.06]`}
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
                          className="h-3.5 w-3.5 rounded-[4px] border-c-border-strong bg-transparent text-c-info shadow-none transition-all checked:border-c-info checked:bg-c-info checked:opacity-100 focus:ring-2 focus:ring-c-focus focus:ring-offset-0 dark:border-white/[0.18] dark:bg-transparent dark:checked:bg-c-info"
                        />
                      </label>
                    </td>
                    <td className="px-3 py-2.5 align-middle" style={{ width: columnWidths.title }}>
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
                            className="shrink-0 rounded p-0.5 text-c-text-muted transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Star
                              size={14}
                              className={
                                isFavorite?.(idea.id) ? 'fill-amber-400 text-amber-400' : ''
                              }
                            />
                          </button>
                        ) : null}
                        <div className="truncate pr-4 text-sm font-semibold leading-5 text-c-text">
                          {idea.title || (isPolish ? 'Bez tytulu' : 'Untitled')}
                        </div>
                      </div>
                      {showRowDescription && idea.body ? (
                        <div className="mt-0.5 truncate pr-6 text-[11px] leading-4 text-c-text-muted">
                          {idea.body}
                        </div>
                      ) : null}
                    </td>
                    {isColumnVisible('stage') ? (
                      <td
                        className="px-3 py-2.5 text-left align-middle"
                        style={{ width: columnWidths.stage }}
                      >
                        {renderStageBadge(idea.stage)}
                      </td>
                    ) : null}
                    {isColumnVisible('tags') ? (
                      <td
                        className="px-3 py-2.5 text-left align-middle"
                        style={{ width: columnWidths.tags }}
                      >
                        {renderTagBadges(idea.tags)}
                      </td>
                    ) : null}
                    {isColumnVisible('tool') ? (
                      <td
                        className="px-3 py-2.5 text-left align-middle"
                        style={{ width: columnWidths.tool }}
                      >
                        {renderToolBadge(idea.preferredTool)}
                      </td>
                    ) : null}
                    {isColumnVisible('date') ? (
                      <td
                        className="px-3 py-2.5 text-left align-middle text-[11px] font-medium leading-5 text-c-text-muted group-hover:text-c-text-secondary"
                        style={{ width: columnWidths.date }}
                      >
                        {formatIdeaDate(idea)}
                      </td>
                    ) : null}
                    <td
                      className="px-3 py-2.5 text-right align-middle"
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
        </div>
      </TableWithPreviewLayout>
    </div>
  );
};

export default IdeasTableContent;
