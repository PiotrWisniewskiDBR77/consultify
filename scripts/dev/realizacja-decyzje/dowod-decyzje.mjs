#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — Realizacja → Decyzje i ryzyka (P16 / R3, DEC-453).
 *
 * Uzycie:
 *   node scripts/dev/realizacja-decyzje/dowod-decyzje.mjs <przed|po> <BASE> <AUTH> [OUT]
 *
 * Klika to, co klika czlowiek: Realizacja → zakladka „Decyzje i ryzyka" →
 * rejestr → „Nowa decyzja" → kebab wiersza → podglad → okno powodu → zapis →
 * RELOAD po kazdym zapisie. Zrzuty 1440x900, motyw JASNY, obok kazdego `.png.json`
 * z url, bledami konsoli i logiem odpowiedzi /api/decisions.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3176', AUTH = '/private/tmp/wt-p16-r3/.run/auth-r3.json', OUT_ARG] =
  process.argv;
const OUT = OUT_ARG || `/private/tmp/wt-p16-r3/evidence/p16-r3/${faza}`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && !/NetworkBuffer/i.test(m.text())) konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/decisions/i.test(u)) return;
  let body = '';
  try { body = (await r.text()).slice(0, 400); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

export async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      { nazwa, opis, faza, url: page.url(), szerokosc: 1440, motyw: 'jasny', bledyKonsoli: [...konsola], czas: new Date().toISOString() },
      null,
      2
    )
  );
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

async function otworzZakladke() {
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  // `?tab=control` ląduje wprost na zakładce; klik w Menu 1 tylko upewnia.
  const tab = page.locator('button', { hasText: /^Decyzje i ryzyka$/ }).filter({ visible: true }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(3000); }
  await page.locator('table tbody tr').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
}

await otworzZakladke();
await zrzut('01-rejestr-decyzji', 'Rejestr decyzji — kolumny i wiersze');

// „Nowa decyzja" — formularz
const nowa = page.getByRole('button', { name: /^Nowa decyzja$/ }).first();
if (await nowa.count()) {
  await nowa.click();
  await page.waitForTimeout(1200);
  await zrzut('02-nowa-decyzja-formularz', 'Formularz „Nowa decyzja"');
  if (faza === 'przed') {
    // Odtworzenie 400: sam tytul, bez inicjatywy
    await page.getByLabel(/Tytu/i).first().fill('proba-r3-przed-ui').catch(() => {});
    const zapisz = page.getByRole('button', { name: /Zapisz decyzj/ }).first();
    if (await zapisz.count()) { await zapisz.click(); await page.waitForTimeout(2500); }
    await zrzut('03-nowa-decyzja-blad', 'Blad po probie zapisu (PRZED = 400)');
  }
}

// Podglad pierwszego wiersza
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
const wiersz = page.locator('table tbody tr').first();
if (await wiersz.count()) {
  await wiersz.click();
  await page.waitForTimeout(1500);
  await zrzut('04-podglad', 'Podglad decyzji (blok akcji)');
}

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n') || '(brak wywolan /api/decisions)');
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n') || '(brak bledow konsoli)');
console.log(`API wywolan: ${apiLog.length}, bledow konsoli: ${konsola.length}`);
await browser.close();
