// D.2 — five dev-render screenshots for the real <ResultsSearchRegistry>
// component (light/dark/empty/error/hit), against the local dev-render
// harness (`npx vite --config dev-render/vite.config.ts --port 3354`).
// One-off script, not part of any test suite.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEV_RENDER_URL || 'http://localhost:3354';
const OUT_DIR = path.join(
  __dirname,
  '..',
  'docs',
  'qa',
  'screens',
  'results-day46-finish',
  'search'
);
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

async function shot(name, { theme = 'light', query = '', urlParams = '' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 700 },
  });
  const page = await context.newPage();
  // Harness theme toggle is a `?theme=` URL param driving Tailwind's `.dark`
  // class (dev-render/main.tsx L1250-1267), NOT the browser's
  // prefers-color-scheme media query.
  const url = `${BASE}/?screen=results-vnext-search-registry&theme=${theme}${urlParams}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  if (query) {
    const input = page.locator(
      'input[aria-label="Szukaj w Wynikach"], input[aria-label="Search Results"]'
    );
    await input.fill(query);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(200);
  const dest = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: dest });
  console.log('saved', dest);
  await context.close();
}

await shot('01-krotkie-zapytanie-light'); // honest "type >= 2 chars" state
await shot('02-wyniki-light', { query: 'ru' }); // >=2 chars -> real hits
await shot('03-wyniki-dark', { query: 'ru', theme: 'dark' });
await shot('04-pusty-light', { query: 'ru', urlParams: '&state=empty' });
await shot('05-blad-light', { query: 'ru', urlParams: '&state=error' });

await browser.close();
console.log('done');
