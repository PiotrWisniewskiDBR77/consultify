import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:3197';
const OUT = '/private/tmp/wt-j17/evidence/jezyk-j17';
const LANG = process.env.LANG_J17 || 'en';
fs.mkdirSync(OUT, { recursive: true });

function sql(q) {
  return execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc '${q.replace(/'/g, "'\\''")}'`,
    { encoding: 'utf8' }
  ).trim();
}
sql(`UPDATE users SET language='${LANG}' WHERE email='audyt@dbr77.local'`);

const konsola = [];
const api4xx = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
page.on('response', async (r) => {
  if (!/\/api\//.test(r.url()) || r.status() < 400) return;
  let body = ''; try { body = (await r.text()).slice(0, 300); } catch {}
  api4xx.push(`${r.request().method()} ${r.status()} ${r.url().replace(BASE, '')}  ${body}`);
});

async function zrzut(nazwa, ms = 3500) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${OUT}/${LANG}-${nazwa}.png`, fullPage: false });
  console.log('zrzut', `${LANG}-${nazwa}.png`, page.url());
}

// 1. logowanie
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await page.fill('input[type="email"], input[name="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"], input[name="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);
await page.evaluate((lang) => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    j.state = j.state || {}; j.state.theme = 'light';
    localStorage.setItem('consultify-storage', JSON.stringify(j));
  } catch {}
  localStorage.setItem('i18nextLng', lang);
  localStorage.setItem('demo_tour_skipped', '1');
  localStorage.setItem('demo_tour_completed', '1');
}, LANG);

// 2. rejestr Inicjatyw
await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
try { await page.waitForSelector('table tbody tr', { timeout: 90000 }); }
catch { console.log('UWAGA: tabela inicjatyw nie doczekala sie wierszy'); }
await zrzut('01-rejestr-inicjatyw', 4000);

// 3. podglad wiersza (klik w pierwszy wiersz tabeli)
try {
  const wiersz = page.locator('table tbody tr').first();
  if (await wiersz.count()) { await wiersz.click(); await zrzut('02-podglad-inicjatywy', 3500); }
  else console.log('BRAK wierszy tabeli inicjatyw');
} catch (e) { console.log('podglad blad', e.message); }

// 4. REALNY 4xx z serwera, renderowany przez warstwe J17.
//    Wolamy trase z pomiaru K5pl (knowledge/vault) ze zlym `scope` -> 400
//    VAULT_SCOPE_INVALID + polskie `error`. Pokazujemy, co widzi UZYTKOWNIK.
const odp = await page.evaluate(async () => {
  const r = await fetch('/api/knowledge/documents/00000000-0000-0000-0000-000000000000/scope', {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'zle' }),
  });
  const body = await r.text();
  // przepusc przez REALNY helper aplikacji (ten sam, ktory renderuja ekrany)
  const mod = await import('/src/utils/apiError.ts');
  let parsed = null; try { parsed = JSON.parse(body); } catch {}
  return { status: r.status, body: body.slice(0, 300), naEkranie: mod.normalizeApiErrorMessage(parsed, 'Request failed') };
});
fs.writeFileSync(`${OUT}/${LANG}-04-realny-4xx.json`, JSON.stringify(odp, null, 2));
console.log('4xx:', JSON.stringify(odp));

// 5. pokaz to samo jako widoczny komunikat na stronie (zrzut, nie tylko JSON)
await page.evaluate((o) => {
  const d = document.createElement('div');
  d.setAttribute('data-j17', '1');
  d.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:99999;max-width:820px;padding:16px 20px;border-radius:10px;background:#fff;border:1px solid #d5d8dd;box-shadow:0 8px 28px rgba(0,0,0,.14);font:13px/1.5 -apple-system,Segoe UI,sans-serif;color:#1b1f24';
  d.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Server 4xx as the user sees it (J17)</div>
    <div style="color:#5a6472">PATCH /api/knowledge/documents/:id/scope  body {"scope":"zle"} &rarr; HTTP ${o.status}</div>
    <div style="margin:6px 0;color:#5a6472">raw body: <code>${o.body.replace(/</g, '&lt;')}</code></div>
    <div style="margin-top:8px;padding:10px 12px;background:#f4f6f8;border-radius:6px"><b>rendered:</b> ${o.naEkranie}</div>`;
  document.body.appendChild(d);
}, odp);
await zrzut('04-realny-4xx', 800);
await page.evaluate(() => document.querySelector('[data-j17]')?.remove());

// 6. generator planu (zakladka Menu 2/3 modulu Inicjatywy)
for (const [nazwa, url] of [
  ['05-generator-planu', '/initiatives?tab=capacity'],
  ['06-ocena-inicjatywy', '/assessment?tab=initiatives'],
]) {
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(12000);
    await zrzut(nazwa, 3000);
  }
  catch (e) { console.log(nazwa, 'blad', e.message); }
}

fs.writeFileSync(`${OUT}/${LANG}-konsola.txt`, konsola.join('\n') || '(0 bledow konsoli)');
fs.writeFileSync(`${OUT}/${LANG}-api-4xx.txt`, api4xx.join('\n') || '(brak)');
console.log('BLEDY KONSOLI:', konsola.length);
await browser.close();
