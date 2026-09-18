import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const output = path.resolve('docs/program/RB_3_20260917/screenshots');
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch();
const findings = [];
for (const theme of ['light', 'dark']) {
  for (const mode of ['write', 'review', 'publish']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const query = new URLSearchParams({
      screen: 'rg1-opened-report',
      reportId: 'rb-drd-northwind-proof',
      ff_report_builder_nav_v2: '1',
      mode,
      theme,
    });
    await page.goto(`http://127.0.0.1:3350/?${query}`, { waitUntil: 'domcontentloaded' });
    const bar = page.getByTestId('report-builder-mode-bar');
    await bar.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1_000);

    const labels = await bar.locator('button').allTextContents();
    const active = await bar.locator('[aria-current="page"]').getAttribute('data-testid');
    if (labels.map((label) => label.trim()).join('|') !== 'Write|Review|Publish') {
      throw new Error(`${theme}/${mode}: unexpected navigation ${labels.join('|')}`);
    }
    if (active !== `report-builder-mode-${mode}`) {
      throw new Error(`${theme}/${mode}: active mode is ${active}`);
    }
    if (mode !== 'write') {
      await page.getByTestId(`report-builder-${mode}-canvas`).waitFor();
      await page.getByTestId('report-builder-document-view').waitFor();
      await page.getByTestId(`report-builder-${mode}-rail`).waitFor();
    }
    await page.evaluate(() => {
      document.querySelectorAll('[data-dev-render-chrome]').forEach((element) => {
        element.style.display = 'none';
      });
    });
    const file = `${mode}-en-${theme}-1440x900.png`;
    await page.screenshot({ path: path.join(output, file) });
    findings.push({ theme, mode, labels, active, errors });
    await page.close();
  }
}
await browser.close();
await fs.writeFile(path.join(output, 'capture.json'), JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
