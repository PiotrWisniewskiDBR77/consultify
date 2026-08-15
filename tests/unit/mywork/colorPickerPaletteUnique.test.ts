/**
 * M06 L-06 — ColorPickerPopover palettes must hold no duplicate hex values.
 *
 * Duplicate colors rendered with `key={c}` triggered React duplicate-key
 * warnings and drew redundant swatches. The arrays are now Set-deduped; this
 * test locks that property so a future hand-edit can't reintroduce a dupe.
 *
 * TRIADA tokenization (2251d00d9e, "mindmap data-color hex -> c-tag/status
 * vars") deliberately replaced the old ~44-entry raw-hex PALETTE with a
 * curated 17-entry semantic-token palette (5 status vars + 12 c-tag identity
 * vars) — a smaller, on-brand, theme-aware set is the intended design, not a
 * regression. Threshold below reflects that reality.
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
    // 4 status accents + 12 c-tag identity vars (TRIADA token palette).
    expect(PALETTE.length).toBeGreaterThanOrEqual(16);
  });
});
