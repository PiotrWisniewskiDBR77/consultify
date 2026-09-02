import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';
import sharp from 'sharp';

const phaseArg = process.argv.find((arg) => arg.startsWith('--faza='));
const phase = phaseArg?.split('=')[1];
if (!['przed', 'po'].includes(phase)) {
  throw new Error('Użycie: node scripts/dev/day274-inicjatywy-zrzuty.mjs --faza=przed|po');
}

const baseUrl = process.env.DAY274_BASE_URL || 'http://127.0.0.1:5270/index.html';
const outDir =
  phase === 'po'
    ? path.resolve('docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day274-inicjatywy-jedna-tabela')
    : '/private/tmp/cx-day274-inicjatywy-jedna-tabela-artefakty/zrzuty-przed';

const screens = [
  { id: 'modul', screen: 'inicjatywy-lista' },
  { id: 'ocena', screen: 'assessment-five-surfaces', extra: '&tab=initiatives' },
];

const paths = new Map();
const headers = new Map();
const menuItems = new Map();

async function assertNoHarness(page) {
  const state = await page.evaluate(() => ({
    commentPanelLinks: document.querySelectorAll('a[href="/odbior.html"]').length,
    commentPanelButtons: [...document.querySelectorAll('button')].filter((node) =>
      /^Uwagi(?:\s|$)/.test(node.textContent?.trim() || '')
    ).length,
    devBars: document.querySelectorAll('[data-dev-toolbar], [data-testid="dev-toolbar"]').length,
  }));
  if (Object.values(state).some((count) => count !== 0)) {
    throw new Error(`Z40: przyrząd harnessu jest widoczny: ${JSON.stringify(state)}`);
  }
}

async function imageMetrics(lightPath, darkPath) {
  const light = await sharp(lightPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dark = await sharp(darkPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (light.info.width !== dark.info.width || light.info.height !== dark.info.height) {
    throw new Error('Z40: para light/dark ma różne wymiary');
  }
  const pixels = light.info.width * light.info.height;
  let lightLuma = 0;
  let darkLuma = 0;
  let different = 0;
  for (let offset = 0; offset < light.data.length; offset += 3) {
    const ll =
      0.2126 * light.data[offset] +
      0.7152 * light.data[offset + 1] +
      0.0722 * light.data[offset + 2];
    const dl =
      0.2126 * dark.data[offset] + 0.7152 * dark.data[offset + 1] + 0.0722 * dark.data[offset + 2];
    lightLuma += ll;
    darkLuma += dl;
    if (
      Math.abs(light.data[offset] - dark.data[offset]) > 8 ||
      Math.abs(light.data[offset + 1] - dark.data[offset + 1]) > 8 ||
      Math.abs(light.data[offset + 2] - dark.data[offset + 2]) > 8
    ) {
      different += 1;
    }
  }
  const meanDifference = Math.abs(lightLuma / pixels - darkLuma / pixels);
  const differentRatio = different / pixels;
  if (meanDifference < 40 || differentRatio <= 0.6) {
    throw new Error(
      `Z40: fałszywa para light/dark (mean=${meanDifference.toFixed(2)}, diff=${(
        differentRatio * 100
      ).toFixed(2)}%)`
    );
  }
  return { meanDifference, differentRatio };
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const candidate of screens) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const url = `${baseUrl}?screen=${candidate.screen}${candidate.extra || ''}&theme=${theme}&lang=pl&uwagi=0`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForSelector('table thead th', { timeout: 30_000 });
        await page.waitForTimeout(800);
        await assertNoHarness(page);
        const headerTexts = await page.locator('table thead th').allTextContents();
        headers.set(
          `${candidate.id}-${theme}`,
          headerTexts.map((text) => text.trim())
        );

        if (phase === 'po' && candidate.id === 'ocena') {
          const framed = await page
            .locator('table')
            .first()
            .evaluate((table) => {
              let node = table.parentElement;
              while (node) {
                const classes = node.classList;
                if (
                  classes.contains('rounded-xl') &&
                  classes.contains('border') &&
                  classes.contains('overflow-hidden') &&
                  classes.contains('bg-white')
                ) {
                  return true;
                }
                node = node.parentElement;
              }
              return false;
            });
          if (framed) throw new Error('A.3: tabela Oceny nadal jest w ramce-karcie');
        }

        const target = path.join(outDir, `${phase}-${candidate.id}-${theme}.png`);
        await page.screenshot({ path: target });
        paths.set(`${candidate.id}-${theme}`, target);

        if (phase === 'po') {
          const menuButton = page
            .getByRole('button', { name: /Row actions|Akcje wiersza/i })
            .first();
          await menuButton.click();
          await page.waitForSelector('[data-row-actions-menu="kebab"]');
          await page.waitForTimeout(200);
          menuItems.set(
            `${candidate.id}-${theme}`,
            (
              await page
                .locator('[data-row-actions-menu="kebab"] [role="menuitem"]')
                .allTextContents()
            ).map((text) => text.replace(/\s+/g, ' ').trim())
          );
          const menuTarget = path.join(outDir, `${phase}-${candidate.id}-kebab-${theme}.png`);
          await page.screenshot({ path: menuTarget });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  for (const candidate of screens) {
    const metrics = await imageMetrics(
      paths.get(`${candidate.id}-light`),
      paths.get(`${candidate.id}-dark`)
    );
    console.log(
      `${candidate.id}: mean_luma_delta=${metrics.meanDifference.toFixed(2)}; different_pixels=${(
        metrics.differentRatio * 100
      ).toFixed(2)}%`
    );
  }
  if (phase === 'po') {
    for (const theme of ['light', 'dark']) {
      const moduleHeaders = JSON.stringify(headers.get(`modul-${theme}`));
      const assessmentHeaders = JSON.stringify(headers.get(`ocena-${theme}`));
      if (moduleHeaders !== assessmentHeaders) {
        throw new Error(
          `A.5: różne nagłówki ${theme}: moduł=${moduleHeaders}; ocena=${assessmentHeaders}`
        );
      }
      const moduleMenu = JSON.stringify(menuItems.get(`modul-${theme}`));
      const assessmentMenu = JSON.stringify(menuItems.get(`ocena-${theme}`));
      if (moduleMenu !== assessmentMenu) {
        throw new Error(`A.5: różne kebaby ${theme}: moduł=${moduleMenu}; ocena=${assessmentMenu}`);
      }
      console.log(`A.5 ${theme}: headers=${moduleHeaders}; menu=${moduleMenu}`);
    }
  }
  console.log(`Zapisano zrzuty ${phase}: ${outDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
