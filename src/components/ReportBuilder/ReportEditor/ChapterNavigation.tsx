/**
 * ChapterNavigation
 *
 * Left-side TOC (Table of Contents) panel for navigating long reports.
 * Full drag & drop support (PowerPoint-like) using @dnd-kit:
 * - Drag blocks within a chapter (reorder)
 * - Drag blocks between chapters (move)
 * - Add, rename, delete chapters
 * - Collapse/expand chapter groups
 *
 * Collapsed state: thin vertical strip inside the flex layout (no fixed positioning).
 */

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Hash,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { BlockConfig } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

export interface Chapter {
  key: string;
  title: string;
  blocks: BlockConfig[];
  isCollapsed?: boolean;
}

interface ChapterNavigationProps {
  blocks: BlockConfig[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onAddChapter: (chapterName?: string) => void;
  onAssignChapter: (blockId: string, chapterKey: string | undefined) => void;
  onRenameChapter: (chapterKey: string, newTitle: string) => void;
  onDeleteChapter?: (chapterKey: string) => void;
  onReorderBlocks?: (activeBlockId: string, overBlockId: string) => void;
  onMoveBlockToChapter?: (blockId: string, targetChapterKey: string | undefined) => void;
  isPl: boolean;
  isVisible: boolean;
  onToggle: () => void;
  sectionRagMap?: Record<string, 'green' | 'amber' | 'red'>;
}

// ==========================================
// CONSTANTS
// ==========================================

const UNGROUPED_KEY = '__ungrouped__';

// ==========================================
// HELPERS
// ==========================================

/**
 * Groups blocks into chapters.
 * Blocks without chapterKey go into "Ungrouped".
 */
export function groupBlocksIntoChapters(blocks: BlockConfig[]): Chapter[] {
  const chapterMap = new Map<string, Chapter>();
  const chapterOrder: string[] = [];

  for (const block of blocks) {
    const key = block.chapterKey || UNGROUPED_KEY;
    if (!chapterMap.has(key)) {
      chapterMap.set(key, {
        key,
        title: block.chapterTitle || (key === UNGROUPED_KEY ? '' : key),
        blocks: [],
      });
      chapterOrder.push(key);
    }
    chapterMap.get(key)!.blocks.push(block);
    if (block.chapterTitle && key !== UNGROUPED_KEY) {
      chapterMap.get(key)!.title = block.chapterTitle;
    }
  }

  return chapterOrder.map((key) => chapterMap.get(key)!);
}

/**
 * Checks if report has chapters (any block has a chapterKey)
 */
export function hasChapters(blocks: BlockConfig[]): boolean {
  return blocks.some((b) => b.chapterKey);
}

// ==========================================
// BLOCK TYPE ICONS
// ==========================================

function getBlockTypeIcon(type: string): string {
  switch (type) {
    case 'cover':
      return '📄';
    case 'summary':
      return '📋';
    case 'matrix':
      return '🔲';
    case 'analysis':
    case 'axis_analysis':
      return '🔍';
    case 'recommendations':
      return '💡';
    case 'action_plan':
      return '🎯';
    case 'methodology':
      return '📐';
    case 'findings':
      return '🔎';
    case 'table':
    case 'scorecard':
      return '📊';
    case 'chart':
    case 'chart_pie':
      return '📈';
    case 'dashboard':
    case 'kpis':
      return '📟';
    case 'risk':
      return '⚠️';
    case 'roadmap':
      return '🗺️';
    case 'quote':
      return '💬';
    case 'context':
      return '🏢';
    case 'appendix':
      return '📎';
    case 'gap_analysis':
      return '📉';
    case 'prioritization':
      return '⚖️';
    case 'initiatives':
    case 'initiative_cards':
      return '⚡';
    default:
      return '📝';
  }
}

// ==========================================
// SORTABLE BLOCK ITEM
// ==========================================

interface SortableBlockItemProps {
  block: BlockConfig;
  isSelected: boolean;
  onSelect: () => void;
  ragStatus?: 'green' | 'amber' | 'red';
}

const RAG_DOT_CLASSES: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-danger-500',
};

const SortableBlockItem: React.FC<SortableBlockItemProps> = ({
  block,
  isSelected,
  onSelect,
  ragStatus,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button
        className="p-0.5 text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <button
        onClick={() => {
          onSelect();
          const el = document.getElementById(`block-${block.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        className={`
          flex-1 flex items-center gap-2 px-2 py-1.5 text-left rounded-md transition-colors min-w-0
          ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }
          ${!block.enabled ? 'opacity-40' : ''}
        `}
      >
        <span className="text-xs flex-shrink-0">{getBlockTypeIcon(block.type)}</span>
        <span className="text-[11px] truncate flex-1">{block.title}</span>
        {ragStatus && (
          <span
            className={`w-2 h-2 rounded-full ${RAG_DOT_CLASSES[ragStatus]} flex-shrink-0`}
            title={`RAG: ${ragStatus.toUpperCase()}`}
          />
        )}
        {block.isGenerated && !ragStatus && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        )}
      </button>
    </div>
  );
};

// ==========================================
// DRAG OVERLAY BLOCK
// ==========================================

const DragOverlayBlock: React.FC<{ block: BlockConfig }> = ({ block }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-c-surface border border-blue-300 dark:border-blue-600 rounded-lg shadow-lg text-sm">
    <span className="text-xs">{getBlockTypeIcon(block.type)}</span>
    <span className="text-xs font-medium truncate">{block.title}</span>
  </div>
);

// ==========================================
// COMPONENT
// ==========================================

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onAddChapter,
  onAssignChapter: _onAssignChapter,
  onRenameChapter,
  onDeleteChapter,
  onReorderBlocks,
  onMoveBlockToChapter,
  isPl,
  isVisible,
  onToggle,
  sectionRagMap,
}) => {
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [confirmDeleteChapter, setConfirmDeleteChapter] = useState<string | null>(null);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');

  const chapters = useMemo(() => groupBlocksIntoChapters(blocks), [blocks]);
  const hasAnyChapters = useMemo(() => hasChapters(blocks), [blocks]);

  const allBlockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const activeBlock = useMemo(
    () => (activeBlockId ? blocks.find((b) => b.id === activeBlockId) : null),
    [activeBlockId, blocks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleChapterCollapse = (key: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startRename = (key: string, currentTitle: string) => {
    setEditingChapter(key);
    setEditTitle(currentTitle);
  };

  const finishRename = () => {
    if (editingChapter && editTitle.trim()) {
      onRenameChapter(editingChapter, editTitle.trim());
    }
    setEditingChapter(null);
    setEditTitle('');
  };

  const handleDeleteChapter = (chapterKey: string) => {
    if (onDeleteChapter) {
      onDeleteChapter(chapterKey);
    }
    setConfirmDeleteChapter(null);
  };

  const handleAddChapterSubmit = () => {
    const name = newChapterName.trim();
    if (name) {
      onAddChapter(name);
    } else {
      onAddChapter();
    }
    setNewChapterName('');
    setIsAddingChapter(false);
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveBlockId(String(event.active.id));
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Could be used for visual cues when dragging over chapters
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBlockId(null);
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeChapter = chapters.find((c) => c.blocks.some((b) => b.id === activeId));
    const overChapter = chapters.find((c) => c.blocks.some((b) => b.id === overId));

    if (activeChapter && overChapter && activeChapter.key === overChapter.key) {
      onReorderBlocks?.(activeId, overId);
    } else if (activeChapter && overChapter && activeChapter.key !== overChapter.key) {
      const targetKey = overChapter.key === UNGROUPED_KEY ? undefined : overChapter.key;
      onMoveBlockToChapter?.(activeId, targetKey);
      onReorderBlocks?.(activeId, overId);
    }
  };

  // ==========================================
  // COLLAPSED STATE — thin vertical strip inside the layout
  // ==========================================

  if (!isVisible) {
    return (
      <div
        className="w-10 bg-c-surface border-r border-c-border-subtle flex flex-col items-center py-3 flex-shrink-0 cursor-pointer hover:bg-c-surface-raised transition-colors group"
        onClick={onToggle}
        title={isPl ? 'Pokaż spis treści' : 'Show table of contents'}
      >
        <BookOpen className="w-4 h-4 text-c-text-secondary group-hover:text-blue-500 transition-colors mb-2" />
        <ChevronRight className="w-3 h-3 text-c-text-secondary group-hover:text-blue-400 mb-3" />
        {/* Vertical label */}
        <span
          className="text-[9px] font-semibold text-c-text-secondary group-hover:text-blue-500 uppercase tracking-[0.15em] transition-colors"
          style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
        >
          {isPl ? 'Spis treści' : 'Contents'}
        </span>
      </div>
    );
  }

  // ==========================================
  // EXPANDED STATE — full sidebar
  // ==========================================

  return (
    <aside className="w-64 bg-c-surface border-r border-c-border-subtle flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-c-border-subtle flex items-center justify-between">
        <h3 className="text-xs font-semibold text-c-text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          {isPl ? 'Spis Treści' : 'Table of Contents'}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAddingChapter(true)}
            className="p-1 text-c-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title={isPl ? 'Dodaj rozdział' : 'Add chapter'}
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded"
            title={isPl ? 'Zwiń panel' : 'Collapse panel'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Stats */}
        <div className="flex items-center gap-3 px-2 py-1.5 mb-2 text-[10px] text-c-text-secondary">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {blocks.length} {isPl ? 'bloków' : 'blocks'}
          </span>
          {hasAnyChapters && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {chapters.filter((c) => c.key !== UNGROUPED_KEY).length}{' '}
              {isPl ? 'rozdziałów' : 'chapters'}
            </span>
          )}
        </div>

        {/* DnD Context wrapping all chapters and blocks */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allBlockIds} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => {
              const isUngrouped = chapter.key === UNGROUPED_KEY;
              const isCollapsed = collapsedChapters.has(chapter.key);
              const isEditing = editingChapter === chapter.key;
              const hasSelectedBlock = chapter.blocks.some((b) => b.id === selectedBlockId);
              const enabledCount = chapter.blocks.filter((b) => b.enabled).length;
              const isConfirmingDelete = confirmDeleteChapter === chapter.key;
              const namedChapters = chapters.filter((c) => c.key !== UNGROUPED_KEY);

              return (
                <div key={chapter.key} className="mb-1">
                  {/* Chapter Header */}
                  {(!isUngrouped || hasAnyChapters) && (
                    <div
                      className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded-lg group/chapter
                        ${
                          hasSelectedBlock && !isUngrouped
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-c-surface-raised'
                        }
                        ${!isUngrouped ? 'cursor-pointer' : ''}
                      `}
                      onClick={() => !isUngrouped && toggleChapterCollapse(chapter.key)}
                    >
                      {!isUngrouped && (
                        <>
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-c-text-secondary flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-c-text-secondary flex-shrink-0" />
                          )}
                        </>
                      )}

                      {!isUngrouped && (
                        <span className="w-5 h-5 rounded bg-c-surface-raised flex items-center justify-center text-c-text text-[10px] font-bold flex-shrink-0">
                          {namedChapters.indexOf(chapter) + 1}
                        </span>
                      )}

                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={finishRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRename();
                            if (e.key === 'Escape') {
                              setEditingChapter(null);
                              setEditTitle('');
                            }
                          }}
                          autoFocus
                          className="flex-1 text-xs font-semibold bg-transparent border-b border-blue-500 outline-none text-c-text py-0.5 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`flex-1 text-xs font-semibold truncate ${
                            isUngrouped ? 'text-c-text-secondary italic' : 'text-c-text'
                          }`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!isUngrouped) startRename(chapter.key, chapter.title);
                          }}
                        >
                          {isUngrouped ? (isPl ? 'Bez rozdziału' : 'Ungrouped') : chapter.title}
                        </span>
                      )}

                      <span className="text-[10px] text-c-text-secondary flex-shrink-0">
                        {enabledCount}/{chapter.blocks.length}
                      </span>

                      {/* Chapter actions */}
                      {!isUngrouped && !isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/chapter:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(chapter.key, chapter.title);
                            }}
                            className="p-0.5 text-c-text-secondary hover:text-blue-500 rounded"
                            title={isPl ? 'Zmień nazwę' : 'Rename'}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {isConfirmingDelete ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleDeleteChapter(chapter.key)}
                                className="p-0.5 text-danger-500 hover:text-danger-700 rounded"
                                title={isPl ? 'Potwierdź' : 'Confirm'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteChapter(null)}
                                className="p-0.5 text-c-text-secondary hover:text-c-text-secondary rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteChapter(chapter.key);
                              }}
                              className="p-0.5 text-c-text-secondary hover:text-danger-500 rounded"
                              title={isPl ? 'Usuń rozdział' : 'Delete chapter'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Block List */}
                  {(!isCollapsed || isUngrouped) && (
                    <div
                      className={`${!isUngrouped && hasAnyChapters ? 'ml-3 border-l border-c-border-subtle' : ''}`}
                    >
                      {chapter.blocks.map((block) => (
                        <SortableBlockItem
                          key={block.id}
                          block={block}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => onSelectBlock(block.id)}
                          ragStatus={sectionRagMap?.[block.id]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeBlock ? <DragOverlayBlock block={activeBlock} /> : null}
          </DragOverlay>
        </DndContext>

        {/* "Add chapter" prompt when no chapters and many blocks */}
        {!hasAnyChapters && blocks.length > 5 && !isAddingChapter && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
              {isPl
                ? 'Masz więcej niż 5 bloków. Rozważ organizację w rozdziały.'
                : 'You have more than 5 blocks. Consider organizing them into chapters.'}
            </p>
            <button
              onClick={() => setIsAddingChapter(true)}
              className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              {isPl ? 'Dodaj rozdziały' : 'Add chapters'}
            </button>
          </div>
        )}

        {/* Inline "new chapter" input */}
        {isAddingChapter && (
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1 block">
              {isPl ? 'Nowy rozdział' : 'New chapter'}
            </label>
            <input
              type="text"
              value={newChapterName}
              onChange={(e) => setNewChapterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddChapterSubmit();
                if (e.key === 'Escape') {
                  setIsAddingChapter(false);
                  setNewChapterName('');
                }
              }}
              autoFocus
              placeholder={isPl ? 'Nazwa rozdziału...' : 'Chapter name...'}
              className="w-full text-xs bg-c-surface border border-blue-300 dark:border-blue-700 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-400 text-c-text placeholder:text-c-text-muted"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddChapterSubmit}
                className="flex-1 text-[11px] font-medium bg-blue-600 text-c-text px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                {isPl ? 'Dodaj' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setIsAddingChapter(false);
                  setNewChapterName('');
                }}
                className="text-[11px] text-c-text-secondary hover:text-c-text px-2 py-1"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Quick "add chapter" button at bottom (always visible when chapters exist) */}
        {hasAnyChapters && !isAddingChapter && (
          <button
            onClick={() => setIsAddingChapter(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] text-c-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-dashed border-c-border-subtle hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {isPl ? 'Dodaj rozdział' : 'Add chapter'}
          </button>
        )}
      </div>
    </aside>
  );
};

export default ChapterNavigation;
