#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — P15 K4: lista planów (Konflikty, Autor) i lista analiz
 * obciążenia (Plan źródłowy) — PRZED/PO.
 *
 * Uzycie:
 *   node scripts/dev/p15-k4-lista-planow/dowod.mjs <przed|po> <BASE> <AUTH>
 *
 * PRZED: BASE=http://localhost:3160 (wspólne środowisko, API 4150, TYLKO
 *        odczyt — nie restartujemy tego procesu).
 * PO:    BASE=http://localhost:3171 (własny vite, własne API 4152, własna
 *        kopia bazy consultify_p15k4).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3171', AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json'] = process.argv;
const OUT = `/private/tmp/wt-p15-k4/evidence/p15-k4/${faza}`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({
    nazwa, opis, faza,
    url: page.url(),
    szerokosc: 1440, motyw: 'jasny',
    bledyKonsoli: [...konsola],
    czas: new Date().toISOString(),
  }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka}  (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

// Playwright's storageState localStorage jest per-origin: wpisy z pliku AUTH
// są zapisane pod originem środowiska, w którym je nagrano (np. :3160), więc
// na WŁASNYM porcie (np. :3171) trzeba je jawnie zaszczepić pod nowym originem
// — inaczej AuthContext (App.tsx: `localStorage.getItem('token')`) nie widzi
// sesji i RouterSync przekierowuje na /login. Czytamy je BEZPOŚREDNIO z pliku
// AUTH (nie z kopii w repo — to sekrety sesji, nie mają wchodzić do gita).
const authState = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
const seed = authState.origins?.[0]?.localStorage ?? [];
await page.evaluate((entries) => {
  for (const { name, value } of entries) localStorage.setItem(name, value);
}, seed);

await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await zrzut('plan-lista', 'Inicjatywy -> Plan: kolumny Konflikty i Autor');

// Kolumny Konflikty/Zaktualizowano/Autor są poza pierwszym ekranem tabeli —
// przewiń poziomo, żeby Autor był widoczny na zrzucie wprost (nie tylko w
// panelu podglądu, który nie pokazuje Autora — patrz PlanScenarioSurface.tsx).
const scrollable = page
  .locator('table')
  .first()
  .locator('xpath=ancestor::div[contains(@class,"overflow")][1]');
if (await scrollable.count()) {
  await scrollable.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForTimeout(400);
  await zrzut('plan-lista-scroll-autor', 'Inicjatywy -> Plan, przewinięte: kolumna Autor');
}

await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await zrzut('capacity-lista', 'Inicjatywy -> Obciążenie: kolumna Plan źródłowy');

await browser.close();
console.log(`bledyKonsoli (poza znanym NetworkBuffer): ${konsola.filter((m) => !/NetworkBuffer/i.test(m)).length}`);
