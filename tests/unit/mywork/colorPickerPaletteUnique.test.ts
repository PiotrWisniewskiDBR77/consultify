/**
 * M06 L-06 — ColorPickerPopover palettes must hold no duplicate hex values.
 *
 * Duplicate colors rendered with `key={c}` triggered React duplicate-key
 * warnings and drew redundant swatches. The arrays are now Set-deduped; this
 * test locks that property so a future hand-edit can't reintroduce a dupe.
 */
import { describe, expect, it } from 'vitest';

import {
  PALETTE,
  RECOMMENDED_COLORS,
} from '../../../src/components/MyWork/mindmap/floating-toolbar/ColorPickerPopover';

describe('M06 L-06 — color palettes are unique', () => {
  it('RECOMMENDED_COLORS has no duplicate hex (safe as React key)', () => {
    expect(new Set(RECOMMENDED_COLORS).size).toBe(RECOMMENDED_COLORS.length);
  });

  it('PALETTE has no duplicate hex (safe as React key)', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it('palettes are non-empty (dedupe did not collapse them)', () => {
    expect(RECOMMENDED_COLORS.length).toBeGreaterThan(3);
    expect(PALETTE.length).toBeGreaterThan(20);
  });
});
