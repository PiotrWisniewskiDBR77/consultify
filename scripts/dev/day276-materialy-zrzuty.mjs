import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const phaseArg = process.argv.find((arg) => arg.startsWith('--faza='));
const phase = phaseArg?.split('=')[1];
if (!['przed', 'po'].includes(phase)) throw new Error('Użycie: --faza=przed|po');

const base = process.env.DAY276_BASE_URL || 'http://127.0.0.1:5274';
const outDir = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day276-materialy-narzedzia-arkusza'
);
fs.mkdirSync(outDir, { recursive: true });

const screens = [
  {
    key: 'arkusz',
    screen: 'sheet-artifact',
    params: phase === 'przed' ? '&ff_artifactStudio=0' : '',
  },
  {
    key: 'arkusz-prawy-panel',
    screen: 'sheet-artifact',
    params: phase === 'przed' ? '&ff_artifactStudio=0' : '',
  },
  {
    key: 'prezentacja',
    screen: 'deck-artifact',
    params: phase === 'przed' ? '&ff_artifactStudio=0' : '',
  },
  { key: 'droga-startu', screen: 'excele-jeden-widok-recent', params: `&faza=${phase}` },
];

const browser = await chromium.launch();
const measurements = [];
for (const item of screens) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const url = `${base}/?screen=${item.screen}&lang=pl&theme=${theme}&uwagi=0${item.params}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1800);

    const harnessChrome = await page
      .locator('[data-dev-render-chrome]:visible, .dev-render-chrome:visible')
      .count();
    if (harnessChrome !== 0) throw new Error(`${item.key}/${theme}: widoczny chrom harnessu`);
    if (await page.getByText('Panel uwag', { exact: false }).count())
      throw new Error(`${item.key}/${theme}: PanelUwag w kadrze`);

    const result = { phase, screen: item.key, theme, url };
    if (item.key.startsWith('arkusz')) {
      if (phase === 'po') {
        const menu = page.getByLabel('Narzędzia arkusza');
        await menu.waitFor({ state: 'visible' });
      }
      const firstHeader = page.locator('table thead th').first();
      const box = await firstHeader.boundingBox();
      if (!box) throw new Error(`${item.key}/${theme}: brak nagłówka siatki`);
      result.firstHeaderTop = box.y;
      result.firstHeaderTopPct = Number(((box.y / 900) * 100).toFixed(2));
      if (phase === 'po' && box.y / 900 >= 1 / 3)
        throw new Error(`${item.key}/${theme}: siatka zaczyna się poniżej 1/3 kadru`);
      const canvasBox =
        phase === 'po'
          ? await page.getByTestId('spreadsheet-canvas').boundingBox()
          : await page.locator('table').first().boundingBox();
      result.canvasWidthPct = canvasBox ? Number(((canvasBox.width / 1440) * 100).toFixed(2)) : 0;
      if (phase === 'po' && (!canvasBox || canvasBox.width / 1440 < 0.5))
        throw new Error(`${item.key}/${theme}: kanwa nie zajmuje centrum`);
    }
    if (phase === 'po' && item.key === 'prezentacja') {
      await page.getByTestId('artifact-menu3').waitFor({ state: 'visible' });
      await page
        .getByRole('button', { name: 'Nowy slajd', exact: true })
        .waitFor({ state: 'visible' });
      await page
        .getByRole('button', { name: 'Pole tekstowe', exact: true })
        .waitFor({ state: 'visible' });
    }
    if (phase === 'po' && item.key === 'droga-startu') {
      await page
        .getByText('Jak chcesz zacząć arkusz?', { exact: true })
        .waitFor({ state: 'visible' });
      for (const label of ['Czysto', 'Z AI', 'Z szablonu'])
        await page.getByText(label, { exact: true }).waitFor({ state: 'visible' });
      if (await page.getByText('Ostatnie', { exact: true }).count())
        throw new Error('Droga startu nadal pokazuje Ostatnie');
    }

    const file = path.join(outDir, `${phase}-${item.key}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    measurements.push({ ...result, file });
    await context.close();
  }
}
await browser.close();

function compare(lightPath, darkPath) {
  const light = PNG.sync.read(fs.readFileSync(lightPath));
  const dark = PNG.sync.read(fs.readFileSync(darkPath));
  if (light.width !== dark.width || light.height !== dark.height)
    throw new Error('Różne rozmiary pary');
  let lightLuma = 0;
  let darkLuma = 0;
  let different = 0;
  const pixels = light.width * light.height;
  for (let i = 0; i < light.data.length; i += 4) {
    const ll = 0.2126 * light.data[i] + 0.7152 * light.data[i + 1] + 0.0722 * light.data[i + 2];
    const dl = 0.2126 * dark.data[i] + 0.7152 * dark.data[i + 1] + 0.0722 * dark.data[i + 2];
    lightLuma += ll;
    darkLuma += dl;
    if (
      light.data[i] !== dark.data[i] ||
      light.data[i + 1] !== dark.data[i + 1] ||
      light.data[i + 2] !== dark.data[i + 2]
    )
      different += 1;
  }
  const meanLumaDelta = Math.abs(lightLuma / pixels - darkLuma / pixels);
  const differentPct = (different / pixels) * 100;
  return {
    meanLumaDelta: Number(meanLumaDelta.toFixed(2)),
    differentPct: Number(differentPct.toFixed(2)),
    pass: meanLumaDelta >= 40 && differentPct > 60,
  };
}

const z40 = screens.map((item) => ({
  screen: item.key,
  ...compare(
    path.join(outDir, `${phase}-${item.key}-light.png`),
    path.join(outDir, `${phase}-${item.key}-dark.png`)
  ),
}));
const manifest = { phase, viewport: '1440x900', measurements, z40 };
fs.writeFileSync(
  `/private/tmp/cx-day276-materialy-narzedzia-arkusza-artefakty/zrzuty-${phase}.json`,
  JSON.stringify(manifest, null, 2)
);
console.log(JSON.stringify(manifest, null, 2));
if (z40.some((entry) => !entry.pass)) {
  console.error(
    'Z40 FAIL — co najmniej jedna para nie spełnia obu progów; zrzuty nie są zaakceptowane.'
  );
  process.exitCode = 1;
}
