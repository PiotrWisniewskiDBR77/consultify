export type PresentationState<T> =
  | { state: 'known'; value: T }
  | { state: 'partial'; value: T; hidden: number; reason: string }
  | { state: 'unknown'; reason: string };

export const knownPresentation = <T>(value: T): PresentationState<T> => ({
  state: 'known',
  value,
});

export const partialPresentation = <T>(
  value: T,
  hidden: number,
  reason: string
): PresentationState<T> => ({ state: 'partial', value, hidden, reason });

export const unknownPresentation = <T>(reason: string): PresentationState<T> => ({
  state: 'unknown',
  reason,
});

export function formatPresentationCount(
  presentation: PresentationState<number>,
  copy: { hidden: string; unknown: string }
): string {
  if (presentation.state === 'known') return String(presentation.value);
  if (presentation.state === 'partial') {
    return `${presentation.value} · ${presentation.hidden} ${copy.hidden}: ${presentation.reason}`;
  }
  return `— · ${copy.unknown}: ${presentation.reason}`;
}

/**
 * Short badge text WITHOUT the embedded reason sentence — for space-constrained
 * inline UI (e.g. a Menu 3 filter chip, `MENU_3_BADGE_BASE` max-w-[200px]
 * truncate). `formatPresentationCount` above packs the full reason into the
 * same string it returns for both the visible label AND the tooltip, which
 * mid-word-truncates a full sentence in a narrow chip and reads as a leaked
 * debug note (grafika 2026-08-31, `assessment-artifacts-restart` C-grade).
 * Pair with `presentationReason()` below for the full, un-truncated sentence
 * in a `title` tooltip instead of squeezing it into the visible text.
 */
export function formatPresentationBadge(
  presentation: PresentationState<number>,
  copy: { hidden: string; unknown: string }
): string {
  if (presentation.state === 'known') return String(presentation.value);
  if (presentation.state === 'partial') {
    return `${presentation.value} · ${presentation.hidden} ${copy.hidden}`;
  }
  return `— · ${copy.unknown}`;
}

/** Full, honest reason sentence for a partial/unknown presentation — always
 * un-truncated when used (put it in a `title` tooltip, never in a narrow
 * inline label). `undefined` for a fully-known presentation (nothing to explain). */
export function presentationReason<T>(presentation: PresentationState<T>): string | undefined {
  return presentation.state === 'known' ? undefined : presentation.reason;
}
