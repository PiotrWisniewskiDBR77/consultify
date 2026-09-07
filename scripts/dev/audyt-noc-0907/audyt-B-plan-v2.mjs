#!/usr/bin/env node
/**
 * AUDYT KONCOWY — Inicjatywy, scenariusz B (Plan), wersja 3 — naprawiony przeplyw.
 *
 * Przyczyna awarii poprzednika (99-awaria-B): "pracuj-z-ai" nie renderuje sie na
 * LISCIE planow — dopiero po otwarciu warsztatu planu (workspaceOpen=true, karta
 * PlanCard). Poprzednik nie wypelnil pola "Nazwa planu" (zly selektor: xpath
 * sibling zamiast aria-label), wiec "Utworz plan" byl disabled (wymaga
 * newName.trim()), karta nigdy sie nie otworzyla i "pracuj-z-ai" nie istnial
 * na ekranie (patrz src/components/Initiatives/PlanScenarioSurface.tsx:1738-1743
 * — input ma aria-label="Nazwa planu nadana przez Ciebie", nie sibling po tekscie).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
fs.mkdirSync(OUT, { recursive: true });

const PLAN_NAZWA = 'ODBIÓR NOC 07.09 — plan audytu v3';
const INICJATYWY_5 = [
  'AI Governance & Ethics Framework',
  'Change Management & Digital Culture Program',
  'ERP-MES Real-time Integration',
  'Operator Upskilling Program — 50 Pilot',
  'Predictive Maintenance — CNC Machines',
];

const konsola = [];
const apiLog = [];
let page, context;

function logApi(response) {
  const u = response.url();
  if (!/\/api\/.*(runtime-v1|resource-plan|plan-scenarios|planning|capacity-roles)/i.test(u)) return;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    apiLog.push(`${new Date().toISOString()} ${response.request().method()} ${response.status()} ${u.replace(BASE, '')}\n    ${body.slice(0, 400)}`);
  });
}
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}
async function ustawMotywJasny() {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = 'consultify-storage';
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'light' };
    localStorage.setItem(KEY, JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  if (await pomin.first().isVisible({ timeout: 2000 }).catch(() => false)) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}

async function main() {
  const browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  await ustawMotywJasny();

  console.log('=== 01: Plan -> Nowy plan (formularz) ===');
  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const nowyPlan = page.getByRole('button', { name: 'Nowy plan' }).first();
  await nowyPlan.waitFor({ timeout: 15000 });
  await nowyPlan.click();
  await page.waitForTimeout(1000);

  console.log('=== 02: wypelnij nazwe (aria-label, NIE xpath-sibling) ===');
  const nazwaInput = page.getByLabel('Nazwa planu nadana przez Ciebie');
  await nazwaInput.waitFor({ timeout: 10000 });
  await nazwaInput.fill(PLAN_NAZWA);
  await page.waitForTimeout(300);
  await zrzut('B01b-formularz-wypelniony', 'Plan -> "Nowy plan" -> formularz z wypelniona nazwa (aria-label selector)');

  const utworz = page.getByRole('button', { name: /Utwórz plan/ });
  await utworz.waitFor({ timeout: 10000 });
  const disabled = await utworz.isDisabled().catch(() => null);
  console.log('  "Utwórz plan" disabled?', disabled);
  await utworz.click();
  await page.waitForTimeout(3000);

  console.log('=== 03: czekam na otwarcie warsztatu planu (pracuj-z-ai) ===');
  const pracujZAI = page.locator('[data-testid="pracuj-z-ai"]');
  await pracujZAI.waitFor({ timeout: 20000 });
  await zrzut('B02b-warsztat-otwarty', 'Karta planu (warsztat) otwarta po "Utwórz plan" — szkic, 0 inicjatyw, "Pracuj z AI" widoczny w toolbarze');

  console.log('=== 04: Pracuj z AI -> Uzupelnij caly dokument (generator) ===');
  await pracujZAI.click();
  await page.waitForTimeout(800);
  await zrzut('B03b-menu-pracuj-z-ai', 'Menu "Pracuj z AI" otwarte');
  const uzupelnijDok = page.getByRole('menuitem', { name: /Uzupełnij cały dokument/ });
  await uzupelnijDok.waitFor({ timeout: 5000 });
  await uzupelnijDok.click();
  await page.waitForTimeout(1000);

  console.log('=== 04b: brama zgody "Uruchomić AI?" -> Zatwierdź ===');
  const zgodaZatwierdz = page.locator('[data-testid="pracuj-z-ai-zatwierdz"]');
  const mamZgode = await zgodaZatwierdz.count();
  console.log('  brama zgody obecna:', mamZgode > 0);
  if (mamZgode) {
    await zrzut('B04a-brama-zgody-ai', 'Brama zgody "Uruchomić AI?" przed generatorem — Zatwierdź/Odrzuć');
    await zgodaZatwierdz.click();
    await page.waitForTimeout(1500);
  }
  await zrzut('B04b-generator-otwarty', 'Generator planu otwarty (krok 1 Źródło, krok 2 Wybór — inicjatywy zatwierdzone)');

  console.log('=== 05: wybor 5 zatwierdzonych inicjatyw ===');
  for (const nazwa of INICJATYWY_5) {
    const etykieta = page.locator('label', { hasText: nazwa }).first();
    const checkbox = etykieta.locator('input[type=checkbox]');
    const count = await checkbox.count();
    console.log(`  ${nazwa}: checkbox znaleziony=${count > 0}`);
    if (count) await checkbox.check({ force: true });
  }
  await page.waitForTimeout(500);
  await zrzut('B05b-parametry-wypelnione', '5 inicjatyw zaznaczonych w generatorze');

  console.log('=== 06: Generuj propozycje ===');
  const generuj = page.getByRole('button', { name: 'Generuj propozycję' });
  await generuj.waitFor({ timeout: 10000 });
  await generuj.click();
  await page.waitForTimeout(6000);
  await zrzut('B06b-propozycja-solvera', 'Po "Generuj propozycję" — tabela z wierszami i uzasadnieniami po polsku');

  console.log('=== 07: Zatwierdz propozycje w generatorze ===');
  const zatwierdzGen = page.getByRole('button', { name: 'Zatwierdź' }).last();
  const mamZatwierdz = await zatwierdzGen.count();
  console.log('  przycisk Zatwierdz w generatorze:', mamZatwierdz);
  if (mamZatwierdz) { await zatwierdzGen.click(); await page.waitForTimeout(4000); }
  await zrzut('B07b-po-zatwierdzeniu-generator', 'Po "Zatwierdź" w generatorze');

  console.log('=== 08: zamknij generator ===');
  const zamknij = page.getByRole('button', { name: 'Zamknij' });
  if (await zamknij.count()) { await zamknij.first().click(); await page.waitForTimeout(1500); }
  await zrzut('B08b-karta-planu-po-generatorze', 'Karta planu po zamknieciu generatora — okna widoczne w sekcji Kolejnosc/Zakres');

  console.log('=== 09: sekcja "Obciazenie rol" -> edycja FTE ===');
  const sekcjeBtn = page.getByRole('button', { name: /^Sekcje/ });
  await sekcjeBtn.click();
  await page.waitForTimeout(500);
  const obciazenieItem = page.getByRole('menuitem', { name: /Obciążenie ról/ });
  await obciazenieItem.waitFor({ timeout: 5000 });
  await obciazenieItem.click();
  await page.waitForTimeout(1500);
  await zrzut('B09b-sekcja-obciazenie-rol', 'Sekcja "Obciążenie ról" karty planu — arkusz inicjatywa x rola (FTE)');

  const pierwszyInput = page.locator('table input[aria-label^="FTE "]').first();
  const mamInput = await pierwszyInput.count();
  console.log('  input FTE znaleziony:', mamInput);
  let ariaLabelUzyty = null;
  if (mamInput) {
    ariaLabelUzyty = await pierwszyInput.getAttribute('aria-label');
    await pierwszyInput.fill('2.5');
    await pierwszyInput.blur();
    await page.waitForTimeout(2000);
    await zrzut('B10b-fte-wpisane', `Wpisano FTE=2.5 dla "${ariaLabelUzyty}" i odblurowano (auto-save)`, { ariaLabelUzyty });
  }

  console.log('=== 10: reload — trwalosc FTE ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const sekcjeBtn2 = page.getByRole('button', { name: /^Sekcje/ });
  if (await sekcjeBtn2.count()) {
    await sekcjeBtn2.click();
    await page.waitForTimeout(500);
    const obciazenieItem2 = page.getByRole('menuitem', { name: /Obciążenie ról/ });
    if (await obciazenieItem2.count()) { await obciazenieItem2.click(); await page.waitForTimeout(1500); }
  }
  let wartoscPoReloadzie = null;
  if (ariaLabelUzyty) {
    const inputPoReloadzie = page.locator(`input[aria-label="${ariaLabelUzyty}"]`);
    if (await inputPoReloadzie.count()) wartoscPoReloadzie = await inputPoReloadzie.inputValue();
  }
  console.log('  wartosc FTE po reloadzie:', wartoscPoReloadzie);
  await zrzut('B11b-po-reloadzie-fte-trwale', `Po reloadzie — FTE odczytane="${wartoscPoReloadzie}" (oczekiwane "2.5")`, { wartoscPoReloadzie, oczekiwane: '2.5' });

  fs.writeFileSync(`${OUT}/api-log-B-v2.txt`, apiLog.join('\n\n') + '\n');
  await browser.close();
  console.log('GOTOWE scenariusz B v2 (plan + generator + obciazenie rol + trwalosc).');
}
main().catch(async (err) => {
  console.error('AWARIA B v2:', err);
  try { if (page) await zrzut('99-awaria-B-v2', String(err?.message || err).slice(0, 400), {}); } catch (e2) { console.error('nie udalo sie zrzutu:', e2); }
  fs.writeFileSync(`${OUT}/api-log-B-v2.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
