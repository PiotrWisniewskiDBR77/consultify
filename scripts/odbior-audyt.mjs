#!/usr/bin/env node
/**
 * AUDYT ŚRODOWISKA ODBIORU — czy każdy obiekt nadaje się do oceny przez właściciela.
 *
 * Nie sprawdza „czy się ładuje" (HTTP 200 zawsze przechodzi w SPA), tylko czy na ekranie
 * jest COŚ DO ODBIORU: realna treść, powłoka artefaktu, działające interakcje, panel uwag,
 * czysty dark mode, brak błędów w konsoli.
 *
 * Wymaga działającego serwera na 3000 (npx vite --config dev-render/vite.config.ts --port 3000).
 * Uruchom: node scripts/odbior-audyt.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BAZA = 'http://localhost:3000';

/** Obiekty z listy odbioru — kolejność jak na stronie. */
const OBIEKTY = [
  ['Decyzja', 'karta-decision', 'artefakt'],
  ['Zadanie', 'karta-task', 'artefakt'],
  ['Powiadomienie', 'karta-notification', 'artefakt'],
  ['Insight', 'karta-insight', 'artefakt'],
  ['Narzędzie', 'karta-tool', 'artefakt'],
  ['Inicjatywa', 'karta-initiative', 'artefakt'],
  ['Idea jako tabela', 'idea-table', 'idea'],
  ['Idea jako mapa myśli', 'mindmap-canvas', 'idea'],
  ['Idea jako tablica', 'whiteboard-canvas', 'idea'],
  ['Idea jako diagram procesu', 'processflow-canvas', 'idea'],
  ['Dokument tekstowy', 'document-artifact', 'dokument'],
  ['Prezentacja', 'deck-artifact', 'dokument'],
  ['Arkusz', 'sheet-artifact', 'dokument'],
  ['Generator dokumentu', 'gen-word-content-hints', 'generator'],
  ['Generator prezentacji', 'gen-deck-content-hints', 'generator'],
  ['Generator arkusza', 'gen-excel-templates-tab', 'generator'],
  ['Agent — schemat kroków', 'agent-plan-canvas', 'agent'],
  ['Vault — poziomy dostępu', 'vault-scope-selector', 'agent'],
];

const MOTYWY = ['light', 'dark'];

/** Zbierane w przeglądarce, na wyrenderowanej stronie. */
function pomiar() {
  const w = window;
  const d = document;
  const wszystkie = [...d.querySelectorAll('*')];
  const widoczny = (el) => el.offsetParent !== null || el === d.body;

  let crimson = 0;
  const slabe = [];
  wszystkie.forEach((el) => {
    const s = w.getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor', 'borderTopColor'].forEach((p) => {
      // Crimson ma DWA warianty: #85182F w jasnym i #c8324a w ciemnym (--c-accent).
      // Skan tylko literalnego #85182F dawał fałszywą zieleń w ciemnym motywie.
      if (/rgb\(133, 24, 47\)|rgb\(200, 50, 74\)/.test(s[p])) crimson++;
    });
    if (el.children.length === 0 && widoczny(el) && parseFloat(s.opacity) > 0.9) {
      const t = (el.textContent || '').trim();
      if (t.length > 2 && !['SCRIPT', 'STYLE', 'TITLE', 'OPTION'].includes(el.tagName)) {
        const c = s.color.match(/\d+/g);
        if (c) {
          const L = +c[0] * 0.299 + +c[1] * 0.587 + +c[2] * 0.114;
          let p = el;
          let bg = 'rgba(0, 0, 0, 0)';
          while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
            const ps = w.getComputedStyle(p);
            bg = ps.backgroundColor;
            // Gradient siedzi w background-image, nie -color: bez tego spacer mijał
            // kartę z gradientem i mierzył kontrast wobec tła aplikacji (fałszywy negatyw).
            if (/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && ps.backgroundImage !== 'none') {
              const stop = ps.backgroundImage.match(/rgba?\([^)]+\)/);
              if (stop) bg = stop[0];
            }
            p = p.parentElement;
          }
          const b = bg.match(/\d+/g) || [255, 255, 255];
          const B = +b[0] * 0.299 + +b[1] * 0.587 + +b[2] * 0.114;
          if (Math.abs(L - B) < 45 && !/0\.\d+\)/.test(bg)) slabe.push(t.slice(0, 30));
        }
      }
    }
  });

  const tekst = d.body.innerText || '';
  const klikalne = wszystkie.filter(
    (el) =>
      widoczny(el) &&
      (el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.getAttribute('role') === 'button' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'INPUT'),
  ).length;

  return {
    znaki: tekst.trim().length,
    crimson,
    slabyKontrast: slabe.length,
    przykladySlabych: slabe.slice(0, 3),
    klikalne,
    panelUwag: !!wszystkie.find((el) => el.tagName === 'BUTTON' && /^Uwagi/.test((el.textContent || '').trim())),
    // Powłoka artefaktu: prawy panel z sekcjami kanonu.
    prawyPanel: /WŁAŚCIWOŚCI|POWIĄZANIA|AKCJE|Właściwości|Powiązania/.test(tekst),
    tabelaWlasciwosci: [...d.querySelectorAll('table')].some((t) => /Właściwość/i.test(t.innerText)),
    kebab: !!wszystkie.find(
      (el) =>
        widoczny(el) &&
        (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') &&
        /^[⋮…·]{1,3}$|more|kebab/i.test((el.getAttribute('aria-label') || '') + (el.textContent || '').trim()),
    ),
    bladNaEkranie: /Coś poszło nie tak|Something went wrong|Unknown <code>|Cannot read|is not defined/.test(tekst),
    pierwszeSlowa: tekst.trim().slice(0, 70).replace(/\s+/g, ' '),
  };
}

const wyniki = [];
const przegladarka = await chromium.launch();

for (const [nazwa, ekran, rodzaj] of OBIEKTY) {
  for (const motyw of MOTYWY) {
    const ctx = await przegladarka.newContext({ viewport: { width: 1440, height: 900 } });
    const strona = await ctx.newPage();
    const bledyKonsoli = [];
    strona.on('console', (m) => {
      if (m.type() === 'error') bledyKonsoli.push(m.text().slice(0, 120));
    });
    strona.on('pageerror', (e) => bledyKonsoli.push('PAGEERROR: ' + String(e.message).slice(0, 120)));

    let pomiarWynik = null;
    try {
      await strona.goto(`${BAZA}/?screen=${ekran}&cardContract=1&lang=pl&theme=${motyw}`, {
        waitUntil: 'networkidle',
        timeout: 25000,
      });
      await strona.waitForTimeout(2500); // animacja wejścia (opacity 0.18 → 1)
      pomiarWynik = await strona.evaluate(pomiar);
    } catch (e) {
      pomiarWynik = { blad: String(e.message).slice(0, 100) };
    }

    wyniki.push({
      nazwa,
      ekran,
      rodzaj,
      motyw,
      ...pomiarWynik,
      // Odfiltrowane: szum dev-servera i brak backendu w harnessie są oczekiwane.
      bledyKonsoli: bledyKonsoli.filter(
        (b) => !/favicon|vite|HMR|net::ERR_|Failed to load resource|404|Download the React DevTools/i.test(b),
      ),
    });
    await ctx.close();
    process.stdout.write('.');
  }
}
await przegladarka.close();
process.stdout.write('\n\n');

/** Próg „nadaje się do odbioru". */
function ocen(w) {
  const problemy = [];
  if (w.blad) problemy.push('nie załadował się: ' + w.blad);
  if (w.bladNaEkranie) problemy.push('błąd na ekranie');
  if ((w.znaki || 0) < 250) problemy.push(`mało treści (${w.znaki} znaków)`);
  // Próg niski celowo: ekran-katalog (np. 3 kafle szablonów) jest poprawny,
  // a pusty stan albo nieudany render dają 0-2 elementy.
  if ((w.klikalne || 0) < 3) problemy.push(`prawie nic do kliknięcia (${w.klikalne})`);
  if (!w.panelUwag) problemy.push('BRAK panelu uwag');
  if (w.crimson) problemy.push(`crimson ×${w.crimson}`);
  if ((w.slabyKontrast || 0) > 0) problemy.push(`nieczytelne teksty ×${w.slabyKontrast}`);
  // Brak backendu AI w harnessie jest oczekiwany — to nie wada ekranu do odbioru.
  const istotneBledy = (w.bledyKonsoli || []).filter((b) => !/AI returned no JSON|Analyze with AI failed/i.test(b));
  if (istotneBledy.length) problemy.push(`błędy konsoli ×${istotneBledy.length}`);
  if (w.rodzaj === 'artefakt' && !w.prawyPanel) problemy.push('brak prawego panelu');
  if (w.rodzaj === 'artefakt' && !w.tabelaWlasciwosci) problemy.push('brak tabeli właściwości');
  return problemy;
}

const raport = [];
raport.push('# Audyt środowiska odbioru\n');
raport.push(`Obiektów: ${OBIEKTY.length} × 2 motywy = ${wyniki.length} sprawdzeń.\n`);

let gotowe = 0;
const doNaprawy = [];
for (const [nazwa, ekran] of OBIEKTY) {
  const pary = wyniki.filter((w) => w.ekran === ekran);
  const problemy = pary.flatMap((w) => ocen(w).map((p) => `${w.motyw}: ${p}`));
  if (!problemy.length) {
    gotowe++;
    raport.push(`- **${nazwa}** — gotowe (treść ${pary[0].znaki} zn., ${pary[0].klikalne} elementów klikalnych)`);
  } else {
    doNaprawy.push({ nazwa, ekran, problemy });
    raport.push(`- **${nazwa}** — ⚠ ${problemy.join(' · ')}`);
  }
}
raport.push(`\n**Gotowych: ${gotowe}/${OBIEKTY.length}.**\n`);

if (doNaprawy.length) {
  raport.push('\n## Szczegóły problemów\n');
  for (const d of doNaprawy) {
    raport.push(`### ${d.nazwa} (\`${d.ekran}\`)`);
    for (const p of d.problemy) raport.push(`- ${p}`);
    const przyklady = wyniki
      .filter((w) => w.ekran === d.ekran)
      .flatMap((w) => (w.bledyKonsoli || []).map((b) => `  - [${w.motyw}] ${b}`));
    if (przyklady.length) raport.push('Błędy konsoli:', ...przyklady.slice(0, 6));
    const slabe = wyniki
      .filter((w) => w.ekran === d.ekran)
      .flatMap((w) => (w.przykladySlabych || []).map((s) => `  - [${w.motyw}] „${s}"`));
    if (slabe.length) raport.push('Nieczytelne teksty:', ...slabe.slice(0, 6));
    raport.push('');
  }
}

const tresc = raport.join('\n');
fs.writeFileSync('docs/testing/reports/AUDYT_SRODOWISKA_ODBIORU.md', tresc, 'utf8');
console.log(tresc);
