#!/usr/bin/env node
/** AUDYT KONCOWY — Inicjatywy, scenariusz B (Plan), wersja 2 — poprawiony przeplyw. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
fs.mkdirSync(OUT, { recursive: true });

const PLAN_NAZWA = 'ODBIÓR NOC 07.09 — plan audytu';
const INICJATYWY_5 = [
  'AI Governance & Ethics Framework',
  'Change Management & Digital Culture Program',
  'ERP-MES Real-time Integration',
  'Operator Upskilling Program — 50 Pilot',
  'Predictive Maintenance — CNC Machines',
];
const INICJATYWA_6 = 'Customer 360 & CRM Enhancement';

const konsola = [];
const apiLog = [];
let page, context;

function logApi(response) {
  const u = response.url();
  if (!/\/api\/.*(runtime-v1|resource-plan|plan-scenarios|planning)/i.test(u)) return;
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

  console.log('=== 01: Plan -> Nowy plan (formularz nazwy/parametrow) ===');
  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const nowyPlan = page.getByRole('button', { name: 'Nowy plan' }).first();
  await nowyPlan.waitFor({ timeout: 15000 });
  await nowyPlan.click();
  await page.waitForTimeout(1500);
  const nazwaInput = page.getByLabel('Nazwa planu nadana przez Ciebie');
  await nazwaInput.waitFor({ timeout: 10000 });
  await nazwaInput.fill(PLAN_NAZWA);
  await zrzut('B01-formularz-nowego-planu', 'Plan -> "Nowy plan" -> formularz (nazwa, jednostka, horyzont, liczba tygodni)');

  console.log('=== 02: Utworz plan ===');
  const utworz = page.getByRole('button', { name: /Utwórz plan/ });
  await utworz.waitFor({ timeout: 10000 });
  const utworzDisabled = await utworz.isDisabled().catch(() => null);
  console.log('  "Utwórz plan" disabled?', utworzDisabled);
  await utworz.click({ force: true });
  await page.waitForTimeout(4000);
  await zrzut('B02-plan-utworzony-karta', 'Po "Utwórz plan" — karta nowego planu (szkic, 0 inicjatyw)');

  console.log('=== 03: Pracuj z AI -> Uzupelnij caly dokument (generator) ===');
  const pracujZAI = page.locator('[data-testid="pracuj-z-ai"]');
  await pracujZAI.waitFor({ timeout: 15000 });
  await pracujZAI.click();
  await page.waitForTimeout(800);
  await zrzut('B03-menu-pracuj-z-ai', 'Menu "Pracuj z AI" otwarte — opcje Analizuj / Uzupełnij tę sekcję / Uzupełnij cały dokument');
  const uzupelnijDok = page.getByRole('menuitem', { name: /Uzupełnij cały dokument/ });
  await uzupelnijDok.click();
  await page.waitForTimeout(1500);
  await zrzut('B04-generator-otwarty', 'Generator planu otwarty (krok 1 Źródło, krok 2 Wybór — inicjatywy zatwierdzone)');

  console.log('=== 04: wybor 5 zatwierdzonych inicjatyw ===');
  for (const nazwa of INICJATYWY_5) {
    const etykieta = page.locator('label', { hasText: nazwa }).first();
    const checkbox = etykieta.locator('input[type=checkbox]');
    const count = await checkbox.count();
    console.log(`  ${nazwa}: checkbox znaleziony=${count > 0}`);
    if (count) await checkbox.check({ force: true });
  }
  await page.waitForTimeout(500);
  const trybSelect = page.getByLabel('Tryb analizy');
  const trybMocyBlocked = await page.locator('option[value="CAPACITY"]').isDisabled().catch(() => null);
  console.log('  tryb CAPACITY disabled (brak analizy)?', trybMocyBlocked);
  await zrzut('B05-parametry-wypelnione', `5 inicjatyw zaznaczonych. Tryb "Według obciążenia ról" disabled=${trybMocyBlocked}`);

  console.log('=== 05: Generuj propozycje ===');
  const generuj = page.getByRole('button', { name: 'Generuj propozycję' });
  await generuj.click();
  await page.waitForTimeout(6000);
  await zrzut('B06-propozycja-solvera', 'Po "Generuj propozycję" — tabela z 5 wierszami i uzasadnieniami po polsku');

  console.log('=== 06: Zatwierdz propozycje w generatorze ===');
  const zatwierdzGen = page.getByRole('button', { name: 'Zatwierdź' }).last();
  const mamZatwierdz = await zatwierdzGen.count();
  console.log('  przycisk Zatwierdz w generatorze:', mamZatwierdz);
  if (mamZatwierdz) { await zatwierdzGen.click(); await page.waitForTimeout(4000); }
  await zrzut('B07-po-zatwierdzeniu-generator', 'Po "Zatwierdź" w generatorze — komunikat "Zapisano hh:mm"');

  console.log('=== 07: zamknij generator ===');
  const zamknij = page.getByRole('button', { name: 'Zamknij' });
  if (await zamknij.count()) { await zamknij.first().click(); await page.waitForTimeout(1500); }
  await zrzut('B08-karta-planu-po-generatorze', 'Karta planu po zamknieciu generatora — okna widoczne w sekcji Kolejnosc');

  console.log('=== 08: reload — trwalosc ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await zrzut('B09-po-reloadzie-lista-planow', 'Lista planow po odswiezeniu strony');

  fs.writeFileSync(`${OUT}/api-log-B.txt`, apiLog.join('\n\n') + '\n');
  await browser.close();
  console.log('GOTOWE scenariusz B (czesc 1: utworzenie planu + generator).');
}
main().catch(async (err) => {
  console.error('AWARIA B:', err);
  try { if (page) await zrzut('99-awaria-B', String(err?.message || err).slice(0, 400), {}); } catch {}
  fs.writeFileSync(`${OUT}/api-log-B.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
