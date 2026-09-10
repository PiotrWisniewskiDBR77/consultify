// F4c — zrzut PRZED/PO dla przycisku "Add Link"/"Add External Link" w
// LinkedItemsSection, przez dev-render harness (izolowany, bez logowania).
// Wymaga: npx vite --config dev-render/vite.config.ts --port 3020 (osobno)
// Użycie: node scripts/dev/f4c-zrzut-devrender.mjs <przed|po>
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3020';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
await page.emulateMedia({ colorScheme: 'light' });

await page.goto(`${base}/?screen=f4c-linked-items-add-button&theme=light`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(1000);

if (label === 'po') {
  await page.getByText('Dodaj link', { exact: true }).click();
  await page.waitForTimeout(500);
}

await page.screenshot({
  path: `evidence/f4/f4c-${label}-add-link-devrender-900-jasny.png`,
  fullPage: false,
});

await browser.close();
