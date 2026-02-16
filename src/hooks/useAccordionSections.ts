/**
 * useAccordionSections
 *
 * Manages accordion expand/collapse state with smart-open, persistence, and
 * expand-all / collapse-all. Implements section 1.1.1 of
 * docs/ui-standards/detail-view-presentation-modes.md
 *
 * Priority of expanded state:
 *   1) Persisted state (if exists for this entityType:entityId)
 *   2) Smart-open rules (based on entity data / status)
 *   3) Default open set (per entity type)
 *
 * Persistence key: `consultinity:accordionSections:<entityType>:<entityId>`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EntityType } from './usePresentationMode';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SmartOpenConditions {
  /** Decision/task status */
  status?: string;
  /** Escalation level (0 = none) */
  escalationLevel?: number;
  /** Whether entity has blocking relationships */
  hasBlockingRelations?: boolean;
  /** Whether impact or priority is high/critical */
  isHighImpact?: boolean;
}

interface UseAccordionSectionsOptions {
  entityType: EntityType;
  entityId: string | null;
  /** Section IDs that are always open by default */
  defaultOpenSections: string[];
  /** Map of sectionId -> condition function that determines smart-open */
  smartOpenRules?: Record<string, (conditions: SmartOpenConditions) => boolean>;
  /** Current conditions for smart-open evaluation */
  smartOpenConditions?: SmartOpenConditions;
  /** All available section IDs (used for expand/collapse all) */
  allSectionIds: string[];
}

interface UseAccordionSectionsReturn {
  expandedSections: Set<string>;
  toggleSection: (sectionId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isExpanded: (sectionId: string) => boolean;
  /** Whether user has manually overridden defaults */
  hasPersistedState: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function persistenceKey(entityType: EntityType, entityId: string): string {
  return `consultinity:accordionSections:${entityType}:${entityId}`;
}

function readPersistedSections(entityType: EntityType, entityId: string | null): string[] | null {
  if (!entityId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(persistenceKey(entityType, entityId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    // corrupt or blocked
  }
  return null;
}

function writePersistedSections(
  entityType: EntityType,
  entityId: string | null,
  sections: string[]
): void {
  if (!entityId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(persistenceKey(entityType, entityId), JSON.stringify(sections));
  } catch {
    // silent
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAccordionSections({
  entityType,
  entityId,
  defaultOpenSections,
  smartOpenRules,
  smartOpenConditions,
  allSectionIds,
}: UseAccordionSectionsOptions): UseAccordionSectionsReturn {
  const [hasPersistedState, setHasPersistedState] = useState(false);
  const isInitialized = useRef(false);

  // Compute smart-open sections
  const smartOpenSections = useMemo(() => {
    if (!smartOpenRules || !smartOpenConditions) return [];
    const result: string[] = [];
    for (const [sectionId, conditionFn] of Object.entries(smartOpenRules)) {
      if (conditionFn(smartOpenConditions)) {
        result.push(sectionId);
      }
    }
    return result;
  }, [smartOpenRules, smartOpenConditions]);

  // Resolve initial state
  const initialSections = useMemo<Set<string>>(() => {
    // 1) Check persisted state
    const persisted = readPersistedSections(entityType, entityId);
    if (persisted) {
      return new Set(persisted);
    }

    // 2) Merge default + smart-open
    const merged = new Set([...defaultOpenSections, ...smartOpenSections]);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(initialSections);

  // Re-initialize when entity changes
  useEffect(() => {
    const persisted = readPersistedSections(entityType, entityId);
    if (persisted) {
      setExpandedSections(new Set(persisted));
      setHasPersistedState(true);
    } else {
      const merged = new Set([...defaultOpenSections, ...smartOpenSections]);
      setExpandedSections(merged);
      setHasPersistedState(false);
    }
    isInitialized.current = true;
  }, [entityType, entityId, defaultOpenSections, smartOpenSections]);

  // Persist on change (skip initial)
  useEffect(() => {
    if (!isInitialized.current) return;
    writePersistedSections(entityType, entityId, Array.from(expandedSections));
    setHasPersistedState(true);
  }, [expandedSections, entityType, entityId]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(allSectionIds));
  }, [allSectionIds]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const isExpanded = useCallback(
    (sectionId: string) => expandedSections.has(sectionId),
    [expandedSections]
  );

  return {
    expandedSections,
    toggleSection,
    expandAll,
    collapseAll,
    isExpanded,
    hasPersistedState,
  };
}
