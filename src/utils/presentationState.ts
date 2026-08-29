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
