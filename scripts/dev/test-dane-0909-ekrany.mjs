#!/usr/bin/env node
/**
 * TEST-DANE 09.09 — harness B1/B2/B5. Przechodzi wszystkie 16 modulow:
 * korzen modulu + wykryte zakladki Menu 2 + podglad pierwszego rekordu.
 * Zbiera: bledy konsoli, odpowiedzi 4xx/5xx, liczbe wierszy, wypelnienie podgladu.
 * Haslo czytane z pliku POZA repo w czasie wykonania.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:3227';
const OUT = process.env.OUT || '/Users/piotrwisniewski/Developer/wt/test-dane/evidence/test-jezyk-dane-0909/dane';
const SEKRETY = '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.EMAIL || 'james.whitfield@northwind.example';
function haslo() {
  const m = fs.readFileSync(SEKRETY, 'utf8').match(/has(?:ł|l)o[^:]*:\s*(\S+)/i);
  if (!m) throw new Error('brak hasla w pliku sekretow');
  return m[1];
}

const MODULY = [
  { id: '01-chat', nazwa: 'Chat', route: '/chat' },
  { id: '02-mywork', nazwa: 'My Work', route: '/my-work' },
  { id: '03-interview', nazwa: 'Interview', route: '/interview' },
  { id: '04-tools', nazwa: 'Tools', route: '/discovery-tools' },
  { id: '05-assessment', nazwa: 'Assessment', route: '/assessment' },
  { id: '06-audits', nazwa: 'Audits', route: '/audit-programs' },
  { id: '07-initiatives', nazwa: 'Initiatives', route: '/initiatives' },
  { id: '08-execution', nazwa: 'Execution', route: '/execution' },
  { id: '09-results', nazwa: 'Results', route: '/results/kpi' },
  { id: '10-materials', nazwa: 'Materials', route: '/presentations' },
  { id: '11-finance', nazwa: 'Finance', route: '/finance' },
  { id: '12-meeting', nazwa: 'Meeting', route: '/meetings' },
  { id: '13-organization', nazwa: 'Organization', route: '/organization/profile' },
  { id: '14-admin', nazwa: 'Admin Panel', route: '/admin' },
  { id: '15-settings', nazwa: 'Settings', route: '/settings/profile' },
  { id: '16-partner', nazwa: 'Partner Portal', route: '/partner/dashboard' },
];

const wynik = { start: new Date().toISOString(), ekrany: [] };
let konsola = [], siec = [];
const resetLog = () => { konsola = []; siec = []; };

async function stanEkranu(page) {
  return page.evaluate(() => {
    const txt = document.body.innerText || '';
    const main = document.querySelector('main') || document.body;
    const mtxt = main.innerText || '';
    const tabs = [...document.querySelectorAll('[role="tab"],[data-testid*="tab"],nav[aria-label] button')]
      .map(x => (x.innerText || x.getAttribute('aria-label') || '').trim().split('\n')[0]).filter(Boolean);
    return {
      wierszeTbody: document.querySelectorAll('tbody tr').length,
      wierszeRoleRow: Math.max(0, document.querySelectorAll('[role="row"]').length - 1),
      karty: document.querySelectorAll('[data-testid*="card"],[class*="Card"]').length,
      zakladki: [...new Set(tabs)],
      dlugoscTekstuMain: mtxt.length,
      pustyStan: /no (results|data|items|records|kpis|initiatives)|nothing (here|to show)|there are no |get started|brak danych/i.test(mtxt),
      surogatKlucza: (txt.match(/\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\.[a-zA-Z_.]{2,}\b/g) || []).filter(s => !/\.(com|pl|io|ai|js|ts|example|png|svg)$/.test(s)).slice(0, 6),
      undefNull: (txt.match(/\b(undefined|NaN|\[object [A-Za-z]+\])/g) || []).slice(0, 6),
      naglowek: (document.querySelector('h1,h2')?.innerText || '').trim().slice(0, 80),
    };
  }).catch(e => ({ blad: String(e).slice(0, 200) }));
}

async function pomiar(page, nazwa) {
  await page.waitForTimeout(3000);
  const st = await stanEkranu(page);
  await page.screenshot({ path: path.join(OUT, `${nazwa}.png`) }).catch(() => {});
  const rec = {
    nazwa, url: page.url(),
    bledyKonsoli: konsola.filter(c => c.typ === 'error').map(c => c.tekst).slice(0, 10),
    liczbaBledowKonsoli: konsola.filter(c => c.typ === 'error').length,
    siec: siec.filter(s => s.status >= 400).map(s => `${s.status} ${s.url.replace(/^https?:\/\/[^/]+/, '')}`).slice(0, 15),
    ...st,
  };
  wynik.ekrany.push(rec);
  console.log(`[EKRAN] ${nazwa} | url=${rec.url.replace(BASE, '')} | wiersze=${st.wierszeTbody}/${st.wierszeRoleRow} | pusty=${st.pustyStan} | konsola=${rec.liczbaBledowKonsoli} | 4xx5xx=${rec.siec.length}${rec.siec.length ? ' :: ' + rec.siec.slice(0, 5).join(' ; ') : ''}${st.surogatKlucza?.length ? ' | KLUCZE:' + st.surogatKlucza.join(',') : ''}`);
  resetLog();
  return rec;
}

async function przejdz(page, route) {
  resetLog();
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape').catch(() => {});
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-GB' });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsola.push({ typ: 'error', tekst: m.text().slice(0, 250) }); });
  page.on('pageerror', e => konsola.push({ typ: 'error', tekst: 'PAGEERROR ' + String(e).slice(0, 250) }));
  page.on('response', r => { if (r.status() >= 400) siec.push({ status: r.status(), url: r.url() }); });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', haslo());
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    try { const raw = localStorage.getItem('consultify-storage'); const j = raw ? JSON.parse(raw) : { state: {}, version: 0 }; j.state = j.state || {}; j.state.theme = 'light'; localStorage.setItem('consultify-storage', JSON.stringify(j)); } catch {}
    localStorage.setItem('i18nextLng', 'en');
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1'); } catch {}
    for (const k of ['demo_tour_skipped', 'demo_tour_completed', 'teresa_onboarding_dismissed', 'consultify_teresa_onboarding_seen']) localStorage.setItem(k, '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
  console.log('zalogowany, url:', page.url());

  for (const m of MODULY) {
    await przejdz(page, m.route);
    const glowny = await pomiar(page, `${m.id}-01-root`);
    // --- Menu 2: zakladki wykryte na ekranie ---
    const zak = (glowny.zakladki || []).filter(z => z.length > 1 && z.length < 40).slice(0, 8);
    let i = 1;
    for (const z of zak) {
      i += 1;
      resetLog();
      const el = page.getByRole('tab', { name: z, exact: true }).first();
      const ok = await el.isVisible({ timeout: 1500 }).catch(() => false);
      if (!ok) continue;
      await el.click({ force: true }).catch(() => {});
      await pomiar(page, `${m.id}-${String(i).padStart(2, '0')}-tab-${z.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 24)}`);
    }
    // --- podglad pierwszego rekordu (B5) ---
    await przejdz(page, m.route);
    await page.waitForTimeout(2500);
    const wiersz = page.locator('tbody tr').first();
    if (await wiersz.isVisible({ timeout: 2500 }).catch(() => false)) {
      resetLog();
      await wiersz.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      const rec = await pomiar(page, `${m.id}-90-podglad`);
      const pola = await page.evaluate(() => {
        const panele = [...document.querySelectorAll('[class*="preview" i],[data-testid*="preview" i],aside,[role="dialog"]')];
        const p = panele.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
        if (!p) return null;
        const linie = (p.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
        const puste = linie.filter(s => /^(—|-|–|N\/A|Not set|None|--)$/i.test(s)).length;
        return { linie: linie.length, pustePola: puste, tekst: (p.innerText || '').slice(0, 700) };
      }).catch(() => null);
      rec.podgladPola = pola;
      console.log(`   [PODGLAD] ${m.id}: linie=${pola?.linie ?? 'brak panelu'} puste=${pola?.pustePola ?? '-'}`);
    } else {
      console.log(`   [PODGLAD] ${m.id}: BRAK wiersza tabeli do otwarcia`);
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'b1b2b5-wynik.json'), JSON.stringify(wynik, null, 2));
  console.log('ZAPISANO', path.join(OUT, 'b1b2b5-wynik.json'));
}
main().catch(e => { console.error('BLAD:', e); process.exit(1); });
