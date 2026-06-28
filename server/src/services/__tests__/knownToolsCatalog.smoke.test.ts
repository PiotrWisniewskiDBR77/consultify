/**
 * Module 04 (Narzędzia) — known-tools catalog SHIP/HIDE decision tests.
 *
 * The curated Wave 1 set must launch (active, not coming-soon); everything else
 * must be flagged coming-soon and non-active so it can never open the broken
 * canvas or surface a "not implemented" step.
 */
import { describe, expect, it } from 'vitest';

import { ACTIVE_KNOWN_TOOL_TYPES, SQLITE_KNOWN_TOOLS_SEED } from '../KnownToolsService.js';

const SHIP = [
  'dynamic-swot',
  'market-forces',
  'value-chain',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  'process-automation',
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'ai-discovery',
  'pain-explorer',
  'rpa-scanner',
];

describe('known-tools catalog SHIP/HIDE decision', () => {
  it('activates exactly the 19 curated SHIP tools', () => {
    expect(ACTIVE_KNOWN_TOOL_TYPES.size).toBe(19);
    for (const t of SHIP) {
      expect(ACTIVE_KNOWN_TOOL_TYPES.has(t)).toBe(true);
    }
  });

  it('marks every non-SHIP seed tool as coming-soon', () => {
    const hidden = SQLITE_KNOWN_TOOLS_SEED.filter((s) => !ACTIVE_KNOWN_TOOL_TYPES.has(s.toolType));
    expect(hidden.length).toBeGreaterThanOrEqual(12);
    for (const tool of hidden) {
      expect(tool.isComingSoon).toBe(true);
    }
  });

  it('never marks a SHIP tool as coming-soon', () => {
    const shippedSeeds = SQLITE_KNOWN_TOOLS_SEED.filter((s) =>
      ACTIVE_KNOWN_TOOL_TYPES.has(s.toolType)
    );
    for (const tool of shippedSeeds) {
      expect(Boolean(tool.isComingSoon)).toBe(false);
    }
  });
});
