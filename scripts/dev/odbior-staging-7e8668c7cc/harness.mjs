// ODBIÓR STAGING 7e8668c7cc — harness: sesja z pliku JSON, motyw z zustand (consultify-storage),
// zrzut jasny+ciemny, sidecar .json z błędami konsoli i odpowiedziami >=400.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const OUT = process.env.OUT_DIR || '/Users/piotrwisniewski/Developer/wt/odbior-staging/evidence/odbior-staging-7e8668c7cc';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const konto = process.argv[3] || 'owner';
const sesja = JSON.parse(fs.readFileSync(`${SCRATCH}/sesja-staging-${konto}.json`, 'utf8'));
const BASE = sesja.base;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const wyniki = [];
const linki = [];

for (const poz of manifest) {
  const motywy = poz.motywy || ['light', 'dark'];
  for (const motyw of motywy) {
    const ctx = await browser.newContext({
      viewport: { width: poz.szerokosc || 1440, height: poz.wysokosc || 900 },
      colorScheme: motyw, locale: 'en-US',
    });
    await ctx.addCookies(Object.entries(sesja.cookies || {}).map(([name, value]) => ({ name, value, domain: new URL(BASE).hostname, path: '/' })));
    await ctx.addInitScript(({ theme, ls }) => {
      try {
        for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
        const raw = localStorage.getItem('consultify-storage');
        const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        obj.state = { ...(obj.state || {}), theme };
        localStorage.setItem('consultify-storage', JSON.stringify(obj));
        if (theme === 'dark') document.documentElement.classList.add('dark');
      } catch (e) {}
    }, { theme: motyw, ls: { token: sesja.token, refreshToken: sesja.refreshToken, user: JSON.stringify(sesja.user) } });

    const page = await ctx.newPage();
    const bledy = [];
    const http4xx5xx = [];
    const czasy = {};
    page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 240)); });
    page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 240)));
    page.on('response', (r) => {
      if (r.status() >= 400) http4xx5xx.push({ status: r.status(), method: r.request().method(), url: r.url().replace(BASE, '') });
      const t = r.request().timing?.();
      if (poz.mierzCzas && r.url().includes(poz.mierzCzas)) czasy[r.url().replace(BASE, '')] = t ? Math.round(t.responseEnd) : null;
    });

    const t0 = Date.now();
    let meta_tDoRender = null;
    let meta_tDoTresci = null;
    try {
      await page.goto(BASE + poz.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Aplikacja na stagingu montuje sie 20-30 s (zmierzone dbg4): staly timeout
      // dawal BIALE zrzuty. Czekamy na realne drzewo, nie na zegar.
      try {
        await page.waitForFunction(() => (document.getElementById('root')?.innerHTML.length ?? 0) > 20000, null, { timeout: 75000 });
        meta_tDoRender = Date.now() - t0;
      } catch { bledy.push('APLIKACJA NIE ZAMONTOWALA SIE W 75 s (root < 20 kB)'); }
      // Powloka modulu montuje sie DUZO wczesniej niz centrum: przy samym progu
      // 20 kB zrzuty lapaly pasek boczny + kreciolek "Loading...". Czekamy, az
      // znikna wskazniki ladowania w tresci (kanon: zrzut ma pokazywac PRODUKT).
      try {
        await page.waitForFunction(() => {
          const t = document.body.innerText || '';
          return !/(^|\s)(Loading\u2026|Loading\.\.\.|\u0141adowanie\u2026|\u0141adowanie\.\.\.)(\s|$)/.test(t);
        }, null, { timeout: 60000 });
        meta_tDoTresci = Date.now() - t0;
      } catch { bledy.push('CENTRUM NADAL POKAZUJE WSKAZNIK LADOWANIA PO 60 s'); }
      await page.waitForTimeout(poz.czekaj ?? 4000);
      // kreator powitalny
      for (const sel of ['text=Skip for now', 'text=Pomiń na razie']) {
        try { const l = page.locator(sel).first(); if (await l.isVisible({ timeout: 700 })) { await l.click(); await page.waitForTimeout(1200); } } catch {}
      }
      for (const krok of poz.kroki || []) {
        try {
          if (krok.klik) { await page.locator(krok.klik).first().click({ timeout: 9000 }); }
          else if (krok.wpisz) { await page.locator(krok.wpisz).first().fill(krok.tekst, { timeout: 9000 }); }
          else if (krok.zdarzenie) { await page.evaluate(({ n, d }) => window.dispatchEvent(new CustomEvent(n, { detail: d })), { n: krok.zdarzenie, d: krok.detail }); }
          else if (krok.reload) { await page.reload({ waitUntil: 'domcontentloaded' }); }
          await page.waitForTimeout(krok.czekaj ?? 1600);
        } catch (e) { bledy.push(`KROK NIEUDANY ${JSON.stringify(krok).slice(0,90)}: ${String(e.message).split('\n')[0].slice(0, 140)}`); }
      }
    } catch (e) { bledy.push('NAWIGACJA: ' + String(e.message).split('\n')[0].slice(0, 200)); }
    const ms = Date.now() - t0;

    const dom = {};
    for (const [k, sel] of Object.entries(poz.dom || {})) {
      try { dom[k] = await page.locator(sel).count(); } catch { dom[k] = 'blad'; }
    }
    if (poz.zbierzLinki) {
      try { linki.push(...await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href') + ' :: ' + (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g,' ').trim().slice(0,40)))); } catch {}
    }
    let tekst = '';
    try { tekst = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1400); } catch {}

    const plik = `${poz.nazwa}-${motyw === 'light' ? 'jasny' : 'ciemny'}.png`;
    try { await page.screenshot({ path: path.join(OUT, plik), fullPage: !!poz.pelna }); } catch (e) { bledy.push('ZRZUT: ' + e.message.slice(0, 120)); }
    const meta = {
      nazwa: poz.nazwa, motyw, url: poz.url, urlKoncowy: page.url().replace(BASE, ''), konto,
      bledyKonsoli: bledy.length, bledy, http4xx5xx, piatkiXX: http4xx5xx.filter(x => x.status >= 500).length,
      dom, msDoZrzutu: ms, msDoRenderu: meta_tDoRender, msDoTresci: meta_tDoTresci, czasy, tekst,
    };
    fs.writeFileSync(path.join(OUT, plik.replace('.png', '.json')), JSON.stringify(meta, null, 1));
    wyniki.push(meta);
    console.log(`${plik.padEnd(46)} konsola=${bledy.length} 4xx/5xx=${http4xx5xx.length}/${meta.piatkiXX} render=${meta_tDoRender}ms tresc=${meta_tDoTresci}ms url=${meta.urlKoncowy.slice(0,60)} ${ms}ms`);
    if (bledy.length) console.log('   BŁĘDY: ' + bledy.slice(0, 3).join(' || ').slice(0, 400));
    if (http4xx5xx.length) console.log('   HTTP: ' + http4xx5xx.slice(0, 6).map(x => `${x.status} ${x.method} ${x.url.slice(0,70)}`).join(' | '));
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, '_zbiorczo.json'), JSON.stringify(wyniki, null, 1));
if (linki.length) { fs.writeFileSync(path.join(OUT, '_linki.json'), JSON.stringify([...new Set(linki)], null, 1)); console.log('LINKI:', [...new Set(linki)].length); }
console.log('\nGOTOWE:', wyniki.length, 'zrzutów →', OUT);
