/**
 * M06 Fala 4.1b — accepted flag-ON contract.
 *
 * `mindmapDrawerUnified` defaults to ON after owner acceptance. The flag stays
 * available as an explicit rollback switch for the legacy drawers.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS } from '../../../src/hooks/useFeatureFlags';

describe('mindmapDrawerUnified flag (Fala 4.1b)', () => {
  const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapDrawerUnified');

  it('is registered in DEFAULT_FLAGS', () => {
    expect(flag).toBeDefined();
  });

  it('defaults to ON after owner acceptance', () => {
    expect(flag?.defaultValue).toBe(true);
  });

  it('allows local override for QA/preview toggling', () => {
    expect(flag?.allowLocalOverride).toBe(true);
  });
});
