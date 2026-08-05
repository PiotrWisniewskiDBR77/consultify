import { describe, expect, it } from 'vitest';

import {
  DEDICATED_TOOL_TYPES,
  hasDedicatedToolDocumentView,
} from '@/components/DiscoveryTools/dedicatedToolTypes';

describe('dedicated tool document routing', () => {
  it.each(['ambition-decomposer', 'focus-tradeoff', 'narrative-engine'])(
    'routes implemented strategic tool %s to ToolDocumentView',
    (toolType) => {
      expect(DEDICATED_TOOL_TYPES).toContain(toolType);
      expect(hasDedicatedToolDocumentView(toolType)).toBe(true);
    }
  );

  it('keeps unknown tool types on the explicit generic fallback', () => {
    expect(hasDedicatedToolDocumentView('not-a-real-tool')).toBe(false);
  });
});
