#!/usr/bin/env node
/**
 * E3 — dowód i zrzuty ewidencyjne (1440, jasny + ciemny).
 * P2: kebab wiersza z przejściami statusu, stopka podglądu z listą przejść,
 *     tabela po zmianie statusu (po pełnym reload).
 * P1: polski komunikat odmowy GO na karcie inicjatywy.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] || 'evidence/e3';
const MOTYW = process.argv[3] || 'light';
const SUF = MOTYW === 'dark' ? 'ciemny' : 'jasny';
const BAZA = 'http://localhost:3243';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + e.message));
page.on('dialog', (d) => d.accept());

const zrzut = async (nazwa) => {
  const p = `${OUT}/${nazwa}-${SUF}.png`;
  await page.screenshot({ path: p });
  console.log('ZRZUT', p);
};

await page.goto(`${BAZA}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

await page.evaluate((motyw) => {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 };
  parsed.state = parsed.state || {};
  parsed.state.theme = motyw;
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
}, MOTYW);
await page.evaluate(() => window.localStorage.setItem('i18nextLng', 'pl'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
console.log('html class:', await page.evaluate(() => document.documentElement.className));

// Plakietka środowiska (`EnvironmentBadge`) jest przypięta do prawego dolnego
// rogu okna i przy 1440×900 nakłada się na ostatni przycisk stopki podglądu.
// To element produktu, nie przyrządu — ukrywamy go WYŁĄCZNIE na czas zrzutu,
// żeby zasłonięty nie był mierzony element. Odnotowane w meldunku.
const ukryjPlakietkeSrodowiska = async () => {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('body *')).forEach((el) => {
      if (el.children.length === 0 && /^LOCAL\s*@/.test((el.textContent || '').trim())) {
        const cel = el.closest('[class*="fixed"]') || el.parentElement || el;
        cel.style.display = 'none';
      }
    });
  });
};
await ukryjPlakietkeSrodowiska();

// ── P2 · Realizacja → Praca ────────────────────────────────────────────────
await page.goto(`${BAZA}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await ukryjPlakietkeSrodowiska();
await zrzut('p2-0-praca-lista');

// Wiersz zadania ze statusem „Do zrobienia" (kolumna STATUS = indeks 4).
const wskaznik = await page.evaluate(() => {
  const wiersze = Array.from(document.querySelectorAll('tbody tr'));
  for (let i = 0; i < wiersze.length; i += 1) {
    const komorki = Array.from(wiersze[i].querySelectorAll('td')).map((td) => td.innerText.trim());
    if (komorki[4] === 'Do zrobienia') return { i, tytul: komorki[0], status: komorki[4] };
    if (i < 3) console.log('WIERSZ', i, JSON.stringify(komorki));
  }
  return null;
});
console.log('WIERSZ DO PROBY:', JSON.stringify(wskaznik));
if (!wskaznik) { console.log('BRAK wiersza TODO'); await browser.close(); process.exit(1); }

const idWiersza = await page.evaluate((i) => {
  const tr = document.querySelectorAll('tbody tr')[i];
  return tr?.getAttribute('data-row-id') || tr?.id || null;
}, wskaznik.i);
console.log('data-row-id:', idWiersza);

// ── kebab wiersza rozwinięty ───────────────────────────────────────────────
const otworzKebab = async (i) => {
  await page.evaluate((idx) => {
    const tr = document.querySelectorAll('tbody tr')[idx];
    const btn = Array.from(tr.querySelectorAll('button')).find((b) => {
      const a = (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '');
      return /akcje|actions|więcej|more|menu/i.test(a);
    }) || Array.from(tr.querySelectorAll('button')).pop();
    btn?.click();
  }, i);
  await page.waitForTimeout(900);
};
await otworzKebab(wskaznik.i);
const pozycjeKebaba = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button'))
    .map((b) => b.innerText.trim()).filter(Boolean)
);
console.log('KEBAB:', JSON.stringify(pozycjeKebaba, null, 1));
await zrzut('p2-1-kebab');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// ── podgląd: stopka z akcją „Zmień status" + lista przejść ────────────────
await page.evaluate((i) => document.querySelectorAll('tbody tr')[i]?.click(), wskaznik.i);
await page.waitForTimeout(1500);
// Pasek akcji podglądu leży na dole panelu — bez przewinięcia właściciel
// nie zobaczyłby go na zrzucie (przyrząd pokazywałby nie tę część produktu).
const przewinDoStopki = async () => {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(
      (x) => x.innerText.trim() === 'Zmień status'
    );
    b?.scrollIntoView({ block: 'center' });
    const panel = b?.closest('aside, section, div[class*="overflow"]');
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(700);
};
await przewinDoStopki();
await zrzut('p2-2a-podglad-pasek-akcji');
const klikStopki = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(
    (x) => x.innerText.trim() === 'Zmień status'
  );
  if (!b) return false;
  b.click();
  return true;
});
console.log('Klik „Zmień status" w stopce:', klikStopki);
await page.waitForTimeout(1200);
const opcje = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="execution-work-preview-status"]');
  return s ? Array.from(s.options).map((o) => `${o.value}=${o.text}`) : null;
});
console.log('OPCJE SELECTA:', JSON.stringify(opcje));
await przewinDoStopki();
await zrzut('p2-2-podglad-stopka');

// ── zmiana TODO → W toku ──────────────────────────────────────────────────
await page.selectOption('[data-testid="execution-work-preview-status"]', 'in_progress');
await page.waitForTimeout(2500);
await zrzut('p2-3-po-zmianie-na-w-toku');

// PEŁNY RELOAD — zmiana musi przeżyć.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await ukryjPlakietkeSrodowiska();
const poReload1 = await page.evaluate((tytul) => {
  const tr = Array.from(document.querySelectorAll('tbody tr')).find(
    (x) => x.querySelectorAll('td')[0]?.innerText.trim() === tytul
  );
  return tr ? Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())[4] : null;
}, wskaznik.tytul);
console.log('PO RELOAD 1 — status w tabeli:', poReload1);
await zrzut('p2-4-tabela-po-reload-w-toku');

// ── zmiana W toku → Zakończone (przez kebab wiersza) ─────────────────────
const idx2 = await page.evaluate((tytul) => {
  const wiersze = Array.from(document.querySelectorAll('tbody tr'));
  return wiersze.findIndex((x) => x.querySelectorAll('td')[0]?.innerText.trim() === tytul);
}, wskaznik.tytul);
await otworzKebab(idx2);
const kebab2 = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button'))
    .map((b) => b.innerText.trim()).filter(Boolean)
);
console.log('KEBAB PO ZMIANIE:', JSON.stringify(kebab2, null, 1));
await zrzut('p2-5-kebab-przejscia');
const klikDone = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button'))
    .find((x) => /Ustaw status:\s*(Wykonane|Zako)/i.test(x.innerText));
  if (!b) return false;
  b.click();
  return true;
});
console.log('Klik „Ustaw status: Zakończone" w kebabie:', klikDone);
await page.waitForTimeout(2500);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await ukryjPlakietkeSrodowiska();
const poReload2 = await page.evaluate((tytul) => {
  const tr = Array.from(document.querySelectorAll('tbody tr')).find(
    (x) => x.querySelectorAll('td')[0]?.innerText.trim() === tytul
  );
  return tr ? Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())[4] : null;
}, wskaznik.tytul);
console.log('PO RELOAD 2 — status w tabeli:', poReload2 ?? '(wiersz poza bieżącym widokiem listy)');
await zrzut('p2-6-tabela-po-reload-zakonczone');

fs.writeFileSync(`${OUT}/pomiar-${SUF}.json`, JSON.stringify({
  wiersz: wskaznik, kebabPrzed: pozycjeKebaba, opcjeSelecta: opcje,
  kebabPo: kebab2, poReload1, poReload2, bledyKonsoli: bledy,
}, null, 2));

await browser.close();
console.log('BLEDY KONSOLI:', bledy.length, bledy.slice(0, 5));
