/**
 * MYW-PHOTO-003 (P1) — owner-feedback contract regression.
 *
 * "Menu drugiego poziomu przelewa się przy 1280 px i pokazuje natywny
 * poziomy pasek przewijania; kontrolki ściśnięte przy prawej krawędzi." —
 * at ~1280px the main nav row (tabs + right-cluster controls) overflows and
 * scrolls, but showed the browser's thick default scrollbar with no
 * trailing space, so the last control read as cramped against the edge.
 *
 * Fix: both horizontally-scrolling rows in the main nav bar now use the
 * app's existing thin styled scrollbar token (`app-table-scrollbar`, the
 * same one every other scrollable table surface uses) plus a small trailing
 * `pr-1` so the last chip/control never sits flush against the scroll edge.
 *
 * Source: `evidence/exact-candidate-43730-photo-gate-2026-08-23/MY_WORK_EXPERT_REVIEW_2026-08-23.md`.
 * Source-contract check, following `MyWorkHub.decisionsOwnerFeedback.test.ts`
 * in this directory (full mount pulls in the whole My Work provider stack).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

describe('MYW-PHOTO-003 — main nav overflow rows use the styled scrollbar', () => {
  it('applies the canonical thin scrollbar token to the main tab row and the right cluster', () => {
    const overflowRows = hubSource
      .split('\n')
      .filter((line) => line.includes('overflow-x-auto') && line.includes('whitespace-nowrap'));

    const styledRows = overflowRows.filter((line) => line.includes('app-table-scrollbar'));
    // At least the main-tabs row and the right-cluster scrollable-controls
    // row must carry the styled-scrollbar token.
    expect(styledRows.length).toBeGreaterThanOrEqual(2);
  });

  it('gives the scrolled rows trailing room so the last control is not flush against the edge', () => {
    const styledClassNameRows = hubSource
      .split('\n')
      .filter((line) => line.includes('className=') && line.includes('app-table-scrollbar'));
    expect(styledClassNameRows.length).toBeGreaterThanOrEqual(2);
    for (const row of styledClassNameRows) {
      expect(row).toContain('pr-1');
    }
  });
});
