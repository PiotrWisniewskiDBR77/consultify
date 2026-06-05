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
import { GripVertical } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NModeSection } from './types';

const isSectionVisible = (s: NModeSection, showAll: boolean) =>
  showAll || s.alwaysShow || s.hasData !== false;

const N_MODE_LEFT_NAV_WIDTH_CLASS = 'w-[242px]';

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
            ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500'
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
                ? 'text-primary-500 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
            }
          />
          <span className="whitespace-nowrap">
            {isPolish ? section.label.pl : section.label.en}
          </span>
          {section.badge !== undefined && section.badge > 0 && (
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onSectionReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onSectionReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <nav className={`${N_MODE_LEFT_NAV_WIDTH_CLASS} flex-shrink-0 pr-4`}>
      <div className="sticky top-28 pt-1 space-y-1">
        {!onSectionReorder ? (
          visibleSections.map((section) => {
            const isActive = activeSection === section.id;
            const Icon = section.icon;

            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    size={14}
                    className={
                      isActive
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                    }
                  />
                  <span className="whitespace-nowrap">
                    {isPolish ? section.label.pl : section.label.en}
                  </span>
                  {section.badge !== undefined && section.badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-navy-700/80 text-slate-500 dark:text-slate-400">
                      {section.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleSections.map((section) => (
                <SortableNavItem
                  key={section.id}
                  section={section}
                  isActive={activeSection === section.id}
                  isPolish={isPolish}
                  onSectionChange={onSectionChange}
                />
              ))}
            </SortableContext>
          </DndContext>
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
      </div>
    </nav>
  );
};

export default NModeLeftNav;
