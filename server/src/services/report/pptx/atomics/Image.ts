/**
 * Atomic: Image
 * Renders an image (local path or data URI) into a slide.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface ImageProps {
  position: ElementPosition;
  /**
   * Local file path (recommended for server-side generation).
   * Either `path` or `data` must be provided.
   */
  path?: string;
  /**
   * Data URI ("data:image/png;base64,...") OR raw base64 without header.
   */
  data?: string;
  /**
   * `cover` uses `crop` (fills the box, may cut edges).
   * `contain` uses `contain` (fits inside, may add letterboxing).
   */
  fit?: 'cover' | 'contain';
  /** 0..100, where 100 is fully transparent (pptxgenjs semantics). */
  transparency?: number;
}

function normalizeImageData(data: string): string {
  const trimmed = String(data || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  // Default to PNG for bare base64.
  return `data:image/png;base64,${trimmed}`;
}

export function Image(props: ImageProps, _tokens: DesignTokens): RenderedElement {
  return {
    kind: 'image',
    apply(slide: any) {
      const sizing = props.fit === 'contain' ? 'contain' : 'crop';
      const data = props.data ? normalizeImageData(props.data) : undefined;
      const path = props.path;

      if (!data && !path) return;

      slide.addImage({
        ...(data ? { data } : { path }),
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        sizing,
        ...(typeof props.transparency === 'number' ? { transparency: props.transparency } : {}),
      });
    },
  };
}

