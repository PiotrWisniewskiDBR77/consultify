/**
 * KONTROLA 09.09 — PRZEPŁYWY ZAPISU, część 2.
 * Użycie: node scripts/dev/kontrola-0909-zapis2.mjs <modul>
 *   modul = realizacja | mojapraca | spotkania | materialy | audyty
 *
 * PUŁAPKA PRZYRZĄDU (zmierzona 09.09): `button:has-text("Risks")` trafia
 * w ZAKŁADKĘ „Decisions & risks", nie w chip „Risks 7" — i wtedy CTA
 * „New RAID item" słusznie nie ma na ekranie. Celuj rolą + kotwicą regexu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { otworz, zaloguj, zrzut, nowyLog, BASE, OUT } from './kontrola-0909-wspolne.mjs';

const MODUL = process.argv[2];
const ZNACZNIK = process.env.ZNACZNIK || `KONTROLA-${Date.now().toString(36)}`;
const log = nowyLog();
const kroki = [];
let poprzednio = 0;

function krok(nazwa, opis, extra = {}) {
  const nowe = log.siec.slice(poprzednio);
  poprzednio = log.siec.length;
  const rec = {
    krok: nazwa, opis,
    zapisy: nowe.filter((s) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(s.metoda) && !/voice-event|auth\/login/.test(s.url)).map((s) => `${s.status} ${s.metoda} ${s.url}`),
    bledy: [...new Set(nowe.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g, '<id>')}`))],
    ...extra,
  };
  kroki.push(rec);
  console.log(`[KROK] ${nazwa} :: ${opis}`);
  if (rec.zapisy.length) console.log('   ZAPISY:', rec.zapisy.slice(0, 8).join(' | '));
  if (rec.bledy.length) console.log('   BLEDY :', rec.bledy.join(' | '));
  return rec;
}
async function klik(page, sel, opis, timeout = 4000) {
  const l = typeof sel === 'string' ? page.locator(sel).first() : sel;
  if (!(await l.isVisible({ timeout }).catch(() => false))) { console.log(`   ! nie widać: ${opis}`); return false; }
  await l.click({ force: true }).catch((e) => console.log('   ! klik:', String(e).slice(0, 90)));
  await page.waitForTimeout(2500);
  return true;
}
async function wybierzWszystkieSelecty(page, zakres = 'body') {
  const sel = page.locator(`${zakres} select`);
  const n = await sel.count();
  for (let i = 0; i < n; i += 1) {
    const w = await sel.nth(i).locator('option').evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
    if (w.length) await sel.nth(i).selectOption(w[0]).catch(() => {});
  }
}

const { browser, page } = await otworz(log);
page.on('dialog', (d) => d.accept().catch(() => {}));
await zaloguj(page);
console.log('znacznik:', ZNACZNIK);
async function idz(route, czekaj = 8000) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(czekaj);
}

async function realizacja() {
  await idz('/execution?tab=work');
  await zrzut(page, 'realizacja-01-work', 'zapis');
  krok('realizacja/work', 'zakładka Work', { wierszy: await page.locator('tbody tr').count().catch(() => 0) });
  await klik(page, 'button:has-text("New task")', 'CTA New task');
  const dlg = 'div[data-testid="execution-work-create-dialog"]';
  const jest = await page.locator(dlg).first().isVisible({ timeout: 3500 }).catch(() => false);
  if (jest) {
    await page.locator(`${dlg} input[type="text"]`).first().fill(`${ZNACZNIK} task`).catch(() => {});
    await wybierzWszystkieSelecty(page, dlg);
    await page.locator(`${dlg} input[type="date"]`).first().fill('2026-10-15').catch(() => {});
    await zrzut(page, 'realizacja-02-zadanie-formularz', 'zapis');
    await klik(page, `${dlg} button:has-text("Create"), ${dlg} button:has-text("Add"), ${dlg} button:has-text("Save")`, 'zapis zadania');
    await page.waitForTimeout(4000);
  }
  await idz('/execution?tab=work');
  await zrzut(page, 'realizacja-03-zadanie-lista', 'zapis');
  krok('realizacja/zadanie', 'utworzenie zadania', { formularz: jest, naLiscie: await page.locator(`tbody tr:has-text("${ZNACZNIK}")`).count().catch(() => 0) });

  await idz('/execution?tab=control');
  await klik(page, 'button:has-text("New decision")', 'CTA New decision');
  const maDec = await page.locator('input[aria-label="Decision title"]').first().isVisible({ timeout: 3500 }).catch(() => false);
  if (maDec) {
    await page.locator('input[aria-label="Decision title"]').first().fill(`${ZNACZNIK} decision`);
    await wybierzWszystkieSelecty(page);
    await page.locator('input[type="date"]').first().fill('2026-10-20').catch(() => {});
    await zrzut(page, 'realizacja-04-decyzja-formularz', 'zapis');
    await klik(page, 'button:has-text("Create decision"), button:has-text("Add decision"), button:has-text("Save")', 'zapis decyzji');
    await page.waitForTimeout(4500);
  }
  await idz('/execution?tab=control');
  await zrzut(page, 'realizacja-05-decyzja-lista', 'zapis');
  krok('realizacja/decyzja', 'utworzenie decyzji', { formularz: maDec, naLiscie: await page.locator(`tbody tr:has-text("${ZNACZNIK}")`).count().catch(() => 0) });

  await page.getByRole('button', { name: /^Risks\s*\d*$/ }).first().click({ force: true }).catch(() => console.log('   ! chip Risks'));
  await page.waitForTimeout(3500);
  await klik(page, 'button:has-text("New RAID")', 'CTA New RAID');
  const maRaid = await page.locator('input[aria-label*="Title"], input[aria-label*="itle"]').first().isVisible({ timeout: 3500 }).catch(() => false);
  if (maRaid) {
    await page.locator('input[aria-label*="Title"], input[aria-label*="itle"]').first().fill(`${ZNACZNIK} raid`);
    await wybierzWszystkieSelecty(page);
    const d = page.locator('input[type="date"]');
    if (await d.count()) await d.first().fill('2026-10-25').catch(() => {});
    await zrzut(page, 'realizacja-06-raid-formularz', 'zapis');
    await klik(page, 'button:has-text("Save RAID"), button:has-text("Add RAID"), button:has-text("Create RAID")', 'zapis RAID');
    await page.waitForTimeout(4500);
  }
  await zrzut(page, 'realizacja-07-raid-po', 'zapis');
  krok('realizacja/raid', 'utworzenie RAID', { formularz: maRaid, znacznikNaEkranie: (await page.evaluate(() => document.body.innerText || '')).includes(ZNACZNIK) });
}

async function mojapraca() {
  await idz('/my-work');
  await zrzut(page, 'mojapraca-01-root', 'zapis');
  krok('mojapraca/root', 'wejście', { wierszy: await page.locator('tbody tr').count().catch(() => 0) });
  await page.getByRole('button', { name: /^Tasks$/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(4000);
  await zrzut(page, 'mojapraca-02-tasks', 'zapis');
  const cta = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((x) => /new|add|create/i.test(x)));
  console.log('   CTA:', cta.join(' | '));
  await klik(page, 'button:has-text("New task"), button:has-text("New Task"), button:has-text("Add task")', 'CTA nowego zadania');
  await page.waitForTimeout(5000);
  await zrzut(page, 'mojapraca-03-po-cta', 'zapis');
  const inp = page.locator('input[placeholder*="itle"], div[role="dialog"] input[type="text"]').first();
  const maForm = await inp.isVisible({ timeout: 4000 }).catch(() => false);
  if (maForm) {
    await inp.fill(`${ZNACZNIK} mywork task`).catch(() => {});
    await zrzut(page, 'mojapraca-04-formularz', 'zapis');
    await klik(page, 'button:has-text("Create"), button:has-text("Save"), button:has-text("Add")', 'zapis zadania');
    await page.waitForTimeout(5000);
  }
  await idz('/my-work');
  await zrzut(page, 'mojapraca-05-po', 'zapis');
  krok('mojapraca/utworz', 'utworzenie zadania', { cta, maForm, url: page.url(), naEkranie: (await page.evaluate(() => document.body.innerText || '')).includes(ZNACZNIK) });
}

async function spotkania() {
  await idz('/meetings');
  await zrzut(page, 'spotkania-01-root', 'zapis');
  krok('spotkania/root', 'wejście', { wierszy: await page.locator('tbody tr').count().catch(() => 0) });
  await klik(page, 'button:has-text("New meeting")', 'CTA New meeting');
  await page.waitForTimeout(3500);
  await zrzut(page, 'spotkania-02-formularz', 'zapis');
  const inp = page.locator('div[role="dialog"] input[type="text"], input[placeholder*="itle"]').first();
  const maForm = await inp.isVisible({ timeout: 3500 }).catch(() => false);
  if (maForm) {
    await inp.fill(`${ZNACZNIK} meeting`).catch(() => {});
    await wybierzWszystkieSelecty(page, 'div[role="dialog"]');
    await zrzut(page, 'spotkania-03-wypelniony', 'zapis');
    await klik(page, 'button:has-text("Create"), button:has-text("Schedule"), button:has-text("Save")', 'zapis spotkania');
    await page.waitForTimeout(5000);
  }
  await idz('/meetings');
  await zrzut(page, 'spotkania-04-po', 'zapis');
  krok('spotkania/utworz', 'utworzenie spotkania', { maForm, naLiscie: await page.locator(`tbody tr:has-text("${ZNACZNIK}")`).count().catch(() => 0), wierszy: await page.locator('tbody tr').count().catch(() => 0) });
}

async function materialy() {
  for (const zak of ['All', 'Documents', 'Presentations', 'Sheets']) {
    await idz('/presentations');
    await page.getByRole('button', { name: new RegExp(`^${zak}$`) }).first().click({ force: true }).catch(() => console.log(`   ! zakładka ${zak}`));
    await page.waitForTimeout(4000);
    await zrzut(page, `materialy-tab-${zak}`, 'zapis');
    krok(`materialy/tab-${zak}`, 'zakładka', { wierszy: await page.locator('tbody tr').count().catch(() => 0) });
  }
  await idz('/presentations');
  await klik(page, 'button:has-text("New presentation")', 'CTA New presentation');
  await page.waitForTimeout(7000);
  await zrzut(page, 'materialy-05-po-cta', 'zapis');
  krok('materialy/utworz', 'kliknięte New presentation', { url: page.url() });
}

async function audyty() {
  await idz('/audit-programs');
  await zrzut(page, 'audyty-01-root', 'zapis');
  const st = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /new audit/i.test(x.innerText || ''));
    return { jest: !!b, wygaszony: b ? b.disabled : null, podpis: (document.body.innerText || '').match(/Frozen until[^\n]*/)?.[0] || '' };
  });
  console.log('   New audit:', JSON.stringify(st));
  krok('audyty/root', 'stan CTA', st);
}

const MAPA = { realizacja, mojapraca, spotkania, materialy, audyty };
if (!MAPA[MODUL]) { console.error('nieznany moduł'); process.exit(2); }
await MAPA[MODUL]();
fs.mkdirSync(path.join(OUT, 'zapis'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'zapis', `${MODUL}-zapis-wynik.json`), JSON.stringify({
  modul: MODUL, znacznik: ZNACZNIK, kroki, konsola: log.konsola,
  siec4xx5xx: [...new Set(log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g, '<id>')}`))],
  wszystkieZapisy: log.siec.filter((s) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(s.metoda) && !/voice-event|auth\/login/.test(s.url)).map((s) => `${s.status} ${s.metoda} ${s.url}`),
}, null, 1));
console.log('\nKONSOLA:', log.konsola.length, log.konsola.slice(0, 5));
console.log('4xx/5xx:', [...new Set(log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g, '<id>')}`))].join(' | ') || 'brak');
await browser.close();
