// P-T06 (14.09) — zrzuty PRZED/PO suwaków „Widoczności widgetów".
//
// Harness `pt06-ustawienia-suwaki` montuje REALNY <AppearanceModule> z zakładką
// Dashboard. Motyw przez `&theme=` (zustand, nie prefers-color-scheme).
//
// Poza obrazem robimy POMIAR: realny kolor tła toru każdego pstryczka i jego
// kontrast do tła kafelka. „Widać / nie widać" ma być liczbą, nie wrażeniem.
//
//   node scripts/dev/pt06-suwaki-zrzuty.mjs --port 4281 --faza PO
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
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-pt06-suwaki-20260914');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function scena(nazwa, lang, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const bledy = [];
  page.on('pageerror', (e) => bledy.push(String(e).slice(0, 300)));
  await page.goto(`${BASE}/?screen=pt06-ustawienia-suwaki&lang=${lang}&theme=${theme}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(1800);

  const pomiar = await page.evaluate(() => {
    const luma = (rgb) => {
      const [r, g, b] = rgb;
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const kontrast = (a, b) => {
      const [x, y] = [luma(a), luma(b)].sort((p, q) => q - p);
      return Number(((x + 0.05) / (y + 0.05)).toFixed(2));
    };
    return Array.from(document.querySelectorAll('[role="switch"]')).map((el) => {
      const tor = parse(getComputedStyle(el).backgroundColor);
      const kafelek = parse(getComputedStyle(el.parentElement || document.body).backgroundColor);
      const galka = el.firstElementChild
        ? parse(getComputedStyle(el.firstElementChild).backgroundColor)
        : tor;
      return {
        etykieta: el.getAttribute('aria-label'),
        wlaczony: el.getAttribute('aria-checked') === 'true',
        tor: tor.join(','),
        kontrastDoKafelka: kontrast(tor, kafelek),
        kontrastDoGalki: kontrast(tor, galka),
      };
    });
  });

  const plik = path.join(OUT, `${FAZA}-${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), faza: FAZA, lang, theme, pomiar, bledy }, null, 2)
  );
  const off = pomiar.filter((p) => !p.wlaczony);
  console.log(
    FAZA,
    nazwa,
    '| pstryczków:',
    pomiar.length,
    '| OFF kontrast do kafelka:',
    off.map((p) => p.kontrastDoKafelka).join(' ')
  );
  await page.close();
}

for (const theme of ['light', 'dark']) await scena(`01-widzety-en-${theme}`, 'en', theme);
await scena('02-widzety-pl-light', 'pl', 'light');

await browser.close();
