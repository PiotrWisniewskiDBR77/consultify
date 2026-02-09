/**
 * Atomic: Header Bar
 * Colored bar at the top of content slides — standard consulting pattern.
 */
import type { DesignTokens, RenderedElement } from '../types.js';

export interface HeaderBarProps {
  color?: string;
}

export function HeaderBar(props: HeaderBarProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'shape',
    apply(slide) {
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: '100%',
        h: tokens.grid.headerH,
        fill: { color: props.color ?? tokens.colors.primary },
      });
    },
  };
}
