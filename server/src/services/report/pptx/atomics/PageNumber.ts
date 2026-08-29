/**
 * Atomic: Page Number
 * Slide number indicator in the footer area.
 */
import type { DesignTokens, RenderedElement } from '../types.js';

export interface PageNumberProps {
  color?: string;
}

export function PageNumber(_props: PageNumberProps, _tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    // Page numbering is owned centrally by PptxPipelineService.addHeaderFooter,
    // which has the page/total context. Keep this atomic as a compatibility
    // no-op so existing layouts do not add a second native slide number.
    apply() {},
  };
}
