/**
 * Atomic: Divider
 * A thin horizontal line to separate sections within a slide.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface DividerProps {
  position: ElementPosition;
  color?: string;
  thickness?: number;
}

export function Divider(props: DividerProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'shape',
    apply(slide) {
      slide.addShape('line', {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: 0,
        line: {
          color: props.color ?? tokens.colors.border,
          width: props.thickness ?? 1,
        },
      });
    },
  };
}
