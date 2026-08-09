import { describe, expect, it } from 'vitest';

import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '../../../src/config/consultingToolsStandard';

/**
 * RB-025 — the "Output Contract" card in ToolDocumentView renders one card
 * per entry in `CONSULTING_TOOL_STANDARD_OUTPUTS`. Before this fix it
 * declared four output types (initiative, report, presentation, idea) while
 * ToolDocumentView only ever delivered a typed generating/created/reopen/
 * lineage surface for `initiative` (the generated-initiatives list +
 * `onOpenInitiative`); `report`/`presentation`/`idea` had zero implementation
 * anywhere (outputsScaffolding.ts's report/deck outlines have no callers).
 * This locks the contract to only what is actually delivered end-to-end.
 */
describe('CONSULTING_TOOL_STANDARD_OUTPUTS — RB-025 narrowed output contract', () => {
  it('declares only output types with a real typed delivery surface', () => {
    expect(CONSULTING_TOOL_STANDARD_OUTPUTS).toEqual(['initiative']);
  });

  it('does not re-advertise report/presentation/idea (no generating/created/reopen/lineage surface exists)', () => {
    expect(CONSULTING_TOOL_STANDARD_OUTPUTS).not.toContain('report');
    expect(CONSULTING_TOOL_STANDARD_OUTPUTS).not.toContain('presentation');
    expect(CONSULTING_TOOL_STANDARD_OUTPUTS).not.toContain('idea');
  });
});
