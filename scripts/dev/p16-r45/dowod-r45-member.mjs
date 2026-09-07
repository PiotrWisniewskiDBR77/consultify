#!/usr/bin/env node
/**
 * PARA NEGATYWNA — konto MEMBER (Anna Kowalska), P16/R4+R5.
 *
 * Sprawdza WZROKIEM i pomiarem, co MEMBER widzi w zakladce „Decyzje i ryzyka".
 * Reguly zmierzone na serwerze (07.09, API 4161, kopia bazy p16r45):
 *   POST /api/decisions            -> 403 Permission denied (approve_changes)
 *   POST .../raid-items/:id        -> 404 NOT_FOUND (initiative.update per projekt)
 *   GET /api/organizations/:id/... -> 403
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3181';
const OUT = '/private/tmp/wt-p16-r45/evidence/p16-r45/po-member';
fs.mkdirSync(OUT, { recursive: true });
const konsola = [];
const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:1440,height:900}, colorScheme:'light',
  storageState:'/private/tmp/wt-p16-r45/.local/auth-anna-r45.json', locale:'pl-PL' });
const p = await c.newPage();
p.on('console', (m) => { if (m.type()==='error') konsola.push(m.text().slice(0,300)); });
const odmowy = [];
p.on('response', (r) => { if (r.status() >= 400) odmowy.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'')}`); });

async function zrzut(nazwa, opis) {
  const s = `${OUT}/${nazwa}.png`;
  await p.screenshot({ path: s, fullPage: false });
  fs.writeFileSync(`${s}.json`, JSON.stringify({ nazwa, opis, konto: 'anna.kowalska@dbr77.com (MEMBER)',
    url: p.url(), szerokosc: 1440, motyw: 'jasny', bledyKonsoli: [...konsola], czas: new Date().toISOString() }, null, 2));
  console.log(`ZRZUT ${s} (bledyKonsoli=${konsola.length})`);
}
async function chip(n) {
  const el = p.locator('button').filter({ hasText: new RegExp(`^${n}\\s*\\d*$`) }).first();
  await el.waitFor({ timeout: 20000 }); await el.click(); await p.waitForTimeout(2500);
}

await p.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
await chip('Ryzyka');
await zrzut('01-member-ryzyka', 'MEMBER: rejestr RAID widoczny (odczyt 200)');
console.log('CTA „Nowa pozycja RAID" widoczne:', await p.getByTestId('execution-new-raid-open').count());

// Akcje zapisu w podgladzie pozycji RAID.
await p.locator('table tbody tr').first().click();
await p.waitForTimeout(2000);
await zrzut('02-member-podglad-raid', 'MEMBER: podglad pozycji RAID');
for (const akcja of ['Zmień termin','Zmień właściciela','Zamknij pozycję']) {
  console.log(`akcja "${akcja}" w podgladzie: ${await p.getByRole('button', { name: new RegExp(akcja) }).count()}`);
}

await chip('Sygnały');
await p.locator('table tbody tr').first().click();
await p.waitForTimeout(2000);
await zrzut('03-member-sygnal', 'MEMBER: podglad sygnalu BEZ akcji „Przygotuj interwencje"');
console.log('„Przygotuj interwencje" u MEMBER:', await p.getByRole('button', { name: /Przygotuj interwencję/ }).count());

await chip('Decyzje');
await p.locator('table tbody tr').first().click();
await p.waitForTimeout(2000);
await zrzut('04-member-decyzja', 'MEMBER: podglad decyzji BEZ Rozstrzygnij/Odrzuc/Nieaktualna');
for (const a of ['Rozstrzygnij','Odrzuć','Nieaktualna']) {
  console.log(`akcja "${a}" u MEMBER: ${await p.getByRole('button', { name: new RegExp(`^${a}$`) }).count()}`);
}
console.log('CTA „Nowa decyzja" u MEMBER:', await p.getByRole('button', { name: 'Nowa decyzja' }).count());

fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
fs.writeFileSync(`${OUT}/odmowy.log`, [...new Set(odmowy)].join('\n') + '\n');
console.log('ODMOWY (>=400):'); [...new Set(odmowy)].forEach(x=>console.log('  ', x));
console.log(`bledow konsoli: ${konsola.length}`);
await b.close();
