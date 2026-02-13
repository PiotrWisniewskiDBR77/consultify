/**
 * usePresentationMode
 *
 * Shared hook for detail view presentation mode persistence.
 * Implements the contract from docs/ui-standards/detail-view-presentation-modes.md
 *
 * Modes: 'n' (N mode) | 'c' (C mode)
 * Note: D mode (accordion) has been removed. Legacy 'd' values redirect to 'n'.
 *
 * Priority:
 *   1) URL override (?view=n|c) [also accepts legacy values]
 *   2) Persisted user preference (localStorage per entityType)
 *   3) Fallback: 'n'
 *
 * Backward compatibility:
 *   Reads: 'd'|'accordion'|'notion'|'clickup' → normalizes to n|c
 *   Writes: always n|c only
 *
 * Persistence key: `consultinity:presentationMode:<entityType>`
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Canonical enum ───────────────────────────────────────────────────────────
export type PresentationMode = 'n' | 'c';
export type EntityType = 'task' | 'decision' | 'notification' | 'initiative';

const VALID_MODES: PresentationMode[] = ['n', 'c'];
const FALLBACK_MODE: PresentationMode = 'n';

// ── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(entityType: EntityType): string {
  return `consultinity:presentationMode:${entityType}`;
}

/** Normalize any legacy or current value to n|c */
function normalizeMode(raw: string | null): PresentationMode | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();

  // Direct match
  if (value === 'n' || value === 'c') return value;

  // Legacy aliases → redirect to 'n' (D mode removed)
  if (value === 'd' || value === 'accordion' || value === 'notion') return 'n';
  if (value === 'clickup') return 'c';

  return null;
}

function readFromURL(): PresentationMode | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return normalizeMode(params.get('view'));
}

function readFromStorage(entityType: EntityType): PresentationMode | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeMode(localStorage.getItem(storageKey(entityType)));
  } catch {
    // localStorage blocked or unavailable
  }
  return null;
}

/** Always writes canonical n|c */
function writeToStorage(entityType: EntityType, mode: PresentationMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(entityType), mode);
  } catch {
    // silent
  }
}

/** Always writes canonical n|c */
function updateURLParam(mode: PresentationMode): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('view', mode);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // silent
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UsePresentationModeOptions {
  entityType: EntityType;
  /** If true, also updates the URL query param on change. Default false. */
  syncURL?: boolean;
}

interface UsePresentationModeReturn {
  mode: PresentationMode;
  setMode: (next: PresentationMode) => void;
  isN: boolean;
  isC: boolean;
}

export function usePresentationMode({
  entityType,
  syncURL = false,
}: UsePresentationModeOptions): UsePresentationModeReturn {
  // Resolve initial mode following priority chain
  const initial = useMemo<PresentationMode>(() => {
    return readFromURL() ?? readFromStorage(entityType) ?? FALLBACK_MODE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const [mode, setModeState] = useState<PresentationMode>(initial);

  // Re-resolve if entityType changes (e.g. user navigates from task → decision)
  useEffect(() => {
    const resolved = readFromURL() ?? readFromStorage(entityType) ?? FALLBACK_MODE;
    setModeState(resolved);
  }, [entityType]);

  const setMode = useCallback(
    (next: PresentationMode) => {
      if (!VALID_MODES.includes(next)) return;
      setModeState(next);
      writeToStorage(entityType, next);
      if (syncURL) {
        updateURLParam(next);
      }
    },
    [entityType, syncURL]
  );

  return {
    mode,
    setMode,
    isN: mode === 'n',
    isC: mode === 'c',
  };
}
