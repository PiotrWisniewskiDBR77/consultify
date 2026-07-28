/**
 * SONDA ZAPISU: czy styl wybrany w pasku doleciał do „serwera" (mock harnessu).
 *
 * Potrzebna, bo harness Process Flow ŚWIADOMIE resetuje `mapState` przy
 * przeładowaniu strony („harness ma startować z czystej sceny",
 * dev-render/screens/processflow-canvas.tsx) — samo przeładowanie NIE
 * rozstrzyga tam persystencji i dałoby fałszywy alarm. Rozstrzyga to, co
 * zobaczył zapis: `window.__PF_MOCK_MAP__()` / `window.__MM_DEBUG_MAP__()`.
 */
import { chromium } from 'playwright';

const [, , screen = 'processflow-canvas', probeName = '__PF_MOCK_MAP__'] = process.argv;
const url = `http://localhost:3340/?screen=${screen}&ff_canvasObjectEditBar=1`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const idx = Number(process.env.NODE_INDEX || 1);
await page.locator('.react-flow__node').nth(idx).click({ force: true });
await page.waitForTimeout(900);

for (const [control, swatch] of [
  ['bg-color', 4],
  ['border-color', 15],
]) {
  await page.locator(`[data-testid="object-edit-bar-${control}"]`).click();
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"] button').nth(swatch).click();
  await page.waitForTimeout(500);
  await page.locator('.react-flow__node').nth(idx).click({ force: true });
  await page.waitForTimeout(600);
}

// Daj autosave'owi (debounce) dojechać.
await page.waitForTimeout(3000);

const saved = await page.evaluate((name) => {
  const fn = window[name];
  if (typeof fn !== 'function') return { error: `brak sondy ${name}` };
  const state = fn();
  const nodes = state?.nodes || state?.map?.nodes || [];
  const hits = nodes
    .filter((n) => n?.data?.bgColor || n?.data?.borderColor)
    .map((n) => ({ id: n.id, bgColor: n.data.bgColor, borderColor: n.data.borderColor }));
  return { version: state?.version, liczbaWezlow: nodes.length, zeStylem: hits };
}, probeName);

console.log(`  ${screen} → ${JSON.stringify(saved)}`);
await browser.close();
