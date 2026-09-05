import type { LucideIcon } from 'lucide-react';
import {
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
  PanelRight,
  Presentation,
  Rocket,
  Sparkles,
  Star,
  Trash2,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type TableSettingsColumn,
  TableSettingsPopover,
} from '@/components/shared/ModuleHub/TableSettingsPopover';
import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
  FOCUSED_ROW_CLASS,
  PREVIEW_SELECTED_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from '@/components/shared/selectionTokens';
import { EmptyState, ErrorState, SkeletonState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { normalizeRowActionSections } from '@/components/standard/StandardTable';
import { MetaChip, ToolChip } from '@/components/ui/primitives/chips';
import { ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';
import type {
  ColumnDef,
  ColumnWidths,
  FilterOption,
  TableFilters,
} from '@/components/ui/ResizableTable';
import { ColumnResizer, FilterDropdown } from '@/components/ui/ResizableTable';

import type { IdeaConvertTarget as SsotConvertTarget } from './ideaConvertTargets';
import { IDEA_STAGE_BUCKET_LABELS } from './ideaEntryTypes';
import { IdeaPreviewBody, IdeaPreviewFooter } from './IdeaPreview';
import { formatIdeaDate, getToolMeta, STAGE_DOT_VAR } from './ideaPreviewMeta';
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

// Uwaga właściciela (05.09, verbatim): „mam tylko wielki problem z tym panelem
// prawym bo on powinien być zamykany jak nie jest potrzebny — a teraz nie
// mogę go zamknąć". Klik na X w `PreviewPaneShell` DZIAŁA (zamyka podgląd),
// ale każdy kolejny klik w wiersz natychmiast otwierał go z powrotem — więc
// z perspektywy właściciela panelu "nie da się zamknąć" podczas normalnego
// przeglądania tabeli. `sessionStorage` (nie localStorage): zamknięcie ma
// przetrwać sesję przeglądarki, nie zostać na zawsze.
const IDEAS_TABLE_PREVIEW_DISMISSED_STORAGE_KEY = 'consultify.mywork.ideas.previewDismissed.v1';

function loadIdeaPreviewDismissed(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(IDEAS_TABLE_PREVIEW_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistIdeaPreviewDismissed(dismissed: boolean) {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(IDEAS_TABLE_PREVIEW_DISMISSED_STORAGE_KEY, String(dismissed));
  } catch {
    /* ignore persistence errors */
  }
}

// Icon/badge styling only — label TEXT comes from IDEA_STAGE_BUCKET_LABELS
// (ideaEntryTypes.ts, 2026-07-24 SSOT unification: this dict used to carry its
// own "Rosnie"/"Ksztaltuje" (no diacritics), drifted from the other Ideas-list
// renderers that spelled them "Rośnie"/"Kształtuje się").
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
  /**
   * Uwaga właściciela 05.09 — panel prawy „powinien być zamykany jak nie jest
   * potrzebny". Prawda: X w nagłówku już zamykał podgląd, ale klik w
   * DOWOLNY wiersz natychmiast otwierał go z powrotem (kanon "single click →
   * selection + preview"), więc z perspektywy przeglądania tabeli panel
   * nigdy realnie nie zostawał zamknięty. Ten flag pamięta świadome
   * zamknięcie (X / Escape) na czas sesji przeglądarki i wstrzymuje
   * auto-otwieranie przy zwykłym kliku w wiersz, dopóki użytkownik nie
   * poprosi o podgląd ponownie (przycisk „Pokaż panel" albo kebab „Otwórz
   * podgląd").
   */
  const [previewDismissed, setPreviewDismissed] = useState<boolean>(loadIdeaPreviewDismissed);
  /** Stan Rozwin/Zwin bloku 3 podgladu (kanon 7.3 pkt 3) - przezywa zmiane wiersza. */
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  // MYW-IDEA-REC-001 — PPM-mirror (ANEKS #3b, same contract as
  // FilterableTable.tsx:613/1237-1268): right-click on a row opens the SAME
  // RowActionsMenu popover the row's kebab already renders, anchored at the
  // cursor instead of the button. One row can have an active context-menu
  // point at a time. This table predates FilterableTable (self-documented a
  // few lines below, on the table element itself: "migration to
  // FilterableTable... deliberately not rewritten"), so the mirror is wired
  // directly rather than inherited.
  const [contextMenuRow, setContextMenuRow] = useState<{
    ideaId: string;
    point: { x: number; y: number };
  } | null>(null);
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

  // S18-NOOVERLAP (2026-08-12) — closes the Updated/actions column-overlap
  // regression the owner rejected. Two independent defects, both measured
  // in a real browser (dev-render/measure-idea-table-overlap.mjs against
  // dev-render/screens/idea-table-production.tsx):
  //
  //   Defect A (width-proportional): DEFAULT_IDEAS_COLUMN_WIDTHS sums to
  //   1354px; the fixed columns other than title alone are 794px, so at
  //   1280×800 the title's real budget is 478px against a hard 560px
  //   default — a 74px overflow that the sticky actions column (S13-STICKY)
  //   then renders on top of.
  //   Defect B (constant, viewport-independent): the sticky actions cell's
  //   `right: 0` anchors to the scroller's PADDING box, but the scroller's
  //   `scrollWidth` (TableWithPreviewLayout.tsx:339 `pr-2`, an 8px trailing
  //   padding) never counts that padding — so max scroll leaves a permanent
  //   8px sliver of the date column covered at every viewport tested.
  //
  // The scroll container that can overflow horizontally is
  // TableWithPreviewLayout.tsx's `overflow-auto` div — a shared file with
  // 39 importers, deliberately left untouched. Instead we watch it from
  // here by walking up from our own wrapper (tableWrapperRef, set on the
  // div below), the same `.closest('.overflow-auto')` approach the
  // real-browser measurement script uses.
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [scrollerAvailableWidth, setScrollerAvailableWidth] = useState<number | null>(null);
  const [scrollerPaddingRight, setScrollerPaddingRight] = useState(0);

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    const scroller = wrapper?.closest<HTMLElement>('.overflow-auto') ?? null;
    if (!scroller) return undefined;

    const measure = () => {
      const paddingRight = parseFloat(getComputedStyle(scroller).paddingRight) || 0;
      setScrollerPaddingRight(paddingRight);
      setScrollerAvailableWidth(scroller.clientWidth - paddingRight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Sum of every OTHER visible column — the budget left for title once the
  // fixed columns are subtracted from what the scroller can actually show.
  // At 1280×800 production defaults: 40 + 150 + 230 + 190 + 128 + 56 = 794px.
  const fixedColumnsWidthSum = useMemo(
    () =>
      columnWidths.select +
      (isColumnVisible('stage') ? columnWidths.stage : 0) +
      (isColumnVisible('tags') ? columnWidths.tags : 0) +
      (isColumnVisible('tool') ? columnWidths.tool : 0) +
      (isColumnVisible('date') ? columnWidths.date : 0) +
      columnWidths.actions,
    [
      columnWidths.select,
      columnWidths.stage,
      columnWidths.tags,
      columnWidths.tool,
      columnWidths.date,
      columnWidths.actions,
      isColumnVisible,
    ]
  );

  // Fix A — the title column's RENDERED width. `columnWidths.title`
  // (user-persisted, resizable) stays the ceiling — a manual drag is still
  // respected whenever there is room — but it no longer forces overflow
  // past what the scroller can actually show. Falls back to the raw
  // persisted width until the first real measurement lands (no ancestor
  // scroller found yet, or a non-browser render), matching the pre-fix
  // rendering for that one frame instead of guessing a shrunk width.
  // Bounds reuse IDEAS_RESIZE_BOUNDS.title (360/900) — the same bounds the
  // title ColumnResizer already enforces below, not a new invented range.
  const renderedTitleWidth = useMemo(() => {
    if (scrollerAvailableWidth === null) return columnWidths.title;
    const fitWidth = Math.min(columnWidths.title, scrollerAvailableWidth - fixedColumnsWidthSum);
    return Math.max(IDEAS_RESIZE_BOUNDS.title.min, Math.min(IDEAS_RESIZE_BOUNDS.title.max, fitWidth));
  }, [scrollerAvailableWidth, fixedColumnsWidthSum, columnWidths.title]);

  const tableMinWidth = useMemo(() => {
    const optionalWidth =
      (isColumnVisible('stage') ? columnWidths.stage : 0) +
      (isColumnVisible('tags') ? columnWidths.tags : 0) +
      (isColumnVisible('tool') ? columnWidths.tool : 0) +
      (isColumnVisible('date') ? columnWidths.date : 0);

    // S18-NOOVERLAP: uses the RENDERED title width, not the raw persisted
    // one — otherwise this table's own inline minWidth style re-forces the
    // exact overflow Fix A just removed from the header/body cells below.
    return Math.max(
      1120,
      columnWidths.select + renderedTitleWidth + optionalWidth + columnWidths.actions
    );
  }, [
    columnWidths.actions,
    columnWidths.date,
    columnWidths.select,
    columnWidths.stage,
    columnWidths.tags,
    renderedTitleWidth,
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
      label: isPolish ? 'Narzędzie' : 'Tool',
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

  /**
   * Podgląd wiersza — kanon §7 realizuje wspólny `IdeaPreview`, ten sam, który
   * osadza widok listy (`MyIdeasListContent`). Do 2026-09-02 stała tu WŁASNA
   * kopia bloków 2-6: jednolinijkowy `idea.body` bez tabeli właściwości
   * (naruszenie §7.3 pkt 3 „bogaty domyślny szablon", zgłaszane przez
   * właściciela trzy razy jako „preview nie jest zgodny z wzorem") i kebab
   * bloku 3 bez ani jednej własnej pozycji. Powłoka nie klei już własnego
   * podglądu — deklaruje dane i handlery, komponent narzuca wygląd.
   */
  const renderPreview = (idea: MyIdea) => (
    <IdeaPreviewBody
      idea={idea}
      isPolish={isPolish}
      detailsExpanded={detailsExpanded}
      onToggleDetailsExpanded={() => setDetailsExpanded((v) => !v)}
      onEditIdea={onOpenIdea}
    />
  );

  const renderPreviewFooter = (idea: MyIdea) => (
    <IdeaPreviewFooter
      idea={idea}
      isPolish={isPolish}
      onOpenIdeaInProcessFlow={onOpenIdeaInProcessFlow}
      onConvertComplete={onRefresh}
    />
  );

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
        onSelect={(id) => {
          // id === null ⇒ świadome zamknięcie (X w nagłówku, Escape, tło na
          // mobile) — zapamiętaj to na sesję, żeby kolejny klik w wiersz
          // (poniżej) nie otwierał panelu z powrotem.
          if (id === null) {
            setPreviewDismissed(true);
            persistIdeaPreviewDismissed(true);
          }
          setPreviewIdeaId(id);
        }}
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
        <div
          ref={tableWrapperRef}
          className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl"
        >
          <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */
            className="w-full table-fixed bg-c-surface"
            style={{ minWidth: tableMinWidth }}
          >
            <thead className="sticky top-0 z-sticky bg-c-surface-raised shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]">
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
                  // S18-NOOVERLAP Fix A: renders at the width the scroller can
                  // actually fit, not the raw persisted columnWidths.title —
                  // see renderedTitleWidth above.
                  style={{ width: renderedTitleWidth }}
                >
                  <button
                    onClick={() => onSort('title')}
                    className="inline-flex items-center text-left transition-colors hover:text-c-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {isPolish ? 'Tytuł' : 'Title'}
                    <SortIndicator active={sortField === 'title'} direction={sortDir} />
                  </button>
                  <ColumnResizer
                    columnId="title"
                    // Deliberately the PERSISTED width, not renderedTitleWidth:
                    // this is the ceiling a manual drag adjusts. When the
                    // rendered width is currently clamped below it, dragging
                    // takes effect as soon as room frees up (matches the
                    // "still respected whenever there is room" contract).
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
                          {isPolish ? 'Narzędzie' : 'Tool'}
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
                {/*
                  S13-STICKY (2026-08-12): pin the actions column to the right
                  edge instead of letting it scroll off-screen. At 1280×800 in
                  the true production shape (no sibling ArtifactRightPanel),
                  DEFAULT_IDEAS_COLUMN_WIDTHS sums to 1354px against a 1280px
                  viewport — the row kebab, the ONLY route to per-row actions,
                  sat ~74px past the right edge at rest with no visible
                  affordance (confirmed via getBoundingClientRect on the
                  production-shape dev-render harness). `overflow-auto` on the
                  scroll container (TableWithPreviewLayout.tsx) makes it
                  technically reachable by scrolling, but that is not an
                  acceptable route to the primary row action on a required
                  acceptance viewport.
                  Rejected alternatives:
                    - Shrinking `title` 560→486 to force a fit: brittle,
                      because every column here is user-resizable
                      (handleColumnBoundaryResize) — any resize reintroduces
                      the overflow.
                    - Hiding `date` below a width threshold: loses data and
                      still breaks under user resize.
                  Sticky is robust to resizing, keeps every column reachable,
                  and keeps the primary action permanently visible — the
                  actual acceptance criterion.
                  z-index: `z-sticky` (20, canon "sticky headers, command
                  rows, chrome bars" — tailwind.config.js) on the header row
                  (bumped here from a raw `z-10`, matching the precedent in
                  ResizableTable/TableHeader.tsx) beats `z-canvas` (10, canon
                  "in-flow raised content") on the body's sticky cells below,
                  so the header's pinned corner always wins the header-row ×
                  sticky-column intersection during scroll. Both stay well
                  under `z-context-menu` (120) — the row menu portals straight
                  to `document.body` (RowActionsMenu.tsx), a DOM sibling of
                  the whole app root, so its stacking is independent of
                  anything set here.

                  S18-NOOVERLAP Fix B (2026-08-12): `right-0` (the Tailwind
                  class, kept — the S13-STICKY/S17-OVERLAPTEST contract tests
                  assert its literal presence as the structural "still
                  pinned" marker) sticks this cell to the scroller's PADDING
                  box. `scrollWidth` on that same scroller does not include
                  its own trailing padding (TableWithPreviewLayout.tsx:339
                  `pr-2`, 8px), so max scroll can only bring the table's
                  content-box edge flush with the viewport — a permanent 8px
                  gap between that and where `right: 0` pins this column,
                  measured at every viewport (1280, 720, 200% zoom alike).
                  The inline `right` style below overrides the class (inline
                  style beats a non-`!important` utility class) with the
                  negative of that same padding, closing the gap exactly.
                  Read from computed style, never hard-coded — and inert
                  whenever Fix A already removed the overflow, since a
                  sticky cell only ever applies its offset once "stuck".
                */}
                <th
                  className="sticky right-0 z-sticky px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-c-text-muted bg-c-surface-raised border-l border-c-border-subtle"
                  style={{ width: columnWidths.actions, right: -scrollerPaddingRight }}
                >
                  <div className="flex items-center justify-end gap-1 normal-case tracking-normal">
                    {previewDismissed ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewDismissed(false);
                          persistIdeaPreviewDismissed(false);
                          const target =
                            (focusedIndex >= 0 ? ideas[focusedIndex] : undefined) ?? ideas[0];
                          if (target) {
                            setPreviewIdeaId(target.id);
                          }
                        }}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium text-c-text-muted transition-colors hover:bg-slate-900/[0.06] hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] dark:hover:bg-white/10"
                        aria-label={isPolish ? 'Pokaż panel' : 'Show panel'}
                        title={isPolish ? 'Pokaż panel' : 'Show panel'}
                      >
                        <PanelRight size={14} />
                        <span>{isPolish ? 'Pokaż panel' : 'Show panel'}</span>
                      </button>
                    ) : null}
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

                // S13-STICKY: the sticky actions cell needs its OWN opaque
                // background — it overlays the data columns as they scroll
                // underneath it, so it can't rely on the <tr> background
                // showing through a transparent <td>. Mirrors the same four
                // states the row's own className computes below (bg parts of
                // SELECTED_ROW_CLASS / FOCUSED_ROW_CLASS / default+hover) so
                // the pinned column reads as part of the row, not a foreign
                // strip glued on top of it.
                const stickyActionsCellBgClass =
                  isPreviewSelected || isChecked
                    ? 'bg-slate-100 dark:bg-white/[0.08]'
                    : isFocused
                      ? 'bg-slate-50/80 dark:bg-white/[0.04]'
                      : 'bg-c-surface group-hover:bg-slate-100/80 dark:group-hover:bg-white/[0.04]';

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
                    ],
                  },
                  ...(folders && onMoveToFolder
                    ? [
                        {
                          id: 'folder',
                          kind: 'manage' as const,
                          label: 'Folder',
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
                          // Kebab = prośba wprost o podgląd — zdejmij zamknięcie,
                          // żeby zwykły klik w wiersz znów otwierał panel.
                          setPreviewDismissed(false);
                          persistIdeaPreviewDismissed(false);
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
                      onFocusIndexChange(index);
                      // Panel świadomie zamknięty (X/Escape) w tej sesji —
                      // zwykły klik w wiersz go NIE otwiera z powrotem
                      // (uwaga właściciela 05.09). Zaznaczenie/focus wiersza
                      // dalej działa; podgląd wraca przez „Pokaż panel" albo
                      // kebab „Otwórz podgląd".
                      if (!previewDismissed) {
                        setPreviewIdeaId(idea.id);
                      }
                    }}
                    onDoubleClick={() => onOpenIdea(idea)}
                    onContextMenu={(e) => {
                      // MYW-IDEA-REC-001 — PPM-mirror: don't swallow the
                      // native browser menu for a row whose kebab would be
                      // empty anyway (mirrors FilterableTable.tsx's
                      // `hasMenu` guard for the same reason).
                      if (rowActionSections.every((section) => section.actions.length === 0)) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenuRow({ ideaId: idea.id, point: { x: e.clientX, y: e.clientY } });
                    }}
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
                    <td
                      className="px-3 py-2.5 align-middle"
                      // S18-NOOVERLAP Fix A: mirrors the header <th> above.
                      style={{ width: renderedTitleWidth }}
                    >
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
                          {idea.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
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
                      // S13-STICKY: pinned to the right edge (see the header
                      // <th> comment above for the full "why sticky, not a
                      // width squeeze" rationale + z-index reasoning).
                      // `z-canvas` (10, canon "in-flow raised content") is
                      // deliberately below the header's `z-sticky` (20) so
                      // the corner cell never fights the header row for the
                      // top spot, and both stay far under `z-context-menu`
                      // (120) for the kebab's own portal-to-body menu.
                      // S18-NOOVERLAP Fix B: mirrors the header <th>'s
                      // `right: -scrollerPaddingRight` override above — same
                      // padding-box-vs-scrollWidth gap, same compensation.
                      className={`sticky right-0 z-canvas px-3 py-2.5 text-right align-middle border-l border-c-border-subtle transition-colors ${stickyActionsCellBgClass}`}
                      style={{ width: columnWidths.actions, right: -scrollerPaddingRight }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActionsMenu
                        sections={normalizeRowActionSections(rowActionSections)}
                        iconVariant="vertical"
                        // RISK-35 (S1-CONTRAST, 2026-08-12): opacity-40 at rest measured
                        // 1.93:1 (light) / 1.61:1 (dark) against the 3:1 WCAG 1.4.11
                        // non-text-contrast bar for this icon-only button — it is the
                        // only route to per-row actions, so it must be legible before
                        // the row is hovered, not just after. opacity-90 clears both
                        // themes with margin (5.84:1 / 3.29:1 — see
                        // docs/qa/ideas-complete-transformation-2026-08-09/21_FOCUS_AND_CONTRAST.md
                        // §8) while keeping the hover reveal (opacity-100) visibly
                        // stronger, preserving the "reveal on row hover" pattern.
                        className="opacity-90 transition-opacity group-hover:opacity-100"
                        // MYW-IDEA-REC-001 — same popover the kebab above
                        // opens, anchored at the cursor when the last
                        // right-click landed on THIS row.
                        contextMenuAnchor={
                          contextMenuRow?.ideaId === idea.id ? contextMenuRow.point : null
                        }
                        onContextMenuClose={() => setContextMenuRow(null)}
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
