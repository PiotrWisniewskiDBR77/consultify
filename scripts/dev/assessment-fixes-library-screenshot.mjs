// Evidence capture for repair 5 (AssessmentLibraryTab "Wkrótce"/"Coming
// soon" -> "Planowane").
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-fixes-20260826'
);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
    await page.goto(
      `http://localhost:4532/index.html?screen=assessment-five-surfaces&tab=library&theme=${theme}`,
      { waitUntil: 'networkidle' }
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `10-library-planned-${theme}.png`) });
    await page.close();
  }
  await browser.close();
  console.log('Saved Library screenshots to', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
