// Jednorazowy skrypt dowodowy dla ZLECENIE mvp/galeria-odbioru.
// Renderuje 20 realnych ekranów (patrz docs/program/PROGRAM_NAPRAWCZY_20260905/SCEPTYK_ODBIORU_20260906.md §4)
// na aktualnym kodzie, 1440x900, motyw jasny, loguje przez wstrzyknięcie localStorage
// z /private/tmp/stanowisko-noc/auth.json (tylko odczyt), zapisuje PNG + JSON (url, bledyKonsoli)
// do evidence/galeria-odbioru/. Do usunięcia po odbiorze (nie jest testem).
import { chromium } from 'playwright';
import fs from 'node:fs';

const authPath = '/private/tmp/stanowisko-noc/auth.json';
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const origin = auth.origins.find((o) => o.origin === 'http://localhost:3090');
const ls = Object.fromEntries(origin.localStorage.map((i) => [i.name, i.value]));

// Wymuszenie motywu jasnego (fixture ma "dark") — wymóg zlecenia.
try {
  const storage = JSON.parse(ls['consultify-storage']);
  storage.state.theme = 'light';
  ls['consultify-storage'] = JSON.stringify(storage);
} catch (e) {
  console.error('Nie udało się nadpisać motywu', e);
}

const outDir = '/private/tmp/wt-galeria/evidence/galeria-odbioru';
fs.mkdirSync(outDir, { recursive: true });

const BASE = 'http://localhost:3090';

const items = [
  {
    num: '01',
    slug: 'interview-skrzynka',
    url: `${BASE}/interview`,
  },
  {
    num: '02',
    slug: 'ocena-biblioteka',
    url: `${BASE}/assessment/overview?tab=library`,
  },
  {
    num: '03',
    slug: 'audyty-biblioteka',
    url: `${BASE}/audit-programs?tab=library`,
  },
  {
    num: '04',
    slug: 'audyty-wnioski',
    url: `${BASE}/audit-programs?tab=conclusions`,
  },
  {
    num: '05',
    slug: 'inicjatywy-lista',
    url: `${BASE}/initiatives`,
  },
  {
    num: '06',
    slug: 'inicjatywy-klik-podglad',
    url: `${BASE}/initiatives`,
    action: async (page) => {
      await page.waitForSelector('text=Supply Chain Optimization', { timeout: 15000 });
      await page.click('text=Supply Chain Optimization');
      await page.waitForTimeout(1200);
    },
  },
  {
    num: '07',
    slug: 'inicjatywy-karta',
    url: `${BASE}/initiatives?mode=doc&open=fa87dc75-d838-4fa0-8263-590969aa8621`,
  },
  {
    num: '08',
    slug: 'inicjatywy-plan',
    url: `${BASE}/initiatives?tab=plan`,
  },
  {
    num: '09',
    slug: 'drd-kolor-czcionka',
    url: `${BASE}/assessment/drd/2d1fc7a8-8145-48f1-aaf5-24fd86f1dfd7`,
  },
  {
    num: '10',
    slug: 'drd-zapytaj-terese',
    url: `${BASE}/assessment/drd/2d1fc7a8-8145-48f1-aaf5-24fd86f1dfd7`,
    action: async (page) => {
      await page.waitForSelector('text=Zapytaj Teresę', { timeout: 15000 });
      await page.click('text=Zapytaj Teresę');
      await page.waitForTimeout(1200);
    },
  },
  {
    num: '11',
    slug: 'drd-naglowek',
    url: `${BASE}/assessment/drd/2d1fc7a8-8145-48f1-aaf5-24fd86f1dfd7`,
  },
  {
    num: '12',
    slug: 'narzedzia-insighty',
    url: `${BASE}/discovery-tools?tab=outputs`,
  },
  {
    num: '13',
    slug: 'wyniki-menu2',
    url: `${BASE}/results/kpi`,
  },
  {
    num: '14',
    slug: 'wyniki-miernik-narzedzie',
    url: `${BASE}/results/kpi/869659bb-19f7-5b72-92f3-2eadb2631b99?zbior=0a9a0f97-c029-5687-98a3-b94c7a8c6ec7`,
  },
  {
    num: '15',
    slug: 'materialy-filtry',
    url: `${BASE}/presentations?tab=all`,
  },
  {
    num: '16',
    slug: 'materialy-biblioteka-wzorcow',
    url: `${BASE}/presentations?tab=templates`,
  },
  {
    num: '17',
    slug: 'inicjatywy-statusy-pl',
    url: `${BASE}/initiatives`,
    action: async (page) => {
      const btn = page.locator('button', { hasText: 'Status: Wszystkie' }).first();
      await btn.waitFor({ timeout: 15000 });
      await btn.click();
      await page.waitForTimeout(800);
    },
  },
  {
    num: '18',
    slug: 'spotkania-fala2',
    url: `${BASE}/meetings`,
  },
  {
    num: '19',
    slug: 'realizacja-kokpit',
    url: `${BASE}/execution?tab=summary&view=table&kokpit=ryzyka`,
  },
  {
    num: '20',
    slug: 'realizacja-decyzje',
    url: `${BASE}/execution?tab=control&view=table`,
  },
];

const browser = await chromium.launch();
const results = [];

for (const item of items) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ colorScheme: 'light' });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) {
      consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((data) => {
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, ls);

  try {
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    consoleErrors.push(`NAVIGATION TIMEOUT: ${e.message}`);
  }
  await page.waitForTimeout(1800);

  if (item.action) {
    try {
      await item.action(page);
    } catch (e) {
      consoleErrors.push(`ACTION FAILED: ${e.message}`);
    }
  }

  const fileBase = `${item.num}-${item.slug}`;
  const pngPath = `${outDir}/${fileBase}.png`;
  await page.screenshot({ path: pngPath, fullPage: false });

  const finalUrl = page.url();
  fs.writeFileSync(
    `${outDir}/${fileBase}.png.json`,
    JSON.stringify({ url: finalUrl, bledyKonsoli: consoleErrors }, null, 2)
  );

  console.log(`[${item.num}] ${finalUrl} — błędów: ${consoleErrors.length}`);
  results.push({ num: item.num, slug: item.slug, url: finalUrl, errCount: consoleErrors.length });

  await page.close();
}

await browser.close();
console.log('GOTOWE', JSON.stringify(results, null, 2));
