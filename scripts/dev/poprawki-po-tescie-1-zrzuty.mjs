#!/usr/bin/env node
/**
 * POPRAWKI-PO-TESCIE-1 — harness zrzutow PRZED/PO dla defektow z RAPORT_DANE.md.
 * Uzycie: node scripts/dev/poprawki-po-tescie-1-zrzuty.mjs <faza> <lista-id-defektow>
 *   faza = przed | po
 * Haslo czytane w czasie wykonania z pliku POZA repo (HASLO_PLIK), nigdy z literalu.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:3229';
const ROOT = process.env.ROOT || '/Users/piotrwisniewski/Developer/wt/poprawki-po-tescie';
const HASLO_PLIK = process.env.HASLO_PLIK || '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
const EMAIL = process.env.EMAIL || 'james.whitfield@northwind.example';
const FAZA = process.argv[2] || 'przed';
const WYBOR = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);

function haslo() {
  const raw = fs.readFileSync(HASLO_PLIK, 'utf8');
  const m = raw.match(/has(?:ł|l)o[^:]*:\s*(\S+)/i);
  return m ? m[1] : raw.trim();
}

/** Scenariusze: id = katalog defektu, kroki = co kliknac po wejsciu na route. */
const SCENARIUSZE = [
  { id: "D-01-ocena-nazwa", route: "/assessment?tab=processes" },
  { id: 'D-02-ocena-library', route: '/assessment', tab: 'Library', wiersz: true },
  { id: 'D-17-v9-overrides', route: '/my-work' },
  { id: 'D-06-mywork-podglad', route: '/my-work', wiersz: true },
  { id: 'D-08-execution-resources', route: '/execution', tab: 'Resources' },
  { id: 'D-09-execution-dashboard', route: '/execution' },
  { id: 'D-11-audyty-library', route: '/audit-programs', tab: 'Library' },
  { id: 'D-15-inicjatywy-reczne', route: '/initiatives', menu2: true },
  { id: 'D-07-materialy-podglad', route: '/presentations', wiersz: true },
  { id: 'D-10-admin-members', route: '/admin', tab: 'Members' },
  { id: 'D-12-format-daty', route: '/results/kpi' },
];

async function ustawMotyw(page, motyw) {
  await page.evaluate((m) => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = m;
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch { /* brak magazynu */ }
  }, motyw);
}

async function main() {
  const scen = WYBOR.length ? SCENARIUSZE.filter(s => WYBOR.some(w => s.id.startsWith(w))) : SCENARIUSZE;
  if (!scen.length) { console.error('brak scenariuszy dla:', WYBOR.join(',')); process.exit(1); }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-GB' });
  const page = await context.newPage();
  const konsola = [];
  page.on('console', m => { if (m.type() === 'error') konsola.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => konsola.push('PAGEERROR ' + String(e).slice(0, 200)));

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', haslo());
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    localStorage.setItem('i18nextLng', 'en');
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1'); } catch { /* brak uzytkownika */ }
    for (const k of ['demo_tour_skipped', 'demo_tour_completed', 'teresa_onboarding_dismissed', 'consultify_teresa_onboarding_seen']) localStorage.setItem(k, '1');
  });
  await ustawMotyw(page, 'light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  console.log('zalogowany:', page.url());

  for (const s of scen) {
    for (const motyw of ['light', 'dark']) {
      const kat = path.join(ROOT, 'evidence/poprawki-po-tescie-1', s.id, FAZA);
      fs.mkdirSync(kat, { recursive: true });
      await ustawMotyw(page, motyw);
      await page.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(4000);
      await page.keyboard.press('Escape').catch(() => {});
      if (s.tab) {
        const el = page.getByRole('tab', { name: s.tab, exact: true }).first();
        if (await el.isVisible({ timeout: 2500 }).catch(() => false)) { await el.click({ force: true }).catch(() => {}); await page.waitForTimeout(3000); }
        else console.log(`  ! brak zakladki ${s.tab} na ${s.route}`);
      }
      if (s.wiersz) {
        const w = page.locator('tbody tr').first();
        if (await w.isVisible({ timeout: 3000 }).catch(() => false)) { await w.click({ force: true }).catch(() => {}); await page.waitForTimeout(3000); }
        else console.log(`  ! brak wiersza na ${s.route}`);
      }
      if (s.menu2) {
        const b = page.locator('button:has-text("New"), button:has-text("Create")').first();
        if (await b.isVisible({ timeout: 2500 }).catch(() => false)) { await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(2500); }
      }
      const plik = path.join(kat, `${motyw === 'light' ? 'jasny' : 'ciemny'}.png`);
      await page.screenshot({ path: plik }).catch(() => {});
      const tekst = await page.evaluate(() => (document.body.innerText || '').slice(0, 4000)).catch(() => '');
      fs.writeFileSync(plik.replace(/\.png$/, '.txt'), tekst);
      console.log(`[ZRZUT] ${s.id} ${motyw} -> ${plik}`);
    }
  }
  fs.writeFileSync(path.join(ROOT, 'evidence/poprawki-po-tescie-1', `konsola-${FAZA}.txt`), konsola.join('\n'));
  await browser.close();
}
main().catch(e => { console.error('BLAD:', e); process.exit(1); });
