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
  const fontWeight = ['normal', '500', '600', '700', 'bold'].includes(String(raw.fontWeight))
    ? (String(raw.fontWeight) as CSSProperties['fontWeight'])
    : undefined;
  const lineHeight = String(raw.lineHeight || '').trim();
  const letterSpacing = String(raw.letterSpacing || '').trim();
  return {
    ...(size ? { fontSize: /^\d+(\.\d+)?$/.test(size) ? `${size}px` : size } : {}),
    ...(typeof raw.color === 'string' && raw.color.trim() ? { color: raw.color.trim() } : {}),
    ...(align ? { textAlign: align } : {}),
    ...(typeof raw.fontFamily === 'string' && raw.fontFamily.trim()
      ? { fontFamily: raw.fontFamily.trim() }
      : {}),
    ...(fontWeight ? { fontWeight } : {}),
    ...(raw.fontStyle === 'italic' ? { fontStyle: 'italic' } : {}),
    ...(raw.textDecoration === 'underline' ? { textDecoration: 'underline' } : {}),
    ...(lineHeight
      ? { lineHeight: /^\d+(\.\d+)?$/.test(lineHeight) ? Number(lineHeight) : lineHeight }
      : {}),
    ...(letterSpacing
      ? {
          letterSpacing: /^-?\d+(\.\d+)?$/.test(letterSpacing)
            ? `${letterSpacing}px`
            : letterSpacing,
        }
      : {}),
  };
}

export function blockFrameStyle(styleOverrides?: Record<string, unknown>): CSSProperties {
  const raw = styleOverrides || {};
  const width = Math.min(100, Math.max(10, Number(raw.widthPercent) || 100));
  const minHeight = Math.max(0, Number(raw.minHeight) || 0);
  const placement = ['flex-start', 'center', 'flex-end', 'stretch'].includes(String(raw.alignSelf))
    ? (String(raw.alignSelf) as CSSProperties['alignSelf'])
    : 'stretch';
  return {
    width: placement === 'stretch' ? '100%' : `${width}%`,
    minHeight: minHeight ? `${minHeight}px` : undefined,
    alignSelf: placement,
  };
}

export function blockGeometryStyle(geometry?: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}): CSSProperties {
  if (!geometry) return {};
  return {
    position: 'absolute',
    left: `${geometry.x}%`,
    top: `${geometry.y}%`,
    width: `${geometry.width}%`,
    height: `${geometry.height}%`,
    transform: `rotate(${geometry.rotation}deg)`,
    transformOrigin: 'center',
    zIndex: 20,
  };
}

export function mergeStarterBlockContent(
  defaults: Record<string, unknown>,
  selection?: Record<string, unknown>
): Record<string, unknown> {
  return { ...defaults, ...(selection || {}) };
}

type HeadingLikeBlock = {
  block_id?: string;
  type?: string;
  content?: Record<string, unknown>;
};

/**
 * Keep the slide model title aligned with the heading the user actually edits.
 * Quality gates, slide navigation and exporters read `card.title`, while the
 * canvas renders the first heading block. Leaving those values independent
 * makes a corrected heading look right in the editor but remain stale after
 * export or quality validation.
 */
export function titleFromPrimaryHeadingUpdate(
  blocks: HeadingLikeBlock[],
  blockId: string,
  updatedBlock: HeadingLikeBlock
): string | undefined {
  const primaryHeading = blocks.find((block) => block.type === 'heading');
  if (
    updatedBlock.type !== 'heading' ||
    !primaryHeading ||
    primaryHeading.block_id !== blockId
  ) {
    return undefined;
  }

  const text = String(updatedBlock.content?.text || '').trim();
  return text || undefined;
}

export function shouldSyncKeyMessageWithTitle(
  currentTitle: unknown,
  currentKeyMessage: unknown
): boolean {
  const title = String(currentTitle || '').trim();
  const keyMessage = String(currentKeyMessage || '').trim();
  return Boolean(title && keyMessage && title === keyMessage);
}
import type { CSSProperties } from 'react';
