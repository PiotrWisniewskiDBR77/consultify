// One-off evidence capture for the 2026-08-26 assessment/DRD "empty handler"
// fixes — headless Playwright against the running dev-render harness
// (npx vite --config dev-render/vite.config.ts --port 4531).
// Usage: node scripts/dev/assessment-fixes-drd-screenshots.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:4531/drd-workspace.html?screen=interview';
const OUT_DIR = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-fixes-20260826'
);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.goto(`${BASE}&theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="interview-focus-panel"]');

    // 1. Base interview panel — command row visible (Wstecz/Zapisz/Dalej/Pomiń).
    await page.screenshot({ path: path.join(OUT_DIR, `01-interview-${theme}.png`) });

    // 2. Skip dictionary open — 4-code select, Potwierdź disabled.
    await page.getByRole('button', { name: /Pomiń z uzasadnieniem/i }).click();
    await page.screenshot({ path: path.join(OUT_DIR, `02-skip-dictionary-${theme}.png`) });

    // 3. Skip dictionary with a code chosen — Potwierdź enabled.
    await page.getByTestId('skip-reason-select').selectOption({ label: 'poza zakresem zlecenia' });
    await page.screenshot({ path: path.join(OUT_DIR, `03-skip-dictionary-chosen-${theme}.png`) });
    // Reset (do not actually submit — keep the harness state clean for the next shot).
    await page.getByRole('button', { name: /Pomiń z uzasadnieniem/i }).click().catch(() => {});

    // 4. "Nie wiem" -> ResolutionCard, assign_question disabled/Planowane.
    await page.getByRole('radio', { name: /Nie wiem/i }).click();
    await page.waitForSelector('[data-testid="resolution-card"]');
    await page.screenshot({ path: path.join(OUT_DIR, `04-resolution-card-${theme}.png`) });

    // 5. "Poproś o dowód" clicked — visible confirmation line.
    await page.getByRole('button', { name: /Poproś o dowód/i }).click();
    await page.screenshot({ path: path.join(OUT_DIR, `05-resolution-confirmed-${theme}.png`) });

    await page.close();
  }
  await browser.close();
  console.log('Saved screenshots to', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
