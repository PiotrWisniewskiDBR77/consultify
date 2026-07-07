/**
 * useCardLayout — card-management primitive for the N-pattern (wzorzec N §3.5)
 *
 * Turns a DEFAULT_CARD_SETS spec into a LIVE, editable layout of an artifact's
 * cards and exposes the full management API:
 *
 *     add · remove · hide/show · reorder · applyDefaultSet · resetToDefault
 *
 * The layout is a flat list of `{ id, visible, order }` items. `order` is the
 * canonical index (0-based, contiguous); `visible` drives whether a card shows
 * in the nav/canvas. Cards NOT in the layout are "available to add" and surface
 * in the "+ Nowa karta ▾" picker.
 *
 * PERSISTENCE IS THE ARTIFACT'S JOB. This hook does NOT touch the network or
 * localStorage. It calls `onLayoutChange(layout)` after every mutation; the
 * artifact persists however it likes (localStorage, PATCH updateInsight JSON,
 * `sectionCompletions`-style column, …). Pass `initialLayout` to hydrate from a
 * previously persisted layout; omit it to start from the default set.
 *
 * DERIVING SECTIONS: `applyToSections(sections)` takes the artifact's full
 * `NModeSection[]` (in any order) and returns them filtered to VISIBLE cards, in
 * layout order, with layout-only ids that have no matching section dropped and
 * sections missing from the layout appended at the end (never truncated).
 *
 * @see cardSets.ts  (DEFAULT_CARD_SETS + catalog)
 * @see Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5
 */

import { useCallback, useMemo, useState } from 'react';

import {
  type ArtifactCardSpec,
  type CardCatalogEntry,
  DEFAULT_CARD_SETS,
  type NModeArtifactType,
} from './cardSets';

// ── Layout model ────────────────────────────────────────────────────────────────

export interface CardLayoutItem {
  /** Card id (== artifact section id). */
  id: string;
  /** Whether the card is shown in the nav/canvas. */
  visible: boolean;
  /** Canonical order index (0-based, contiguous). */
  order: number;
}

export type CardLayout = CardLayoutItem[];

export interface UseCardLayoutOptions {
  /** Artifact type — selects the catalog + default sets from DEFAULT_CARD_SETS. */
  artifactType: NModeArtifactType;
  /**
   * Previously persisted layout to hydrate from. When omitted (or empty) the
   * hook builds the layout from the canonical default set (`sets[0]`).
   */
  initialLayout?: CardLayout | null;
  /**
   * Persistence callback — fired after EVERY mutation with the next layout.
   * The artifact owns persistence (localStorage / PATCH / column). Optional so
   * the hook is usable in read-only previews.
   */
  onLayoutChange?: (layout: CardLayout) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Build the canonical default layout from a spec's first (default) set. */
function buildDefaultLayout(spec: ArtifactCardSpec): CardLayout {
  const set = spec.sets[0];
  const visibleIds = set ? set.cards : spec.catalog.map((c) => c.id);
  const visibleSet = new Set(visibleIds);

  // Visible cards first, in set order; then the remaining catalog cards hidden,
  // in catalog order, so every catalog card has a stable slot in the layout.
  const orderedIds = [
    ...visibleIds.filter((id) => spec.catalog.some((c) => c.id === id)),
    ...spec.catalog.map((c) => c.id).filter((id) => !visibleSet.has(id)),
  ];

  return orderedIds.map((id, index) => ({
    id,
    visible: visibleSet.has(id),
    order: index,
  }));
}

/** Re-index a layout so `order` is contiguous 0..n-1 matching array position. */
function reindex(layout: CardLayout): CardLayout {
  return layout.map((item, index) => ({ ...item, order: index }));
}

/** Sort a copy of the layout by `order`. */
function sortByOrder(layout: CardLayout): CardLayout {
  return [...layout].sort((a, b) => a.order - b.order);
}

// ── Hook ─────────────────────────────────────────────────────────────────────────

export interface UseCardLayoutResult {
  /** Live layout, sorted by order. */
  layout: CardLayout;
  /** Catalog entries for THIS artifact (all cards that can appear). */
  catalog: CardCatalogEntry[];
  /** The artifact's full spec (catalog + named sets). */
  spec: ArtifactCardSpec;
  /** Catalog entries NOT currently in the layout — offered by "+ Nowa karta". */
  availableToAdd: CardCatalogEntry[];
  /** Visible card ids in order (convenience for filtering sections). */
  visibleOrderedIds: string[];

  // ── Mutations ──
  /** Add a catalog card (appended visible at the end). No-op if already present. */
  addCard: (catalogId: string) => void;
  /** Remove a card entirely. No-op for `core` cards (they can only be hidden). */
  removeCard: (id: string) => void;
  /** Hide a card (keeps it in the layout, drops it from nav/canvas). */
  hideCard: (id: string) => void;
  /** Show a previously hidden card. */
  showCard: (id: string) => void;
  /** Move a card from one VISIBLE-order index to another. */
  reorderCards: (fromIdx: number, toIdx: number) => void;
  /** Reorder by explicit id order (e.g. from a dnd handler). */
  reorderByIds: (orderedIds: string[]) => void;
  /** Replace the layout with a named default set. */
  applyDefaultSet: (setId: string) => void;
  /** Reset to the canonical default set (`sets[0]`). */
  resetToDefault: () => void;

  /** Filter + order the artifact's sections by the live layout. */
  applyToSections: <T extends { id: string }>(sections: T[]) => T[];
}

export function useCardLayout(options: UseCardLayoutOptions): UseCardLayoutResult {
  const { artifactType, initialLayout, onLayoutChange } = options;

  const spec = useMemo<ArtifactCardSpec>(
    () => DEFAULT_CARD_SETS[artifactType] ?? { catalog: [], sets: [] },
    [artifactType]
  );

  const catalogById = useMemo(() => {
    const map = new Map<string, CardCatalogEntry>();
    for (const entry of spec.catalog) map.set(entry.id, entry);
    return map;
  }, [spec]);

  // Hydrate from a persisted layout when present + non-empty, else the default.
  const [layout, setLayout] = useState<CardLayout>(() =>
    initialLayout && initialLayout.length > 0
      ? reindex(sortByOrder(initialLayout))
      : buildDefaultLayout(spec)
  );

  // Commit a next layout: re-index, store, notify the artifact to persist.
  const commit = useCallback(
    (next: CardLayout) => {
      const normalized = reindex(next);
      setLayout(normalized);
      onLayoutChange?.(normalized);
    },
    [onLayoutChange]
  );

  const addCard = useCallback(
    (catalogId: string) => {
      if (!catalogById.has(catalogId)) return;
      setLayout((prev) => {
        if (prev.some((c) => c.id === catalogId)) {
          // Already present — if hidden, adding re-shows it.
          const shown = prev.map((c) =>
            c.id === catalogId ? { ...c, visible: true } : c
          );
          const normalized = reindex(sortByOrder(shown));
          onLayoutChange?.(normalized);
          return normalized;
        }
        const next = reindex([
          ...sortByOrder(prev),
          { id: catalogId, visible: true, order: prev.length },
        ]);
        onLayoutChange?.(next);
        return next;
      });
    },
    [catalogById, onLayoutChange]
  );

  const removeCard = useCallback(
    (id: string) => {
      if (catalogById.get(id)?.core) return; // core cards can only be hidden
      setLayout((prev) => {
        const next = reindex(sortByOrder(prev).filter((c) => c.id !== id));
        onLayoutChange?.(next);
        return next;
      });
    },
    [catalogById, onLayoutChange]
  );

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      setLayout((prev) => {
        const next = reindex(
          sortByOrder(prev).map((c) => (c.id === id ? { ...c, visible } : c))
        );
        onLayoutChange?.(next);
        return next;
      });
    },
    [onLayoutChange]
  );

  const hideCard = useCallback((id: string) => setVisible(id, false), [setVisible]);
  const showCard = useCallback((id: string) => setVisible(id, true), [setVisible]);

  const reorderCards = useCallback(
    (fromIdx: number, toIdx: number) => {
      setLayout((prev) => {
        const sorted = sortByOrder(prev);
        if (
          fromIdx < 0 ||
          toIdx < 0 ||
          fromIdx >= sorted.length ||
          toIdx >= sorted.length ||
          fromIdx === toIdx
        ) {
          return prev;
        }
        const clone = [...sorted];
        const [moved] = clone.splice(fromIdx, 1);
        clone.splice(toIdx, 0, moved);
        const next = reindex(clone);
        onLayoutChange?.(next);
        return next;
      });
    },
    [onLayoutChange]
  );

  const reorderByIds = useCallback(
    (orderedIds: string[]) => {
      setLayout((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const ordered = orderedIds
          .map((id) => byId.get(id))
          .filter((c): c is CardLayoutItem => Boolean(c));
        const missing = sortByOrder(prev).filter((c) => !orderedIds.includes(c.id));
        const next = reindex([...ordered, ...missing]);
        onLayoutChange?.(next);
        return next;
      });
    },
    [onLayoutChange]
  );

  const applyDefaultSet = useCallback(
    (setId: string) => {
      const set = spec.sets.find((s) => s.id === setId);
      if (!set) return;
      const visibleSet = new Set(set.cards);
      const orderedIds = [
        ...set.cards.filter((id) => catalogById.has(id)),
        ...spec.catalog.map((c) => c.id).filter((id) => !visibleSet.has(id)),
      ];
      const next = orderedIds.map((id, index) => ({
        id,
        visible: visibleSet.has(id),
        order: index,
      }));
      commit(next);
    },
    [spec, catalogById, commit]
  );

  const resetToDefault = useCallback(() => {
    commit(buildDefaultLayout(spec));
  }, [spec, commit]);

  // ── Derived ──
  const sortedLayout = useMemo(() => sortByOrder(layout), [layout]);

  const visibleOrderedIds = useMemo(
    () => sortedLayout.filter((c) => c.visible).map((c) => c.id),
    [sortedLayout]
  );

  const availableToAdd = useMemo(
    () => spec.catalog.filter((c) => !layout.some((l) => l.id === c.id)),
    [spec, layout]
  );

  const applyToSections = useCallback(
    <T extends { id: string }>(sections: T[]): T[] => {
      const byId = new Map(sections.map((s) => [s.id, s]));
      const ordered = visibleOrderedIds
        .map((id) => byId.get(id))
        .filter((s): s is T => Boolean(s));
      // Sections the layout knows nothing about (e.g. dynamically injected)
      // stay reachable at the end so we never truncate the artifact.
      const knownIds = new Set(layout.map((c) => c.id));
      const extras = sections.filter((s) => !knownIds.has(s.id));
      return [...ordered, ...extras];
    },
    [visibleOrderedIds, layout]
  );

  return {
    layout: sortedLayout,
    catalog: spec.catalog,
    spec,
    availableToAdd,
    visibleOrderedIds,
    addCard,
    removeCard,
    hideCard,
    showCard,
    reorderCards,
    reorderByIds,
    applyDefaultSet,
    resetToDefault,
    applyToSections,
  };
}

export default useCardLayout;
