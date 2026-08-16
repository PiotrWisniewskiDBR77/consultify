/**
 * TLS-CATALOG-001 — sole committed governance test for the real MVP gate.
 *
 * Lead review (2026-08-16) reversed an earlier red-by-design companion to
 * this file: a permanently-failing test in a shared tree handed to an
 * integrator across three merging lanes makes every downstream run red and
 * indistinguishable from a genuine regression a later lane introduces. That
 * file (`mvpGateGovernance.redByDesign.test.ts`) has been DELETED. Its
 * content — the precise statement of the violation, the exact expected end
 * state, and what must change — now lives in
 * `docs/program/evidence/closure/a/TLS-CATALOG-001/CATALOG_INVENTORY.md`
 * §6 (the integrator change request), where it is unambiguous and cannot
 * rot into ambient noise.
 *
 * This file is the ratchet instead: it pins the REAL runtime gate
 * (`ACTIVE_KNOWN_TOOL_TYPES` in `server/src/services/KnownToolsService.ts`,
 * read-only import — this lane does not own that file) by EXACT set
 * membership, not just size. A size-only assertion would let a swap (one
 * tool type removed, a different one added, size unchanged) slip through
 * silently — this asserts the full named set, so ANY addition or removal
 * fails loudly and by name.
 *
 * If this test ever goes red, it means someone edited
 * `ACTIVE_KNOWN_TOOL_TYPES`. That is expected and required for the
 * TLS-CATALOG-001 fix (reduce it to `{'dynamic-swot'}`) — this file must be
 * updated in the SAME commit as that edit, deliberately, never silently.
 */
import { describe, expect, it } from 'vitest';

import { ACTIVE_KNOWN_TOOL_TYPES } from '../../KnownToolsService.js';
import { APPROVED_MVP_TOOL_TYPES } from '../approvedMvpToolTypes.js';

// The exact 19 tool types the real gate activates today (2026-08-16),
// verified by reading server/src/services/KnownToolsService.ts:206-229.
// Sorted for a stable, readable diff.
const CURRENT_ACTIVE_KNOWN_TOOL_TYPES = [
  'a3-problem-solving',
  'ai-discovery',
  'ambition-decomposer',
  'capability-mapper',
  'dms-builder',
  'dynamic-swot',
  'focus-tradeoff',
  'growth-paths',
  'inventory-autopilot',
  'market-forces',
  'narrative-engine',
  'pain-explorer',
  'portfolio-priority',
  'process-automation',
  'risk-uncertainty',
  'rpa-scanner',
  'smed-planner',
  'sop-builder',
  'value-chain',
].sort();

// The 18 of those NOT covered by the owner's MVP approval (all but dynamic-swot).
const CURRENTLY_ACTIVE_BUT_NOT_OWNER_APPROVED = CURRENT_ACTIVE_KNOWN_TOOL_TYPES.filter(
  (t) => t !== 'dynamic-swot'
);

function describeSetDelta(actual: string[], expected: string[]): string {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const added = actual.filter((t) => !expectedSet.has(t));
  const removed = expected.filter((t) => !actualSet.has(t));
  const parts: string[] = [];
  if (added.length) parts.push(`added to the gate (not previously pinned): ${added.join(', ')}`);
  if (removed.length) parts.push(`removed from the gate (previously pinned, now gone): ${removed.join(', ')}`);
  return parts.length
    ? parts.join('; ')
    : 'membership matches but ordering/representation differs (unexpected)';
}

describe('TLS-CATALOG-001 — real MVP gate, pinned by exact membership (ratchet)', () => {
  it('ACTIVE_KNOWN_TOOL_TYPES matches the exact pinned 19-entry set, not just its size', () => {
    const actual = [...ACTIVE_KNOWN_TOOL_TYPES].sort();
    const message =
      `ACTIVE_KNOWN_TOOL_TYPES (server/src/services/KnownToolsService.ts:206-229) changed: ` +
      `${describeSetDelta(actual, CURRENT_ACTIVE_KNOWN_TOOL_TYPES)}.\n` +
      `This test intentionally pins EXACT membership (not size) so a swap can't slip through ` +
      `silently. If this change was deliberate, update the pinned list in THIS file in the ` +
      `same commit. If it widens the gate beyond the owner-approved MVP set, it also needs ` +
      `owner sign-off, a packet, provenance and rights record per the frozen MVP decision — ` +
      `see docs/program/evidence/closure/a/TLS-CATALOG-001/CATALOG_INVENTORY.md §6 (the ` +
      `integrator change request, target end state: exactly {'dynamic-swot'}).`;
    expect(actual, message).toEqual(CURRENT_ACTIVE_KNOWN_TOOL_TYPES);
  });

  it('the real gate is 19 tool types wide, not 1', () => {
    expect(ACTIVE_KNOWN_TOOL_TYPES.size).toBe(19);
  });

  it('dynamic-swot — the owner-approved MVP tool — is active in the real gate', () => {
    expect(ACTIVE_KNOWN_TOOL_TYPES.has('dynamic-swot')).toBe(true);
  });

  it('exactly 18 tool types are active in the real gate without owner MVP approval', () => {
    const undeclared = [...ACTIVE_KNOWN_TOOL_TYPES]
      .filter((t) => !APPROVED_MVP_TOOL_TYPES.has(t))
      .sort();
    expect(undeclared).toEqual(CURRENTLY_ACTIVE_BUT_NOT_OWNER_APPROVED);
  });

  it('the owner-approved MVP set today contains exactly dynamic-swot', () => {
    expect([...APPROVED_MVP_TOOL_TYPES]).toEqual(['dynamic-swot']);
  });
});
