/**
 * usePresentationMode
 *
 * Shared hook for detail view presentation mode persistence.
 * Implements the contract from docs/ui-standards/detail-view-presentation-modes.md
 *
 * Modes: 'd' (D mode) | 'n' (N mode) | 'c' (C mode)
 *
 * Priority:
 *   1) URL override (?view=d|n|c) [also accepts legacy values]
 *   2) Persisted user preference (localStorage per entityType)
 *   3) Fallback: 'd'
 *
 * Backward compatibility:
 *   Reads: 'accordion'|'notion'|'clickup' → normalizes to d|n|c
 *   Writes: always d|n|c only
 *
 * Persistence key: `consultinity:presentationMode:<entityType>`
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Canonical enum ───────────────────────────────────────────────────────────
export type PresentationMode = 'd' | 'n' | 'c';
export type EntityType = 'task' | 'decision' | 'notification' | 'initiative';

const VALID_MODES: PresentationMode[] = ['d', 'n', 'c'];
const FALLBACK_MODE: PresentationMode = 'd';

// ── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(entityType: EntityType): string {
  return `consultinity:presentationMode:${entityType}`;
}

/** Normalize any legacy or current value to d|n|c */
function normalizeMode(raw: string | null): PresentationMode | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();

  // Direct match
  if (value === 'd' || value === 'n' || value === 'c') return value;

  // Legacy aliases
  if (value === 'accordion') return 'd';
  if (value === 'notion') return 'n';
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

/** Always writes canonical d|n|c */
function writeToStorage(entityType: EntityType, mode: PresentationMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(entityType), mode);
  } catch {
    // silent
  }
}

/** Always writes canonical d|n|c */
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
  isD: boolean;
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
    isD: mode === 'd',
    isN: mode === 'n',
    isC: mode === 'c',
  };
}
