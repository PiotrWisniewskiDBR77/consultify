/**
 * Z-41 (14.09) — zrzuty odbiorowe S5 PMO E3 (/projects, lista + podgląd
 * bramek etapów) — REALNY <MyProjects/> montowany dev-renderem (bez logowania,
 * atrapa fetch), zgodnie z CLAUDE.md #7 (nadzorca sam zrzuca i ogląda PRZED
 * właścicielem).
 *
 * Uruchom harness dev-render (osobny terminal / w tle):
 *   npx vite --config dev-render/vite.config.ts --port 3041 --strictPort
 * potem:
 *   node scripts/dev/z41-pmo-projekty-zrzuty.mjs
 *
 * Mierzy jasność tła (luma) każdego zrzutu — para jasny/ciemny ma być
 * DWOMA różnymi obrazami (pamięć „Duplikat zamiast motywu"), nie tym samym
 * plikiem pod dwiema nazwami.
 */
import { mkdirSync } from 'node:fs';

import { chromium } from 'playwright';
import sharp from 'sharp';

const OUT = process.env.Z41_OUT || `${process.env.HOME}/Developer/cto-codex/zrzuty-s5-pmo-20260914/en`;
const BASE = process.env.Z41_BASE_URL || 'http://127.0.0.1:3041';

mkdirSync(OUT, { recursive: true });

async function meanLuma(path) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  const channels = info.channels;
  const pixelCount = data.length / channels;
  for (let i = 0; i < data.length; i += channels) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / pixelCount;
}

const browser = await chromium.launch();
const errors = [];
const measured = [];

async function shot(name, { screen, lang = 'en', theme = 'light', afterGoto, expectSelector }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
  page.on('console', (m) => {
    // W harnessie bez backendu MyWorkView/NotificationDropdown itd. odpytują
    // prawdziwe endpointy, które tu zwracają 404 — to szum sieci, nie crash
    // aplikacji. Łapiemy TYLKO błędy renderu Reacta (ErrorBoundary/Uncaught).
    const text = m.text();
    if (m.type() === 'error' && /ErrorBoundary|Uncaught|Cannot read propert/i.test(text)) {
      errors.push(`${name}: ${text}`);
    }
  });
  const url = `${BASE}/?screen=${screen}&lang=${lang}&theme=${theme}&uwagi=0`;
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  if (expectSelector) await page.waitForSelector(expectSelector, { timeout: 20000 });
  await page.waitForTimeout(800);
  if (afterGoto) await afterGoto(page);
  await page.waitForTimeout(400);

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== isDark) errors.push(`${name}: motyw nie wszedl (dark class=${isDark})`);

  const filePath = `${OUT}/${name}.png`;
  await page.screenshot({ path: filePath, fullPage: false });
  const luma = await meanLuma(filePath);
  measured.push({ name, theme, luma: luma.toFixed(1) });
  await page.close();
  return filePath;
}

// (1) EN jasny — lista + podgląd z bramkami
await shot('01-en-jasny-lista-podglad', {
  screen: 'z41-pmo-projekty',
  lang: 'en',
  theme: 'light',
  expectSelector: 'table tbody tr',
  afterGoto: async (page) => {
    await page.click('table tbody tr');
    await page.waitForTimeout(600);
    // Rozwiń panel podglądu do bramek etapów (scroll wewnętrznego kontenera).
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(
        (el) => el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200
      );
      if (candidates[0]) candidates[0].scrollTop = candidates[0].scrollHeight;
    });
  },
});

// (2) EN ciemny
await shot('02-en-ciemny-lista-podglad', {
  screen: 'z41-pmo-projekty',
  lang: 'en',
  theme: 'dark',
  expectSelector: 'table tbody tr',
  afterGoto: async (page) => {
    await page.click('table tbody tr');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(
        (el) => el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200
      );
      if (candidates[0]) candidates[0].scrollTop = candidates[0].scrollHeight;
    });
  },
});

// (3) PL jasny
await shot('03-pl-jasny-lista-podglad', {
  screen: 'z41-pmo-projekty',
  lang: 'pl',
  theme: 'light',
  expectSelector: 'table tbody tr',
  afterGoto: async (page) => {
    await page.click('table tbody tr');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(
        (el) => el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200
      );
      if (candidates[0]) candidates[0].scrollTop = candidates[0].scrollHeight;
    });
  },
});

// (4) EN — kreator "New project" otwarty
await shot('04-en-nowy-projekt-kreator', {
  screen: 'z41-pmo-projekty',
  lang: 'en',
  theme: 'light',
  expectSelector: 'table tbody tr',
  afterGoto: async (page) => {
    await page.getByRole('button', { name: /New project/i }).click();
    await page.waitForTimeout(500);
  },
});

// (5) OFF: /projects → /my-work (VITE_PMO_PROJECTS domyślnie wyłączona)
await shot('05-off-projects-redirect-mywork', {
  screen: 'z41-pmo-projekty-off',
  lang: 'en',
  theme: 'light',
  afterGoto: async (page) => {
    // Świeża sesja demo pokazuje modal powitalny "Meet Teresa" — to NIE jest
    // część /projects, zamykamy go, żeby zrzut czytelnie pokazał lądowanie
    // My Work (dowód przekierowania), a nie onboarding.
    const skip = page.getByText('Skip for now');
    if (await skip.count()) {
      await skip.first().click();
      await page.waitForTimeout(300);
    }
  },
});

await browser.close();
console.table(measured);
if (errors.length) {
  console.error('BŁĘDY:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK — 5 zrzutów w ${OUT}`);
