import { describe, expect, it } from 'vitest';

import { A3_SECTIONS } from '../../src/config/a3problemsolving';
import { SOP_SECTIONS } from '../../src/config/sopbuilder';
import { DMS_LAYERS } from '../../src/config/dmsbuilder';
import { SMED_PHASES } from '../../src/config/smedplanner';
import { INVENTORY_LEVERS } from '../../src/config/inventoryautopilot';
import { AI_PHASES } from '../../src/config/aidiscovery';
import { PAIN_STAGES } from '../../src/config/painexplorer';
import { RPA_GATES } from '../../src/config/rpascanner';
import { AUTOMATION_PHASES } from '../../src/config/processautomation';
import { getToolSuggestionPrompt } from '../../src/hooks/discovery/toolAi/promptRegistry';
import type { ToolType } from '../../src/store/useToolStore';

/**
 * Regression test for the deepen-ladder wiring bug: `a3-problem-solving` and
 * `sop-builder` (and, after this fix, the 7 tools below) are all members of
 * OPERATIONAL_TOOL_TYPES in promptRegistry.ts. That generic branch used to be
 * checked BEFORE the tool-specific staircase overrides, so the overrides were
 * unreachable dead code — calling getToolSuggestionPrompt with a real section
 * id always returned the generic "3-6 concrete items" prompt, never the
 * staircase-framed one built from build<Tool>DeepenPrompt. This test asserts
 * every wired tool actually returns the staircase-framed prompt (i.e. it
 * echoes the ladder's own copy) for its first real section, not the generic
 * fallback.
 */
describe('promptRegistry deepen-ladder wiring', () => {
  const cases: Array<{ toolType: ToolType; sectionId: string; label: string }> = [
    { toolType: 'a3-problem-solving', sectionId: A3_SECTIONS[0], label: 'A3 Problem Solving' },
    { toolType: 'sop-builder', sectionId: SOP_SECTIONS[0], label: 'SOP Builder' },
    { toolType: 'dms-builder', sectionId: DMS_LAYERS[0], label: 'DMS Builder' },
    { toolType: 'smed-planner', sectionId: SMED_PHASES[0], label: 'SMED Planner' },
    { toolType: 'inventory-autopilot', sectionId: INVENTORY_LEVERS[0], label: 'Inventory Autopilot' },
    { toolType: 'ai-discovery', sectionId: AI_PHASES[0], label: 'AI Discovery' },
    { toolType: 'pain-explorer', sectionId: PAIN_STAGES[0], label: 'Pain Explorer' },
    { toolType: 'rpa-scanner', sectionId: RPA_GATES[0], label: 'RPA Scanner' },
    { toolType: 'process-automation', sectionId: AUTOMATION_PHASES[0], label: 'Process Automation' },
  ];

  it.each(cases)(
    '$label: getToolSuggestionPrompt returns the staircase-framed prompt (not the generic fallback) for its first section',
    ({ toolType, sectionId }) => {
      const inputData = { context: { goal: 'Reduce cycle time', scope: 'Plant A' } };
      const prompt = getToolSuggestionPrompt(toolType, sectionId, inputData);

      expect(prompt).toBeTruthy();
      // Staircase-framed prompts always carry this literal marker; the generic
      // OPERATIONAL_TOOL_TYPES fallback prompt never does.
      expect(prompt).toContain('disciplined by the insight staircase');
      expect(prompt).toContain('Staircase framing for this section:');
      // Would only appear in the generic fallback prompt — must NOT be present.
      expect(prompt).not.toContain('Act as a senior operations consultant. Generate 3-6 concrete');
    }
  );

  it('falls through to the generic prompt for a section with no staircase override (e.g. context/summary)', () => {
    const prompt = getToolSuggestionPrompt('a3-problem-solving', 'context', {});
    expect(prompt).toBe('');
  });
});
