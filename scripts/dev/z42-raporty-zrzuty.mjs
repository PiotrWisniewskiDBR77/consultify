// Z-42 (14.09) — zrzuty zakładki „Raporty" (E4) W POWŁOCE modułu Realizacja
// (Menu 1/2/3), do pokazania właścicielowi (CLAUDE.md §7).
//
// Wzorzec 1:1 z `scripts/dev/z27-skrzynka-zrzuty.mjs` — dev-render harness
// (ekran `z42-realizacja-raporty`) montuje REALNY <ExecutionHub>. Motyw
// sterowany przez `&theme=` w URL: harness (dev-render/main.tsx) sam ustawia
// `.dark` na <html> ORAZ zapisuje motyw do zustand (`useAppStore.setState`).
// NIE emulujemy `prefers-color-scheme` — ThemeSync nadpisałby klasę i „jasny"
// zrzut wyszedłby ciemny (pułapka zapisana po 12 zrzutach 10.09).
//
// Flaga wymagana w budowie (import.meta.env, nie da się przełączyć z URL):
//   VITE_EXECUTION_REPORT_E4=true
//
// Użycie:
//   VITE_EXECUTION_REPORT_E4=true npx vite --config dev-render/vite.config.ts --port 5442 --strictPort
//   node scripts/dev/z42-raporty-zrzuty.mjs --port 5442
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '5442');
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-q2-raporty-20260914');
fs.mkdirSync(OUT, { recursive: true });

const url = (lang, theme, extra = '') =>
  `${BASE}/?screen=z42-realizacja-raporty&tab=reports&lang=${lang}&theme=${theme}${extra}`;

const browser = await chromium.launch();

async function zrzut(nazwa, lang, theme, extra) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  await page.goto(url(lang, theme, extra), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1800);
  const plik = path.join(OUT, `${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  // Bezpiecznik motywu: „jasny" zrzut z ciemnym <html class="dark"> to ten sam
  // obraz pod dwiema nazwami (pułapka „duplikat zamiast motywu").
  const htmlDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  // Ile pigułek Menu 3 realnie się renderuje (kanon TRIADA: ≤3). Czytamy
  // KONTENER (`aria-label="Table presets"` w StandardModuleBar), nie listę
  // spodziewanych etykiet — inaczej probe pokazywałby pustkę zamiast błędu.
  const menu3 = await page.evaluate(() => {
    // `aria-label` jest TŁUMACZONY („Table presets"/„Presety tabeli"), więc
    // selektor po etykiecie działałby tylko po angielsku. Wchodzimy przez
    // pierwszy chip (`aria-pressed`) i czytamy jego rodzeństwo.
    const first = document.querySelector('button[aria-pressed]');
    const box = first?.parentElement;
    if (!box) return null;
    return Array.from(box.querySelectorAll(':scope > button')).map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim()
    );
  });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), lang, theme, htmlDark, menu3, bledyKonsoli }, null, 2)
  );
  console.log(
    nazwa,
    '→ htmlDark:',
    htmlDark,
    '| Menu3:',
    JSON.stringify(menu3),
    '| błędy:',
    bledyKonsoli.length
  );
  await page.close();
}

// Brakujący wariant odbioru (EN light/dark + PL dark były w paczce).
await zrzut('01-raporty-pl-light', 'pl', 'light');
// DOWÓD HOLD 2b — pusta zakładka MUSI nieść przycisk „New report".
await zrzut('02-raporty-pusty-en-light', 'en', 'light', '&empty=1');
// Odświeżenie trójki z paczki: zrzuty z 14.09 rano powstały PRZED naprawą
// HOLD 1/2, więc pokazują cztery pigułki Menu 3 i akcje podglądu bez klas
// wariantu. Zostawione bez zmian byłyby dowodem na nieistniejący stan.
await zrzut('03-raporty-en-light', 'en', 'light');
await zrzut('04-raporty-en-dark', 'en', 'dark');
await zrzut('05-raporty-pl-dark', 'pl', 'dark');

await browser.close();
