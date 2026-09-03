/**
 * MYW-PHOTO-003 (P1) — owner-feedback contract regression.
 *
 * "Level-2 menu overflows at 1280px with a native horizontal scrollbar;
 * controls are cramped at the right edge." — the acceptance doc's evidence
 * for this being partially closed pointed at `ScrollAffordance` inside
 * `MyWorkNav.tsx` (lines ~285–286 / ~333–334). Measured (dyżur
 * mw-skrzynka-pasek-20260903, mywork-inbox harness, 1024px/768px screenshots
 * PRZED naprawą): `MyWorkNav` is NEVER mounted anywhere in the app —
 * `grep -rn '<MyWorkNav' src/` has zero hits outside `MyWorkNav.tsx` itself,
 * and `isMyWorkTwoLevelNavEnabled()` (the flag that would gate it in) is
 * never called either. The nav bar that actually ships is the single-row
 * `tabs.map` bar in `MyWorkHub.tsx` (Main Navigation Row) plus its Menu 2
 * right cluster — neither had ANY scroll affordance, just a thin styled
 * scrollbar (`app-table-scrollbar`) that gives zero visual cue more tabs
 * exist past a hard-clipped edge. This locks in the fix: both rows now use
 * the shared `useScrollEdges` + `ScrollEdgeFade` primitives (extracted from
 * `MyWorkNav.tsx`'s own, never-shipped implementation).
 *
 * Source-level lock (component is too large/dependency-heavy to mount in a
 * unit test — same pattern as `MyWorkHub.photo005.contract.test.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');

describe('MYW-PHOTO-003 — live nav bar (not the unmounted MyWorkNav.tsx) signals horizontal scroll', () => {
  it('imports the shared scroll-edge affordance primitives', () => {
    expect(hubSource).toContain("from './shared/useScrollEdges'");
    expect(hubSource).toContain("from './shared/ScrollEdgeFade'");
  });

  it('wires the Main Navigation Row tab strip to a measured scroll-edge ref', () => {
    expect(hubSource).toContain('const [tabsRowRef, tabsRowEdges] = useScrollEdges(');
    expect(hubSource).toContain('ref={tabsRowRef}');
    expect(hubSource).toContain(
      'visible={tabsRowEdges.scrollable && !tabsRowEdges.atStart}'
    );
    expect(hubSource).toContain('visible={tabsRowEdges.scrollable && !tabsRowEdges.atEnd}');
  });

  it('wires the Menu 2 right cluster row to a measured scroll-edge ref', () => {
    expect(hubSource).toContain(
      'const [rightClusterRowRef, rightClusterRowEdges] = useScrollEdges('
    );
    expect(hubSource).toContain('ref={rightClusterRowRef}');
    expect(hubSource).toContain(
      'visible={rightClusterRowEdges.scrollable && !rightClusterRowEdges.atStart}'
    );
    expect(hubSource).toContain(
      'visible={rightClusterRowEdges.scrollable && !rightClusterRowEdges.atEnd}'
    );
  });
});
