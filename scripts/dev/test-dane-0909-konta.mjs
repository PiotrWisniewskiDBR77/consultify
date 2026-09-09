#!/usr/bin/env node
/** TEST-DANE 09.09 — B7: 9 kont Northwind, logowanie + ekran startowy + zrzut. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const BASE = 'http://127.0.0.1:3227';
const API = 'http://127.0.0.1:4209';
const OUT = '/Users/piotrwisniewski/Developer/wt/test-dane/evidence/test-jezyk-dane-0909/dane/konta';
fs.mkdirSync(OUT, { recursive: true });
const PW = fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt', 'utf8').match(/has(?:ł|l)o[^:]*:\s*(\S+)/i)[1];
const KONTA = ['james.whitfield', 'sarah.mitchell', 'robert.chen', 'emily.carter', 'daniel.osei', 'laura.novak', 'michael.grant', 'priya.sharma', 'thomas.baker'].map(x => `${x}@northwind.example`);
const wynik = [];
const b = await chromium.launch();
for (const email of KONTA) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json().catch(() => ({}));
  const rec = { email, httpLogin: r.status, rola: j?.user?.role ?? null, org: j?.user?.organizationId ?? null };
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await c.newPage();
  const bledy = []; const net = [];
  p.on('pageerror', e => bledy.push(String(e).slice(0, 150)));
  p.on('console', m => { if (m.type() === 'error') bledy.push(m.text().slice(0, 150)); });
  p.on('response', x => { if (x.status() >= 400) net.push(`${x.status()} ${x.url().replace(API, '')}`); });
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await p.click('button[type="submit"]'); await p.waitForTimeout(9000);
  rec.urlPo = p.url().replace(BASE, '');
  rec.tekstEkranu = (await p.evaluate(() => (document.body.innerText || '').length).catch(() => 0));
  rec.menu = await p.evaluate(() => (document.querySelector('nav')?.innerText || '').split('\n').filter(Boolean)).catch(() => []);
  rec.bledyKonsoli = bledy.length; rec.przykladBledu = bledy[0] || null; rec.net4xx5xx = [...new Set(net)].slice(0, 8);
  await p.screenshot({ path: path.join(OUT, `${email.split('@')[0]}.png`) }).catch(() => {});
  await c.close();
  wynik.push(rec);
  console.log(`[KONTO] ${email.padEnd(35)} login=${rec.httpLogin} rola=${rec.rola} url=${rec.urlPo} tekst=${rec.tekstEkranu} menu=${rec.menu.length} bledy=${rec.bledyKonsoli} net=${rec.net4xx5xx.length}`);
}
await b.close();
fs.writeFileSync(path.join(OUT, 'b7-konta.json'), JSON.stringify(wynik, null, 2));
console.log('ZAPISANO b7-konta.json');
