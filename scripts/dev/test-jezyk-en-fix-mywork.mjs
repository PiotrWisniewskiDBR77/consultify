/**
 * TEST-JEZYK — NAPRAWA 2 błędnych zrzutów EN z pierwszego przebiegu.
 *
 * `getByRole('button', {name: 'Inbox'})` / `{name: 'Tasks'}` w My Work
 * trafiały na globalne ikony nagłówka (tacka/checklist) zamiast na zakładki
 * Menu 2 modułu — `.first()` łapał niewłaściwy element (ten sam tekst
 * dostępny w dwóch miejscach DOM). Efekt: plik `02-tab-inbox.png` pokazywał
 * w rzeczywistości "Notebook", a `02-tab-tasks.png` pokazywał "Calendar"
 * z otwartym popoverem "My Action Plan" — złapane przez sygnał A6 (rozjazd
 * liczby linii EN/PL), potwierdzone okiem na zrzucie.
 *
 * Naprawa: klik po POZYCJI w pasku zakładek (top 55-75, left 65-1000),
 * ta sama metoda co w dogrywkach PL — tu użyta też dla EN.
 *
 * BEZ przełączania języka — konto zostaje na EN przez cały czas.
 * Użycie: node scripts/dev/test-jezyk-en-fix-mywork.mjs
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

const TABS = ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Vaults'];
const NAPRAW = ['Inbox', 'Tasks'];

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function czytajPasek(p) {
  return p.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, [role="tab"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top >= 55 && r.top <= 75 && r.left >= 65 && r.left <= 1000 && r.width > 0) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 40 && !t.includes('\n')) out.push(t);
      }
    });
    return out;
  });
}
async function klijnijIdx(p, idx) {
  return p.evaluate((i) => {
    const out = [];
    document.querySelectorAll('button, [role="tab"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top >= 55 && r.top <= 75 && r.left >= 65 && r.left <= 1000 && r.width > 0) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 40 && !t.includes('\n')) out.push(el);
      }
    });
    const el = out[i];
    if (!el) return false;
    el.click();
    return true;
  }, idx);
}

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

await p.goto(`${BASE}/my-work`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1800);
const kolej = await czytajPasek(p);
console.log('EN kolejność my-work:', JSON.stringify(kolej));

const dir = path.join(OUT, 'en', '02-my-work');
for (const tabName of NAPRAW) {
  const idx = kolej.indexOf(tabName);
  const screenId = `02-tab-${slug(tabName)}`;
  if (idx === -1) {
    console.log('BLAD: nie znaleziono', tabName);
    continue;
  }
  await p.goto(`${BASE}/my-work`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1500);
  const ok = await klijnijIdx(p, idx);
  console.log(tabName, 'klik OK?', ok);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
  const innerText = await p.evaluate(() => document.body.innerText || '');
  fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
  console.log('NAPRAWIONO', screenId, '->', p.url());
}

await b.close();
console.log('GOTOWE');
