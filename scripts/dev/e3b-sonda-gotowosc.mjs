#!/usr/bin/env node
/**
 * E3b — SONDA: gdzie realnie pojawia się angielskie „Owner assigned"?
 * Nie zgaduje powierzchni: przechodzi po karcie inicjatywy i po każdym kroku
 * wypisuje, czy ten napis jest w DOM i w którym elemencie.
 */
import { chromium } from 'playwright';

const BAZA = 'http://localhost:3245';
const ID = process.argv[2];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const siec = [];
page.on('response', (r) => {
  if (/gate-readiness|readiness/.test(r.url())) siec.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${BAZA}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const raw = window.localStorage.getItem('consultify-storage');
  const p = raw ? JSON.parse(raw) : { state: {}, version: 2 };
  p.state = p.state || {};
  p.state.theme = 'light';
  window.localStorage.setItem('consultify-storage', JSON.stringify(p));
  window.localStorage.setItem('i18nextLng', 'pl');
  const uid = p.state?.currentUser?.id || '';
  if (uid) window.localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
});

const szukaj = async (etap) => {
  const wynik = await page.evaluate(() => {
    const igly = [
      'Owner assigned',
      'Title defined',
      'Assign a business',
      'Właściciel przypisany',
      'Tytuł uzupełniony',
      'Gotowość (system)',
      'Bieżąca brama',
      'Blokujące braki',
    ];
    const trafienia = [];
    Array.from(document.querySelectorAll('body *')).forEach((el) => {
      if (el.children.length) return;
      const txt = (el.textContent || '').trim();
      if (igly.some((i) => txt.includes(i))) {
        const sciezka = [];
        let cur = el;
        for (let i = 0; i < 5 && cur; i += 1) {
          sciezka.push(
            `${cur.tagName.toLowerCase()}${cur.className ? '.' + String(cur.className).split(' ').slice(0, 2).join('.') : ''}`
          );
          cur = cur.parentElement;
        }
        trafienia.push({ txt: txt.slice(0, 70), sciezka: sciezka.join(' < ') });
      }
    });
    return trafienia;
  });
  console.log(`[${etap}] trafien: ${wynik.length}`);
  wynik.slice(0, 6).forEach((w) => console.log('   •', w.txt, '||', w.sciezka));
};

await page.goto(`${BAZA}/initiatives?open=${ID}&mode=doc`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await szukaj('karta, tryb domyślny');

await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) =>
    /^Bramy$/i.test((x.innerText || '').trim())
  );
  b?.click();
});
await page.waitForTimeout(3000);
await szukaj('sekcja Bramy');

// Rozwiń licznik blokad („2 blok") w wierszu bramy.
const klik = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('button,[role="button"],span,div')).find((x) =>
    /^\s*\d+\s*blok/i.test((x.textContent || '').trim())
  );
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  (el.closest('button') || el).click();
  return true;
});
console.log('klik w licznik blokad:', klik);
await page.waitForTimeout(2500);
await szukaj('po kliknięciu blokad');

await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) =>
    /^Edycja$/i.test((x.innerText || '').trim())
  );
  b?.click();
});
await page.waitForTimeout(3000);
await szukaj('tryb Edycja');

console.log('SIEC:', JSON.stringify(siec, null, 1));
await page.screenshot({ path: '/tmp/e3b-sonda.png' });
await browser.close();
