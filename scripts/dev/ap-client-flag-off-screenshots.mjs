// Gate J fix pass, defect #3 — missing "flag OFF" evidence screenshots.
// Independent verification found only 1 of 5 AP-CLIENT components
// (lineage-navigator) had a committed `*-flag-off-*` screenshot; the other four
// (compare/comments/saved-views/export-import) relied only on unit-test coverage
// of the null-render path. This script closes that gap.
//
// Each shot gets its OWN fresh Playwright browser CONTEXT (not just a fresh page)
// so localStorage from any earlier navigation in this process cannot leak into the
// off-state check — the exact pitfall the 2026-08-12 harness fix
// (`ap-client-screenshots.mjs` / commit f698877070) had to work around for
// lineage-navigator: `consultify_feature_flags` persists in localStorage across
// `page.goto()` within the same browser context, so a scene=default shot taken
// earlier in the same context can leave the flag ON before a later scene=off shot.
// The dev-render screens themselves already write an explicit `scene !== 'off'`
// (true or false, never "skip") on every navigation, so a fresh context isn't
// strictly required to get a correct result here — it's extra insurance, matching
// CLAUDE.md's explicit instruction for this task to use a fresh context per
// component. Temporary tooling script for this package's report — not wired into
// CI/build, same status as its sibling `ap-client-screenshots.mjs`.
import { chromium } from 'playwright';

const BASE = process.env.AP_CLIENT_BASE_URL || 'http://localhost:58045';
const OUT = '/Users/piotrwisniewski/consultify-wt/fv3p-j-security/docs/validation/finance-v3/generated/gate-e/visual/ap-client';

const shots = [
  { name: 'compare-panel-flag-off-light.png', screen: 'finance-compare-panel' },
  { name: 'comments-panel-flag-off-light.png', screen: 'finance-comments-panel' },
  { name: 'saved-views-panel-flag-off-light.png', screen: 'finance-saved-views-panel' },
  { name: 'export-import-panel-flag-off-light.png', screen: 'finance-export-import-panel' },
];

const browser = await chromium.launch();

for (const shot of shots) {
  // Fresh context per component — brand-new, empty localStorage every time.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=${shot.screen}&scene=off&theme=light`;
  console.log('navigating', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error('NAV FAILED', url, e.message);
    await context.close();
    continue;
  }
  await page.waitForTimeout(900);

  // Sanity check before saving: confirm the flag override this navigation wrote is
  // actually `false` (proof this is a genuinely fresh, off-state context), logged
  // for the report transcript.
  const flagState = await page.evaluate(() =>
    window.localStorage.getItem('consultify_feature_flags')
  );
  console.log('  localStorage consultify_feature_flags =', flagState);

  const path = `${OUT}/${shot.name}`;
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
  await context.close();
}

await browser.close();
console.log('DONE');
