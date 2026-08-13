/* eslint-disable */
/**
 * S17-OVERLAPTEST — real-browser geometry measurement for the Idea Table
 * Updated-column / pinned-actions-column overlap defect.
 *
 * Drives dev-render/screens/idea-table-production.tsx (the byte-for-byte
 * production wrapper shape) with Playwright/Chromium and reports, for each
 * viewport in the owner's required matrix and at both scroll extremes:
 *   - header Updated <th> rect vs header actions <th> rect
 *   - every body row's Updated <td> rect vs that row's actions <td> rect
 *   - whether the kebab (role=button, name="Row actions") is present +
 *     visible for every row
 *
 * Usage: node measure-idea-table-overlap.mjs <base-url>
 *   node measure-idea-table-overlap.mjs http://localhost:3357
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3357';
const URL = `${BASE}/?screen=idea-table-production&lang=en`;

const VIEWPORTS = [
  { name: '1280x800 @100%', width: 1280, height: 800 },
  { name: '1440x900 @100%', width: 1440, height: 900 },
  { name: '720x450', width: 720, height: 450 },
  // 200% zoom / reflow: per WCAG 1.4.10 reflow testing convention, zooming
  // the browser to Z% is equivalent (in CSS px terms) to emulating a
  // viewport of 1/Z the linear size — a 1280x800 design at 200% zoom
  // presents an effective 640x400 CSS-px viewport.
  { name: '200% zoom (emulated 640x400 CSS px)', width: 640, height: 400 },
];

async function measureAtScroll(page, scrollLeft) {
  return await page.evaluate((targetScrollLeft) => {
    const scrollContainer = document.querySelector('table')?.closest('.overflow-auto') ||
      document.querySelector('table')?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollLeft = targetScrollLeft;
    }
    const table = document.querySelector('table');
    if (!table) return { error: 'no table found' };

    const headerRow = table.querySelector('thead tr');
    const headerCells = Array.from(headerRow.querySelectorAll('th'));
    const headerDateTh = headerCells.find((th) => /updat|data/i.test(th.textContent || ''));
    const headerActionsTh = headerCells[headerCells.length - 1];

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const rows = bodyRows.map((tr, idx) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      // date column is second-to-last (before actions), when visible
      const actionsCell = cells[cells.length - 1];
      // find the date cell by matching header column order: locate by
      // position — header order is select/title/stage/tags/tool/date/actions
      // so date cell is cells[cells.length - 2] when the date column is visible.
      const dateCell = cells.length >= 2 ? cells[cells.length - 2] : null;
      const kebab = tr.querySelector('button[aria-label="Row actions"]');
      return {
        rowIndex: idx,
        dateCellRect: rect(dateCell),
        dateCellText: dateCell ? dateCell.textContent : null,
        actionsCellRect: rect(actionsCell),
        kebabPresent: !!kebab,
        kebabVisible: kebab ? kebab.getClientRects().length > 0 : false,
      };
    });

    return {
      actualScrollLeft: scrollContainer ? scrollContainer.scrollLeft : null,
      scrollMax: scrollContainer ? scrollContainer.scrollWidth - scrollContainer.clientWidth : null,
      headerDateRect: rect(headerDateTh),
      headerDateText: headerDateTh ? headerDateTh.textContent : null,
      headerActionsRect: rect(headerActionsTh),
      rows,
    };
  }, scrollLeft);
}

function report(label, data) {
  console.log(`\n=== ${label} (requested scrollLeft in call) ===`);
  if (data.error) {
    console.log('ERROR:', data.error);
    return;
  }
  console.log(`actualScrollLeft=${data.actualScrollLeft} scrollMax=${data.scrollMax}`);
  const hd = data.headerDateRect;
  const ha = data.headerActionsRect;
  const headerHolds = hd && ha ? hd.right <= ha.left : null;
  console.log(
    `HEADER  updated.right=${hd?.right?.toFixed(1)} actions.left=${ha?.left?.toFixed(1)} ` +
      `holds(updated.right<=actions.left)=${headerHolds} text="${data.headerDateText}"`
  );
  data.rows.forEach((r) => {
    const dr = r.dateCellRect;
    const ar = r.actionsCellRect;
    const holds = dr && ar ? dr.right <= ar.left : null;
    const overlapPx = dr && ar ? (dr.right - ar.left).toFixed(1) : 'n/a';
    console.log(
      `row ${r.rowIndex}: updated.right=${dr?.right?.toFixed(1)} actions.left=${ar?.left?.toFixed(1)} ` +
        `holds=${holds} overlapPx=${overlapPx} text="${(r.dateCellText || '').trim()}" ` +
        `kebabPresent=${r.kebabPresent} kebabVisible=${r.kebabVisible}`
    );
  });
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const atZero = await measureAtScroll(page, 0);
    report(`${vp.name} — scrollLeft=0`, atZero);

    const scrollMax = atZero.scrollMax ?? 0;
    if (scrollMax > 0) {
      const atMax = await measureAtScroll(page, scrollMax);
      report(`${vp.name} — scrollLeft=max(${scrollMax})`, atMax);
    } else {
      console.log(`\n=== ${vp.name} — scrollLeft=max === (no horizontal overflow, scrollMax=${scrollMax}, skipped)`);
    }

    await page.close();
  }
  await browser.close();
})();
