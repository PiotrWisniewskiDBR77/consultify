// Evidence capture for repair 4 (AssessmentHub i18n headers + PriorityChip
// raw enum, MethodWorkspaceShell Settings panel debug/UUID cleanup).
// Usage: node scripts/dev/assessment-fixes-hub-shell-screenshots.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-fixes-20260826'
);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch();

  // 1. AssessmentHub — initiatives tab (Priority column real fix + PL headers)
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(
      `http://localhost:4532/index.html?screen=assessment-five-surfaces&tab=initiatives&theme=${theme}`,
      { waitUntil: 'networkidle' }
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `06-assessmenthub-initiatives-${theme}.png`) });
    await page.close();
  }

  // 2. AssessmentHub — reports tab (import status labels)
  for (const theme of ['light']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(
      `http://localhost:4532/index.html?screen=assessment-five-surfaces&tab=reports&theme=${theme}`,
      { waitUntil: 'networkidle' }
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `07-assessmenthub-reports-${theme}.png`) });
    await page.close();
  }

  await browser.close();
  console.log('Saved AssessmentHub screenshots to', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
