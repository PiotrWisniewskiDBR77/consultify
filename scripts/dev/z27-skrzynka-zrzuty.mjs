// Z-27 (14.09) — zrzuty skrzynki recenzenta W POWŁOCE modułu Inicjatywy
// (Menu 1/2/3), jasny + ciemny, do pokazania właścicielowi (CLAUDE.md §7).
//
// Renderuje dev-render harness (ekran `z27-inicjatywy-skrzynka`), montujący
// REALNY <InitiativesHub>. Motyw sterowany przez `&theme=` w URL — harness
// (dev-render/main.tsx) sam ustawia `.dark` na <html> ORAZ zapisuje motyw
// do zustand store (`useAppStore.setState({theme})`), więc nie trzeba
// emulować `prefers-color-scheme` ani ręcznie majstrować przy localStorage
// (patrz komentarz w main.tsx: ThemeSync inaczej nadpisuje klasę).
//
// Użycie:
//   node scripts/dev/z27-skrzynka-zrzuty.mjs --port 4271 --case on
//   node scripts/dev/z27-skrzynka-zrzuty.mjs --port 4272 --case off
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '4271');
const CASE = arg('case', 'on'); // on = flagi ON, off = flagi OFF (parytet)
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-z27-skrzynka-20260914');
fs.mkdirSync(OUT, { recursive: true });

const url = (theme) =>
  `${BASE}/?screen=z27-inicjatywy-skrzynka&tab=transitionInbox&lang=pl&theme=${theme}`;

const browser = await chromium.launch();

async function zrzut(nazwa, theme, akcja) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  await page.goto(url(theme), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  if (akcja) await akcja(page);
  const plik = path.join(OUT, `${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), case: CASE, theme, bledyKonsoli }, null, 2)
  );
  console.log(nazwa, '→', plik, 'błędy konsoli:', bledyKonsoli.length);
  await page.close();
}

if (CASE === 'off') {
  for (const theme of ['light', 'dark']) {
    await zrzut(`03-skrzynka-flaga-off-${theme}`, theme);
  }
} else {
  for (const theme of ['light', 'dark']) {
    await zrzut(`01-skrzynka-lista-${theme}`, theme);
    await zrzut(`02-skrzynka-podglad-${theme}`, theme, async (page) => {
      await page.click('text=ERP rollout — phase 2 (finance close)');
      await page.waitForTimeout(900);
    });
  }
}

await browser.close();
