/**
 * KONTROLA-PO-NAPRAWACH 09.09 — PRZEPŁYWY ZAPISU przez UI.
 *
 * Sens paczki: 09.09 `--verify` był zielony, bo liczył ZERA. Zepsuty zapis
 * (skasowany wiersz wzorcowy `ie_governance_policies`) wyszedł dopiero, gdy
 * ktoś kliknął „Utwórz". Dlatego tu klikamy, a nie liczymy.
 *
 * Użycie: node scripts/dev/kontrola-0909-zapis.mjs <modul>
 *   modul = inicjatywy | realizacja | mojapraca | spotkania | materialy | audyty
 */
import fs from 'node:fs';
import path from 'node:path';
import { otworz, zaloguj, zrzut, nowyLog, BASE, OUT } from './kontrola-0909-wspolne.mjs';

const MODUL = process.argv[2];
const ZNACZNIK = process.env.ZNACZNIK || `KONTROLA-${Date.now().toString(36)}`;
const log = nowyLog();
const kroki = [];

function zapiszKrok(nazwa, opis, extra = {}) {
  const odCzasu = kroki.length ? kroki[kroki.length - 1].znacznik : null;
  const nowe = log.siec.slice(kroki.reduce((a, k) => a + (k.liczbaSieci || 0), 0));
  const rec = {
    krok: nazwa, opis,
    znacznik: new Date().toISOString(),
    liczbaSieci: nowe.length,
    zapisy: nowe.filter((s) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(s.metoda))
      .map((s) => `${s.status} ${s.metoda} ${s.url}`),
    bledy: nowe.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url}`),
    ...extra,
  };
  kroki.push(rec);
  console.log(`[KROK] ${nazwa} :: ${opis}`);
  if (rec.zapisy.length) console.log('   ZAPISY:', rec.zapisy.join(' | '));
  if (rec.bledy.length) console.log('   BLEDY :', rec.bledy.join(' | '));
  return rec;
}

async function klik(page, selektor, opis, timeout = 4000) {
  const l = typeof selektor === 'string' ? page.locator(selektor).first() : selektor;
  const ok = await l.isVisible({ timeout }).catch(() => false);
  if (!ok) { console.log(`   ! nie widać: ${opis}`); return false; }
  await l.click({ force: true }).catch((e) => console.log('   ! klik padł:', String(e).slice(0, 120)));
  await page.waitForTimeout(2500);
  return true;
}

const { browser, page } = await otworz(log);
await zaloguj(page);
console.log('znacznik rekordów:', ZNACZNIK);

/* ---------------------------------------------------------------- INICJATYWY */
async function inicjatywy() {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await zrzut(page, 'inicjatywy-01-lista-przed', 'zapis');
  zapiszKrok('inicjatywy/lista', 'wejście na moduł', {
    wierszy: await page.locator('tbody tr').count().catch(() => 0),
  });

  await klik(page, 'button:has-text("New initiative")', 'CTA New initiative');
  await zrzut(page, 'inicjatywy-02-menu-cta', 'zapis');
  const menuWidoczne = await page.locator('text=Fill in the form').first().isVisible({ timeout: 3000 }).catch(() => false);
  zapiszKrok('inicjatywy/menu', 'menu CTA', { maPozycjeReczna: menuWidoczne });
  if (!menuWidoczne) { console.log('STOP: brak pozycji „Fill in the form"'); return; }

  await klik(page, 'text=Fill in the form', 'pozycja ręczna');
  await page.waitForTimeout(2500);
  await zrzut(page, 'inicjatywy-03-formularz', 'zapis');

  const tytul = `${ZNACZNIK} Manual initiative`;
  await page.fill('#initiatives-new-modal-title', tytul).catch((e) => console.log('! tytuł:', String(e).slice(0, 100)));
  // projekt (RequiredProjectPicker) — pierwszy realny wybór z listy
  const selecty = page.locator('div[role="dialog"] select');
  const n = await selecty.count();
  for (let i = 0; i < n; i += 1) {
    const opcje = await selecty.nth(i).locator('option').allTextContents();
    const wartosci = await selecty.nth(i).locator('option').evaluateAll((els) => els.map((e) => e.value));
    const idx = wartosci.findIndex((v, k) => v && k > 0 && !/operational|strategic|transformational|compliance/.test(v));
    if (idx > 0) { await selecty.nth(i).selectOption(wartosci[idx]).catch(() => {}); console.log('   projekt:', opcje[idx]); }
  }
  await page.waitForTimeout(800);
  await zrzut(page, 'inicjatywy-04-formularz-wypelniony', 'zapis');
  zapiszKrok('inicjatywy/formularz', 'formularz wypełniony');

  page.on('dialog', (d) => d.accept().catch(() => {}));
  await klik(page, 'div[role="dialog"] button:has-text("Create")', 'przycisk Create', 6000);
  await page.waitForTimeout(6000);
  await zrzut(page, 'inicjatywy-05-po-utworzeniu', 'zapis');
  zapiszKrok('inicjatywy/utworz', 'kliknięte Create', {
    tytul,
    toast: await page.evaluate(() => [...document.querySelectorAll('[role="status"],[class*="toast"],[data-sonner-toast]')].map((x) => x.innerText.trim()).join(' | ').slice(0, 300)).catch(() => ''),
  });

  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const naLiscie = await page.locator(`tbody tr:has-text("${ZNACZNIK}")`).count().catch(() => 0);
  await zrzut(page, 'inicjatywy-06-lista-po', 'zapis');
  zapiszKrok('inicjatywy/lista-po', 'nowy rekord na liście', { naLiscie, wierszy: await page.locator('tbody tr').count().catch(() => 0) });
}

/* ---------------------------------------------------------------- pozostałe */
async function rozpoznanieModulu(route, nazwa) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.keyboard.press('Escape').catch(() => {});
  await zrzut(page, `${nazwa}-01-root`, 'zapis');
  const info = await page.evaluate(() => ({
    naglowek: (document.querySelector('h1,h2')?.innerText || '').slice(0, 120),
    przyciski: [...document.querySelectorAll('button')].map((b) => ({ t: (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '), d: b.disabled })).filter((x) => x.t).slice(0, 50),
    zakladki: [...document.querySelectorAll('[role="tab"]')].map((x) => x.innerText.trim()),
    wierszy: document.querySelectorAll('tbody tr').length,
  }));
  console.log(JSON.stringify(info, null, 1));
  zapiszKrok(`${nazwa}/root`, 'rozpoznanie', info);
}

const MAPA = {
  inicjatywy,
  realizacja: () => rozpoznanieModulu('/execution', 'realizacja'),
  mojapraca: () => rozpoznanieModulu('/my-work', 'mojapraca'),
  spotkania: () => rozpoznanieModulu('/meetings', 'spotkania'),
  materialy: () => rozpoznanieModulu('/presentations', 'materialy'),
  audyty: () => rozpoznanieModulu('/audit-programs', 'audyty'),
};

if (!MAPA[MODUL]) { console.error('nieznany moduł:', MODUL); process.exit(2); }
await MAPA[MODUL]();

fs.mkdirSync(path.join(OUT, 'zapis'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'zapis', `${MODUL}-wynik.json`), JSON.stringify({
  modul: MODUL, znacznik: ZNACZNIK, kroki,
  konsola: log.konsola,
  siec4xx5xx: log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url}`),
  wszystkieZapisy: log.siec.filter((s) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(s.metoda)).map((s) => `${s.status} ${s.metoda} ${s.url}`),
}, null, 1));
console.log('\nKONSOLA błędów:', log.konsola.length);
if (log.konsola.length) console.log(log.konsola.slice(0, 8).join('\n'));
console.log('4xx/5xx:', log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url}`).join('\n') || 'brak');
await browser.close();
