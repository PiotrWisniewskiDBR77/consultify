#!/usr/bin/env node
/**
 * DOWÓD NA EKRANIE — P15 K2: most inicjatyw modułu + portfel roboczy + generator.
 *
 * Przepływ (1440, jasny, reload po każdym zapisie):
 *   Inicjatywy → Plan → „Nowy plan" → generator (5 zatwierdzonych inicjatyw modułu
 *   + 12 tygodni) → „Generuj" → propozycja widoczna → „Zatwierdź" → „Zapisano hh:mm"
 *   → reload → karta pokazuje 5 okien w „Zakres inicjatyw" → lista planów: nowy plan,
 *   „Portfel roboczy…", autor, 5 inicjatyw.
 * Para negatywna: inicjatywa w statusie Szkic nie jest do wyboru w generatorze.
 *
 * Użycie:
 *   node scripts/dev/p15-k2-most-inicjatyw/dowod.mjs [BASE] [AUTH]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  BASE = 'http://localhost:3173',
  AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json',
] = process.argv;
const OUT = '/private/tmp/wt-p15-k2/evidence/p15-k2/przeplyw';
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const api = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/initiatives/runtime-v1/'))
    api.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
        url: page.url(),
        szerokosc: 1440,
        motyw: 'jasny',
        bledyKonsoli: [...konsola],
        czas: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`ZRZUT ${nazwa}: ${sciezka} (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
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
await page.waitForTimeout(7000);
await zrzut('01-lista-planow-przed', 'Inicjatywy → Plan: lista planów przed założeniem nowego');

// ── „Nowy plan" (Menu 1) ────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Nowy plan' }).first().click();
await page.waitForTimeout(1500);
const nazwaPlanu = `Plan K2 ${new Date().toISOString().slice(11, 19)}`;
await page.getByLabel('Nazwa planu nadana przez Ciebie').fill(nazwaPlanu);
await zrzut('02-formularz-nowy-plan', 'Formularz „Nowy plan" bez pól portfela — zakłada go serwer');
await page.getByRole('button', { name: /Utwórz plan/ }).click();
await page.waitForTimeout(6000);
await zrzut('03-karta-planu-pusta', 'Karta planu po założeniu — zakres pusty, portfel roboczy w tle');

// ── Generator: Pracuj z AI → Uzupełnij cały dokument → zgoda ────────────────
await page.getByRole('button', { name: /Pracuj z AI/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('menuitem', { name: /Uzupełnij cały dokument/ }).click();
await page.waitForTimeout(800);
// Panel zgody „Uruchomic AI?" (PracujZAI) — karta ma wlasny generator, wiec
// panel tylko pyta o zgode i oddaje robote oknu generatora.
await page.getByRole('button', { name: /^Zatwierd[źz]$/ }).first().click();
await page.waitForTimeout(1500);
await zrzut('04-generator-krok1-2', 'Generator: źródło z licznikami i wybór tylko kwalifikujących się');

// Para negatywna: żaden szkic modułu nie jest do wyboru.
const szkice = await page.evaluate(() =>
  Array.from(document.querySelectorAll('label')).filter((l) => /Szkic/.test(l.textContent || ''))
    .length
);
console.log(`PARA NEGATYWNA: etykiet ze statusem „Szkic" w wyborze = ${szkice} (oczekiwane 0)`);

// Zaznacz 5 pierwszych zatwierdzonych.
const checkboxy = page.locator('section:has-text("2. Wybór") input[type="checkbox"]');
const ile = Math.min(5, await checkboxy.count());
for (let i = 0; i < ile; i += 1) await checkboxy.nth(i).check();
await page.getByLabel('Liczba okresów').fill('12');
await zrzut('05-generator-wybor-5', `Wybrane ${ile} inicjatywy modułu i 12 okresów`);

await page.getByRole('button', { name: /Generuj propozycję/ }).click();
await page.waitForTimeout(9000);
const wierszy = await page
  .locator('table[aria-label="Proponowana kolejność"] tbody tr')
  .count()
  .catch(() => 0);
console.log(`PROPOZYCJA: wierszy = ${wierszy}`);
await zrzut('06-propozycja-przed-zatwierdzeniem', `Propozycja solvera: ${wierszy} wierszy PRZED „Zatwierdź"`);

await page
  .locator('section', { hasText: '5. Zatwierdź' })
  .getByRole('button', { name: /^Zatwierdź$/ })
  .click();
await page.waitForTimeout(7000);
const zapis = await page
  .locator('[role="status"]')
  .allTextContents()
  .then((t) => t.filter((x) => /Zapisano/.test(x)));
console.log(`ZAPIS: ${JSON.stringify(zapis)}`);
await zrzut('07-zapisano', `Znacznik zapisu z odpowiedzi serwera: ${zapis.join(' | ') || 'BRAK'}`);

// ── reload: trwałość ────────────────────────────────────────────────────────
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
// Menu 2 startuje na presecie „Opublikowane"; nowy plan jest SZKICEM.
await page.getByRole('button', { name: /^Szkice/ }).first().click();
await page.waitForTimeout(3000);
// Kolumna „Autor" jest poza pierwszym ekranem tabeli — przewiń poziomo, żeby
// znalazła się na zrzucie wprost (ten sam zabieg co w dowodzie K4).
const przewijalna = page
  .locator('table')
  .first()
  .locator('xpath=ancestor::div[contains(@class,"overflow")][1]');
if (await przewijalna.count()) {
  await przewijalna.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForTimeout(800);
}
await zrzut('08-po-reload-lista', 'Po przeładowaniu: lista planów z nazwą portfela roboczego i autorem');

const komorka = page.getByText(nazwaPlanu, { exact: false }).first();
await komorka.dblclick();
await page.waitForTimeout(7000);
await page.getByRole('button', { name: /Zakres inicjatyw/ }).first().click();
await page.waitForTimeout(1500);
await zrzut('09-karta-zakres-inicjatyw', 'Karta planu po reloadzie: sekcja „Zakres inicjatyw" = okna planu');
await page.getByRole('button', { name: /Kolejność i okna/ }).first().click();
await page.waitForTimeout(1500);
await zrzut('10-karta-kolejnosc-i-okna', 'Karta planu po reloadzie: sekcja „Kolejność i okna" = 5 okien z propozycji');

fs.writeFileSync(
  `${OUT}/api-log.txt`,
  [
    '# P15-K2 — wywołania runtime-v1 podczas przepływu klikanego',
    `# BASE=${BASE}, API=4153, baza=consultify_p15k2, ${new Date().toISOString()}`,
    '',
    ...api,
    '',
    `# błędy konsoli: ${konsola.length}`,
    ...konsola,
  ].join('\n')
);
console.log(`API-LOG: ${OUT}/api-log.txt (${api.length} wywołań), błędy konsoli: ${konsola.length}`);

await browser.close();
