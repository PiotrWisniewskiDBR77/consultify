/**
 * M06 L-06 — ColorPickerPopover palettes must hold no duplicate hex values.
 *
 * Duplicate colors rendered with `key={c}` triggered React duplicate-key
 * warnings and drew redundant swatches. The arrays are now Set-deduped; this
 * test locks that property so a future hand-edit can't reintroduce a dupe.
 *
 * TRIADA tokenization (2251d00d9e, "mindmap data-color hex -> c-tag/status
 * vars") deliberately replaced the old ~44-entry raw-hex PALETTE with a
 * curated semantic-token palette (originally 5 status vars + 12 c-tag
 * identity vars = 17) — a smaller, on-brand, theme-aware set is the intended
 * design, not a regression.
 *
 * That 5th status var was `var(--c-accent)` (crimson). Commit 6dbada35a8
 * ("fix(crimson-idee): ... usunięto var(--c-accent) z selectowalnej PALETTE
 * danych (crimson nigdy jako dana)") removed it per CLAUDE.md's Pułapka nr 1
 * canon: crimson/`c-accent` is reserved for critical semantics only and must
 * never be offered as a plain data/decoration color. PALETTE is now 4 status
 * vars (info/success/warning/danger) + 12 c-tag vars = 16 — this test's
 * threshold predated that fix and had gone stale.
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
    // 4 status accents (info/success/warning/danger) + 12 c-tag identity vars
    // (TRIADA token palette). Crimson (`c-accent`) is deliberately excluded —
    // see file header re: commit 6dbada35a8.
    expect(PALETTE.length).toBeGreaterThanOrEqual(16);
  });
});
