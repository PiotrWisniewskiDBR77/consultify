/* eslint-disable */
/**
 * K5-4 — POMIAR podglądu banku Realizacji (harness `k5-preview-bank`, port 5313).
 *
 * PO CO: właściciel odrzucił podgląd słowami „Preview tutaj nie mieści się na
 * ekranie". „Nie mieści się" to LICZBA, nie wrażenie — ten skrypt ją podaje dla
 * każdej rozdzielczości odbioru, razem ze zrzutem, na który właściciel patrzy.
 *
 * Mierzone (wszystko z otwartym podglądem, po kliknięciu w wiersz):
 *   · `documentElement.scrollHeight === clientHeight` — strona się NIE przewija,
 *   · prostokąt `<aside data-right-panel>` mieści się w oknie,
 *   · stopka `[data-preview-block="footer"]` („Copy link") widoczna BEZ przewijania,
 *   · ciało panelu ma `overflow-y: auto` (przewija się treść, nie strona),
 *   · `aside === 1`, „Open" === 1, brak bloku „Co dalej",
 *   · liczba RZĘDÓW chipów w karcie meta (kanon K5-4: dokładnie 1),
 *   · błędy konsoli.
 *
 *   node evidence/k5-preview2-20260913/pomiar.mjs
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const KATALOG = path.dirname(new URL(import.meta.url).pathname);
const BAZA = process.env.K5_BAZA || 'http://localhost:5313';

const WARIANTY = [
  { nazwa: '1440x900-jasny', w: 1440, h: 900, motyw: 'light' },
  { nazwa: '1440x900-ciemny', w: 1440, h: 900, motyw: 'dark' },
  { nazwa: '1280x800-jasny', w: 1280, h: 800, motyw: 'light' },
  { nazwa: '1920x1080-jasny', w: 1920, h: 1080, motyw: 'light' },
];

const POMIAR = () => {
  const d = document.documentElement;
  const aside = document.querySelector('aside[data-right-panel]');
  const r = aside && aside.getBoundingClientRect();
  const stopka = document.querySelector('[data-preview-block="footer"]');
  const sr = stopka && stopka.getBoundingClientRect();
  const cialo = aside && aside.querySelector('.overflow-y-auto');
  const meta = document.querySelector('[data-preview-block="meta"]');
  // Rzędy chipów = liczba różnych współrzędnych `top` pigułek karty meta.
  const chipy = meta ? Array.from(meta.querySelectorAll('span[class*="rounded-full"]')) : [];
  const rzedy = Array.from(new Set(chipy.map((c) => Math.round(c.getBoundingClientRect().top))));
  return {
    scrollHeight: d.scrollHeight,
    clientHeight: d.clientHeight,
    stronaPrzewija: d.scrollHeight > d.clientHeight,
    aside: document.querySelectorAll('aside').length,
    asideRect: r && { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom) },
    asideWOknie: !!r && r.top >= 0 && r.bottom <= d.clientHeight + 1,
    stopka: sr && {
      top: Math.round(sr.top),
      bottom: Math.round(sr.bottom),
      tekst: stopka.innerText.trim(),
      widocznaBezPrzewijania: sr.top >= 0 && sr.bottom <= d.clientHeight + 1,
    },
    cialoOverflowY: cialo ? getComputedStyle(cialo).overflowY : null,
    blokCoDalej: !!document.querySelector('[data-preview-block="whatsnext"]'),
    przyciskOpen: Array.from(document.querySelectorAll('button')).filter(
      (b) => b.innerText.trim() === 'Open'
    ).length,
    rzedyChipowMeta: rzedy.length,
    naglowkiTabeliFaktow: Array.from(document.querySelectorAll('th')).map((th) =>
      th.innerText.trim()
    ),
  };
};

(async () => {
  const przegladarka = await chromium.launch();
  const wynik = [];
  for (const w of WARIANTY) {
    const strona = await przegladarka.newPage({
      viewport: { width: w.w, height: w.h },
      deviceScaleFactor: 2,
    });
    const bledy = [];
    strona.on('console', (m) => m.type() === 'error' && bledy.push(m.text().slice(0, 200)));
    strona.on('pageerror', (e) => bledy.push('PAGEERROR ' + String(e).slice(0, 200)));
    await strona.route('**/*', (trasa) => {
      const u = trasa.request().url();
      return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')
        ? trasa.continue()
        : trasa.abort();
    });
    await strona
      .goto(`${BAZA}/?screen=k5-preview-bank&lang=en&theme=${w.motyw}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      .catch(() => {});
    await strona.waitForTimeout(7000);
    await strona.locator('tbody tr').first().click({ timeout: 15000 });
    await strona.waitForTimeout(1500);
    await strona.evaluate(() => {
      document
        .querySelectorAll('[data-dev-render-chrome]')
        .forEach((e) => (e.style.display = 'none'));
    });
    await strona.waitForTimeout(200);
    const dane = await strona.evaluate(POMIAR);
    dane.bledyKonsoli = bledy.length;
    dane.bledy = bledy;
    dane.wariant = w.nazwa;
    await strona.screenshot({ path: path.join(KATALOG, `PO-${w.nazwa}.png`) });
    wynik.push(dane);
    console.log(`\n===== ${w.nazwa} =====`);
    console.log(JSON.stringify(dane, null, 2));
    await strona.close();
  }
  fs.writeFileSync(path.join(KATALOG, 'pomiar.json'), JSON.stringify(wynik, null, 2), 'utf8');
  await przegladarka.close();
})();
