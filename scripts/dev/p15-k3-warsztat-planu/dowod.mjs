#!/usr/bin/env node
/**
 * DOWÓD NA EKRANIE — P15 K3: warsztat planu w karcie.
 *
 * Przepływ (1440, jasny, reload po każdym zapisie):
 *   Nowy plan → generator (5 inicjatyw / 12 tygodni) → Zatwierdź → karta →
 *   „Dodaj inicjatywę" (6.) → reload → 6 okien → zmiana daty docelowej → reload →
 *   trwałe → zależność „A po B" → reload → „Pracuj z AI → Analizuj" → propozycja
 *   respektuje zależność, uzasadnienie PO POLSKU → Zatwierdź → Opublikuj →
 *   próba edycji opublikowanego = zdanie o nowej wersji.
 *
 * Użycie: node scripts/dev/p15-k3-warsztat-planu/dowod.mjs [BASE] [AUTH]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  BASE = 'http://localhost:3179',
  AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json',
] = process.argv;
const OUT = '/private/tmp/wt-p15-k3/evidence/p15-k3/przeplyw';
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const api = [];
const notatki = [];

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
  console.log(`ZRZUT ${nazwa} (bledyKonsoli=${konsola.length})`);
}
const notuj = (tekst) => {
  notatki.push(tekst);
  console.log(tekst);
};
const sekcja = async (nazwa) => {
  await page.getByRole('button', { name: nazwa }).first().click();
  await page.waitForTimeout(1200);
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const authState = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
await page.evaluate((entries) => {
  for (const { name, value } of entries) localStorage.setItem(name, value);
}, authState.origins?.[0]?.localStorage ?? []);
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

/*
 * Nazwa musi WYGLĄDAĆ jak nazwa, nie jak identyfikator: `resolveBusinessDisplayLabel`
 * (businessDisplayLabel.ts:13) uznaje napis kończący się `-<6+ cyfr>` za kod techniczny
 * i podmienia go na „Plan bez nazwy" — zmierzone w pierwszym przebiegu tego skryptu.
 */
const nazwaPlanu = `Proba K3 ${new Date().toISOString().slice(11, 19)}`;

await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await zrzut('01-lista-planow', 'Menu 2 startuje na „Wszystkie" — świeży szkic będzie widoczny bez klikania');

// ── Nowy plan ───────────────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Nowy plan' }).first().click();
await page.waitForTimeout(1500);
await page.getByLabel('Nazwa planu nadana przez Ciebie').fill(nazwaPlanu);
await page.getByRole('button', { name: /Utwórz plan/ }).click();
await page.waitForTimeout(7000);
await zrzut('02-karta-nowego-planu', 'Karta planu po założeniu (szkic, zakres pusty)');

// ── Generator: 5 inicjatyw / 12 tygodni ─────────────────────────────────────
await page.getByRole('button', { name: /Pracuj z AI/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('menuitem', { name: /Uzupełnij cały dokument/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^Zatwierd[źz]$/ }).first().click();
await page.waitForTimeout(1500);
const checkboxy = page.locator('section:has-text("2. Wybór") input[type="checkbox"]');
const ile = Math.min(5, await checkboxy.count());
for (let i = 0; i < ile; i += 1) await checkboxy.nth(i).check();
await page.getByLabel('Liczba okresów').fill('12');
await page.getByRole('button', { name: /Generuj propozycję/ }).click();
await page.waitForTimeout(10000);
const wierszyPropozycji = await page
  .locator('table[aria-label="Proponowana kolejność"] tbody tr')
  .count()
  .catch(() => 0);
notuj(`GENERATOR: wybrano ${ile} inicjatyw, propozycja ma ${wierszyPropozycji} wierszy`);
await zrzut('03-generator-propozycja', `Propozycja solvera przed „Zatwierdź": ${wierszyPropozycji} wierszy`);
await page
  .locator('section', { hasText: '5. Zatwierdź' })
  .getByRole('button', { name: /^Zatwierdź$/ })
  .click();
await page.waitForTimeout(8000);
await page.getByRole('button', { name: 'Zamknij' }).first().click().catch(() => undefined);
await page.waitForTimeout(1500);

// ── „Dodaj inicjatywę" → 6. okno ────────────────────────────────────────────
await sekcja('Zakres inicjatyw');
await zrzut('04-zakres-przed-dodaniem', 'Zakres inicjatyw — 5 okien planu, edytowalny (szkic)');
const wybor = page.getByLabel('Inicjatywa do dodania do planu');
const opcje = await wybor.locator('option').all();
const doDodania = (await opcje[1]?.getAttribute('value')) ?? '';
const nazwaDodanej = (await opcje[1]?.textContent())?.trim() ?? '';
await wybor.selectOption(doDodania);
await page.getByRole('button', { name: 'Dodaj inicjatywę' }).click();
await page.waitForTimeout(9000);
notuj(`DODANO: „${nazwaDodanej}"`);
await zrzut('05-po-dodaniu', `Po „Dodaj inicjatywę": ${nazwaDodanej}`);

// reload → trwałość
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.getByText(nazwaPlanu, { exact: false }).first().dblclick();
await page.waitForTimeout(8000);
await sekcja('Zakres inicjatyw');
const okienPoReload = await page.locator('button:has-text("Usuń z planu")').count();
notuj(`PO RELOAD: okien w zakresie = ${okienPoReload} (oczekiwane 6)`);
await zrzut('06-po-reload-6-okien', `Po przeładowaniu: ${okienPoReload} okien w zakresie`);

// ── Zmiana daty docelowej ───────────────────────────────────────────────────
// Najpierw poszerzamy „najpóźniej" (inaczej walidacja słusznie odrzuca datę spoza
// okna — zmierzone w pierwszym przebiegu: „Zachowaj kolejność…"), potem przesuwamy
// datę docelową. Dwa zapisy = dwa razy CAS.
await sekcja('Kolejność i okna');
const poleNajpozniej = page.locator('input[type="date"][aria-label^="Najpóźniej"]').nth(1);
await poleNajpozniej.fill('2026-11-16');
await page.waitForTimeout(8000);
const poleDaty = page.locator('input[type="date"][aria-label^="Data docelowa"]').nth(1);
const etykietaDaty = await poleDaty.getAttribute('aria-label');
await poleDaty.fill('2026-10-19');
await page.waitForTimeout(8000);
await zrzut('07-zmiana-daty', `Zmieniona data docelowa: ${etykietaDaty} → 2026-10-19`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.getByText(nazwaPlanu, { exact: false }).first().dblclick();
await page.waitForTimeout(8000);
await sekcja('Kolejność i okna');
const wartoscPoReload = await page
  .locator(`input[type="date"][aria-label="${etykietaDaty}"]`)
  .inputValue();
notuj(`DATA PO RELOAD: ${wartoscPoReload} (oczekiwane 2026-10-19)`);
await zrzut('08-data-po-reload', `Data docelowa trwała po przeładowaniu: ${wartoscPoReload}`);

// ── Zależność „druga po pierwszej" ──────────────────────────────────────────
const zaleznosc = page.locator('input[type="checkbox"][aria-label*=" po "]').first();
const etykietaZaleznosci = await zaleznosc.getAttribute('aria-label');
// `check()` sprawdza stan NATYCHMIAST po kliku i klika ponownie; pole jest
// sterowane odpowiedzią serwera, więc używamy zwykłego `click()` i czekamy.
await zaleznosc.click();
await page.waitForTimeout(12000);
notuj(`ZALEZNOSC ZAZNACZONA: ${await zaleznosc.isChecked()}`);
notuj(`ZALEZNOSC: ${etykietaZaleznosci}`);
await zrzut('09-zaleznosc', `Zależność zapisana: ${etykietaZaleznosci}`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.getByText(nazwaPlanu, { exact: false }).first().dblclick();
await page.waitForTimeout(8000);
await sekcja('Kolejność i okna');
// Etykieta niesie polskie cudzysłowy — selektor CSS by się na nich wywrócił,
// więc szukamy po dostępnej nazwie, nie po atrybucie.
const zaleznoscPoReload = await page.getByLabel(etykietaZaleznosci, { exact: true }).isChecked();
notuj(`ZALEZNOSC PO RELOAD: ${zaleznoscPoReload ? 'zaznaczona' : 'BRAK'}`);
await zrzut('10-zaleznosc-po-reload', `Zależność trwała po przeładowaniu: ${zaleznoscPoReload}`);

// ── „Pracuj z AI → Analizuj": propozycja z uzasadnieniem po polsku ──────────
await page.getByRole('button', { name: /Pracuj z AI/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('menuitem', { name: /Analizuj/ }).first().click();
await page.waitForTimeout(1500);
// Panel zgody „Uruchomić AI?" — Zatwierdź uruchamia analizę.
await page.getByRole('button', { name: /^Zatwierd[źz]$/ }).first().click().catch(() => undefined);
await page.waitForTimeout(10000);
await sekcja('Kolejność i okna');
const uzasadnienia = await page.locator('text=/Solver wybrał/').count();
const angielskie = await page.locator('text=/Deterministic solver selected/').count();
const kody = await page.locator('text=/SOLVER-1:/').count();
notuj(
  `UZASADNIENIE: „Solver wybrał…" ×${uzasadnienia}, angielskich ×${angielskie}, surowych kodów ×${kody}`
);
await zrzut('11-uzasadnienie-po-polsku', `Uzasadnienie solvera po polsku (${uzasadnienia} wierszy)`);

// Propozycja z „Analizuj" renderuje się w „Zależności i konflikty" (D5) i tam
// się ją zatwierdza — bez otwierania generatora.
await sekcja('Zależności i konflikty');
const wierszePropozycjiWKarcie = await page
  .locator('table[aria-label="Proponowana kolejność"] tbody tr')
  .count()
  .catch(() => 0);
const poPoprzedniku = await page.locator('text=/po okresie poprzednika/').count();
notuj(
  `PROPOZYCJA W KARCIE: ${wierszePropozycjiWKarcie} wierszy, „po okresie poprzednika" ×${poPoprzedniku}`
);
await zrzut(
  '12-zaleznosci-i-konflikty',
  `Sekcja „Zależności i konflikty": propozycja ${wierszePropozycjiWKarcie} wierszy, zależność uwzględniona ×${poPoprzedniku}`
);
await page
  .locator('section, div')
  .filter({ hasText: 'Propozycja solvera' })
  .getByRole('button', { name: /^Zatwierdź$/ })
  .first()
  .click()
  .catch(() => undefined);
await page.waitForTimeout(9000);
await zrzut('12b-propozycja-zatwierdzona', 'Propozycja zatwierdzona z karty (bez generatora)');

// ── Publikacja i próba edycji opublikowanego ────────────────────────────────
await sekcja('Decyzje');
await page.getByRole('button', { name: 'Opublikuj plan' }).click();
await page.waitForTimeout(3000);
// Plan z konfliktami wymaga jawnego potwierdzenia (bramka P11).
const potwierdzenie = page.getByRole('button', { name: /^Publikuję mimo/ });
if (await potwierdzenie.count()) {
  notuj(`PUBLIKACJA: ${await potwierdzenie.first().textContent()}`);
  await potwierdzenie.first().click();
}
await page.waitForTimeout(9000);
await zrzut('13-opublikowany', 'Plan opublikowany');
await sekcja('Zakres inicjatyw');
const zdanieOWersji = await page
  .locator('text=/Plan opublikowany — utwórz nową wersję/')
  .count();
const dodajWidoczne = await page.getByRole('button', { name: 'Dodaj inicjatywę' }).count();
notuj(
  `OPUBLIKOWANY: zdanie o nowej wersji ×${zdanieOWersji}, przycisk „Dodaj inicjatywę" ×${dodajWidoczne} (oczekiwane 0)`
);
await zrzut('14-opublikowany-tylko-odczyt', 'Plan opublikowany = tylko do odczytu + zdanie o nowej wersji');

fs.writeFileSync(
  `${OUT}/api-log.txt`,
  [
    '# P15-K3 — wywołania runtime-v1 podczas przepływu klikanego',
    `# BASE=${BASE}, API=4159, baza=consultify_p15k3, ${new Date().toISOString()}`,
    '',
    ...notatki.map((n) => `# ${n}`),
    '',
    ...api,
    '',
    `# błędy konsoli: ${konsola.length}`,
    ...konsola,
  ].join('\n')
);
console.log(`API-LOG: ${OUT}/api-log.txt (${api.length} wywołań), błędy konsoli: ${konsola.length}`);
console.log(`NAZWA PLANU DO SPRZATANIA: ${nazwaPlanu}`);

await browser.close();
