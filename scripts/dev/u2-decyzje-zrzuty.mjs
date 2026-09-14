// U2 (DEC-491 §2.7, 14.09) — zrzuty podglądu DECYZJI w powłoce Realizacji.
//
// Renderuje dev-render harness (ekran `u2-realizacja-decyzje`), montujący
// REALNY <ExecutionHub initialTab="control">. Motyw sterowany przez `&theme=`
// w URL — harness sam ustawia `.dark` na <html> ORAZ zapisuje motyw do zustand
// (`useAppStore.setState({theme})`); `page.emulateMedia` NIC by tu nie zmienił
// (pamięć „Motyw z zustand, nie z prefers-color-scheme").
//
// Użycie:
//   npx vite --config dev-render/vite.config.ts --port 4281 --strictPort
//   node scripts/dev/u2-decyzje-zrzuty.mjs --port 4281 --faza PO
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '4281');
const FAZA = arg('faza', 'PO'); // PRZED = stan linii, PO = po naprawie
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-u2-decisions-20260914');
fs.mkdirSync(OUT, { recursive: true });

const url = (lang, theme) =>
  `${BASE}/?screen=u2-realizacja-decyzje&lang=${lang}&theme=${theme}`;

const browser = await chromium.launch();

async function zrzut(nazwa, lang, theme, wiersz) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e).slice(0, 300)));
  await page.goto(url(lang, theme), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  if (wiersz) {
    await page.click(`text=${wiersz}`);
    await page.waitForTimeout(900);
  }
  // Pomiar, nie oko: czy ramka „Co dalej" jest w DOM podglądu.
  const pomiar = await page.evaluate(() => ({
    whatsNext: document.querySelectorAll('[data-preview-block="whatsnext"]').length,
    details: (
      document.querySelector('[data-preview-block="details"]')?.textContent ?? ''
    ).slice(0, 400),
  }));
  const plik = path.join(OUT, `${FAZA}-${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), faza: FAZA, lang, theme, pomiar, bledyKonsoli }, null, 2)
  );
  console.log(FAZA, nazwa, '→ whatsNext w DOM:', pomiar.whatsNext, '| błędy:', bledyKonsoli.length);
  await page.close();
}

const WIERSZ = 'Choose the canonical demand forecast source';
for (const theme of ['light', 'dark']) {
  await zrzut(`01-decyzje-lista-en-${theme}`, 'en', theme);
  await zrzut(`02-decyzje-podglad-en-${theme}`, 'en', theme, WIERSZ);
}
await zrzut('03-decyzje-podglad-pl-light', 'pl', 'light', WIERSZ);

await browser.close();
