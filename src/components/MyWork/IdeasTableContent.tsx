import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
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
import React, { useEffect, useMemo, useState } from 'react';

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
import {
  type RowActionSection,
  RowActionsMenu,
} from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
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
      'border border-violet-300/80 bg-violet-50 text-violet-900 dark:border-violet-300/[0.25] dark:bg-violet-300/[0.12] dark:text-violet-100',
    iconClass: 'text-violet-600 dark:text-violet-300',
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
  }
> = {
  mindmap: {
    label: 'Recommendation map',
    labelPl: 'Mapa rekomendacji',
    icon: Network,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-primary-600 dark:text-primary-300',
  },
  table: {
    label: 'Table',
    labelPl: 'Tabela',
    icon: Table2,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-sky-600 dark:text-sky-300',
  },
  process_flow: {
    label: 'Process Flow',
    labelPl: 'Proces',
    icon: Workflow,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  whiteboard: {
    label: 'Whiteboard',
    labelPl: 'Whiteboard',
    icon: PenTool,
    badge:
      'border border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100',
    iconClass: 'text-amber-600 dark:text-amber-300',
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
    <span className="ml-1 inline-flex text-[10px] text-slate-400">
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
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${meta.badge}`}
      >
        <Icon size={11} className={meta.iconClass} />
        {isPolish ? meta.labelPl : meta.label}
      </span>
    );
  };

  const renderToolBadge = (tool?: string | null) => {
    const meta = getToolMeta(tool);
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${meta.badge}`}
      >
        <Icon size={11} className={meta.iconClass} />
        {isPolish ? meta.labelPl : meta.label}
      </span>
    );
  };

  const renderTagBadges = (tags?: string[], max = 2) => {
    if (!tags?.length) {
      return <span className="text-[11px] text-slate-400">—</span>;
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {tags.slice(0, max).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-100 px-2 py-1 text-[10px] font-medium leading-none text-slate-800 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200"
          >
            {tag}
          </span>
        ))}
        {tags.length > max ? (
          <span className="text-[10px] text-slate-400">+{tags.length - max}</span>
        ) : null}
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
        <div
          className="h-full overflow-x-auto bg-slate-50/40 pr-4 [scrollbar-gutter:stable] dark:bg-navy-950"
          style={{ scrollbarGutter: 'stable' }}
        >
          <table className="w-full table-fixed" style={{ minWidth: 980 }}>
            <thead className="sticky top-0 z-10 bg-slate-100/95 shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur dark:bg-navy-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]">
              <tr className="border-b border-slate-300/70 dark:border-white/[0.10]">
                <th className="w-9 px-2 py-3">
                  <button
                    onClick={() => {
                      if (allSelected) {
                        onClearSelection();
                      } else {
                        onSelectAllVisible();
                      }
                    }}
                    className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] transition-colors ${
                      allSelected
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : someSelected
                          ? 'border-primary-500 bg-primary-500/50 text-white'
                          : 'border-slate-400/70 bg-white/70 text-transparent opacity-80 hover:border-primary-500 hover:bg-white hover:text-slate-500 dark:border-white/[0.14] dark:bg-white/[0.03] dark:hover:bg-white/[0.07]'
                    }`}
                    title={isPolish ? 'Zaznacz widoczne' : 'Select visible'}
                  >
                    {allSelected ? '✓' : someSelected ? '−' : '□'}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  <button
                    onClick={() => onSort('title')}
                    className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {isPolish ? 'Tytul' : 'Title'}
                    <SortIndicator active={sortField === 'title'} direction={sortDir} />
                  </button>
                </th>
                <th
                  className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.stage }}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSort('stage')}
                      className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
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
                    minWidth={120}
                    maxWidth={180}
                    onResize={onColumnResize}
                  />
                </th>
                <th
                  className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.tags }}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSort('tags')}
                      className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
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
                    minWidth={140}
                    maxWidth={260}
                    onResize={onColumnResize}
                  />
                </th>
                <th
                  className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.tool }}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSort('tool')}
                      className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
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
                    minWidth={150}
                    maxWidth={220}
                    onResize={onColumnResize}
                  />
                </th>
                <th
                  className="relative px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.date }}
                >
                  <button
                    onClick={() => onSort('date')}
                    className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {isPolish ? 'Data' : 'Updated'}
                    <SortIndicator active={sortField === 'date'} direction={sortDir} />
                  </button>
                  <ColumnResizer
                    columnId="date"
                    currentWidth={columnWidths.date}
                    minWidth={110}
                    maxWidth={150}
                    onResize={onColumnResize}
                  />
                </th>
                <th
                  className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  style={{ width: columnWidths.actions }}
                >
                  {isPolish ? 'Akcje' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((idea, index) => {
                const isChecked = selectedIds.has(idea.id);
                const isPreviewSelected = previewIdeaId === idea.id;
                const isFocused = focusedIndex === index;
                const rowAccentClass = isPreviewSelected
                  ? 'bg-primary-500 dark:bg-primary-300'
                  : isFocused
                    ? 'bg-cyan-500 dark:bg-cyan-300'
                    : isChecked
                      ? 'bg-primary-400/70 dark:bg-primary-300/70'
                      : null;

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
                        ? 'bg-primary-50/95 dark:bg-primary-400/[0.105]'
                        : isChecked
                          ? 'bg-primary-50/65 dark:bg-primary-400/[0.07]'
                          : isFocused
                            ? 'bg-cyan-50/80 dark:bg-cyan-400/[0.075]'
                            : 'bg-white hover:bg-slate-100/80 dark:bg-navy-950 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <td className="relative px-2 py-3.5 align-top">
                      {rowAccentClass ? (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full ${rowAccentClass}`}
                        />
                      ) : null}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelect(idea.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-3.5 w-3.5 rounded-[4px] border-slate-400/70 bg-white/80 text-primary-500 opacity-60 shadow-none transition-all checked:border-primary-500 checked:bg-primary-500 checked:opacity-100 group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-primary-500/25 focus:ring-offset-0 dark:border-white/[0.14] dark:bg-white/[0.035] dark:checked:bg-primary-500 dark:group-hover:bg-white/[0.08]"
                      />
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <div className="truncate text-[13px] font-semibold leading-5 text-slate-950 dark:text-slate-100">
                        {idea.title || (isPolish ? 'Bez tytulu' : 'Untitled')}
                      </div>
                      {idea.body ? (
                        <div className="mt-1 truncate text-[11px] leading-4 text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                          {idea.body}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 align-top" style={{ width: columnWidths.stage }}>
                      {renderStageBadge(idea.stage)}
                    </td>
                    <td className="px-3 py-3.5 align-top" style={{ width: columnWidths.tags }}>
                      {renderTagBadges(idea.tags)}
                    </td>
                    <td className="px-3 py-3.5 align-top" style={{ width: columnWidths.tool }}>
                      {renderToolBadge(idea.preferredTool)}
                    </td>
                    <td
                      className="px-3 py-3.5 align-top text-[11px] leading-5 text-slate-600 dark:text-slate-400"
                      style={{ width: columnWidths.date }}
                    >
                      {formatIdeaDate(idea)}
                    </td>
                    <td
                      className="px-3 py-3 text-right align-top"
                      style={{ width: columnWidths.actions }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActionsMenu sections={rowActionSections} iconVariant="vertical" />
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
