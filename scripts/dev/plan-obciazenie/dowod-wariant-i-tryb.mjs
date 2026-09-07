#!/usr/bin/env node
/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K6/K7 — DOWOD NA EKRANIE.
 *
 * Uzycie:
 *   node scripts/dev/plan-obciazenie/dowod-wariant-i-tryb.mjs <przed|po> <BASE> <AUTH> <ZNACZNIK> [KATALOG]
 *
 * Klika to, co klika czlowiek:
 *   Plan -> karta planu -> „Obciazenie rol" (arkusz z powiazanej analizy)
 *   -> Obciazenie -> karta analizy -> „Pracuj z AI -> Analizuj" -> 3 warianty
 *   -> „Przesun kolejnosc" -> Decyzje (slad wyboru + link do planu)
 *   -> Plan -> szkic v+1 z propozycja -> Zatwierdz -> Opublikuj -> reload.
 * Para negatywna: plan BEZ opublikowanej analizy — tryb „wg obciazenia rol"
 * nieaktywny z powodem.
 *
 * Zrzuty 1440x900, motyw JASNY, `.png.json` z url i bledami konsoli,
 * plus pelny log odpowiedzi API tras runtime-v1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  faza = 'po',
  BASE = 'http://localhost:3183',
  AUTH = '/private/tmp/wt-p15-k67/.run/auth-k67.json',
  ZNACZNIK = 'proba-k67',
  KATALOG = '/private/tmp/wt-p15-k67/evidence/p15-k67',
  TYLKO = '',
] = process.argv;
const tylkoNegatyw = TYLKO === 'negatyw';
const OUT = `${KATALOG}/${faza}`;
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
      {
        nazwa,
        opis,
        faza,
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
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

const sekcja = async (nazwa) => {
  const przycisk = page.getByRole('button', { name: new RegExp(`^${nazwa}`) });
  if (await przycisk.count()) {
    await przycisk.first().click();
    await page.waitForTimeout(2500);
    return true;
  }
  console.log(`(brak sekcji ${nazwa})`);
  return false;
};
const preset = async (nazwa) => {
  const p = page.getByRole('button', { name: new RegExp(`^${nazwa}`) });
  if (await p.count()) {
    await p.first().click();
    await page.waitForTimeout(3000);
  }
};
const otworzWiersz = async (tekst) => {
  const wiersz = page.locator('table tbody tr', { hasText: tekst }).first();
  await wiersz.waitFor({ timeout: 25000 });
  await wiersz.dblclick();
  await page.waitForTimeout(7000);
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

// ---------- 1. PLAN: „Obciazenie rol" z powiazanej analizy ----------
if (!tylkoNegatyw) {
await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await preset('Opublikowane');
await otworzWiersz(ZNACZNIK);
await sekcja('Obciążenie ról');
await zrzut('01-plan-obciazenie-rol', 'Karta planu: „Obciążenie ról" — arkusz okres × rola z powiązanej opublikowanej analizy');

// ---------- 2. OBCIAZENIE: karta analizy -> Pracuj z AI -> Analizuj ----------
await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await preset('Opublikowane');
await otworzWiersz(ZNACZNIK);
await sekcja('Luki i presja');
await zrzut('02-analiza-luki-per-rola', 'Karta analizy: luka na roli Controls Engineer');

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
await zrzut('03-trzy-warianty', 'Karta analizy: trzy warianty doradcy (Zmień kolejność / Podziel zakres / Zwiększ dostępność)');

// ---------- 3. WYBOR „Przesun kolejnosc" ----------
const wariant = page.getByLabel('Opcja obciążenia: Zmień kolejność');
if (await wariant.count()) {
  await wariant.first().getByRole('button').first().click();
  await page.waitForTimeout(12000);
}
await zrzut('04-wariant-wybrany', 'Karta analizy: wariant „Przesuń kolejność" wybrany — komunikat o zapisie');
await sekcja('Decyzje');
await zrzut('05-decyzja-slad', 'Karta analizy → Decyzje: „Wybrano wariant: … → plan vN (szkic)" z linkiem');

// ---------- 4. PLAN: szkic v+1 z propozycja -> Zatwierdz -> Opublikuj ----------
await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await preset('Szkice');
await otworzWiersz(ZNACZNIK);
await sekcja('Zależności i konflikty');
await zrzut('06-plan-szkic-propozycja', 'Karta planu (szkic v+1): propozycja solvera z przesuniętymi oknami i uzasadnieniem po polsku');

const zatwierdz = page.getByRole('button', { name: /^Zatwierdź/ });
if (await zatwierdz.count()) {
  await zatwierdz.first().click();
  await page.waitForTimeout(9000);
}
await zrzut('07-propozycja-zatwierdzona', 'Karta planu: propozycja zatwierdzona — okna zapisane na serwerze');

await sekcja('Kolejność i okna');
await zrzut('08-okna-po-przesunieciu', 'Karta planu: okna po przesunięciu');

await sekcja('Decyzje');
const opublikuj = page.getByRole('button', { name: /Opublikuj plan/ });
if (await opublikuj.count()) {
  await opublikuj.first().click();
  await page.waitForTimeout(5000);
  const potwierdz = page.getByRole('button', { name: /Publikuj|Potwierd/ });
  if (await potwierdz.count()) {
    await potwierdz.first().click();
    await page.waitForTimeout(5000);
  }
}
await zrzut('09-plan-opublikowany', 'Karta planu: nowa wersja opublikowana');

// ---------- 5. RELOAD: trwalosc ----------
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await preset('Opublikowane');
await otworzWiersz(ZNACZNIK);
await sekcja('Kolejność i okna');
await zrzut('10-po-reloadzie', 'Po odświeżeniu: przesunięte okna są trwałe');

}

// ---------- 6. PARA NEGATYWNA: plan bez opublikowanej analizy ----------
await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await preset('Szkice');
const wierszBez = page.locator('table tbody tr', { hasText: 'bez-analizy' }).first();
if (await wierszBez.count()) {
  await wierszBez.dblclick();
  await page.waitForTimeout(7000);
  await sekcja('Obciążenie ról');
  await zrzut('11-plan-bez-analizy', 'Karta planu bez analizy: „Nieznane — brak opublikowanej analizy obciążenia" + „Nowa analiza z tego planu"');
  const aiPlan = page.getByRole('button', { name: /Pracuj z AI/ });
  if (await aiPlan.count()) {
    await aiPlan.first().click();
    await page.waitForTimeout(1500);
    const uzupelnij = page
      .getByRole('menuitem', { name: /Uzupełnij cały dokument/ })
      .or(page.getByRole('button', { name: /Uzupełnij cały dokument/ }));
    if (await uzupelnij.count()) {
      await uzupelnij.first().click();
      await page.waitForTimeout(2500);
      // Menu 5 pyta „Uruchomic AI?" — generator otwiera sie dopiero po Zatwierdz.
      const potwierdzAI = page.getByRole('button', { name: /^Zatwierdź/ });
      if (await potwierdzAI.count()) {
        await potwierdzAI.last().click();
        await page.waitForTimeout(4000);
      }
    }
  }
  await zrzut('12-generator-tryb-nieaktywny', 'Generator: tryb „Według obciążenia ról" NIEAKTYWNY z powodem po polsku');
}

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n'));
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n'));
console.log(`API wywolan: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
await browser.close();
