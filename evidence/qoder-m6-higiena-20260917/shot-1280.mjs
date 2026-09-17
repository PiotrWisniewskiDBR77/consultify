// Wpis 67 (M6 higiena) — dowód wizualny W81: pasek ModuleNavBar przy 1280 px
// zawija się do 2 rzędów, zakładka „Load" jest widoczna, a primary CTA
// „New initiative" NIE jest przycięte. Ekran: z30-inicjatywy-obciazenie
// (REALNY <InitiativesHub>, Menu 1/2/3, flaga VITE_INITIATIVES_WORKLOAD=true).
// Usage: node evidence/qoder-m6-higiena-20260917/shot-1280.mjs
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5430';
const OUT = process.argv[2] || 'evidence/qoder-m6-higiena-20260917';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  const failed404 = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() === 404) failed404.push(r.url()); });

  // The dev-render harness has no backend (apiNoBackendPlugin honestly 404s
  // /api/*). Stub unmatched /api calls so the console-error count reflects real
  // page errors from the bar, not harness no-backend noise. Scope by pathname
  // predicate — a broad `**/api/**` glob also matches vite module-script URLs
  // (a pnpm dep path can contain an `/api/` segment) and breaks module loading.
  await page.route(
    (url) => new URL(url).pathname.startsWith('/api/'),
    (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  );

  // Default Initiatives tab (register) — the primary CTA "New initiative" lives
  // here; the tablist (Initiatives/Plan/Load) renders on every tab.
  const url = `${BASE}/?screen=z30-inicjatywy-obciazenie&lang=en&theme=${theme}`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${OUT}/bar-1280-${theme}.png` });

  const bar = page.locator('[data-testid="module-nav-main-row"]').first();
  if (await bar.count()) {
    const box = await bar.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${OUT}/bar-1280-${theme}-clip.png`,
        clip: { x: 0, y: Math.max(0, box.y - 8), width: 1280, height: Math.min(900, box.height + 96) },
      });
    }
  }

  const geom = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="module-nav-main-row"]');
    const left = document.querySelector('[data-testid="module-nav-left-cluster"]');
    const right = document.querySelector('[data-testid="module-nav-right-cluster"]');
    const tabs = Array.from(document.querySelectorAll('[role="tablist"] [role="tab"]'));
    const loadTab = tabs.find((t) => /load/i.test(t.textContent || ''));
    const buttons = Array.from(right ? right.querySelectorAll('button') : []);
    const cta = buttons.find((b) => /new initiative/i.test(b.textContent || ''));
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const rr = rect(row); const lr = rect(left); const gtr = rect(right); const cr = rect(cta);
    return {
      rowH: rr ? Math.round(rr.height) : null,
      leftTop: lr ? Math.round(lr.top) : null,
      rightTop: gtr ? Math.round(gtr.top) : null,
      twoRows: lr && gtr ? Math.abs(lr.top - gtr.top) > 4 : null,
      tabLabels: tabs.map((t) => (t.textContent || '').trim()),
      loadVisible: loadTab ? loadTab.getBoundingClientRect().width > 0 : false,
      rightButtons: buttons.map((b) => (b.textContent || '').trim()).filter(Boolean),
      ctaText: cta ? (cta.textContent || '').trim() : null,
      ctaRight: cr ? Math.round(cr.right) : null,
      ctaClipped: cr ? cr.right > window.innerWidth + 0.5 : null,
      viewportW: window.innerWidth,
    };
  });
  console.log(`theme=${theme} consoleErrors=${errors.length} geom=${JSON.stringify(geom)}`);
  console.log(`  404s (${failed404.length}):`, failed404.slice(0, 6));
  if (errors.length) console.log('  first errors:', errors.slice(0, 3));
  await context.close();
}
await browser.close();
console.log('DONE');
