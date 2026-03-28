import {
  Calendar,
  CheckCircle2,
  Lightbulb,
  Network,
  PenTool,
  Rocket,
  Sparkles,
  Sprout,
  Table2,
  Trash2,
  TreePine,
  Workflow,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import type {
  ColumnDef,
  ColumnWidths,
  FilterOption,
  TableFilters,
} from '@/components/ui/ResizableTable';
import { ColumnResizer, FilterDropdown } from '@/components/ui/ResizableTable';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import type { IdeaStage, MyIdea, SortDir, SortField } from './MyIdeasListContent';

const STAGE_META: Record<
  IdeaStage,
  {
    label: string;
    labelPl: string;
    icon: React.ElementType;
    badge: string;
  }
> = {
  spark: {
    label: 'Spark',
    labelPl: 'Iskra',
    icon: Lightbulb,
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  incubating: {
    label: 'Growing',
    labelPl: 'Rosnie',
    icon: Sprout,
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  shaping: {
    label: 'Shaping',
    labelPl: 'Ksztaltuje',
    icon: TreePine,
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  ready: {
    label: 'Ready',
    labelPl: 'Gotowy',
    icon: CheckCircle2,
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
  promoted: {
    label: 'Promoted',
    labelPl: 'Promowany',
    icon: Rocket,
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
};

const TOOL_META: Record<
  string,
  {
    label: string;
    labelPl: string;
    icon: React.ElementType;
    badge: string;
  }
> = {
  mindmap: {
    label: 'Recommendation map',
    labelPl: 'Mapa rekomendacji',
    icon: Network,
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  table: {
    label: 'Table',
    labelPl: 'Tabela',
    icon: Table2,
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  process_flow: {
    label: 'Process Flow',
    labelPl: 'Proces',
    icon: Workflow,
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  whiteboard: {
    label: 'Whiteboard',
    labelPl: 'Whiteboard',
    icon: PenTool,
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
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
  onStartConvert: (idea: MyIdea) => void;
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
  onStartConvert,
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
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
      >
        <Icon size={10} />
        {isPolish ? meta.labelPl : meta.label}
      </span>
    );
  };

  const renderToolBadge = (tool?: string | null) => {
    const meta = getToolMeta(tool);
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
      >
        <Icon size={10} />
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
            className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300"
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
    const toolMeta = getToolMeta(idea.preferredTool);
    return (
      <div className="space-y-4">
        {idea.body ? (
          <section className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Opis' : 'Summary'}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{idea.body}</p>
          </section>
        ) : null}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Etap' : 'Stage'}
            </div>
            <div className="mt-2">{renderStageBadge(idea.stage)}</div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Narzędzie' : 'Tool'}
            </div>
            <div className="mt-2">{renderToolBadge(idea.preferredTool)}</div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Data' : 'Updated'}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Calendar size={14} className="text-slate-400" />
              {formatIdeaDate(idea)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Tagi' : 'Tags'}
            </div>
            <div className="mt-2">{renderTagBadges(idea.tags, 4)}</div>
          </div>
        </section>

        {(idea.mapItems || idea.mapNodes || idea.mapEdges || idea.sourceType) && (
          <section className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Kontekst' : 'Context'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              {idea.sourceType ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-navy-800">
                  {isPolish ? 'Zrodlo' : 'Source'}: {idea.sourceType}
                </span>
              ) : null}
              {typeof idea.mapItems === 'number' ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-navy-800">
                  {isPolish ? 'Elementy' : 'Items'}: {idea.mapItems}
                </span>
              ) : null}
              {typeof idea.mapNodes === 'number' ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-navy-800">
                  {isPolish ? 'Nodes' : 'Nodes'}: {idea.mapNodes}
                </span>
              ) : null}
              {typeof idea.mapEdges === 'number' ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-navy-800">
                  {isPolish ? 'Polaczenia' : 'Edges'}: {idea.mapEdges}
                </span>
              ) : null}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-dashed border-slate-200/70 p-3 dark:border-white/[0.06]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Co dalej' : 'Next step'}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {isPolish
              ? `Otworz pelny workspace, aby rozwinac ${stageMeta.labelPl.toLowerCase()} w narzedziu ${toolMeta.labelPl.toLowerCase()}.`
              : `Open the full workspace to expand this ${stageMeta.label.toLowerCase()} idea in ${toolMeta.label.toLowerCase()}.`}
          </p>
        </section>
      </div>
    );
  };

  const renderPreviewFooter = (idea: MyIdea) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onStartConvert(idea)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-500/15 dark:text-purple-300"
      >
        <Sparkles size={14} />
        {isPolish ? 'Konwertuj' : 'Convert'}
      </button>
      <button
        onClick={() => onOpenIdeaInProcessFlow(idea)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300"
      >
        <Workflow size={14} />
        {isPolish ? 'Otworz Flow' : 'Open Flow'}
      </button>
      <ConvertToOutputMenu
        sourceType="idea"
        sourceId={idea.id}
        sourceTitle={idea.title || ''}
        onConvertComplete={() => onRefresh()}
        variant="dropdown"
      />
    </div>
  );

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
        <div className="h-full overflow-x-auto">
          <table className="w-full table-fixed" style={{ minWidth: 980 }}>
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-navy-900/90 backdrop-blur">
              <tr className="border-b border-slate-200/70 dark:border-white/[0.06]">
                <th className="w-10 px-2 py-2.5">
                  <button
                    onClick={() => {
                      if (allSelected) {
                        onClearSelection();
                      } else {
                        onSelectAllVisible();
                      }
                    }}
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      allSelected
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : someSelected
                          ? 'border-primary-500 bg-primary-500/50 text-white'
                          : 'border-slate-300 text-transparent hover:border-primary-400 hover:text-slate-400 dark:border-white/[0.10]'
                    }`}
                    title={isPolish ? 'Zaznacz widoczne' : 'Select visible'}
                  >
                    {allSelected ? '✓' : someSelected ? '−' : '□'}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <button
                    onClick={() => onSort('title')}
                    className="inline-flex items-center text-left transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {isPolish ? 'Tytul' : 'Title'}
                    <SortIndicator active={sortField === 'title'} direction={sortDir} />
                  </button>
                </th>
                <th
                  className="relative px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                  className="relative px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                  className="relative px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                  className="relative px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                  className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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

                const rowActions: RowAction[] = [
                  {
                    id: 'open',
                    label: isPolish ? 'Otwórz' : 'Open',
                    onClick: () => onOpenIdea(idea),
                  },
                  {
                    id: 'convert',
                    label: isPolish ? 'Konwertuj' : 'Convert',
                    icon: Sparkles,
                    onClick: () => onStartConvert(idea),
                  },
                  {
                    id: 'flow',
                    label: isPolish ? 'Otwórz w Process Flow' : 'Open in Process Flow',
                    icon: Workflow,
                    onClick: () => onOpenIdeaInProcessFlow(idea),
                  },
                  {
                    id: 'delete',
                    label: isPolish ? 'Usuń' : 'Delete',
                    icon: Trash2,
                    variant: 'danger',
                    divider: true,
                    onClick: () => onDeleteIdea(idea),
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
                    className={`group cursor-pointer border-b border-slate-200/60 transition-colors dark:border-white/[0.06] ${
                      isPreviewSelected
                        ? 'bg-primary-50 dark:bg-primary-500/10'
                        : isChecked
                          ? 'bg-primary-50/60 dark:bg-primary-500/6'
                          : isFocused
                            ? 'bg-amber-50/50 dark:bg-amber-500/5'
                            : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="px-2 py-2.5 align-top">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelect(idea.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500/30 dark:border-white/[0.10]"
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {idea.title || (isPolish ? 'Bez tytulu' : 'Untitled')}
                      </div>
                      {idea.body ? (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {idea.body}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ width: columnWidths.stage }}>
                      {renderStageBadge(idea.stage)}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ width: columnWidths.tags }}>
                      {renderTagBadges(idea.tags)}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ width: columnWidths.tool }}>
                      {renderToolBadge(idea.preferredTool)}
                    </td>
                    <td
                      className="px-3 py-2.5 align-top text-[11px] text-slate-500 dark:text-slate-400"
                      style={{ width: columnWidths.date }}
                    >
                      {formatIdeaDate(idea)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right align-top"
                      style={{ width: columnWidths.actions }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActionsMenu actions={rowActions} iconVariant="vertical" />
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
