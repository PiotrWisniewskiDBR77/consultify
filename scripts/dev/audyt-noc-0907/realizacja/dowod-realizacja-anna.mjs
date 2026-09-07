#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — para negatywna MEMBER (Anna Kowalska), modul Realizacja.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3185';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-anna-odbior-3185.json';
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/realizacja';

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
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\//i.test(u)) return;
  if (r.status() < 400) return;
  let body = '';
  try { body = (await r.text()).slice(0, 300); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), czas: new Date().toISOString() }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${opis}`);
}

// Praca — Anna widzi liste, sprawdzamy czy moze edytowac cudze zadanie
await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('30-anna-praca', 'Anna (MEMBER) - zakladka Praca');

const komorkiEdytowalne = page.locator('[data-editable="tak"]');
const liczba = await komorkiEdytowalne.count();
console.log('Anna - liczba komorek oznaczonych jako edytowalne (data-editable=tak):', liczba);
if (liczba > 0) {
  await komorkiEdytowalne.first().dblclick();
  await page.waitForTimeout(500);
  await zrzut('31-anna-probe-edycja', 'Anna probuje edytowac pierwsza komorke oznaczona jako edytowalna');
}

// Decyzje i ryzyka — czy widzi "Nowa decyzja" / akcje rozstrzygajace
await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('32-anna-decyzje', 'Anna - Decyzje i ryzyka, sprawdz czy widac "Nowa decyzja"');
const btnNowaDecyzjaAnna = await page.getByRole('button', { name: /^Nowa decyzja$/ }).count();
console.log('Anna widzi "Nowa decyzja":', btnNowaDecyzjaAnna > 0);

// klik na pierwsza decyzje, sprawdz czy jest "Rozstrzygnij" w podgladzie
const pierwszaDecyzja = page.locator('tbody tr, [role="row"]').nth(1);
if (await pierwszaDecyzja.count()) {
  await pierwszaDecyzja.click();
  await page.waitForTimeout(1000);
  await zrzut('33-anna-decyzja-podglad', 'Anna - podglad decyzji, sprawdz czy widac Rozstrzygnij/Odrzuc');
  const btnRozstrzygnij = await page.getByRole('button', { name: /Rozstrzygnij/i }).count();
  console.log('Anna widzi "Rozstrzygnij":', btnRozstrzygnij > 0);
}

// Sygnaly — czy Anna widzi "Przygotuj interwencje"
const chipSygnalyAnna = page.locator('button').filter({ hasText: /^Sygnały\s*\(?\d*\)?$/ }).first();
if (await chipSygnalyAnna.count()) {
  await chipSygnalyAnna.click();
  await page.waitForTimeout(2000);
  const wierszSygnalAnna = page.locator('[role="row"], tbody tr').nth(1);
  if (await wierszSygnalAnna.count()) {
    await wierszSygnalAnna.click();
    await page.waitForTimeout(800);
    const btnInterwencjaAnna = await page.getByRole('button', { name: /Przygotuj interwencję/i }).count();
    console.log('Anna widzi "Przygotuj interwencję":', btnInterwencjaAnna > 0);
    await zrzut('34-anna-sygnal-podglad', 'Anna - podglad sygnalu, sprawdz brak Przygotuj interwencje');
  }
}

// Raporty — Anna nie powinna widziec przyciskow deweloperskich
await page.goto(`${BASE}/execution?tab=reports`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('35-anna-raporty', 'Anna - zakladka Raporty, sprawdz brak Nowa definicja / Kontrakt raportu');

// Realizacje (lista) — widok ogolny Anny
await page.goto(`${BASE}/execution?tab=list`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('36-anna-lista', 'Anna - Realizacje (lista glowna)');

fs.writeFileSync(`${OUT}/api-log-anna.txt`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/konsola-anna.log`, konsola.join('\n') + '\n');
console.log(`\nWywolan API >=400: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
await browser.close();
