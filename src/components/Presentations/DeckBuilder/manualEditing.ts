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

export function blockContentStyle(content: Record<string, unknown>): CSSProperties {
  const raw = (content.style && typeof content.style === 'object' ? content.style : {}) as Record<
    string,
    unknown
  >;
  const size = String(raw.fontSize || '').trim();
  const align = ['left', 'center', 'right'].includes(String(raw.textAlign))
    ? (String(raw.textAlign) as CSSProperties['textAlign'])
    : undefined;
  return {
    ...(size ? { fontSize: /^\d+(\.\d+)?$/.test(size) ? `${size}px` : size } : {}),
    ...(typeof raw.color === 'string' && raw.color.trim() ? { color: raw.color.trim() } : {}),
    ...(align ? { textAlign: align } : {}),
  };
}

export function mergeStarterBlockContent(
  defaults: Record<string, unknown>,
  selection?: Record<string, unknown>
): Record<string, unknown> {
  return { ...defaults, ...(selection || {}) };
}
import type { CSSProperties } from 'react';
