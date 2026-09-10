#!/usr/bin/env node
/**
 * E3b — zrzuty na CZYSTYM ekranie (bez kreatora powitalnego).
 *
 *  · p2-1-kebab-{jasny,ciemny}        — kebab wiersza „Do zrobienia" w Realizacja → Praca
 *  · p1-gotowosc-po-polsku-{jasny,ciemny} — sekcja „Gotowość bramy" na karcie inicjatywy
 *
 * Kreator „Krok 1 z 3" zasłaniał zrzuty E3. Prawda serwerowa to
 * `user_preferences.onboarding_completed` (`useFirstRunOnboarding.ts`), ustawiona
 * w bazie kopii; drugi bezpiecznik to lokalny klucz `consultify_onboarding_done:<id>`,
 * który ustawiamy w `localStorage` PRZED pierwszym malowaniem aplikacji.
 *
 * Użycie: node scripts/dev/e3b-zrzuty.mjs <OUT> <light|dark> <ID_INICJATYWY>
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] || 'evidence/e3b';
const MOTYW = process.argv[3] || 'light';
const ID_INICJATYWY = process.argv[4] || '';
const SUF = MOTYW === 'dark' ? 'ciemny' : 'jasny';
const BAZA = 'http://localhost:3245';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const bledy = [];
page.on('console', (m) => {
  if (m.type() === 'error') bledy.push(m.text());
});
page.on('pageerror', (e) => bledy.push('pageerror: ' + e.message));

const zrzut = async (n) => {
  const p = `${OUT}/${n}-${SUF}.png`;
  await page.screenshot({ path: p });
  console.log('ZRZUT', p);
};

/** Plakietka „LOCAL @sha" to przyrząd, nie produkt — nie może stać na zrzucie. */
const ukryjPlakietke = async () => {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('body *')).forEach((el) => {
      if (el.children.length === 0 && /^LOCAL\s*@/.test((el.textContent || '').trim())) {
        (el.closest('[class*="fixed"]') || el.parentElement || el).style.display = 'none';
      }
    });
  });
};

await page.goto(`${BAZA}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

const idUzytkownika = await page.evaluate((m) => {
  const raw = window.localStorage.getItem('consultify-storage');
  const p = raw ? JSON.parse(raw) : { state: {}, version: 2 };
  p.state = p.state || {};
  p.state.theme = m;
  window.localStorage.setItem('consultify-storage', JSON.stringify(p));
  window.localStorage.setItem('i18nextLng', 'pl');
  const uid = p.state?.currentUser?.id || '';
  if (uid) window.localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
  return uid;
}, MOTYW);
console.log('ID uzytkownika:', idUzytkownika || '(brak w store)');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

const kreator = await page.evaluate(() =>
  /Krok\s*1\s*z\s*3|Step\s*1\s*of\s*3/.test(document.body.innerText)
);
console.log('KREATOR POWITALNY WIDOCZNY:', kreator);

// ── P2 · kebab wiersza zadania ─────────────────────────────────────────────
await page.goto(`${BAZA}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await ukryjPlakietke();

const wiersz = await page.evaluate(() => {
  const wiersze = Array.from(document.querySelectorAll('tbody tr'));
  const index = wiersze.findIndex((tr) => /Do zrobienia/i.test(tr.innerText));
  const wybrany = index >= 0 ? index : 0;
  const tr = wiersze[wybrany];
  if (!tr) return null;
  const btn = Array.from(tr.querySelectorAll('button')).pop();
  btn?.click();
  return { index: wybrany, tekst: tr.innerText.replace(/\s+/g, ' ').slice(0, 90) };
});
console.log('WIERSZ:', JSON.stringify(wiersz));
await page.waitForTimeout(1200);
const pozycjeKebaba = await page.evaluate(() =>
  Array.from(
    document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button')
  )
    .map((x) => x.innerText.trim().split('\n')[0])
    .filter(Boolean)
);
console.log('KEBAB:', JSON.stringify(pozycjeKebaba, null, 1));
await zrzut('p2-1-kebab');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

/*
 * P1 — blokady gotowości bramy: ZRZUTU NIE MA I NIE UDAJEMY, ŻE JEST.
 *
 * Angielskie „Owner assigned" wchodzi do interfejsu WYŁĄCZNIE przez
 * `getInitiativeStatusPreflightTruth` (`src/services/initiativeWriteTruth.ts`)
 * → toast „brakuje: • …" w `InitiativesHub` i `InitiativeDocumentView`.
 * Zmierzone na stanowisku (sondy `e3b-sonda-gotowosc.mjs`, `e3b-sonda-cta.mjs`,
 * `e3b-sonda-lista.mjs`): tego toasta NIE DA SIĘ dziś wywołać z aplikacji —
 * zmiana statusu z karty (natywny `<select>` w panelu WŁAŚCIWOŚCI) nie wysyła
 * ŻADNEGO żądania i wraca do wartości wyjściowej, a kebab wiersza listy ma
 * tylko Otwórz/Otwórz podgląd/Archiwizuj. Poprawka językowa jest więc pokryta
 * testem jednostkowym z dowodem mutacyjnym, a nie zrzutem — patrz meldunek.
 */
let gotowosc = null;

fs.writeFileSync(
  `${OUT}/pomiar-${SUF}.json`,
  JSON.stringify({ kreator, wiersz, pozycjeKebaba, gotowosc, bledy }, null, 2)
);
await browser.close();
console.log('BLEDY KONSOLI:', bledy.length, bledy.slice(0, 5));
