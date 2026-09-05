import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.P7K_RENDER_URL || 'http://127.0.0.1:3027';
const output = path.resolve('evidence/p7k-wyniki/prototype');
const views = ['kpi-l1', 'kpi-l2', 'kpi-l3', 'okr-l1', 'okr-l2', 'okr-l3', 'roi-l1', 'roi-l2'];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();

for (const view of views) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    const networkErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${String(error)}`));
    page.on('response', (response) => { if (response.status() >= 400) networkErrors.push({ status: response.status(), method: response.request().method(), url: response.url() }); });
    const url = `${base}/?screen=p7k-wyniki-prototype&view=${view}&theme=${theme}&lang=pl&uwagi=0`;
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.locator('[data-dev-render-chrome]').evaluateAll((elements) => elements.forEach((element) => { element.style.display = 'none'; }));
    const metrics = await page.evaluate(() => ({
      asideCount: document.querySelectorAll('aside').length,
      tableCount: document.querySelectorAll('table').length,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      bodyText: document.body.innerText,
    }));
    const name = `${view}--${theme}`;
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    await fs.writeFile(path.join(output, `${name}.json`), `${JSON.stringify({ view, theme, url, httpStatus: response?.status() ?? null, consoleErrors, networkErrors, ...metrics }, null, 2)}\n`);
    await page.close();
  }
}

await browser.close();
