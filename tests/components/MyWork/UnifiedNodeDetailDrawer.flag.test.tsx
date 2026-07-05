/**
 * M06 Fala 4.1b — flag-OFF contract.
 *
 * `mindmapDrawerUnified` must default to OFF so that, until Piotr accepts the
 * unified drawer on screenshots, both consumers keep rendering their legacy
 * drawers (NodeDetailDrawer / IdeaNodeDetailDrawer) — zero behaviour change.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS } from '../../../src/hooks/useFeatureFlags';

describe('mindmapDrawerUnified flag (Fala 4.1b)', () => {
  const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapDrawerUnified');

  it('is registered in DEFAULT_FLAGS', () => {
    expect(flag).toBeDefined();
  });

  it('defaults to OFF (legacy drawers stay live)', () => {
    expect(flag?.defaultValue).toBe(false);
  });

  it('allows local override for QA/preview toggling', () => {
    expect(flag?.allowLocalOverride).toBe(true);
  });
});
