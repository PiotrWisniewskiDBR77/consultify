/**
 * KONTROLA 09.09 — regresja 10 napraw (RAPORT_DANE §4) + 5 pozycji dosiewu D9.
 * Jeden przebieg, 1440×900, EN, motyw jasny; zrzut + innerText na każdy ekran.
 */
import fs from 'node:fs';
import path from 'node:path';
import { otworz, zaloguj, zrzut, nowyLog, BASE, OUT } from './kontrola-0909-wspolne.mjs';

const log = nowyLog();
const wyniki = [];
const { browser, page } = await otworz(log);
page.on('dialog', (d) => d.accept().catch(() => {}));
await zaloguj(page);

const EKRANY = [
  { id: 'D-17-v9-overrides', route: '/my-work' },
  { id: 'DOSIEW-1-organizacja', route: '/organization/profile' },
  { id: 'DOSIEW-2-wywiad-inbox', route: '/interview' },
  { id: 'DOSIEW-3-wyniki-migawka', route: '/results/kpi' },
  { id: 'DOSIEW-4-realizacja-zasoby', route: '/execution?tab=resources' },
];

for (const e of EKRANY) {
  const przed = log.siec.length;
  const konsolaPrzed = log.konsola.length;
  await page.goto(`${BASE}${e.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape').catch(() => {});
  if (e.klik) {
    const l = page.getByRole('button', { name: new RegExp(`^${e.klik}`) }).first();
    if (await l.isVisible({ timeout: 3000 }).catch(() => false)) { await l.click({ force: true }); await page.waitForTimeout(4000); }
    else console.log(`  ! brak „${e.klik}" na ${e.route}`);
  }
  if (e.wiersz) {
    const w = page.locator('tbody tr').first();
    if (await w.isVisible({ timeout: 3500 }).catch(() => false)) { await w.click({ force: true }); await page.waitForTimeout(4000); }
    else console.log(`  ! brak wiersza na ${e.route}`);
  }
  if (e.cta) {
    const b = page.getByRole('button', { name: new RegExp(`^${e.cta}$`) }).first();
    if (await b.isVisible({ timeout: 3000 }).catch(() => false)) { await b.click({ force: true }); await page.waitForTimeout(2500); }
    else console.log(`  ! brak CTA ${e.cta}`);
  }
  const plik = await zrzut(page, e.id, 'regresja');
  const tekst = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  fs.writeFileSync(plik.replace(/\.png$/, '-pelny.txt'), tekst);
  const siec = log.siec.slice(przed).filter((s) => s.status >= 400);
  wyniki.push({
    id: e.id, route: e.route,
    bledyKonsoli: log.konsola.length - konsolaPrzed,
    odpowiedzi4xx5xx: [...new Set(siec.map((s) => `${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g, '<id>')}`))],
    dlugoscTekstu: tekst.length,
  });
  console.log(`[EKRAN] ${e.id} | konsola=${log.konsola.length - konsolaPrzed} | 4xx5xx=${siec.length}${siec.length ? ' :: ' + [...new Set(siec.map((s) => s.status + ' ' + s.url.replace(/[0-9a-f-]{20,}/g, '<id>')))].join(' ; ') : ''}`);
}
fs.mkdirSync(path.join(OUT, 'regresja'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'regresja', 'wynik.json'), JSON.stringify({ wyniki, konsola: log.konsola }, null, 1));
console.log('\nRAZEM błędów konsoli:', log.konsola.length);
console.log('RAZEM 4xx/5xx:', [...new Set(log.siec.filter((s) => s.status >= 400).map((s) => `${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g, '<id>')}`))].join('\n') || 'brak');
await browser.close();
