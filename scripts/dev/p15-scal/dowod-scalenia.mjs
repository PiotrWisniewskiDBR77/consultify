#!/usr/bin/env node
/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15 — DOWÓD SCALENIA K3 (warsztat planu)
 * z K5 (moc per rola) na JEDNEJ karcie planu.
 *
 * Pytanie, na które odpowiada ten przepływ: czy po scaleniu obie funkcje żyją
 * OBOK SIEBIE i czy nie przeszkadzają sobie w zapisie. Sedno ryzyka: edytor
 * popytu per rola (K5) pisał do agregatu WŁASNYM licznikiem wersji, a warsztat
 * K3 swoim — dwaj pisarze jednego agregatu na jednej karcie dawaliby 409 po
 * pierwszej zmianie po drugiej stronie. Po scaleniu edytor jest sterowany i
 * oddaje zapis do `persistScenario` karty, więc krok (07) sprawdza wprost:
 * zapis FTE, a ZARAZ POTEM zapis daty z warsztatu — oba muszą przejść.
 *
 * Użycie: node scripts/dev/p15-scal/dowod-scalenia.mjs [BASE] [AUTH]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  BASE = 'http://localhost:3182',
  AUTH = '/private/tmp/wt-p15-scal/.auth-scal.json',
] = process.argv;
const OUT = '/private/tmp/wt-p15-scal/evidence/p15-scal';
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
        baza: 'consultify_p15scal (kopia consultify_fable + migracja K1 + seed stanowisk K5)',
        galaz: 'mvp/p15-k3k5-scalenie',
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
  await page.getByRole('button', { name: new RegExp(`^${nazwa}`) }).first().click();
  await page.waitForTimeout(1500);
};
const otworzPlan = async () => {
  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const wiersz = page.locator('table tbody tr', { hasText: 'proba-scal' }).first();
  await wiersz.waitFor({ timeout: 30000 });
  await wiersz.dblclick();
  await page.waitForTimeout(8000);
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
// Sesja zapisana na innym porcie — localStorage kopiujemy jawnie (jak w K3).
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

// ── 1. JEDNA KARTA: sekcje K3 ────────────────────────────────────────────────
await otworzPlan();
await sekcja('Zakres inicjatyw');
const dodaj = await page.getByRole('button', { name: 'Dodaj inicjatywę' }).count();
const usun = await page.getByRole('button', { name: 'Usuń z planu' }).count();
notuj(`K3 ZAKRES: „Dodaj inicjatywę" ×${dodaj}, „Usuń z planu" ×${usun}`);
await zrzut('01-zakres-k3', `Karta planu, „Zakres inicjatyw" (K3): Dodaj ×${dodaj}, Usuń ×${usun}`);

await sekcja('Kolejność i okna');
const polaDat = await page.locator('input[type="date"]').count();
notuj(`K3 OKNA: pól dat na karcie = ${polaDat}`);
await zrzut('02-okna-k3', `„Kolejność i okna" (K3): ${polaDat} pól dat (najwcześniej/docelowa/najpóźniej)`);

await sekcja('Zależności i konflikty');
await zrzut('03-zaleznosci-k3', 'Sekcja „Zależności i konflikty" (K3) widoczna także bez konfliktów');

// ── 2. TA SAMA KARTA: arkusz per rola z K5 ──────────────────────────────────
await sekcja('Obciążenie ról');
const komunikatK3 = await page.locator('text=/Nieznane — brak opublikowanej analizy obciążenia/').count();
const poleCE = page.locator('input[aria-label*="Controls Engineer"]');
const ileCE = await poleCE.count();
notuj(`SCALENIE: komunikat K3 ×${komunikatK3}, pól FTE „Controls Engineer" (K5) = ${ileCE}`);
await zrzut(
  '04-obciazenie-rol-scalone',
  `„Obciążenie ról": komunikat analizy (K3) ×${komunikatK3} NAD arkuszem FTE per rola (K5), pól CE ${ileCE}`
);

for (let i = 0; i < ileCE; i += 1) {
  await poleCE.nth(i).fill('1');
  await poleCE.nth(i).blur();
  await page.waitForTimeout(3000);
}
const poleAnalityk = page.locator('input[aria-label*="Analityk"]');
if (await poleAnalityk.count()) {
  await poleAnalityk.first().fill('0.2');
  await poleAnalityk.first().blur();
  await page.waitForTimeout(3000);
}
const zapisano = await page.locator('text=/Zapisano /').count();
const nieZapisano = await page.locator('text=/Nie zapisano obciążenia ról/').count();
notuj(`ZAPIS FTE: „Zapisano" ×${zapisano}, „Nie zapisano" ×${nieZapisano} (oczekiwane 0)`);
await zrzut('05-fte-wpisane', `FTE wpisane per rola, „Zapisano" ×${zapisano}, błędów zapisu ×${nieZapisano}`);

// ── 3. RELOAD: trwałość ─────────────────────────────────────────────────────
await otworzPlan();
await sekcja('Obciążenie ról');
const wartosciPoReload = await page
  .locator('input[aria-label*="Controls Engineer"]')
  .evaluateAll((pola) => pola.map((p) => p.value));
notuj(`PO RELOAD FTE: ${JSON.stringify(wartosciPoReload)}`);
await zrzut('06-fte-po-reloadzie', `Po przeładowaniu FTE trwałe: ${wartosciPoReload.join(', ')}`);

// ── 4. SEDNO SCALENIA: zapis K3 PO zapisie K5 (jedno CAS, nie dwa) ──────────
await sekcja('Kolejność i okna');
const polePozno = page.locator('input[type="date"][aria-label^="Najpóźniej"]').first();
const etykietaPozno = await polePozno.getAttribute('aria-label');
const przedZmiana = await polePozno.inputValue();
// Data MUSI miescic sie w horyzoncie planu (6 tygodni od 07.09) — pierwszy przebieg
// wpisal 26.10 i K3 slusznie ja odrzucil zdaniem o horyzoncie (zrzut w historii).
const nowaData = '2026-10-12';
await polePozno.fill(nowaData);
await page.waitForTimeout(9000);
const konfliktPoZapisie = await page.locator('text=/w innej wersji niż ta, na której pracujesz/').count();
notuj(
  `K3 PO K5: „${etykietaPozno}" ${przedZmiana} → ${nowaData}; komunikatów o konflikcie wersji ×${konfliktPoZapisie} (oczekiwane 0)`
);
await zrzut(
  '07-data-po-zapisie-fte',
  `Zapis daty (K3) TUŻ PO zapisie FTE (K5) — konfliktów wersji ×${konfliktPoZapisie}`
);
await otworzPlan();
await sekcja('Kolejność i okna');
const dataPoReload = await page.getByLabel(etykietaPozno, { exact: true }).inputValue();
await zrzut('08a-data-po-reloadzie', `Po przeładowaniu data z warsztatu K3: ${dataPoReload}`);
await sekcja('Obciążenie ról');
const fteObokDaty = await page
  .locator('input[aria-label*="Controls Engineer"]')
  .evaluateAll((pola) => pola.map((p) => p.value));
notuj(
  `PO RELOAD DATA: ${dataPoReload} (oczekiwane ${nowaData}); FTE po tej samej stronie: ${JSON.stringify(fteObokDaty)}`
);
await zrzut(
  '08b-fte-po-zapisie-daty',
  `Po zapisie daty (K3) FTE per rola (K5) nietknięte: ${fteObokDaty.join(', ')}`
);

// ── 5. PUBLIKACJA PLANU I ANALIZA Z PLANU (K5) ──────────────────────────────
await sekcja('Decyzje');
const opublikuj = page.getByRole('button', { name: /Opublikuj plan/ });
if (await opublikuj.count()) {
  await opublikuj.first().click();
  await page.waitForTimeout(4000);
  const potwierdz = page.getByRole('button', { name: /^Publikuj/ });
  if (await potwierdz.count()) {
    await potwierdz.first().click();
    await page.waitForTimeout(5000);
  }
}
await page.waitForTimeout(4000);
await zrzut('09-plan-opublikowany', 'Plan opublikowany (dalsza edycja przez nową wersję — K3)');

await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.getByRole('button', { name: /Nowa analiza/ }).first().click();
await page.waitForTimeout(3000);
await page.getByLabel('Capacity analysis name').fill('proba-scal — analiza z planu K3+K5');
const wyborPlanu = page.getByLabel('Capacity source plan');
await wyborPlanu.selectOption({ label: /proba-scal/ }).catch(async () => {
  const opcje = await wyborPlanu.locator('option').allTextContents();
  const index = opcje.findIndex((o) => o.includes('proba-scal'));
  if (index >= 0) await wyborPlanu.selectOption({ index });
});
await page.getByRole('button', { name: /Utwórz analizę/ }).first().click();
await page.waitForTimeout(10000);
await sekcja('Arkusz obciążenia');
const wierszeArkusza = await page.locator('table tbody tr').count();
notuj(`ARKUSZ K5: wierszy okres × rola = ${wierszeArkusza}`);
await zrzut('10-arkusz-okres-rola', `Analiza z planu: arkusz okres × rola, ${wierszeArkusza} wierszy`);

await sekcja('Luki i presja');
await zrzut('11-luki-per-rola', 'Analiza: luka per rola (K5) — nazwa roli, nie sam skalar okresu');

// ── 6. WARIANTY DORADCY: nazwa roli (K5) + kod solvera po polsku (K3) ───────
await sekcja('Decyzje');
const opublikujAnalize = page.getByRole('button', { name: /Opublikuj analizę/ });
if (await opublikujAnalize.count()) {
  await opublikujAnalize.first().click();
  await page.waitForTimeout(7000);
}
const ai = page.getByRole('button', { name: /Pracuj z AI/ });
if (await ai.count()) {
  await ai.first().click();
  await page.waitForTimeout(1500);
  const analizuj = page
    .getByRole('menuitem', { name: /Analizuj/ })
    .or(page.getByRole('button', { name: /^Analizuj/ }));
  if (await analizuj.count()) {
    await analizuj.first().click();
    await page.waitForTimeout(10000);
  }
}
await sekcja('Propozycje zmian');
const rolaWWariancie = await page.locator('text=/dotyczy roli /').count();
const kodySurowe = await page.locator('text=/SOLVER-/').count();
const angielskie = await page.locator('text=/Deterministic solver/').count();
notuj(
  `WARIANTY: „dotyczy roli" (K5) ×${rolaWWariancie}, surowych kodów SOLVER- (K3 niedokończone) ×${kodySurowe}, angielskich zdań ×${angielskie}`
);
await zrzut(
  '12-warianty-doradcy',
  `„Propozycje zmian": nazwa roli ×${rolaWWariancie}, surowych kodów ×${kodySurowe}, angielskich ×${angielskie}`
);

fs.writeFileSync(
  `${OUT}/api-log.txt`,
  [
    '# P15 SCALENIE K3+K5 — wywołania runtime-v1 w przepływie klikanym',
    `# BASE=${BASE}, API=4162, baza=consultify_p15scal, ${new Date().toISOString()}`,
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
await browser.close();
