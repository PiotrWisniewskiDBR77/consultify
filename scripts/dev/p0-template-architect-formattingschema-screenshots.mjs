// P0 fix (2026-09-02, zgłoszenie #42) — evidence capture.
// Repro: Architekt szablonów Word (`gen-word-content-hints`) crashed to a
// blank white screen on row click for a template with a PARTIAL
// `formattingSchema` (TypeError: Cannot read properties of undefined
// (reading 'enabled')). Click-then-shoot, both themes, per rule #7 (owner
// only ever sees a clean post-fix screenshot).
//
// Wzór: scripts/dev/ui-latki-20260828-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/p0-template-architect-formattingschema-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.P0_ARCHITEKT_BASE_URL || 'http://localhost:4977';
const OUT = process.argv[2] || '/private/tmp/p0-architekt/evidence/p0-architekt-20260902';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shootRowClick(name, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const url = `${BASE}/?screen=gen-word-content-hints&theme=${theme}&lang=pl`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  // The dev-render mock template's name (dev-render/mocks/documentTemplateArchitectMocks.ts).
  await page.waitForSelector('text=Raport zarządczy (miesięczny)', { timeout: 15000 });
  await page.waitForTimeout(300);
  // THE REPRO STEP: click the row. Pre-fix this crashed to a blank white
  // screen (TypeError reading 'enabled'); post-fix the Word-layout editor
  // renders below the table.
  await page.getByText('Raport zarządczy (miesięczny)', { exact: true }).click();
  await page.waitForTimeout(400);
  // Scroll the Word-layout fieldset ("Układ dokumentu" — PL translation of
  // wordSettings) into view so the screenshot proves the editor actually
  // rendered, not just that nothing threw.
  await page.getByText('Układ dokumentu', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path, 'page errors:', errors);
  if (errors.length > 0) {
    console.error('PAGE ERRORS DETECTED for', name, errors);
  }
  await context.close();
  return errors;
}

const lightErrors = await shootRowClick('01-row-click-light', 'light');
const darkErrors = await shootRowClick('02-row-click-dark', 'dark');

await browser.close();

const totalErrors = lightErrors.length + darkErrors.length;
console.log(totalErrors === 0 ? 'DONE — zero page errors' : `DONE — ${totalErrors} page errors!`);
process.exit(totalErrors === 0 ? 0 : 1);
