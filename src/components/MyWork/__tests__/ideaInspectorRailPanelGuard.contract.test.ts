import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// FIX-8 (Day 3 acceptance): with the shared IdeaElementInspector rail
// (ff_ideaInspectorRightRail) ON, the legacy per-tool detail panels must NOT
// also render — that was the reported "two panels at once" defect. This is a
// source contract (not a full render test — IdeaTableTool/IdeaProcessFlowTool
// pull in the entire table/process-flow subsystem, far too costly to mount
// per CLAUDE.md's ban on heavy per-robot test runs) proving the guard exists
// in both places the review named, and that ExecutiveModuleShell's own rail
// visibility contract (present when ON, absent when OFF) is covered
// separately by ExecutiveModuleShell.elementRail.test.tsx.
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

describe('idea inspector rail vs legacy detail panels — mutually exclusive', () => {
  it('IdeaTableTool: RowDetailPanel does not open while the rail flag is on', () => {
    const source = read('IdeaTableTool.tsx');
    expect(source).toContain(
      "import { isIdeaInspectorRightRailEnabled } from '@/utils/ideaInspectorRightRailFlag';"
    );
    expect(source).toContain('open={!!detailNodeId && !isIdeaInspectorRightRailEnabled()}');
  });

  it('IdeaProcessFlowTool: ProcessFlowPropertiesPanel does not render while the rail flag is on', () => {
    const source = read('IdeaProcessFlowTool.tsx');
    expect(source).toContain(
      "import { isIdeaInspectorRightRailEnabled } from '@/utils/ideaInspectorRightRailFlag';"
    );
    expect(source).toContain('{showPropertiesPanel && !isIdeaInspectorRightRailEnabled() && (');
  });

  it('IdeaMapWorkspace: ff_ideaDetailsInPanel is guarded off whenever the rail is on', () => {
    const source = read('IdeaMapWorkspace.tsx');
    // Pre-existing guard (not part of this fix, but the precondition FIX-8
    // relies on): the OTHER legacy details surface already self-disables
    // when the new rail is on, so there is exactly one flag combination
    // (rail ON) that can never show two detail surfaces at once.
    expect(source).toContain(
      'const detaleWPanelu = isIdeaDetailsInPanelEnabled() && !ideaInspectorRightRail;'
    );
  });
});
