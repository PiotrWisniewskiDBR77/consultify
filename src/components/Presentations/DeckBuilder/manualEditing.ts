/**
 * Resolve the optional blank-slide insertion argument.
 *
 * `SlideSorter` invokes its callback as a React click handler (first argument
 * is a SyntheticEvent), while `CardCanvas` passes a numeric gap index. Only a
 * finite number is an explicit insertion request; all other values append.
 */
export function resolveBlankCardInsertionIndex(atIndex: unknown, cardCount: number): number {
  const safeCount = Math.max(0, Math.trunc(cardCount));
  return typeof atIndex === 'number' && Number.isFinite(atIndex)
    ? Math.min(Math.max(Math.trunc(atIndex), 0), safeCount)
    : safeCount;
}
