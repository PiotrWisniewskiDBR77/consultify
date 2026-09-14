import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const base = process.env.F2E_E1_UI_URL || 'http://127.0.0.1:5291';
const out = path.resolve('evidence/f2-e-enterprise/e1/browser');
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const theme of ['light', 'dark']) {
  for (const mode of ['progress', 'failed', 'denied', 'conflict']) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.goto(`${base}/?lang=en&theme=${theme}&exportState=${mode}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('Northstar Manufacturing', { exact: true }).waitFor({ state: 'visible' });
    await page.locator('button[aria-label="Row actions"],button[aria-label="Akcje wiersza"]').first().click();
    await page.getByText('Export Data', { exact: true }).click();
    if (mode === 'progress') await page.getByText('49%', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    else await page.getByRole('alert').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);
    const file = `${theme}-${mode}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: false });
    results.push({ theme, mode, consoleErrors, bodyHasUnexpectedError: (await page.locator('body').innerText()).includes('Something went wrong') });
    await browser.close();
  }
}
fs.writeFileSync(path.join(out, 'browser-result.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (results.some((entry) => entry.consoleErrors.length || entry.bodyHasUnexpectedError)) process.exit(1);
