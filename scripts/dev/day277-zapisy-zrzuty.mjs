import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';
import sharp from 'sharp';

const phase = process.argv.find((arg) => arg.startsWith('--faza='))?.split('=')[1];
if (!['przed', 'po'].includes(phase)) throw new Error('Użycie: --faza=przed|po');

const base = process.env.DAY277_BASE_URL || 'http://127.0.0.1:5276/index.html';
const outDir = path.resolve(
  phase === 'po'
    ? 'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day277-zapisy-do-serwera'
    : '/private/tmp/cx-day277-zapisy-do-serwera-artefakty/przed'
);
fs.mkdirSync(outDir, { recursive: true });

const screens = [
  { key: 'decision', screen: 'karta-decision' },
  { key: 'capacity', screen: 'capacity-advisor-a3' },
  { key: 'initiative', screen: 'karta-initiative' },
];

async function metrics(lightPath, darkPath) {
  const light = await sharp(lightPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dark = await sharp(darkPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (light.info.width !== dark.info.width || light.info.height !== dark.info.height) {
    throw new Error('Para light/dark ma różne wymiary');
  }
  let lightLuma = 0;
  let darkLuma = 0;
  let different = 0;
  const pixels = light.info.width * light.info.height;
  for (let i = 0; i < light.data.length; i += 3) {
    const ll = 0.2126 * light.data[i] + 0.7152 * light.data[i + 1] + 0.0722 * light.data[i + 2];
    const dl = 0.2126 * dark.data[i] + 0.7152 * dark.data[i + 1] + 0.0722 * dark.data[i + 2];
    lightLuma += ll;
    darkLuma += dl;
    if (
      Math.abs(light.data[i] - dark.data[i]) +
        Math.abs(light.data[i + 1] - dark.data[i + 1]) +
        Math.abs(light.data[i + 2] - dark.data[i + 2]) >
      30
    ) different += 1;
  }
  const lumaDelta = Math.abs(lightLuma / pixels - darkLuma / pixels);
  const differentPct = (different / pixels) * 100;
  if (lumaDelta < 40 || differentPct <= 60) {
    throw new Error(`Z40 FAIL: luma=${lumaDelta.toFixed(2)}, different=${differentPct.toFixed(2)}%`);
  }
  return { lumaDelta: lumaDelta.toFixed(2), differentPct: differentPct.toFixed(2) };
}

const browser = await chromium.launch();
try {
  for (const item of screens) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const url = `${base}?screen=${item.screen}&lang=pl&theme=${theme}&uwagi=0&phase=${phase === 'po' ? 'after' : 'before'}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(10000);
      const body = await page.locator('body').innerText();
      if (!body.trim() || body.includes('Ładowanie ekranu…') || body.includes('Error:')) {
        throw new Error(`Ekran ${item.screen} nie wyrenderował się: ${body.slice(0, 300)}`);
      }
      for (const forbidden of ['Panel uwag', '← Lista', 'Dev Render Harness']) {
        if (body.includes(forbidden)) throw new Error(`Z40 przyrząd w kadrze: ${forbidden}`);
      }
      if (phase === 'po' && item.key === 'decision' && body.includes('pamięci przeglądarki')) {
        throw new Error('Warunek 10 FAIL: komunikat local-only nadal widoczny');
      }
      if (phase === 'po' && item.key === 'initiative') {
        if (!body.includes('Wypełnij z AI') || !body.includes('Analizuj z AI')) {
          throw new Error('Warunek 17 FAIL: brak dwóch rozróżnialnych przycisków AI');
        }
      }
      if (phase === 'po' && item.key === 'capacity' && !body.includes('Utwórz raport')) {
        console.log('capacity-contract: RED — brak przycisku Utwórz raport; zapisuję dowód braku');
      }
      await page.screenshot({ path: path.join(outDir, `${item.key}-${theme}.png`) });
      await page.close();
    }
    const result = await metrics(
      path.join(outDir, `${item.key}-light.png`),
      path.join(outDir, `${item.key}-dark.png`)
    );
    console.log(`${item.key}: luma=${result.lumaDelta}; different=${result.differentPct}%`);
  }
} finally {
  await browser.close();
}
