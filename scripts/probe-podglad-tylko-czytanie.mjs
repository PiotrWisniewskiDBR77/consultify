#!/usr/bin/env node
/**
 * WERYFIKACJA „Podgląd = tylko czytanie" — 6 kart n-Type × 2 tryby × 2 motywy.
 *
 * Metodyka (lekcje nocy 2026-07-23/24):
 *  · harness startuje karty w EDYCJI (poza Insightem) → Podgląd trzeba KLIKNĄĆ;
 *  · trybu NIE poznasz po tekście strony (słowo „Podgląd" jest na pstryczku
 *    w obu trybach) → rozstrzyga `aria-checked` na radio;
 *  · `innerText` nie pokazuje treści pól → pola czytamy przez `.value`;
 *  · sekcje prawego panelu bywają zwinięte → rozwijamy WSZYSTKIE przed liczeniem.
 *
 * Uruchom przy harnessie na 3170:  node scripts/probe-podglad-final.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BAZA = 'http://localhost:3170';
const KATALOG = '/tmp/zrzuty-podglad';
const KARTY = [
  ['Inicjatywa', 'karta-initiative'],
  ['Insight', 'karta-insight'],
  ['Zadanie', 'karta-task'],
  ['Decyzja', 'karta-decision'],
  ['Powiadomienie', 'karta-notification'],
  ['Narzędzie', 'karta-tool'],
];

/** Akcje ZMIENIAJĄCE STAN — dopasowanie po widocznej etykiecie (PL). */
const ZMIENIA_STAN =
  /^(Utwórz wariant|Oznacz jako ukończone|Oznacz gotowe|Otwórz ponownie|Zgłoś do recenzji|Zatwierdź|Opublikuj|Szkic|Generowanie|Ukończone|Opublikowano|Błąd|Konwertuj na inicjatywę|Oznacz przeczytane|Odłóż|Ponów|Wycisz|Usuń|Archiwizuj|Oznacz jako zablokowane|Nowe zadanie|Nowa decyzja|Dodaj RAID|Zapisz|Deleguj|Przydziel|Zablokuj|Ukończ|Wznów|Start)/i;

/** Zbiera stan strony: pstryczek, aktywne przyciski, edytowalne pola. */
function zbierz() {
  const w = window,
    d = document;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = w.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.15;
  };
  const etykieta = (e) =>
    (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);

  const przyciski = [...d.querySelectorAll('button, [role="button"], [role="menuitem"]')]
    .filter((e) => vis(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true')
    .map(etykieta)
    .filter(Boolean);

  const pola = [...d.querySelectorAll('input:not([type=hidden]), textarea, select, [contenteditable="true"]')]
    .filter((e) => vis(e) && !e.disabled && !e.readOnly && e.getAttribute('contenteditable') !== 'false')
    .map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('type') || ''}] "${String(e.value ?? e.textContent ?? '').slice(0, 30)}"`);

  const uchwyty = [...d.querySelectorAll('.lucide-grip-vertical, [class*="grip"]')].filter(vis).length;

  const radio = [...d.querySelectorAll('[role="radio"]')].map((r) => ({
    l: etykieta(r),
    c: r.getAttribute('aria-checked'),
  }));

  return { przyciski, pola, uchwyty, radio };
}

/** Rozwija wszystkie zwinięte sekcje prawego panelu (max 3 przebiegi). */
function rozwin() {
  let klikniete = 0;
  for (let i = 0; i < 3; i++) {
    const zwiniete = [...document.querySelectorAll('button[aria-expanded="false"]')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && b.closest('section');
    });
    if (!zwiniete.length) break;
    zwiniete.forEach((b) => {
      b.click();
      klikniete++;
    });
  }
  return klikniete;
}

fs.mkdirSync(KATALOG, { recursive: true });
const raport = {};
const browser = await chromium.launch();

for (const [nazwa, klucz] of KARTY) {
  raport[nazwa] = {};
  for (const motyw of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1680, height: 1200 } });
    const page = await ctx.newPage();
    const bledy = [];
    page.on('console', (m) => m.type() === 'error' && bledy.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => bledy.push('PAGEERROR: ' + String(e).slice(0, 160)));
    await page.goto(`${BAZA}/?screen=${klucz}&lang=pl&theme=${motyw}`, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const wynik = {};
    for (const tryb of ['Edycja', 'Podgląd']) {
      const r = page.locator('[role="radio"]').filter({ hasText: tryb }).first();
      if (await r.count()) {
        await r.click({ force: true, timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      await page.evaluate(rozwin).catch(() => {});
      await page.waitForTimeout(900);
      const s = await page.evaluate(zbierz);
      const podglad = s.radio.find((x) => /Podgl/i.test(x.l));
      wynik[tryb] = {
        ariaChecked: podglad ? podglad.c : 'BRAK-PSTRYCZKA',
        przyciski: s.przyciski,
        zmieniaStan: s.przyciski.filter((p) => ZMIENIA_STAN.test(p)),
        pola: s.pola,
        uchwyty: s.uchwyty,
      };
      await page.screenshot({
        path: `${KATALOG}/${klucz}-${motyw}-${tryb === 'Edycja' ? 'edycja' : 'podglad'}.png`,
        fullPage: false,
      });
    }
    wynik.bledy = [...new Set(bledy)].slice(0, 4);
    raport[nazwa][motyw] = wynik;
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync('/tmp/raport-podglad.json', JSON.stringify(raport, null, 2));

console.log('\n╔═══ TABELA: akcje zmieniające stan (PL, motyw light) ═══');
for (const [nazwa, m] of Object.entries(raport)) {
  const e = m.light.Edycja,
    p = m.light['Podgląd'];
  console.log(
    `\n── ${nazwa}  [pstryczek: Edycja=${e.ariaChecked} → Podgląd=${p.ariaChecked}]`
  );
  console.log(`   EDYCJA : ${e.przyciski.length} aktywnych, ${e.zmieniaStan.length} zmieniających stan, ${e.pola.length} pól`);
  console.log(`            ${JSON.stringify(e.zmieniaStan)}`);
  console.log(`   PODGLĄD: ${p.przyciski.length} aktywnych, ${p.zmieniaStan.length} zmieniających stan, ${p.pola.length} pól`);
  console.log(`            ${JSON.stringify(p.zmieniaStan)}`);
  const dark = m.dark['Podgląd'];
  console.log(`   DARK Podgląd: ${dark.zmieniaStan.length} zmieniających stan ${JSON.stringify(dark.zmieniaStan)}`);
  if (m.light.bledy.length) console.log('   BŁĘDY light:', m.light.bledy);
  if (m.dark.bledy.length) console.log('   BŁĘDY dark:', m.dark.bledy);
}
