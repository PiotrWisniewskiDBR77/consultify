/**
 * Atomic: Whitespace
 * Intentional empty space — used for breathing room in layouts.
 * No-op element that occupies logical space but renders nothing.
 */
import type { ElementPosition, RenderedElement } from '../types.js';

export interface WhitespaceProps {
  position: ElementPosition;
}

export function Whitespace(_props: WhitespaceProps): RenderedElement {
  return {
    kind: 'text',
    apply() {
      // Intentional no-op — whitespace is structural, not visual
    },
  };
}
