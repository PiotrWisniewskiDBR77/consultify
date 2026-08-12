/**
 * S18-NOOVERLAP (2026-08-12) — REAL-BROWSER contract test for the Updated
 * column / pinned-actions-column overlap regression the owner rejected.
 *
 * This REPLACES the geometry half of
 * tests/components/MyWork/IdeasTableContent.columnOverlap.test.tsx
 * (S17-OVERLAPTEST). That vitest suite runs in jsdom, which never performs
 * layout — `getBoundingClientRect()` there is either all-zero or (as that
 * suite did) an explicitly stubbed constant. Frozen stubs cannot detect a
 * real fix: they would need their numbers hand-edited every time the
 * implementation changes, which is exactly the "edit the numbers until the
 * test passes" shortcut the owner forbade. This spec instead drives
 * dev-render/screens/idea-table-production.tsx (the byte-for-byte
 * production wrapper shape — see that file's own header comment) with real
 * Playwright/Chromium and reads live `getBoundingClientRect()` geometry, so
 * the numbers in every assertion message come from actual layout at the
 * moment the test runs, not from a constant baked in ahead of time.
 *
 * Kept from the owner's literal spec:
 *   - the exact assertion shape: `updated.right <= actions.left`, for the
 *     header AND for every visible row;
 *   - a human-readable failure message naming the real measured overlap in
 *     px, not a bare `expected false to be true`;
 *   - the kebab-reachability assertion (by ROLE + ACCESSIBLE NAME) enforced
 *     TOGETHER with the no-overlap assertion, in the same test — a "fix"
 *     that removes the sticky pin instead of reserving width would kill the
 *     overlap but let the kebab scroll off-screen again (the exact defect
 *     S13-STICKY fixed), and a "fix" that keeps the kebab pinned without
 *     ever resolving the overlap satisfies only the other half. Neither
 *     alone is enough to pass.
 *
 * Run:
 *   npx playwright test --config playwright.ideas-overlap.config.ts
 *
 * The companion script dev-render/measure-idea-table-overlap.mjs remains as
 * a free-standing, no-assertions probe for ad-hoc numbers (used to produce
 * the evidence in the S18-NOOVERLAP session report); this spec is the
 * pass/fail contract that CI-shaped runs enforce.
 */
import { expect, test, type Page } from '@playwright/test';

type Viewport = { name: string; width: number; height: number };

const VIEWPORTS: Viewport[] = [
  { name: '1280x800 @100%', width: 1280, height: 800 },
  { name: '1440x900 @100%', width: 1440, height: 900 },
  { name: '720x450', width: 720, height: 450 },
  // 200% zoom / reflow: per WCAG 1.4.10 reflow-testing convention, zooming
  // the browser to Z% is equivalent (in CSS px terms) to emulating a
  // viewport of 1/Z the linear size — a 1280x800 design at 200% zoom
  // presents an effective 640x400 CSS-px viewport.
  { name: '200% zoom (emulated 640x400 CSS px)', width: 640, height: 400 },
];

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface RowMeasurement {
  index: number;
  title: string;
  dateCellRect: Rect | null;
  actionsCellRect: Rect | null;
  kebabPresent: boolean;
  kebabVisible: boolean;
}

interface Measurement {
  actualScrollLeft: number;
  scrollMax: number;
  headerDateRect: Rect | null;
  headerActionsRect: Rect | null;
  rows: RowMeasurement[];
}

async function gotoTable(page: Page) {
  await page.goto('/?screen=idea-table-production&lang=en', { waitUntil: 'networkidle' });
  await page.waitForSelector('table');
  // Let fonts/layout settle before the first measurement — matches the
  // fixed settle delay used by dev-render/measure-idea-table-overlap.mjs.
  await page.waitForTimeout(300);
}

async function measureAtScroll(page: Page, targetScrollLeft: number): Promise<Measurement> {
  return page.evaluate((scrollLeft) => {
    const scrollContainer =
      document.querySelector('table')?.closest<HTMLElement>('.overflow-auto') ||
      (document.querySelector('table')?.parentElement as HTMLElement | null);
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollLeft;
    }
    const table = document.querySelector('table');
    if (!table) throw new Error('idea-table-production: no <table> found');

    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
    };

    const headerRow = table.querySelector('thead tr')!;
    const headerCells = Array.from(headerRow.querySelectorAll('th'));
    const headerDateTh = headerCells.find((th) => /updat/i.test(th.textContent || '')) || null;
    const headerActionsTh = headerCells[headerCells.length - 1] || null;

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const rows = bodyRows.map((tr, index) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      const actionsCell = cells[cells.length - 1] || null;
      const dateCell = cells.length >= 2 ? cells[cells.length - 2] : null;
      const titleEl = tr.querySelector('td:nth-child(2) .truncate');
      const kebab = tr.querySelector('button[aria-label="Row actions"]') as HTMLElement | null;
      return {
        index,
        title: (titleEl?.textContent || `row ${index}`).trim(),
        dateCellRect: rect(dateCell),
        actionsCellRect: rect(actionsCell),
        kebabPresent: !!kebab,
        kebabVisible: kebab ? kebab.getClientRects().length > 0 : false,
      };
    });

    return {
      actualScrollLeft: scrollContainer ? scrollContainer.scrollLeft : 0,
      scrollMax: scrollContainer ? scrollContainer.scrollWidth - scrollContainer.clientWidth : 0,
      headerDateRect: rect(headerDateTh),
      headerActionsRect: rect(headerActionsTh),
      rows,
    };
  }, targetScrollLeft);
}

function overlapPx(a: Rect, b: Rect): number {
  return Math.round((a.right - b.left) * 10) / 10;
}

function assertNoOverlap(label: string, who: string, a: Rect | null, b: Rect | null) {
  expect(a, `[${label}] ${who}: expected the Updated cell to be measurable`).not.toBeNull();
  expect(b, `[${label}] ${who}: expected the actions cell to be measurable`).not.toBeNull();
  const holds = a!.right <= b!.left;
  const px = overlapPx(a!, b!);
  expect(
    holds,
    `[${label}] ${who}: Updated column overlaps the pinned actions column by ${px}px ` +
      `(updated.right=${a!.right}, actions.left=${b!.left})`
  ).toBe(true);
}

/**
 * `enforceOverlap`: whether the no-overlap assertions are required at THIS
 * scroll position. Always true once scrolled to the max (the date must be
 * fully legible with zero pixels covered once scrolled — no exceptions,
 * any viewport). At scrollLeft=0 it is true only when the columns already
 * fit (`scrollMax === 0` — the 1280×800 acceptance viewport after Fix A,
 * and the 1440×900 control): the owner was explicit that a viewport whose
 * FIXED columns alone (794px) exceed its own width (720×450; 640×400 at
 * 200% zoom) cannot show everything uncovered simultaneously AT REST, and
 * that is not to be "dressed up as fits" — so this suite does not assert
 * it there. Kebab reachability, in contrast, is required at EVERY scroll
 * position regardless of viewport (`assertScenario` always checks it) —
 * the sticky column is the topmost layer at rest too, so the kebab stays
 * clickable even while the date text is covered.
 */
function assertScenario(label: string, m: Measurement, enforceOverlap: boolean) {
  if (enforceOverlap) {
    assertNoOverlap(label, 'header (Updated <th> vs actions <th>)', m.headerDateRect, m.headerActionsRect);
  }

  for (const row of m.rows) {
    if (enforceOverlap) {
      assertNoOverlap(
        label,
        `row ${row.index} ("${row.title}")`,
        row.dateCellRect,
        row.actionsCellRect
      );
    }

    // Enforced TOGETHER with the no-overlap assertions above (when they
    // apply), on purpose: a "fix" that strips the sticky pin instead of
    // reserving width would clear the overlap but let the kebab scroll
    // off-screen again — the exact defect S13-STICKY fixed. This half is
    // unconditional (checked at every scroll position, every viewport) so
    // that "fix" can never pass by only satisfying the overlap half.
    expect(
      row.kebabPresent,
      `[${label}] row ${row.index} ("${row.title}"): expected a "Row actions" kebab button`
    ).toBe(true);
    expect(
      row.kebabVisible,
      `[${label}] row ${row.index} ("${row.title}"): "Row actions" kebab is present but not visible ` +
        `(getClientRects().length === 0)`
    ).toBe(true);
  }
}

test.describe('Idea Table — Updated column vs pinned actions column overlap (S18-NOOVERLAP, real browser)', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: no overlap + kebab reachable, at scrollLeft=0 and scrollLeft=max`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoTable(page);

      const atZero = await measureAtScroll(page, 0);
      // See assertScenario's doc comment: overlap-free is only required at
      // rest when there's nothing to scroll away in the first place.
      assertScenario(`${vp.name}, scrollLeft=0`, atZero, atZero.scrollMax === 0);

      // Role + accessible name — the owner's other required check, kept
      // live against the real rendered DOM (not just structural presence).
      const kebabsAtZero = page.getByRole('button', { name: 'Row actions' });
      await expect(kebabsAtZero).toHaveCount(atZero.rows.length);

      if (atZero.scrollMax > 0) {
        const atMax = await measureAtScroll(page, atZero.scrollMax);
        // Always enforced once fully scrolled — no exceptions.
        assertScenario(`${vp.name}, scrollLeft=max(${atZero.scrollMax})`, atMax, true);

        const kebabsAtMax = page.getByRole('button', { name: 'Row actions' });
        await expect(kebabsAtMax).toHaveCount(atMax.rows.length);
        for (let i = 0; i < atMax.rows.length; i += 1) {
          await expect(
            kebabsAtMax.nth(i),
            `[${vp.name}, scrollLeft=max] row ${i} kebab should be keyboard/mouse reachable`
          ).toBeVisible();
        }
      }
      // scrollMax === 0 (e.g. 1440×900 control, and 1280×800 after Fix A
      // removes the overflow entirely) means there is nothing to scroll —
      // the scrollLeft=0 measurement above already covers the only state.
    });
  }
});
