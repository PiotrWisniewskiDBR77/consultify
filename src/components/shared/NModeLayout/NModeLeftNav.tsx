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
import { CheckCircle2, ChevronDown, GripVertical } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NModeSection } from './types';

const isSectionVisible = (s: NModeSection, showAll: boolean) =>
  showAll || s.alwaysShow || s.hasData !== false;

// Canon A4: the rail collapses below the lg breakpoint (< 1024px) so the
// 2-pane layout never breaks on tablet/mobile. Section switching there falls
// back to the toolbar's Sections dropdown.
// Szerokość z tokenu gridu n-Type (--ntype-left-panel-width: 216px) — wspólna
// dla sześciu kart, żeby lewy panel nie zmieniał szerokości między kartami ani
// zależnie od długości nazw sekcji (SSOT: _GRID_STABILIZATION_COMMAND_2026-07-24).
const N_MODE_LEFT_NAV_WIDTH_CLASS = 'hidden lg:block w-[var(--ntype-left-panel-width)]';

// Panel ma WŁASNE przewijanie zamiast rosnąć z całą stroną (SSOT „Lewy panel
// sekcji": Inicjatywa = 26 sekcji rosła do ~2437px i przewijała się razem ze
// stroną). `top-28` = 7rem odstępu od góry scrollującego przodka; odejmujemy
// dodatkowy oddech na dole (1.5rem), żeby panel nie stykał się z krawędzią
// widoku, gdy jest długi.
const N_MODE_LEFT_NAV_SCROLL_CLASS =
  'max-h-[calc(100vh-8.5rem)] overflow-y-auto app-table-scrollbar';

// Klucz localStorage dla zwinięcia grup — namespaced po ZESTAWIE etykiet grup
// danej karty (Inicjatywa: „Zakres i plan/…"; Insight: „Insight/…"), więc każda
// karta pamięta swój stan niezależnie bez potrzeby osobnego propa identyfikującego
// artefakt (wzorzec kluczy: `mels.rail.{moduleKey}` w useRailState.ts).
const collapsedGroupsStorageKey = (groupLabelsKey: string) =>
  `ntype.leftNav.collapsedGroups.${groupLabelsKey}`;

function readCollapsedGroups(groupLabelsKey: string): Record<string, boolean> {
  if (typeof window === 'undefined' || !groupLabelsKey) return {};
  try {
    const raw = window.localStorage.getItem(collapsedGroupsStorageKey(groupLabelsKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

interface NModeLeftNavProps {
  /** Available sections */
  sections: NModeSection[];
  /** Currently active section id */
  activeSection: string;
  /** Section change handler */
  onSectionChange: (sectionId: string) => void;
  /** Optional reorder handler (enables drag and drop in nav) */
  onSectionReorder?: (sectionIds: string[]) => void;
  /**
   * Karta otwarta w trybie „Podgląd" (Menu 2 → Edycja | Podgląd).
   *
   * W Podglądzie nawigacja jest TYLKO do czytania — standard §4.4: uchwyty
   * przeciągania są ukryte, bo w trybie „do pokazania klientowi" nie ma czego
   * przestawiać, a kolumna 12-pikselowych kropek przy każdej pozycji zabierała
   * uwagę tytułom sekcji (pomiar 2026-07-23: 4 uchwyty w Decyzji/Zadaniu,
   * 11 we Wglądzie, gdzie Podgląd bywa trybem wejściowym).
   *
   * Opcjonalny i domyślnie `false` → konsument, który go nie poda, zachowuje
   * dzisiejsze zachowanie 1:1 (uchwyty widoczne, drag działa).
   */
  readMode?: boolean;
}

interface SortableNavItemProps {
  section: NModeSection;
  isActive: boolean;
  isPolish: boolean;
  onSectionChange: (sectionId: string) => void;
  /** Podgląd → bez uchwytu (drag i tak nie ma za co złapać). */
  readMode?: boolean;
}

const SortableNavItem: React.FC<SortableNavItemProps> = ({
  section,
  isActive,
  isPolish,
  onSectionChange,
  readMode = false,
}) => {
  const { t } = useTranslation();
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
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--c-focus)] ${
          isActive
            ? 'bg-c-surface-raised text-c-text border-l-2 border-c-focus-solid'
            : 'text-c-text-secondary hover:bg-state-hover border-l-2 border-transparent'
        } ${isDragging ? 'opacity-90 shadow-lg' : ''}`}
      >
        <span className="flex items-center gap-2">
          {/* Uchwyt przeciągania — TYLKO w Edycji (standard §4.4). W Podglądzie
              nie renderujemy go wcale: nie ma za co złapać, więc drag jest
              bezwiedny, a wiersz przestaje mieć 12 px szumu przed ikoną. */}
          {!readMode && (
            <span
              className="inline-flex items-center text-c-text-secondary hover:text-c-text-muted cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              {...attributes}
              {...listeners}
              aria-label={t('sharedComponents.nModeLeftNav.dragSection')}
            >
              <GripVertical size={12} />
            </span>
          )}
          <Icon
            size={14}
            className={
              isActive
                ? 'text-c-focus-solid'
                : 'text-c-text-muted group-hover:text-c-text-secondary'
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
              aria-label={t('sharedComponents.nModeLeftNav.sectionComplete')}
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
  readMode = false,
}) => {
  const { t, i18n } = useTranslation();
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

  // Stabilny klucz namespace'ujący localStorage po ZESTAWIE etykiet grup tej
  // karty (liczony z `sections`, nie z `visibleSections`, żeby przełącznik
  // „Pokaż wszystkie" nie przesuwał klucza). Puste, gdy karta nie ma grup —
  // wtedy nic się nie zapisuje/odczytuje (5 kart bez grupowania = bez zmian).
  const groupLabelsKey = useMemo(() => {
    const set = new Set<string>();
    for (const s of sections) if (s.group) set.add(s.group);
    return Array.from(set).sort().join('|');
  }, [sections]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    readCollapsedGroups(groupLabelsKey)
  );

  useEffect(() => {
    if (!groupLabelsKey) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        collapsedGroupsStorageKey(groupLabelsKey),
        JSON.stringify(collapsedGroups)
      );
    } catch {
      // localStorage może być pełny/wyłączony (tryb prywatny) — zapamiętywanie
      // jest best-effort, nie blokuje działania nawigacji.
    }
  }, [collapsedGroups, groupLabelsKey]);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

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
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--c-focus)] ${
          isActive
            ? 'bg-c-surface-raised text-c-text border-l-2 border-c-focus-solid'
            : 'text-c-text-secondary hover:bg-state-hover border-l-2 border-transparent'
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon
            size={14}
            className={
              isActive
                ? 'text-c-focus-solid'
                : 'text-c-text-muted group-hover:text-c-text-secondary'
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
              aria-label={t('sharedComponents.nModeLeftNav.sectionComplete')}
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
              readMode={readMode}
            />
          ))}
        </div>
      </SortableContext>
    ) : (
      <div className="space-y-1">{items.map(renderItem)}</div>
    );

  const navBody = hasGroups
    ? groups.map((g, gi) => {
        const label = g.label;
        // Grupa zawierająca aktywną sekcję zostaje rozwinięta niezależnie od
        // zapamiętanego stanu zwinięcia — użytkownik nie może wylądować na
        // sekcji, której nagłówek grupy ją ukrywa.
        const containsActive = label ? g.items.some((s) => s.id === activeSection) : false;
        const isGroupCollapsed = label ? Boolean(collapsedGroups[label]) && !containsActive : false;
        return (
          <div key={label ?? `__ungrouped_${gi}`} className={gi > 0 ? 'pt-3' : ''}>
            {label && (
              /* Nagłówek grupy („Wgląd/Dowody/Dostarczane", „Zakres i plan/Rezultaty").
                 BYŁO: surowa szarość z palety Tailwinda (jasny wariant + jeszcze
                 ciemniejszy w `dark:`), 10 px — pomiar 2026-07-23: 2,34:1 (light)
                 i 2,52:1 (dark), czyli grubo poniżej progu AA 4,5:1; w ciemnym
                 motywie nagłówek gasł zupełnie, bo był ciemniejszy od tła obok.
                 JEST: token `c-text-secondary` (theme-aware, bez wariantu `dark:`)
                 + 11 px, żeby wersaliki z rozstrzeleniem 0.14em dały się czytać.
                 Nagłówek jest teraz też przyciskiem zwijającym grupę (SSOT
                 „Lewy panel sekcji": grupy mogą być zwijane, Inicjatywa ma mieć
                 sticky nagłówki) — `sticky top-0` + tło tokenu `c-surface-raised`
                 z przezroczystością (VA0.5 alpha-enabled token, wzorzec
                 `FilterableTable`/`NModeShell`), bo panel siedzi na przekątnym
                 gradiencie strony, którego nie da się dopasować jednym płaskim
                 kolorem — a raw `slate-*`/`navy-*` jest zakazane w powłoce
                 artefaktu (check-artefakt.sh). */
              <button
                type="button"
                onClick={() => toggleGroup(label)}
                aria-expanded={!isGroupCollapsed}
                className="sticky top-0 z-10 flex w-full items-center justify-between gap-1 bg-c-surface-raised/90 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--c-focus)] rounded-sm"
              >
                <span className="truncate">{label}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 text-c-text-muted transition-transform duration-fast ${
                    isGroupCollapsed ? '-rotate-90' : ''
                  }`}
                />
              </button>
            )}
            {!isGroupCollapsed && renderGroupItems(g.items)}
          </div>
        );
      })
    : renderGroupItems(visibleSections);

  // Odstęp lewy panel ↔ centrum = JEDEN token --ntype-column-gap (24px).
  // Wcześniej: pr-4 (16px) TU + pl-6 (24px) w NModeCanvas = 40px podwójnego
  // marginesu; teraz odstęp niesie wyłącznie ten pas (pr), a NModeCanvas nie ma
  // już własnego pl (SSOT: _GRID_STABILIZATION_COMMAND_2026-07-24).
  return (
    <nav className={`${N_MODE_LEFT_NAV_WIDTH_CLASS} flex-shrink-0 pr-[var(--ntype-column-gap)]`}>
      {/* Panel dostaje WŁASNE przewijanie zamiast rosnąć z całą stroną (SSOT
          „Lewy panel sekcji": Inicjatywa = 26 sekcji rosła do ~2437px). Karty
          z małą liczbą sekcji (4-7) nigdy nie sięgają `max-h`, więc dla nich
          `overflow-y-auto` jest bezwiedny — zero regresji wyglądu. */}
      <div className="sticky top-28 pt-1">
        <div className={`${N_MODE_LEFT_NAV_SCROLL_CLASS} space-y-1`}>
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
              className="mt-1 w-full px-3 py-1.5 text-left text-[11px] text-c-text-muted transition-colors hover:text-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] rounded"
            >
              {showAll
                ? t('sharedComponents.nModeLeftNav.hideEmptySections')
                : t('sharedComponents.nModeLeftNav.showAllSections', { count: hiddenCount })}
            </button>
          )}

          {/* ── Mark Complete progress bar ─────────────────────────── */}
          {showProgress && (
            <div className="mt-3 px-3 pb-1 space-y-1.5">
              <div className="flex items-center justify-between">
                {/* Ta sama wada kontrastu co nagłówki grup (surowa szarość, 10 px)
                    — token + 11 px, żeby cała nawigacja miała jeden poziom AA. */}
                <span className="text-[11px] text-c-text-secondary">
                  {t('sharedComponents.nModeLeftNav.sectionsComplete')}
                </span>
                <span className="text-[11px] font-medium text-success-600 dark:text-success-400">
                  {completedCount}&thinsp;/&thinsp;{completableSections.length}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-c-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-success-500 dark:bg-success-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NModeLeftNav;
