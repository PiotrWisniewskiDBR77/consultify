import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const outputDir = path.resolve('evidence/drd-2b-w103');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(
      `http://127.0.0.1:4216/?screen=u19-drd-trzy-kolumny&lang=en&theme=${theme}&uwagi=0`,
      { waitUntil: 'networkidle' }
    );
    await page.getByTestId('drd-level-interview-v2').waitFor();
    await page.getByRole('button', { name: 'Work with AI' }).waitFor();
    await page.getByRole('treeitem', { name: /Sales Processes.*\/ 7/ }).waitFor();
    await page.screenshot({
      path: path.join(outputDir, `drd-2b-en-${theme}-1440x900.png`),
      fullPage: false,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
