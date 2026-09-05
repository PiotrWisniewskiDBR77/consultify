#!/usr/bin/env node
/**
 * ODBIÓR NA ŻYWO 05.09 — trzypoziomowa formuła KPI.
 *
 * PO CO: staging ma JEDNO zestawienie („Karta wyników transformacji") z ZEREM
 * pozycji i JEDEN wskaźnik poza zestawieniami. Poziomu 2 (LISTA zestawienia z
 * pozycjami) nie da się na takich danych ani zobaczyć, ani odebrać — więc
 * dokładam istniejący wskaźnik do istniejącego zestawienia PRZEZ UI (dialog
 * „Dodaj KPI do karty wyników" na ekranie pełnej karty), a nie zapytaniem do
 * bazy. Rekord jest odnotowany w
 * `evidence/odbior-zywo-20260905/UTWORZONE_REKORDY.md`.
 *
 * Ten skrypt NIE robi zrzutów — od tego jest kanoniczny
 * `scripts/dev/odbior-zywo/zrzut.mjs`. Robi wyłącznie kliki i wypisuje
 * zmierzone identyfikatory.
 *
 * Użycie: ODBIOR_AUTH_STATE=… node scripts/dev/kpi-3poziomy-20260905/dodaj-kpi-do-zestawienia.mjs [--port=3044] [--host=127.0.0.1]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const port = Number(get('port', '3044'));
const host = get('host', '127.0.0.1');
const baza = `http://${host}:${port}`;
const auth = process.env.ODBIOR_AUTH_STATE;
if (!auth || !fs.existsSync(auth)) { console.error('Wymagane ODBIOR_AUTH_STATE'); process.exit(2); }

const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
sesja.origins = (sesja.origins || []).map((o) => ({ ...o, origin: String(o.origin).replace('http://localhost:3000', baza) }));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pl-PL' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 160)); });

// 1) Identyfikator wskaźnika spoza zestawień — czytany Z UI (klik w kafelek
//    zestawienia systemowego prowadzi na kartę wskaźnika, więc id jest w URL).
await page.goto(`${baza}/results/kpi/zestawienie/bez-zestawienia`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const kafelek = page.locator('[data-testid="kpi-card-set-grid"] > *').first();
const nazwaKpi = (await kafelek.innerText()).split('\n')[0];
await kafelek.click();
await page.waitForTimeout(1500);
const kpiId = new URL(page.url()).pathname.split('/').pop();
console.log('KPI spoza zestawień:', nazwaKpi, kpiId);

// 2) Pełna karta zestawienia — dochodzimy do niej tak jak człowiek: poziom 1,
//    klik w wiersz, przycisk „Otwórz pełną kartę" w podglądzie.
await page.goto(`${baza}/results/kpi`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.locator('text=Karta wyników transformacji').first().click();
await page.waitForTimeout(900);
await page.locator('text=Otwórz pełną kartę').first().click();
await page.waitForTimeout(2500);
const scorecardId = new URL(page.url()).pathname.split('/').pop();
console.log('Zestawienie:', scorecardId, page.url());

// 3) Dialog „Dodaj KPI do karty wyników".
await page.locator('[data-testid="kpi-scorecard-add-item-cta"]').first().click();
await page.waitForTimeout(800);
await page.locator('[data-testid="kpi-scorecard-add-item-kpi"]').fill(kpiId);
await page.waitForTimeout(1500);
const rozpoznano = await page.locator('[data-testid="kpi-scorecard-add-item-resolve-name"]').first().innerText().catch(() => '(brak)');
console.log('Rozpoznanie w dialogu:', rozpoznano);
await page.locator('[data-testid="kpi-scorecard-add-item-reason"]').fill(
  'Odbiór trzypoziomowej formuły KPI 05.09 — zestawienie miało zero pozycji, więc poziomu 2 nie było na czym pokazać.'
);
await page.locator('[data-testid="kpi-scorecard-add-item-submit"]').click();
await page.waitForTimeout(3000);
const trescPoDodaniu = await page.locator('body').innerText();
console.log('Po dodaniu — pozycja widoczna:', trescPoDodaniu.includes(nazwaKpi));
console.log(JSON.stringify({ kpiId, nazwaKpi, scorecardId }, null, 2));
await browser.close();
