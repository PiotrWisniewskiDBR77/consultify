import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = '/Users/piotrwisniewski/Developer/cto-codex/a-project1-p2-w249';
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.PROJECT1_P2_RENDER_URL || 'http://127.0.0.1:3236/project-context-switcher.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(`${baseUrl}?theme=light&lang=en`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /select project context/i }).click();
await page.getByRole('option', { name: /Digital & Automation Roadmap/i }).click();
const selected = await page.getByTestId('selected-project').textContent();
const lightPng = path.join(outDir, 'project-switcher-light.png');
await page.screenshot({ path: lightPng, fullPage: true });

await page.goto(`${baseUrl}?theme=dark&lang=en`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /select project context/i }).click();
const optionCount = await page.getByRole('option').count();
const darkPng = path.join(outDir, 'project-switcher-dark-open.png');
await page.screenshot({ path: darkPng, fullPage: true });

await browser.close();

const proof = {
  selected,
  optionCount,
  errors,
  screenshots: [lightPng, darkPng],
};
fs.writeFileSync(path.join(outDir, 'render-proof.json'), JSON.stringify(proof, null, 2));
if (selected !== 'ae6cfbae-1ba8-5328-9048-d86f2a52a09e') {
  throw new Error(`Project switch did not update store, selected=${selected}`);
}
if (optionCount !== 4) {
  throw new Error(`Expected All projects + 3 project options, got ${optionCount}`);
}
if (errors.length) {
  throw new Error(`Browser errors: ${errors.join('\n')}`);
}
console.log(JSON.stringify(proof, null, 2));
