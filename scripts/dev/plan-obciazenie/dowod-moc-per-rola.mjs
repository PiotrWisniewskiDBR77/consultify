#!/usr/bin/env node
/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — DOWOD NA EKRANIE: moc per rola.
 *
 * Uzycie:
 *   node scripts/dev/plan-obciazenie/dowod-moc-per-rola.mjs <przed|po> <BASE> <AUTH> [PLAN_ID]
 *
 * Klika to, co klika czlowiek:
 *   Plan -> karta planu -> „Obciazenie rol" (wpis FTE per rola) -> reload ->
 *   Opublikuj plan -> Obciazenie -> Nowa analiza z tego planu -> arkusz okres x rola
 *   -> Opublikuj analize -> Pracuj z AI -> Analizuj -> 3 warianty -> reload.
 * Zrzuty 1440x900, motyw JASNY, `.png.json` z url i bledami konsoli,
 * plus pelny log odpowiedzi API tras runtime-v1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3180', AUTH = '/private/tmp/wt-p15-k5/.auth-k5.json', PLAN_ID = ''] =
  process.argv;
const OUT = `/private/tmp/wt-p15-k5/evidence/p15-k5/${faza}`;
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
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/.*(runtime-v1|resource-plan)/i.test(u)) return;
  let body = '';
  try {
    body = (await r.text()).slice(0, 400);
  } catch {
    body = '(brak ciala)';
  }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
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

const sekcja = async (nazwa) => {
  const przycisk = page.getByRole('button', { name: new RegExp(`^${nazwa}`) });
  if (await przycisk.count()) {
    await przycisk.first().click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

// ---------- 1. PLAN: „Obciazenie rol" ----------
await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
// Lista planow startuje na presecie „Opublikowane" — nasz plan jest SZKICEM.
const szkice = page.getByRole('button', { name: /^Szkice/ });
if (await szkice.count()) {
  await szkice.first().click();
  await page.waitForTimeout(3000);
}
const wierszPlanu = page.locator('table tbody tr', { hasText: 'proba-k5' }).first();
await wierszPlanu.waitFor({ timeout: 25000 });
await wierszPlanu.dblclick();
await page.waitForTimeout(7000);
await sekcja('Obciążenie ról');
await zrzut('01-plan-obciazenie-rol-puste', 'Karta planu: „Obciążenie ról" — arkusz inicjatywa × rola przed wpisem');

// Wpisujemy popyt: kazda z 5 inicjatyw potrzebuje 1 FTE Controls Engineera,
// jedna dodatkowo 0,2 FTE Analityka. Podaz: CE 2,5 FTE, Analityk 2,0, PM 1,0.
// Suma okresu (5,2 wobec 5,5) NIE pokazuje luki — pokazuje ja dopiero ROLA.
const poleCE = page.locator('input[aria-label*="Controls Engineer"]');
const ileCE = await poleCE.count();
for (let i = 0; i < ileCE; i += 1) {
  await poleCE.nth(i).fill('1');
  await poleCE.nth(i).blur();
  await page.waitForTimeout(2500);
}
const poleAnalityk = page.locator('input[aria-label*="Analityk"]');
if (await poleAnalityk.count()) {
  await poleAnalityk.first().fill('0.2');
  await poleAnalityk.first().blur();
  await page.waitForTimeout(2500);
}
await zrzut('02-plan-obciazenie-rol-wpisane', 'Karta planu: FTE wpisane per rola, „Zapisano hh:mm"');

// ---------- 2. RELOAD: trwalosc wpisu ----------
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const szkice2 = page.getByRole('button', { name: /^Szkice/ });
if (await szkice2.count()) {
  await szkice2.first().click();
  await page.waitForTimeout(3000);
}
const wiersz2 = page.locator('table tbody tr', { hasText: 'proba-k5' }).first();
if (await wiersz2.count()) {
  await wiersz2.dblclick();
  await page.waitForTimeout(7000);
}
await sekcja('Obciążenie ról');
await zrzut('03-plan-po-reloadzie', 'Po odświeżeniu strony: wpisane FTE są trwałe');

// ---------- 3. OPUBLIKUJ PLAN ----------
await sekcja('Decyzje');
const opublikujPlan = page.getByRole('button', { name: /Opublikuj plan/ });
if (await opublikujPlan.count()) {
  await opublikujPlan.first().click();
  await page.waitForTimeout(4000);
  const potwierdz = page.getByRole('button', { name: /Publikuj|Potwierd/ });
  if (await potwierdz.count()) {
    await potwierdz.first().click();
    await page.waitForTimeout(4000);
  }
}
await zrzut('04-plan-opublikowany', 'Karta planu: plan opublikowany');

// ---------- 4. OBCIAZENIE: nowa analiza z tego planu ----------
await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.getByRole('button', { name: /Nowa analiza/ }).first().click();
await page.waitForTimeout(3000);
const nazwa = page.getByLabel('Capacity analysis name');
await nazwa.fill('proba-k5 — analiza obciążenia ról');
const wyborPlanu = page.getByLabel('Capacity source plan');
await wyborPlanu.selectOption({ label: /proba-k5/ }).catch(async () => {
  const opcje = await wyborPlanu.locator('option').allTextContents();
  const index = opcje.findIndex((o) => o.includes('proba-k5'));
  if (index >= 0) await wyborPlanu.selectOption({ index });
});
await page.waitForTimeout(500);
await zrzut('05-nowa-analiza-formularz', 'Obciążenie: formularz „Nowa analiza" z wyborem opublikowanego planu');
await page.getByRole('button', { name: /Utwórz analizę/ }).first().click();
await page.waitForTimeout(9000);
await sekcja('Arkusz obciążenia');
await zrzut('06-arkusz-okres-rola', 'Karta analizy: arkusz okres × rola z liczbami i źródłem podaży');

await sekcja('Luki i presja');
await zrzut('07-luki-per-rola', 'Karta analizy: luka na roli Controls Engineer w konkretnym tygodniu');

// ---------- 4b. RECZNA KOREKTA PODAZY (zrodlo „Recznie") ----------
await sekcja('Arkusz obciążenia');
const polePodazy = page.locator('input[aria-label*="Controls Engineer"]').first();
if (await polePodazy.count()) {
  await polePodazy.fill('4');
  await polePodazy.blur();
  await page.waitForTimeout(7000);
}
await zrzut('07b-podaz-recznie', 'Karta analizy: ręczna korekta podaży — źródło zmienia się na „Ręcznie"');

// ---------- 5. OPUBLIKUJ ANALIZE + DORADCA ----------
await sekcja('Decyzje');
const opublikujAnalize = page.getByRole('button', { name: /Opublikuj analizę/ });
if (await opublikujAnalize.count()) {
  await opublikujAnalize.first().click();
  await page.waitForTimeout(6000);
}
await zrzut('08-analiza-opublikowana', 'Karta analizy: analiza opublikowana');

const ai = page.getByRole('button', { name: /Pracuj z AI/ });
if (await ai.count()) {
  await ai.first().click();
  await page.waitForTimeout(1500);
  const analizuj = page
    .getByRole('menuitem', { name: /Analizuj/ })
    .or(page.getByRole('button', { name: /^Analizuj/ }));
  if (await analizuj.count()) {
    await analizuj.first().click();
    await page.waitForTimeout(9000);
  }
}
await sekcja('Propozycje zmian');
await zrzut('09-warianty-doradcy', 'Karta analizy: „Propozycje zmian" — 3 warianty z doradcy');

// ---------- 6. RELOAD: trwalosc ----------
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await zrzut('10-lista-po-reloadzie', 'Lista analiz po odświeżeniu: kolumny Role i Luki z liczbami');
// Lista analiz startuje na presecie „Wszystkie" — nasza analiza jest widoczna bez filtrowania.
const wierszAnalizy = page.locator('table tbody tr', { hasText: 'proba-k5' }).first();
if (await wierszAnalizy.count()) {
  await wierszAnalizy.dblclick();
  await page.waitForTimeout(7000);
  await sekcja('Propozycje zmian');
  await zrzut('11-warianty-po-reloadzie', 'Po odświeżeniu: warianty doradcy trwałe');
}

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n'));
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n'));
console.log(`API wywolan: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
await browser.close();
