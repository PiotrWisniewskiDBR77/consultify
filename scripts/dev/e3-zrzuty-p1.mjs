#!/usr/bin/env node
/**
 * E3 — zrzuty uzupełniające:
 *  P1: odmowa GO na karcie inicjatywy PO POLSKU (400 `rule=GATE_DECISION_REQUIRED`).
 *  P2: `ConfirmModal` przed usunięciem zadania.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] || 'evidence/e3';
const MOTYW = process.argv[3] || 'light';
const SUF = MOTYW === 'dark' ? 'ciemny' : 'jasny';
const BAZA = 'http://localhost:3243';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const bledy = [];
const odpowiedzi = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + e.message));
page.on('dialog', (d) => d.accept());
page.on('response', (r) => {
  if (/\/status$/.test(r.url()) && r.request().method() === 'PATCH')
    odpowiedzi.push(`${r.status()} ${r.url()}`);
});

const zrzut = async (n) => { const p = `${OUT}/${n}-${SUF}.png`; await page.screenshot({ path: p }); console.log('ZRZUT', p); };
const ukryjPlakietke = async () => {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('body *')).forEach((el) => {
      if (el.children.length === 0 && /^LOCAL\s*@/.test((el.textContent || '').trim())) {
        (el.closest('[class*="fixed"]') || el.parentElement || el).style.display = 'none';
      }
    });
  });
};

await page.goto(`${BAZA}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', 'audyt@dbr77.local');
await page.fill('input[type="password"]', 'AudytDBR77!2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
await page.evaluate((m) => {
  const raw = window.localStorage.getItem('consultify-storage');
  const p = raw ? JSON.parse(raw) : { state: {}, version: 2 };
  p.state = p.state || {}; p.state.theme = m;
  window.localStorage.setItem('consultify-storage', JSON.stringify(p));
  window.localStorage.setItem('i18nextLng', 'pl');
}, MOTYW);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await ukryjPlakietke();

// ── P2 · ConfirmModal usunięcia ────────────────────────────────────────────
await page.goto(`${BAZA}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await ukryjPlakietke();
await page.evaluate(() => {
  const tr = document.querySelectorAll('tbody tr')[1];
  const btn = Array.from(tr.querySelectorAll('button')).pop();
  btn?.click();
});
await page.waitForTimeout(900);
const klikUsun = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button'))
    .find((x) => x.innerText.trim() === 'Usuń');
  if (!b) return false; b.click(); return true;
});
console.log('Klik „Usuń" w kebabie:', klikUsun);
await page.waitForTimeout(1200);
const trescModalu = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? d.innerText.replace(/\n+/g, ' | ') : null;
});
console.log('MODAL:', trescModalu);
await zrzut('p2-7-modal-usuniecia');
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// ── P1 · odmowa GO po polsku ───────────────────────────────────────────────
const idInicjatywy = process.argv[4];
// Karta inicjatywy otwiera się parametrami `open`/`mode=doc` na trasie modułu
// (`getArtifactPath`), nie ścieżką /initiatives/:id.
await page.goto(`${BAZA}/initiatives?open=${idInicjatywy}&mode=doc`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await ukryjPlakietke();
await zrzut('p1-0-karta-inicjatywy');

// CTA „Zatwierdź inicjatywę" żyje w trybie Edycja — najpierw przełącznik.
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) =>
    /^Edycja$/i.test(x.innerText.trim())
  );
  b?.click();
});
await page.waitForTimeout(3000);
await ukryjPlakietke();
const przyciski = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map((b) => b.innerText.trim()).filter(Boolean)
);
console.log('PRZYCISKI KARTY:', JSON.stringify(przyciski.slice(0, 40)));
await zrzut('p1-0b-karta-edycja');

const klikCta = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) =>
    /Zatwierdź inicjatyw/i.test(x.innerText.trim())
  );
  if (!b) return false; b.click(); return true;
});
console.log('Klik „Zatwierdź inicjatywę":', klikCta);
await page.waitForTimeout(4000);
await ukryjPlakietke();
const toast = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[class*="toast"], [role="status"], [role="alert"]'))
    .map((x) => x.innerText.trim()).filter(Boolean).slice(0, 6)
);
console.log('TOAST:', JSON.stringify(toast, null, 1));
console.log('PATCH:', odpowiedzi);
await zrzut('p1-1-odmowa-po-polsku');

fs.writeFileSync(`${OUT}/pomiar-p1-${SUF}.json`, JSON.stringify(
  { modal: trescModalu, klikCta, toast, patch: odpowiedzi, bledy }, null, 2));
await browser.close();
console.log('BLEDY KONSOLI:', bledy.length, bledy.slice(0, 5));
