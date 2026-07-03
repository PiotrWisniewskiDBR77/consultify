/**
 * SlideTitle — overflow-safe action-titles (beat-Gamma, Fala 5).
 * Long 2-line action-titles must shrink-to-fit inside the header band instead of
 * clipping at the slide top edge (the bug Fala-2 action-titles exposed).
 */
import { describe, expect, it } from 'vitest';

import { getDesignTokens } from '../../../server/src/services/report/pptx/designTokens.js';
import { SlideTitle } from '../../../server/src/services/report/pptx/atomics/SlideTitle.js';

function optsFor(text: string) {
  const tokens = getDesignTokens('corporate');
  let captured: any = null;
  const el = SlideTitle({ text }, tokens);
  el.apply({ addText: (_t: any, o: any) => (captured = o) } as any);
  return captured;
}

describe('SlideTitle — overflow-safe (Fala 5)', () => {
  it('shrinks to fit and never overflows (fit:shrink + wrap + valign)', () => {
    const o = optsFor('Trzy ruchy uruchamiają 3.2M PLN rocznych korzyści z 18-mies. paybackiem');
    expect(o.fit).toBe('shrink');
    expect(o.wrap).toBe(true);
    expect(o.valign).toBe('middle');
  });

  it('keeps the title box within the header band (h fits ~2 lines, y near top)', () => {
    const o = optsFor('Krótki tytuł');
    const tokens = getDesignTokens('corporate');
    expect(o.y).toBeLessThan(0.2);
    expect(o.h).toBeGreaterThanOrEqual(0.6);
    expect(o.y + o.h).toBeLessThanOrEqual(tokens.grid.headerH + 0.05);
  });
});
