// P-T15 (14.09) — zrzuty PRZED/PO usuwania załączników w powłoce Wywiadu.
//
// Harness `pt15-wywiad-zalaczniki` montuje REALNY <InterviewWorkspace>
// (runtime single_question). Motyw idzie przez `&theme=` (zustand, nie
// prefers-color-scheme).
//
// Użycie:
//   node scripts/dev/pt15-zalaczniki-zrzuty.mjs --port 4281 --faza PO
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '4281');
const FAZA = arg('faza', 'PO');
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-pt15-wywiad-20260914');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// Pomiar, nie oko: ile koszy jest KLIKALNYCH (nie: ile ich jest w DOM).
const policzKosze = (page) =>
  page.evaluate(() => {
    const wszystkie = Array.from(document.querySelectorAll('button[aria-label]')).filter((b) =>
      /remove|usu/i.test(b.getAttribute('aria-label') || '')
    );
    return {
      wDom: wszystkie.length,
      klikalne: wszystkie.filter((b) => !b.hasAttribute('disabled')).length,
    };
  });

async function scena(nazwa, lang, theme, akcja) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const bledy = [];
  page.on('pageerror', (e) => bledy.push(String(e).slice(0, 300)));
  await page.goto(`${BASE}/?screen=pt15-wywiad-zalaczniki&lang=${lang}&theme=${theme}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  if (akcja) await akcja(page);
  const pomiar = await policzKosze(page);
  const chipy = await page.evaluate(() =>
    Array.from(document.querySelectorAll('span'))
      .map((s) => s.textContent || '')
      .filter((tekst) => /\.pdf|\.png/.test(tekst))
      .slice(0, 5)
  );
  const plik = path.join(OUT, `${FAZA}-${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), faza: FAZA, lang, theme, pomiar, chipy, bledy }, null, 2)
  );
  console.log(FAZA, nazwa, '| kosze w DOM:', pomiar.wDom, 'klikalne:', pomiar.klikalne, '| chipy:', chipy);
  await page.close();
}

const najedz = async (page) => {
  const chip = page.locator('text=kontrakt-OEM-2027.pdf').first();
  await chip.hover();
  await page.waitForTimeout(400);
};

for (const theme of ['light', 'dark']) {
  await scena(`01-zalaczniki-${theme}`, 'en', theme, najedz);
}
if (FAZA === 'PO') {
  await scena('02-potwierdzenie-light', 'en', 'light', async (page) => {
    await najedz(page);
    await page.locator('button[aria-label="Remove"]').first().click();
    await page.waitForTimeout(500);
  });
  await scena('03-po-usunieciu-light', 'en', 'light', async (page) => {
    await najedz(page);
    await page.locator('button[aria-label="Remove"]').first().click();
    await page.waitForTimeout(400);
    // Kosz ma aria-label „Remove" i ZERO tekstu; przycisk potwierdzenia ma
    // tekst — dlatego selektor po tekście, nie po nazwie dostępnościowej.
    await page.locator('button:text-is("Remove")').first().click();
    await page.waitForTimeout(1200);
  });
  await scena('04-potwierdzenie-pl-light', 'pl', 'light', async (page) => {
    await najedz(page);
    await page.locator('button[aria-label="Usuń"]').first().click();
    await page.waitForTimeout(500);
  });
}

await browser.close();
