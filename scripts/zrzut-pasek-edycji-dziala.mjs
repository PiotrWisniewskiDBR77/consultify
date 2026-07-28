/**
 * DOWÓD DZIAŁANIA paska edycji: zaznacz węzeł → zmień tło, ramkę, wielkość
 * pisma i pogrubienie → zrzut PO → PRZEŁADUJ → zrzut po przeładowaniu.
 * „Testy przeszły" ≠ „działa" — rozstrzyga obrazek i porównanie PRZED/PO.
 *
 *   node scripts/zrzut-pasek-edycji-dziala.mjs <screen> <nazwa> [theme]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , screen = 'mindmap-canvas', name = 'dziala', theme = 'light'] = process.argv;
const OUT = '/private/tmp/z-edycja-zrzuty';
fs.mkdirSync(OUT, { recursive: true });
const url = `http://localhost:3340/?screen=${screen}&theme=${theme}&ff_canvasObjectEditBar=1`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)));

const NODE_INDEX = Number(process.env.NODE_INDEX || 1);
const clip = { x: 300, y: 90, width: 800, height: 560 };

async function selectNode() {
  const node = page.locator('.react-flow__node').nth(NODE_INDEX);
  await node.click({ force: true });
  await page.waitForTimeout(900);
  return node;
}

async function pick(controlId, swatchIndex) {
  const btn = page.locator(`[data-testid="object-edit-bar-${controlId}"]`);
  if (!(await btn.count())) return `BRAK kontrolki ${controlId}`;
  await btn.click();
  await page.waitForTimeout(350);
  const sw = page.locator('[role="dialog"] button').nth(swatchIndex);
  if (!(await sw.count())) return `BRAK opcji ${swatchIndex} w ${controlId}`;
  await sw.click();
  await page.waitForTimeout(500);
  return 'ok';
}

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await selectNode();
await page.screenshot({ path: `${OUT}/${name}-1-przed.png`, clip });

console.log('  tło        :', await pick('bg-color', 4));
await selectNode();
console.log('  ramka      :', await pick('border-color', 15));
await selectNode();
console.log('  wielkość   :', await pick('font-size', 6));
await selectNode();
const bold = page.locator('[data-testid="object-edit-bar-bold"]');
if (await bold.count()) {
  await bold.click();
  await page.waitForTimeout(400);
  console.log('  pogrubienie: ok');
}
await selectNode();
console.log('  kształt    :', await pick('shape', 3));

await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/${name}-2-po.png`, clip });

// Odznacz — pasek ma zniknąć, listwa wrócić do normalnych akcji.
await page.mouse.click(1150, 760);
await page.waitForTimeout(800);
console.log(
  '  po odznaczeniu pasek =',
  await page.locator('[data-testid="object-edit-bar"]').count()
);
await page.screenshot({
  path: `${OUT}/${name}-3-odznaczone.png`,
  clip: { x: 0, y: 50, width: 1440, height: 60 },
});

// PRZEŁADUJ — czy zmiany przeżyły zapis?
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/${name}-4-po-przeladowaniu.png`, clip });

await browser.close();
