/**
 * DEC-118 repair #4 (2026-08-26) — proves `SHIPPED_TOOL_TYPES`
 * (dedicatedToolTypes.ts) matches the REAL set of bespoke
 * `if (toolType === 'X')` step branches in ToolCanvas.tsx, by re-deriving
 * that set from the source file itself rather than trusting a hand-copied
 * list to stay in sync. This is the empirical check the brief asked for
 * ("zweryfikuj listę 16 gałęzi grep-em w ToolCanvas.tsx, nie przepisuj z
 * panelu") turned into a regression test: if a future edit adds or removes a
 * bespoke branch in ToolCanvas.tsx without updating SHIPPED_TOOL_TYPES, this
 * test fails instead of the two silently drifting apart.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEDICATED_TOOL_TYPES,
  isShippedToolType,
  SHIPPED_TOOL_TYPES,
} from '@/components/DiscoveryTools/dedicatedToolTypes';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function deriveBespokeToolTypesFromToolCanvas(): string[] {
  const source = readFileSync(
    path.join(root, 'src/components/DiscoveryTools/ToolCanvas.tsx'),
    'utf8'
  );
  const matches = [...source.matchAll(/if \(toolType === '([a-z0-9-]+)'\)/g)];
  // Preserve first-seen order, drop duplicates (a toolType could in
  // principle gate more than one block).
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ordered.push(m[1]);
    }
  }
  return ordered;
}

describe('SHIPPED_TOOL_TYPES matches ToolCanvas.tsx bespoke branches exactly', () => {
  it('re-derives the same set of toolTypes from a fresh grep of ToolCanvas.tsx', () => {
    const derived = deriveBespokeToolTypesFromToolCanvas();
    expect(new Set(derived)).toEqual(new Set(SHIPPED_TOOL_TYPES));
  });

  it('is exactly 16 tool types (the number DEC-118 verified, not assumed)', () => {
    expect(SHIPPED_TOOL_TYPES.length).toBe(16);
  });

  it('is a strict subset of DEDICATED_TOOL_TYPES (31 declared)', () => {
    for (const t of SHIPPED_TOOL_TYPES) {
      expect(DEDICATED_TOOL_TYPES).toContain(t);
    }
    expect(SHIPPED_TOOL_TYPES.length).toBeLessThan(DEDICATED_TOOL_TYPES.length);
  });

  it('isShippedToolType agrees with SHIPPED_TOOL_TYPES membership', () => {
    for (const t of DEDICATED_TOOL_TYPES) {
      expect(isShippedToolType(t)).toBe((SHIPPED_TOOL_TYPES as readonly string[]).includes(t));
    }
  });

  it('an unknown tool type is never "shipped"', () => {
    expect(isShippedToolType('not-a-real-tool')).toBe(false);
  });
});
