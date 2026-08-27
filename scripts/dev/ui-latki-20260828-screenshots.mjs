// UI-latki-20260828 evidence capture — 3 owner-approved bugfixes:
//   1) initiatives governed-gate status-change toast (verified via unit-level
//      inspection only, no visual surface — not screenshotted here)
//   2) InterviewHub Sesje tab — missing 'assigned' status label/config
//   3) Interview Creator Shell — glued "CO POWSTANIE" label + wrong PL
//      numeral declension ("1 typów wyniku")
//
// Wzór: scripts/dev/tools-insights-i18n-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/ui-latki-20260828-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.UI_LATKI_BASE_URL || 'http://localhost:3360';
const OUT =
  process.argv[2] ||
  '/private/tmp/latki/docs/program/waves/WAVE_03_ACCEPTANCE/evidence/ui-latki-20260828';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shootCreatorShell(name, theme, typesToCheck) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=interview-creator-shell&theme=${theme}&lang=pl`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Kreator Wniosków AI', { timeout: 15000 });
  await page.waitForTimeout(300);
  for (const label of typesToCheck) {
    await page.getByText(label, { exact: true }).click();
    await page.waitForTimeout(100);
  }
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

async function shootSessionsStatus(name, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=interview-sessions-status&theme=${theme}&lang=pl`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Przydzielony', { timeout: 15000 });
  await page.waitForTimeout(300);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

// Patch 3 — Creator Shell: default state (1 output type — the exact
// "CO POWSTANIEWniosek..." / "1 typów wyniku" repro from the bug report).
await shootCreatorShell('01-creator-shell-light', 'light', []);
await shootCreatorShell('02-creator-shell-dark', 'dark', []);
// Patch 3 — plural sweep: check 4 more boxes (5 total) to exercise the PL
// "few" (2-4) and "many" (5+) CLDR branches, not just "one".
await shootCreatorShell('03-creator-shell-5types-light', 'light', [
  'Analiza Ogólna',
  'Analiza Trendów',
  'Odkrywanie Problemów',
  'Rekomendacje',
]);

// Patch 2 — Sesje tab: 5 rows, one per real normalizeInterviewAssignmentStatus
// value (assigned/in_progress/submitted/approved/completed).
await shootSessionsStatus('04-sessions-status-light', 'light');
await shootSessionsStatus('05-sessions-status-dark', 'dark');

await browser.close();
console.log('DONE');
