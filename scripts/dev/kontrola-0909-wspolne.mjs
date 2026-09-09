/**
 * KONTROLA-PO-NAPRAWACH 09.09 — wspólny rdzeń harnessu (logowanie, motyw, log sieci).
 *
 * PUŁAPKA (zmierzona 09.09): wzorzec `/has(?:ł|l)o[^:]*:\s*(\S+)/i` z harnessu
 * TEST-DANE trafia w NOWĄ pierwszą linię pliku sekretów „Rotacja hasła: 2026-…"
 * i zwraca DATĘ zamiast hasła. Celujemy w konkretną linię „Wspólne hasło…".
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const BASE = process.env.BASE || 'http://127.0.0.1:3231';
export const OUT = process.env.OUT ||
  '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/evidence/kontrola-po-naprawach-0909';
const SEKRETY = '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
export const EMAIL = process.env.EMAIL || 'james.whitfield@northwind.example';

export function haslo() {
  const t = fs.readFileSync(SEKRETY, 'utf8');
  const m =
    t.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/) ??
    t.match(/Wspólne hasło[^:]*:\s*(\S+)/);
  if (!m) throw new Error('brak linii ze wspólnym hasłem w pliku sekretów');
  return m[1].trim();
}

export function nowyLog() {
  return { konsola: [], siec: [] };
}

export async function otworz(log) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    locale: 'en-GB',
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') log.konsola.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => log.konsola.push('PAGEERROR ' + String(e).slice(0, 300)));
  page.on('response', (r) => {
    const u = r.url();
    if (!/\/api\//.test(u)) return;
    log.siec.push({
      status: r.status(),
      metoda: r.request().method(),
      url: u.replace(/^https?:\/\/[^/]+/, ''),
      czas: new Date().toISOString(),
    });
  });
  return { browser, context, page };
}

export async function zaloguj(page, jezyk = 'en') {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', haslo());
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);
  await page.evaluate((j) => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const o = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      o.state = o.state || {};
      o.state.theme = 'light';
      localStorage.setItem('consultify-storage', JSON.stringify(o));
    } catch { /* brak magazynu */ }
    localStorage.setItem('i18nextLng', j);
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1');
    } catch { /* brak uzytkownika */ }
    for (const k of ['demo_tour_skipped', 'demo_tour_completed', 'teresa_onboarding_dismissed', 'consultify_teresa_onboarding_seen'])
      localStorage.setItem(k, '1');
  }, jezyk);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  if (/\/login/.test(page.url())) throw new Error('logowanie nieudane, url=' + page.url());
  return page.url();
}

export async function zrzut(page, nazwa, podkatalog = '') {
  const kat = path.join(OUT, podkatalog);
  fs.mkdirSync(kat, { recursive: true });
  const plik = path.join(kat, `${nazwa}.png`);
  await page.screenshot({ path: plik }).catch(() => {});
  const txt = await page.evaluate(() => (document.body.innerText || '').slice(0, 8000)).catch(() => '');
  fs.writeFileSync(plik.replace(/\.png$/, '.txt'), txt);
  return plik;
}
