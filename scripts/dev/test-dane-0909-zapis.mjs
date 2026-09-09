#!/usr/bin/env node
/** TEST-DANE 09.09 — B4: sciezka zapisu przez UI (utworz -> lista -> edytuj -> podglad -> usun). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const BASE = 'http://127.0.0.1:3227';
const OUT = '/Users/piotrwisniewski/Developer/wt/test-dane/evidence/test-jezyk-dane-0909/dane/zapis';
fs.mkdirSync(OUT, { recursive: true });
const PW = fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt', 'utf8').match(/has(?:ł|l)o[^:]*:\s*(\S+)/i)[1];
const STEMPEL = 'ZZTEST-' + Date.now().toString(36).toUpperCase();
let net = [];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
p.on('response', async r => { const u = r.url(); if (/\/api\//.test(u) && ['POST','PUT','PATCH','DELETE'].includes(r.request().method())) { let body=''; try{ body=(await r.text()).slice(0,300);}catch{} net.push({ m: r.request().method(), s: r.status(), u: u.replace(/^https?:\/\/[^/]+/,''), body }); } });
const zrzut = n => p.screenshot({ path: path.join(OUT, n + '.png') }).catch(()=>{});
const dumpNet = (etykieta) => { console.log(`  --- API [${etykieta}] ---`); for (const x of net) console.log(`  ${x.m} ${x.s} ${x.u} :: ${x.body.replace(/\s+/g,' ').slice(0,180)}`); net = []; };

await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
await p.fill('input[type="email"]', 'james.whitfield@northwind.example'); await p.fill('input[type="password"]', PW);
await p.click('button[type="submit"]'); await p.waitForTimeout(9000);
await p.evaluate(() => { localStorage.setItem('i18nextLng','en'); for (const k of ['demo_tour_skipped','demo_tour_completed','teresa_onboarding_dismissed','consultify_teresa_onboarding_seen']) localStorage.setItem(k,'1'); });
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000);
net = [];

async function otworzKreator(route, przyciski, tag) {
  await p.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000);
  await p.keyboard.press('Escape').catch(()=>{});
  for (const nazwa of przyciski) {
    const el = p.getByRole('button', { name: nazwa, exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(()=>false)) { await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(3000); break; }
  }
  await zrzut(`${tag}-01-kreator`);
  const pola = await p.evaluate(() => {
    const d = document.querySelector('[role="dialog"]') || document.querySelector('form') || document.body;
    return {
      naglowek: (d.querySelector('h1,h2,h3')?.innerText||'').slice(0,80),
      inputy: [...d.querySelectorAll('input,textarea,select')].map(i=>({typ:i.tagName+':'+(i.type||''), name:i.getAttribute('name')||'', ph:i.getAttribute('placeholder')||'', aria:i.getAttribute('aria-label')||''})).slice(0,25),
      przyciski: [...d.querySelectorAll('button')].map(x=>(x.innerText||'').trim().split('\n')[0]).filter(Boolean).slice(0,20),
      tekst: (d.innerText||'').slice(0,500),
    };
  });
  console.log(`\n=== ${tag} :: ${route}\n` + JSON.stringify(pola, null, 1).slice(0, 2500));
  dumpNet(tag + '-otwarcie');
  return pola;
}

await otworzKreator('/initiatives', ['New initiative'], 'inicjatywy');
await otworzKreator('/execution', ['New', 'Add'], 'realizacja');
await otworzKreator('/my-work', ['New', 'Add', 'Create'], 'mojapraca');
await otworzKreator('/meetings', ['New', 'Add', 'Create'], 'spotkania');
await otworzKreator('/presentations', ['New material', 'New'], 'materialy');
console.log('STEMPEL=' + STEMPEL);
await b.close();
