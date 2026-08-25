/**
 * M06 Fala 4.1b — flag contract.
 *
 * `mindmapDrawerUnified` had to default to OFF until Piotr accepted the unified
 * drawer on screenshots (both consumers kept rendering their legacy drawers —
 * NodeDetailDrawer / IdeaNodeDetailDrawer — until then, per the visual-acceptance
 * rule). That acceptance happened: commit dfb83212dc
 * ("flip(akcept Piotra 07-16 delegowany): 7 flag ON — ...drawerUnified...")
 * flipped defaultValue to true on 2026-07-16, matching the "FLIP ON akcept
 * Piotra 07-16" comment still on the flag definition. This test previously
 * asserted the pre-acceptance OFF default and had gone stale.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS } from '../../../src/hooks/useFeatureFlags';

describe('mindmapDrawerUnified flag (Fala 4.1b)', () => {
  const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapDrawerUnified');

  it('is registered in DEFAULT_FLAGS', () => {
    expect(flag).toBeDefined();
  });

  it('defaults to ON (accepted 2026-07-16 — unified drawer is live)', () => {
    expect(flag?.defaultValue).toBe(true);
  });

  it('allows local override for QA/preview toggling', () => {
    expect(flag?.allowLocalOverride).toBe(true);
  });
});
