/**
 * TEST-JEZYK — DOGRYWKA PL #4 (ostatnia): 8 ekranów "91-tworzenie" nie
 * zmierzonych w PL, bo przyrząd szukał przycisku po angielskiej nazwie
 * (New|Add|Create|Import) — po przełączeniu na PL przycisk nazywa się inaczej.
 * Naprawa: szerszy regex wielojęzyczny. Dodatkowo ponawia 2 "90-podglad-rekordu"
 * (my-work, initiatives), które w dogrywce PL dostały "brak wierszy tabeli"
 * (podejrzenie: wyścig czasowy zaraz po przełączeniu języka, nie realny brak
 * danych — w EN te same ekrany miały dane).
 *
 * PIĄTY i OSTATNI cykl przełączenia języka w tej paczce.
 * Użycie: node scripts/dev/test-jezyk-pl-retry4.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'evidence/test-jezyk-dane-0909/jezyk');

const BASE = 'https://staging.consultify.ai';
const SECRETS_PATH = path.join(process.env.HOME, 'Developer/consultify-secrets/northwind-konta-STAGING.txt');
const SECRETS = fs.readFileSync(SECRETS_PATH, 'utf8');
const EMAIL = SECRETS.match(/james\.whitfield@northwind\.example/)[0];
const HASLO = SECRETS.match(/Wspólne hasło[^:]*:\s*(\S+)/)[1];

const TWORZENIE = [
  { id: '01-chat', route: '/chat' },
  { id: '04-tools', route: '/discovery-tools' },
  { id: '06-initiatives', route: '/initiatives' },
  { id: '08-results', route: '/results/kpi' },
  { id: '09-finance', route: '/finance' },
  { id: '10-materials', route: '/presentations' },
  { id: '13-organization', route: '/organization/profile' },
];
const PODGLAD = [
  { id: '02-my-work', route: '/my-work' },
  { id: '06-initiatives', route: '/initiatives' },
];

const raport = { start: new Date().toISOString(), naprawione: [], dalejNA: [] };
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();

await p.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(EMAIL);
await p.locator('input[type="password"]').first().fill(HASLO);
await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
await p.waitForTimeout(2000);
await p.evaluate(() => {
  const K = 'consultify-storage';
  const r = localStorage.getItem(K);
  const o = r ? JSON.parse(r) : { state: {}, version: 0 };
  o.state = { ...(o.state || {}), theme: 'light' };
  localStorage.setItem(K, JSON.stringify(o));
});
await p.reload({ waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(1500);

await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Polski|Polish/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);

const RE_TWORZENIE = /^(New|Add|Create|Import|Nowy|Nowa|Nowe|Dodaj|Utwórz|Utworz|Importuj|Zaimportuj)\b/i;

for (const mod of TWORZENIE) {
  const dir = path.join(OUT, 'pl', mod.id);
  fs.mkdirSync(dir, { recursive: true });
  const screenId = '91-tworzenie';
  try {
    await p.goto(`${BASE}${mod.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await p.waitForTimeout(2200);
    const przycisk = p.getByRole('button', { name: RE_TWORZENIE }).first();
    if (!(await przycisk.count())) throw new Error('brak przycisku tworzenia (PL regex)');
    await przycisk.click({ timeout: 5000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
    const innerText = await p.evaluate(() => document.body.innerText || '');
    fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
    raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
    console.log('[retry4]', mod.id, screenId, '->', p.url());
  } catch (e) {
    raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
    console.log('[retry4] BLAD', mod.id, screenId, String(e.message || e).slice(0, 150));
  } finally {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(300);
  }
}

for (const mod of PODGLAD) {
  const dir = path.join(OUT, 'pl', mod.id);
  fs.mkdirSync(dir, { recursive: true });
  const screenId = '90-podglad-rekordu';
  try {
    await p.goto(`${BASE}${mod.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const wiersz = p.locator('table tbody tr, [role="row"]:not([aria-rowindex="1"])').first();
    if (!(await wiersz.count())) throw new Error('brak wierszy tabeli (2. próba)');
    await wiersz.click({ timeout: 5000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
    const innerText = await p.evaluate(() => document.body.innerText || '');
    fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
    raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
    console.log('[retry4]', mod.id, screenId, '->', p.url());
  } catch (e) {
    raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
    console.log('[retry4] BLAD', mod.id, screenId, String(e.message || e).slice(0, 150));
  } finally {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(300);
  }
}

await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /English|Angielski/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);
fs.mkdirSync(path.join(OUT, 'en', '00-przywrocenie'), { recursive: true });
await p.screenshot({ path: path.join(OUT, 'en', '00-przywrocenie', '06-po-dogrywce4-en-FINALNE.png'), fullPage: false });
const bodyTxt = await p.evaluate(() => document.body.innerText || '');
fs.writeFileSync(path.join(OUT, 'en', '00-przywrocenie', '06-po-dogrywce4-en-FINALNE.txt'), bodyTxt, 'utf8');

await b.close();
raport.koniec = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'pl-retry4-raport.json'), JSON.stringify(raport, null, 1));
console.log(`\nDOGRYWKA #4 GOTOWA. Naprawione: ${raport.naprawione.length}  Dalej N/A: ${raport.dalejNA.length}`);
console.log('Dalej N/A:', JSON.stringify(raport.dalejNA, null, 1));
