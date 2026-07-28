/**
 * Zrzuty weryfikacyjne paska edycji obiektu (ff_canvasObjectEditBar).
 * Uruchamiane ręcznie przez robotnika — harness dev-render na :3340.
 *
 *   node scripts/zrzut-pasek-edycji.mjs <screen> <nazwa> [theme] [flaga]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , screen = 'mindmap-canvas', name = 'zrzut', theme = 'light', flag = '1'] = process.argv;
const OUT = '/private/tmp/z-edycja-zrzuty';
fs.mkdirSync(OUT, { recursive: true });

const url = `http://localhost:3340/?screen=${screen}&theme=${theme}&ff_canvasObjectEditBar=${flag}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200));
});
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

// Zaznacz pierwszy węzeł płótna (react-flow), żeby pasek się pokazał.
const node = page.locator('.react-flow__node').nth(Number(process.env.NODE_INDEX || 1));
if (await node.count()) {
  await node.click({ force: true });
  await page.waitForTimeout(1200);
}

const bar = await page.locator('[data-testid="object-edit-bar"]').count();
const slot = await page.locator('[data-testid="canvas-object-edit-bar-slot"]').count();
console.log(`  ${screen}/${theme}/flaga=${flag} → slot=${slot} pasek=${bar}`);

await page.screenshot({ path: `${OUT}/${name}.png` });

// Zbliżenie na samą listwę — detale ikon/próbek nikną w zrzucie całego ekranu.
const strip = page.locator('[data-testid="idea-canvas-second-bar"]').first();
if (await strip.count()) {
  const box = await strip.boundingBox();
  if (box) {
    await page.screenshot({
      path: `${OUT}/${name}-listwa.png`,
      clip: { x: 0, y: Math.max(0, box.y - 4), width: 1440, height: box.height + 8 },
    });
  }
}

// Otwórz wskazany popover (np. kolor tła), żeby udowodnić, że rozwija się w linii.
const pop = process.env.OPEN_POPOVER;
if (pop) {
  const btn = page.locator(`[data-testid="object-edit-bar-${pop}"]`);
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${OUT}/${name}-popover-${pop}.png`,
      clip: { x: 0, y: 40, width: 900, height: 300 },
    });
  }
}

await browser.close();
