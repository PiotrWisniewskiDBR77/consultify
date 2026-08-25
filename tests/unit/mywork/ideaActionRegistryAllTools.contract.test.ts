import { describe, expect, it } from 'vitest';

import {
  getActionsForSurface,
  IDEA_ACTION_REGISTRY,
  isActionAvailableInTool,
} from '@/actions/ideaActionRegistry';
import type { Surface, Tool } from '@/actions/registry/types';

const tools: Tool[] = ['mindmap', 'whiteboard', 'process_flow', 'table'];
const surfaces: Surface[] = [
  'menu1',
  'menu2',
  'menu3',
  'context_menu',
  'left_rail',
  'right_panel',
  'keyboard',
  'teresa',
];

describe('enumerated Idea Workspace control registry', () => {
  it.each(tools)('%s exposes only registered controls on every surface', (tool) => {
    for (const surface of surfaces) {
      const controls = getActionsForSurface(surface, { tool });
      expect(new Set(controls.map(({ def }) => def.id)).size).toBe(controls.length);
      for (const control of controls) {
        expect(IDEA_ACTION_REGISTRY).toContain(control.def);
        if (!isActionAvailableInTool(control.def, tool)) {
          expect(control.disabledReason?.trim()).toBeTruthy();
        }
      }
    }
  });

  it('gives every explicitly disabled registered control a reason in each tool', () => {
    for (const tool of tools) {
      for (const definition of IDEA_ACTION_REGISTRY.filter((item) => item.showsDisabled)) {
        if (isActionAvailableInTool(definition, tool)) continue;
        for (const surface of definition.surfaces) {
          const control = getActionsForSurface(surface, { tool }).find(
            ({ def }) => def.id === definition.id
          );
          expect(control, `${tool}/${surface}/${definition.id}`).toBeDefined();
          expect(
            control?.disabledReason?.trim(),
            `${tool}/${surface}/${definition.id}`
          ).toBeTruthy();
        }
      }
    }
  });
});
