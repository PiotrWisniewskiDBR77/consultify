// Evidence capture for repair 4's MethodWorkspaceShell Settings panel fix
// (UUID hidden, debug lines removed, freeze blockers shown as real reasons,
// "Akceptacje" rename).
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    await page.goto(`http://localhost:4531/drd-workspace.html?screen=interview&theme=${theme}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('[data-testid="interview-focus-panel"]');
    await page.getByRole('button', { name: /Settings/i }).click();
    await page.waitForSelector('[data-testid="method-workspace-settings"]');
    await page.screenshot({ path: path.join(OUT_DIR, `08-settings-panel-${theme}.png`) });

    // Expand "Szczegóły techniczne" to prove the UUID lives there now.
    await page.getByText('Szczegóły techniczne').click();
    await page.screenshot({ path: path.join(OUT_DIR, `09-settings-panel-technical-${theme}.png`) });

    await page.close();
  }
  await browser.close();
  console.log('Saved Settings panel screenshots to', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
