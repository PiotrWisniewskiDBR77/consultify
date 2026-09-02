import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';
import sharp from 'sharp';

const phaseArg = process.argv.find((arg) => arg.startsWith('--faza='));
const phase = phaseArg?.split('=')[1];
if (phase !== 'przed' && phase !== 'po') {
  throw new Error('Użycie: node scripts/dev/day275-ocena-zrzuty.mjs --faza=przed|po');
}

const base = process.env.DAY275_BASE_URL || `http://127.0.0.1:${phase === 'przed' ? 5272 : 5273}`;
const outputDir =
  phase === 'po'
    ? path.resolve('docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day275-ocena-macierz-i-raport')
    : '/private/tmp/cx-day275-ocena-macierz-i-raport-artefakty/zrzuty-przed';
fs.mkdirSync(outputDir, { recursive: true });

const screens = [
  {
    key: 'presentation',
    screen: 'assessment-presentation-view',
    target: '[data-testid="presentation-deck"]',
  },
  {
    key: 'quality',
    screen: 'assessment-quality-review-panel',
    target: '[data-testid="assessment-quality-review-panel"]',
  },
  { key: 'report', screen: 'assessment-output-report', target: 'article' },
];

const matrixSelector = 'div[style*="grid-template-columns"]';
const harnessText = /PanelUwag|Lista ekranów|Przełącz motyw|DEV RENDER/i;

async function capture(page, spec, theme) {
  const url = `${base}/?screen=${spec.screen}&variant=${spec.key === 'presentation' ? 'full&narrative=1' : spec.key === 'report' ? 'happy' : 'mixed'}&lang=pl&theme=${theme}&uwagi=0&ff_assessmentOutputArtifacts=1`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const target = page.locator(spec.target).first();
  await target.waitFor({ state: 'visible' });

  if (spec.key === 'presentation') {
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
    await page.getByText(/Macierz · oś 1/).waitFor();
    if ((await target.locator(matrixSelector).count()) === 0)
      throw new Error('Slajd bez gridu macierzy');
  }
  if (spec.key === 'quality') {
    if ((await target.locator('[data-testid^="standard-table"]').count()) === 0) {
      // StandardTable has no root testid in the populated state; its persisted table shell has a table.
      if ((await target.locator('table').count()) === 0)
        throw new Error('Panel jakości bez tabeli');
    }
    if (phase === 'po' && (await target.locator(matrixSelector).count()) === 0) {
      throw new Error('Panel jakości PO bez gridu macierzy obok tabeli');
    }
    // Pełnostronicowy kadr produktu: panel ma własny scroll i przy stałych 900 px
    // tabela wypadłaby poza obraz. Rozwijamy wyłącznie kontener do zrzutu.
    await target.evaluate((node) => {
      node.style.height = 'auto';
      node.style.overflow = 'visible';
      if (node.parentElement) node.parentElement.style.height = 'auto';
    });
  }
  if (spec.key === 'report') {
    const ids = await target
      .locator('#wstep, #osie, #odpowiedzi, #podsumowanie')
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    if (ids.join(',') !== 'wstep,osie,odpowiedzi,podsumowanie') {
      throw new Error(`Zła kolejność rozdziałów: ${ids.join(',')}`);
    }
    if ((await target.locator('#osie').locator(matrixSelector).count()) === 0) {
      throw new Error('Raport bez gridu macierzy w rozdziale 2');
    }
  }

  const bodyText = await page.locator('body').innerText();
  if (harnessText.test(bodyText))
    throw new Error(`Kadr ${spec.key}/${theme} zawiera kontrolkę harnessu`);

  const file = path.join(outputDir, `${spec.key}-${theme}.png`);
  await target.screenshot({ path: file });
  return file;
}

async function comparePair(lightFile, darkFile) {
  const light = await sharp(lightFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dark = await sharp(darkFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (light.info.width !== dark.info.width || light.info.height !== dark.info.height) {
    throw new Error(`Z40: różne wymiary pary ${path.basename(lightFile)}`);
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
      Math.abs(light.data[i] - dark.data[i]) > 8 ||
      Math.abs(light.data[i + 1] - dark.data[i + 1]) > 8 ||
      Math.abs(light.data[i + 2] - dark.data[i + 2]) > 8
    )
      different += 1;
  }
  const meanDelta = Math.abs(lightLuma / pixels - darkLuma / pixels);
  const differentPercent = (different / pixels) * 100;
  if (meanDelta < 40 || differentPercent <= 60) {
    throw new Error(
      `Z40 FAIL: delta=${meanDelta.toFixed(2)}, różne=${differentPercent.toFixed(2)}%`
    );
  }
  return { meanDelta, differentPercent };
}

const browser = await chromium.launch();
try {
  const files = new Map();
  for (const spec of screens) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 1,
      });
      files.set(`${spec.key}-${theme}`, await capture(page, spec, theme));
      await page.close();
    }
  }
  for (const spec of screens) {
    const result = await comparePair(files.get(`${spec.key}-light`), files.get(`${spec.key}-dark`));
    console.log(
      `Z40 ${spec.key}: mean_luma_delta=${result.meanDelta.toFixed(2)} different_pixels=${result.differentPercent.toFixed(2)}%`
    );
  }
  console.log(`Zapisano 6 zrzutów ${phase}: ${outputDir}`);
} finally {
  await browser.close();
}
