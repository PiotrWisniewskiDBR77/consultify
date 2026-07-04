/**
 * NModeLeftNav
 *
 * Sticky left navigation rail (242px) for section switching.
 * Shows icons + labels with active state highlighting.
 * Click → shows ONE section at a time in the Canvas (no scroll-all).
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.2
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, GripVertical } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NModeSection } from './types';

const isSectionVisible = (s: NModeSection, showAll: boolean) =>
  showAll || s.alwaysShow || s.hasData !== false;

// Canon A4: the rail collapses below the lg breakpoint (< 1024px) so the
// 2-pane layout never breaks on tablet/mobile. Section switching there falls
// back to the toolbar's Sections dropdown.
const N_MODE_LEFT_NAV_WIDTH_CLASS = 'hidden lg:block w-[242px]';

interface NModeLeftNavProps {
  /** Available sections */
  sections: NModeSection[];
  /** Currently active section id */
  activeSection: string;
  /** Section change handler */
  onSectionChange: (sectionId: string) => void;
  /** Optional reorder handler (enables drag and drop in nav) */
  onSectionReorder?: (sectionIds: string[]) => void;
}

interface SortableNavItemProps {
  section: NModeSection;
  isActive: boolean;
  isPolish: boolean;
  onSectionChange: (sectionId: string) => void;
}

const SortableNavItem: React.FC<SortableNavItemProps> = ({
  section,
  isActive,
  isPolish,
  onSectionChange,
}) => {
  const Icon = section.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        onClick={() => onSectionChange(section.id)}
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-c-surface-raised text-c-text border-l-2 border-c-accent'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
        } ${isDragging ? 'opacity-90 shadow-lg shadow-slate-300/20 dark:shadow-navy-900/40' : ''}`}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
            aria-label={isPolish ? 'Przeciaganie zakladki' : 'Drag section'}
          >
            <GripVertical size={12} />
          </span>
          <Icon
            size={14}
            className={
              isActive
                ? 'text-c-text'
                : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
            }
          />
          <span className="whitespace-nowrap flex-1 min-w-0 truncate">
            {isPolish ? section.label.pl : section.label.en}
          </span>
          {/* Mark Complete ✓ badge — AI signal only */}
          {section.completed && (
            <CheckCircle2
              size={13}
              className="shrink-0 text-success-500 dark:text-success-400"
              aria-label={isPolish ? 'Sekcja ukończona' : 'Section complete'}
            />
          )}
          {section.badge !== undefined && section.badge > 0 && !section.completed && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-navy-700/80 text-slate-500 dark:text-slate-400">
              {section.badge}
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export const NModeLeftNav: React.FC<NModeLeftNavProps> = ({
  sections,
  activeSection,
  onSectionChange,
  onSectionReorder,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [showAll, setShowAll] = useState(false);

  // Mark Complete progress: count completable sections (exclude alwaysShow-only)
  const completableSections = useMemo(
    () => sections.filter((s) => s.hasData !== false || s.alwaysShow),
    [sections]
  );
  const completedCount = useMemo(
    () => completableSections.filter((s) => s.completed).length,
    [completableSections]
  );
  const progressPct =
    completableSections.length > 0
      ? Math.round((completedCount / completableSections.length) * 100)
      : 0;
  const showProgress = completableSections.length > 0 && completedCount > 0;

  // Adaptive sidebar (#22): hide sections explicitly marked empty unless the
  // user opts to see them all. Consumers that don't set `hasData` are unaffected.
  const visibleSections = useMemo(
    () => sections.filter((s) => isSectionVisible(s, showAll)),
    [sections, showAll]
  );
  const hiddenCount = useMemo(
    () => sections.filter((s) => !isSectionVisible(s, false)).length,
    [sections]
  );

  // Group sections under their `group` label. Sections sharing a label collect
  // under one header (in first-appearance order), so the consumer controls group
  // order by ordering its sections. (#22b)
  const groups = useMemo(() => {
    const order: Array<string | null> = [];
    const map = new Map<string | null, NModeSection[]>();
    for (const s of visibleSections) {
      const label = s.group ?? null;
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(s);
    }
    return order.map((label) => ({ label, items: map.get(label) as NModeSection[] }));
  }, [visibleSections]);
  const hasGroups = useMemo(() => visibleSections.some((s) => s.group), [visibleSections]);

  const sectionById = useMemo(() => {
    const map = new Map<string, NModeSection>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  const renderItem = (section: NModeSection) => {
    const isActive = activeSection === section.id;
    const Icon = section.icon;
    return (
      <button
        key={section.id}
        onClick={() => onSectionChange(section.id)}
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-c-surface-raised text-c-text border-l-2 border-c-accent'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon
            size={14}
            className={
              isActive
                ? 'text-c-text'
                : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
            }
          />
          <span className="whitespace-nowrap flex-1 min-w-0 truncate">
            {isPolish ? section.label.pl : section.label.en}
          </span>
          {/* Mark Complete ✓ badge — AI signal only */}
          {section.completed && (
            <CheckCircle2
              size={13}
              className="shrink-0 text-success-500 dark:text-success-400"
              aria-label={isPolish ? 'Sekcja ukończona' : 'Section complete'}
            />
          )}
          {section.badge !== undefined && section.badge > 0 && !section.completed && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-navy-700/80 text-slate-500 dark:text-slate-400">
              {section.badge}
            </span>
          )}
        </span>
      </button>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Within-group reorder: groups are fixed semantic buckets, so a section can be
  // dragged only among its own group's siblings. Rebuilds the FULL id order
  // (substituting the dragged group's members in their new relative order at the
  // slots they occupy) so the handler stays robust to non-contiguous groups and
  // never moves a section into a different group.
  const handleDragEnd = (event: DragEndEvent) => {
    if (!onSectionReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeGroup = sectionById.get(activeId)?.group ?? null;
    const overGroup = sectionById.get(overId)?.group ?? null;
    if (activeGroup !== overGroup) return;

    const allIds = sections.map((s) => s.id);
    const groupIds = sections.filter((s) => (s.group ?? null) === activeGroup).map((s) => s.id);
    const oldIndex = groupIds.indexOf(activeId);
    const newIndex = groupIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedGroup = arrayMove(groupIds, oldIndex, newIndex);
    let gi = 0;
    const rebuilt = allIds.map((id) =>
      (sectionById.get(id)?.group ?? null) === activeGroup ? reorderedGroup[gi++] : id
    );
    onSectionReorder(rebuilt);
  };

  // Render one group's items — sortable when a reorder handler is provided,
  // static otherwise. Same markup either way so grouped/flat × drag/static all
  // share one code path (and one look).
  const renderGroupItems = (items: NModeSection[]) =>
    onSectionReorder ? (
      <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {items.map((section) => (
            <SortableNavItem
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              isPolish={isPolish}
              onSectionChange={onSectionChange}
            />
          ))}
        </div>
      </SortableContext>
    ) : (
      <div className="space-y-1">{items.map(renderItem)}</div>
    );

  const navBody = hasGroups
    ? groups.map((g, gi) => (
        <div key={g.label ?? `__ungrouped_${gi}`} className={gi > 0 ? 'pt-3' : ''}>
          {g.label && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-600">
              {g.label}
            </div>
          )}
          {renderGroupItems(g.items)}
        </div>
      ))
    : renderGroupItems(visibleSections);

  return (
    <nav className={`${N_MODE_LEFT_NAV_WIDTH_CLASS} flex-shrink-0 pr-4`}>
      <div className="sticky top-28 pt-1 space-y-1">
        {onSectionReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {navBody}
          </DndContext>
        ) : (
          navBody
        )}

        {(hiddenCount > 0 || showAll) && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 w-full px-3 py-1.5 text-left text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            {showAll
              ? isPolish
                ? 'Ukryj puste sekcje'
                : 'Hide empty sections'
              : isPolish
                ? `Pokaż wszystkie sekcje (${hiddenCount})`
                : `Show all sections (${hiddenCount})`}
          </button>
        )}

        {/* ── Mark Complete progress bar ─────────────────────────── */}
        {showProgress && (
          <div className="mt-3 px-3 pb-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {isPolish ? 'Sekcje gotowe' : 'Sections complete'}
              </span>
              <span className="text-[10px] font-medium text-success-600 dark:text-success-400">
                {completedCount}&thinsp;/&thinsp;{completableSections.length}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-success-500 dark:bg-success-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NModeLeftNav;
