/**
 * TOR GRAFIKA — narzędzie zrzutowe (2026-08-30).
 *
 * Po co: reguła nr 1 toru grafiki mówi, że ŻADEN ekran nie wchodzi do budowy
 * bez zrzutu stanu zastanego, a reguła nr 3 (CLAUDE.md #7), że właściciel nigdy
 * nie jest pierwszym testerem wizualnym. To narzędzie produkuje dowody dla obu.
 *
 * Zamiast skryptu per ekran (w scripts/dev/ jest ich kilkadziesiąt, każdy
 * z zaszytą ścieżką wyjścia) — jedno narzędzie z parametrami.
 *
 * Wymaga działającego harnessu dev-render:
 *   npx vite --config dev-render/vite.config.ts --port 3020 --strictPort
 *
 * Użycie:
 *   node scripts/dev/grafika-zrzuty.mjs \
 *     --ekrany=karta-initiative,karta-insight \
 *     --katalog=06-inicjatywy \
 *     --faza=PRZED
 *
 * Wynik: evidence/grafika/<katalog>/<ekran>__<FAZA>__<light|dark>.png
 * Konwencja z docs/program/grafika/00_ZASADY_PRACY.md.
 */
import fs from 'fs';
import path from 'path';

import { chromium } from 'playwright';

import { checkScreenshotPairState } from './lib/checkScreenshotPairState.mjs';
import { meanLuma } from './lib/meanLuma.mjs';

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};

const BASE = arg('base', 'http://127.0.0.1:3020');
const EKRANY = arg('ekrany', '').split(',').map((s) => s.trim()).filter(Boolean);
const KATALOG = arg('katalog', 'nieprzypisane');
const FAZA = arg('faza', 'PRZED').toUpperCase();
const MOTYWY = arg('motywy', 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const SZEROKOSC = Number(arg('szerokosc', '1440'));
const WYSOKOSC = Number(arg('wysokosc', '900'));
const OSIAD = Number(arg('osiad', '2500')); // ile ms po networkidle — ekrany dociągają dane po kolei
const JEZYK = arg('jezyk', 'pl');
/**
 * Dodatkowe parametry adresu, np. flagi funkcji: --parametry=ff_org_redesign_v1=1&sub=all
 *
 * POWÓD ISTNIENIA (odbiór grafiki 2026-08-30): ekran „Tożsamość i model działania"
 * bez `ff_org_redesign_v1=1` renderuje STARĄ powierzchnię, nie docelową. Robotnik
 * zmierzył wariant, którego nie oceniał, i o mało nie zgłosił defektu z ekranu,
 * który nie jest tym ekranem. Bez tego przełącznika narzędzie po cichu mierzy
 * niewłaściwą rzecz — a to jest gorsze niż brak pomiaru.
 */
const PARAMETRY = arg('parametry', '').replace(/^[?&]/, '');
/**
 * Dwie DROGI WEJŚCIA do harnessu — odkryte 2026-08-30 przy domykaniu pokrycia.
 *
 * `?screen=X` to droga wspólna (rejestr w `dev-render/main.tsx`). Ale OSIEMNAŚCIE
 * ekranów ma WŁASNY plik `dev-render/X.html` z osobnym punktem wejścia i przez
 * `?screen=` w ogóle ich nie widać — narzędzie odpowiadało listą awaryjną, a to
 * wygląda dokładnie jak „ekran się nie renderuje". Dwa ekrany SIRI dostały przez
 * to fałszywą ocenę D.
 *
 * `--wejscie=html` otwiera `${BASE}/X.html` zamiast `${BASE}/?screen=X`.
 */
const WEJSCIE = arg('wejscie', 'screen');
/**
 * `--przewin=<selektor CSS>` — przewiń element DO KADRU przed zrzutem.
 *
 * POWÓD ISTNIENIA (przegląd przed odbiorem 2026-08-30): kontrolka poufności
 * Idei siedzi na 1325. pikselu WEWNĄTRZ prawego panelu, który ma własny
 * `overflow-y: auto` i widoczne 852 px. `fullPage` mierzy przewijanie STRONY,
 * nie kontenera, więc kontrolka nie mogła trafić na żaden zrzut — i meldunek
 * „kontrolka działa" spotkał się ze zrzutem, na którym jej nie ma. Robotnik
 * nie mógł tego rozstrzygnąć narzędziem, którym mierzył.
 *
 * Można podać kilka selektorów po przecinku (przewijane po kolei). Selektor,
 * którego nie ma na stronie, jest RAPORTOWANY jako `przewin: BRAK` — cicha
 * porażka przewijania wyglądałaby dokładnie jak defekt produktu.
 */
const PRZEWIN = arg('przewin', '').split(',').map((s) => s.trim()).filter(Boolean);
/**
 * `--klawisze=ArrowRight*5,End` — wciśnij klawisze PRZED zrzutem.
 *
 * POWÓD ISTNIENIA (dyżur macierzy DRD 2026-09-01): `assessment-presentation-view`
 * to KOLEKCJA slajdów w jednym komponencie — macierz osi siedzi na slajdzie 6.
 * Narzędzie zrzucało zawsze slajd 1 (tytułowy), więc każdy pomiar tego ekranu
 * odpowiadał na pytanie „jak wygląda strona tytułowa", a nie na pytanie zadane.
 * Właściciel napisał „nigdzie nie znalazłem macierzy" — a macierz na slajdzie
 * była; przyrząd po prostu nigdy do niej nie doszedł. To ten sam kształt awarii
 * co `--przewin`: narzędzie po cichu mierzy niewłaściwą rzecz.
 *
 * Składnia: nazwy klawiszy Playwrighta po przecinku, `*N` powtarza N razy.
 */
const KLAWISZE = arg('klawisze', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .flatMap((s) => {
    const [klawisz, ile] = s.split('*');
    return Array.from({ length: Math.max(1, Number(ile) || 1) }, () => klawisz);
  });
/**
 * `--klik=<selektor CSS>` — kliknij element PRZED zrzutem (kilka po przecinku,
 * klikane po kolei).
 *
 * POWÓD ISTNIENIA (dyżur rodziny podglądu 2026-09-01): podgląd wiersza
 * (preview pane) jest wg kanonu §7.1 **domyślnie zamknięty** i otwiera go
 * dopiero single-click w wiersz. Narzędzie nie umiało kliknąć, więc każdy
 * zrzut ekranu listowego pokazywał tabelę BEZ podglądu — czyli nie pokazywał
 * tego, co właściciel zgłosił. Zmierzono: `?screen=idea-table` renderuje
 * `[data-preview-pane]` = 0 sztuk. Meldunek „podgląd poprawiony" nie mógł
 * mieć dowodu na obrazie, bo przyrząd tej rzeczy nie umiał wyświetlić.
 *
 * Ten sam kształt awarii co `--przewin` i `--klawisze`: narzędzie po cichu
 * mierzy niewłaściwą rzecz. Dlatego selektor, którego NIE MA na stronie, jest
 * raportowany jako `klik: BRAK` — cicha porażka kliknięcia wyglądałaby
 * dokładnie jak defekt produktu.
 */
const KLIK = arg('klik', '').split(',').map((s) => s.trim()).filter(Boolean);
/**
 * DOMYŚLNY KLIK W WIERSZ — bez potrzeby wpisywania `--klik` per ekran (dyżur
 * 192, zadanie 1+3).
 *
 * POWÓD ISTNIENIA: 29 wpisów `klik` na 253 ekrany to dług, który zgnije —
 * każdy nowy ekran listowy wymagałby osobnego wpisu. `StandardTable` deleguje
 * CAŁĄ mechanikę wiersza do `FilterableTable` (`src/components/shared/
 * ModuleHub/FilterableTable.tsx`), który renderuje PRAWDZIWY `<table>` z
 * atrybutem `data-min-table-width` (jedyne miejsce w kodzie, które go
 * nadaje) i zwykłe `<tr>` w `<tbody>` — semantyka HTML, żadnego ARIA-role
 * nadpisania, więc selektor jest identyczny na KAŻDYM ekranie zbudowanym na
 * kanonie (`StandardTable`/`FilterableTable`), bez wyjątków per moduł.
 *
 * Gdy operator NIE poda `--klik`, przelot PRÓBUJE kliknąć pierwszy wiersz
 * tym selektorem, zanim zrobi zrzut. Element ZAWSZE ma `onClick` (nawet gdy
 * ekran nie podał `onRowClick` — wtedy to no-op), więc kliknięcie nigdy nie
 * jest niebezpieczne ani nie psuje ekranów bez podglądu.
 *
 * Jawny `--klik` (istniejące 29 wpisów) ma PIERWSZEŃSTWO i wyłącza tę ścieżkę
 * całkowicie — zero zmiany zachowania dla wywołań, które już podają swój
 * selektor. Wyłącznik `--bez-klika-domyslnego=1` dla ekranów, o których z
 * góry wiadomo, że nie są listowe (rzadki przypadek — samo „nie znaleziono"
 * już się nie liczy jako błąd, patrz niżej).
 *
 * Gdy selektor NIE JEST znaleziony (ekran nie jest listowy, albo tabela jest
 * pusta — narzędzie NIE zgaduje które), to jest LICZONE i wypisane w
 * podsumowaniu na końcu przelotu, ale NIGDY nie ustawia kodu wyjścia 1 —
 * zablokowanie całego przelotu byłoby osobną szkodą (patrz `KLIK` wyżej:
 * jawny `--klik` blokuje, bo operator explicite oczekiwał tego elementu;
 * domyślna próba nie ma tej pewności).
 */
const DOMYSLNY_KLIK_SELEKTOR = 'table[data-min-table-width] tbody tr';
const BEZ_KLIKA_DOMYSLNEGO = arg('bez-klika-domyslnego', '0') === '1';
/**
 * `--wynik-selektor=<css>` — OPCJONALNY. Kilka selektorów po przecinku = WSZYSTKIE
 * muszą być w DOM (AND), jak w `waitFor` z day233.
 *
 * POWÓD ISTNIENIA (przejęcie bezpiecznika 2026-09-01, KSZTAŁT 19 —
 * docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md): narzędzie
 * czekało wyłącznie stały czas (`OSIAD`) i potem robiło zrzut — loteria.
 * Odbiór dyżuru 233 (Finanse) zmierzył, do czego to prowadzi: para
 * light/dark POKAZAŁA DWA RÓŻNE STANY programu (light=sam formularz,
 * dark=policzony wynik), a stary bezpiecznik jasności (próg 150) to
 * przepuścił TYM ŁATWIEJ, im większy był defekt (różnica jasności > 200).
 * Wzorzec naprawy: `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs`.
 *
 * Gdy podany:
 *  1) PO interakcjach (`--klawisze`/`--klik`/`--przewin`) narzędzie czeka na
 *     ten selektor (`waitForSelector`, `state:'attached'`) zamiast polegać
 *     wyłącznie na stałym `OSIAD` — bo wynik często pojawia się DOPIERO po
 *     kliknięciu „policz" (AutoRun bez klika, jak w day233, jest wyjątkiem,
 *     nie regułą — dlatego czekanie na wynik siedzi PO `--klik`, nie zamiast
 *     początkowego, krótkiego osiadnięcia startowego).
 *  2) Po zrzucie narzędzie odczytuje przez `page.evaluate`, czy selektor(y)
 *     są w DOM, i zapisuje to w ZBIORCZYM pliku wyników obok zrzutów
 *     (`_wynik-kontrola__<FAZA>.json` w tym samym katalogu co PNG-i) —
 *     wybrane zamiast sidecar-per-PNG, bo katalog `evidence/grafika/*`
 *     bywa dziesiątkami plików na partię i jeden plik do przejrzenia/grep
 *     jest czytelniejszy niż dziesiątki `.json` obok każdego `.png`.
 *  3) Gdy dla danego ekranu powstanie PARA jasny+ciemny, narzędzie woła
 *     `checkScreenshotPairState` (jasność RÓWNOCZEŚNIE z obecnością wyniku
 *     w DOM) i GŁOŚNO zgłasza parę, która nie przechodzi (kod wyjścia 1).
 *
 * Bez tego parametru: DOKŁADNIE stare zachowanie (zgodność wsteczna) — brak
 * jakiejkolwiek kontroli stanu, sam `OSIAD` jak dotąd. „Brak pomiaru nie jest
 * wynikiem pozytywnym" — dlatego kontrola stanu jest tu OPT-IN, nie
 * domyślnie włączona z cichym `true`, żeby dziesiątki istniejących wywołań
 * (`scripts/dev/*.sh`, instrukcje) nie zaczęły nagle padać na ekranach, dla
 * których nikt nie podał selektora wyniku.
 */
const WYNIK_SELEKTOR = arg('wynik-selektor', '').split(',').map((s) => s.trim()).filter(Boolean);

if (EKRANY.length === 0) {
  console.error('BŁĄD: podaj --ekrany=a,b,c');
  process.exit(1);
}
if (!['PRZED', 'PO'].includes(FAZA)) {
  console.error('BŁĄD: --faza musi być PRZED albo PO');
  process.exit(1);
}

const OUT = path.resolve(process.cwd(), 'evidence/grafika', KATALOG);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const wyniki = [];
// ekran → { light: {hasResultMarker, obrazJasnosc}, dark: {...} } — tylko
// gdy --wynik-selektor podany (patrz komentarz przy WYNIK_SELEKTOR wyżej).
const paryZapis = new Map();
const wszystkiePary = [];

for (const ekran of EKRANY) {
  for (const motyw of MOTYWY) {
    // Świeży kontekst na każdy zrzut — localStorage z poprzedniej nawigacji
    // potrafi przenieść stan flag między ekranami (udokumentowana pułapka
    // harnessu, patrz scripts/dev/ap-client-screenshots.mjs).
    const context = await browser.newContext({
      viewport: { width: SZEROKOSC, height: WYSOKOSC },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const bledy = [];
    const przewinBrak = [];
    const klikBrak = [];
    const wynikBrak = [];
    // Domyślny klik w wiersz (zadanie 3, dyżur 192) — poza `status`/`bledy`
    // celowo: „nie znaleziono" ma być POLICZONE i WIDOCZNE w podsumowaniu,
    // ale NIGDY nie ustawia kodu wyjścia 1 (patrz komentarz przy
    // DOMYSLNY_KLIK_SELEKTOR — zablokowanie przelotu to osobna szkoda).
    let podgladDomyslnyProbowany = false;
    let podgladDomyslnyBrak = false;
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(m.text().slice(0, 200));
    });
    /**
     * `uwagi=0` — WYCINA panel uwag właściciela z kadru.
     *
     * ★ PROSTUJE BŁĄD Z 2026-08-30. Do tego dnia narzędzie próbowało schować
     * kontrolki harnessu przez `addStyleTag` z selektorami
     * `[data-dev-render-chrome], .dev-render-chrome`. Selektory te **nie istnieją
     * w `dev-render/PanelUwag.tsx`** — reguła CSS była martwa, a pływające czarne
     * pastylki „← Lista" i „Uwagi" siedziały na KAŻDYM zrzucie i zasłaniały realną
     * treść produktu (m.in. nagłówek sekcji w podglądzie, rząd przycisków
     * w pakiecie sprawozdań, ostatni wiersz tabeli w rejestrze OKR).
     * Właściciel oglądał te zrzuty jako „czyste".
     *
     * Właściwy wyłącznik istniał od początku: `dev-render/main.tsx:1696`
     * renderuje panel tylko gdy `params.get('uwagi') !== '0'`, a komentarz przy
     * nim mówi wprost: „na zrzucie do akceptu nie mogą się pojawić (zrzut czysty,
     * CLAUDE.md §7c)". Narzędzie po prostu nigdy tego parametru nie podawało.
     */
    const url =
      WEJSCIE === 'html'
        ? `${BASE}/${ekran}.html?lang=${JEZYK}&theme=${motyw}&uwagi=0${PARAMETRY ? `&${PARAMETRY}` : ''}`
        : `${BASE}/?screen=${ekran}&lang=${JEZYK}&theme=${motyw}&uwagi=0${PARAMETRY ? `&${PARAMETRY}` : ''}`;
    const plik = path.join(OUT, `${ekran}__${FAZA}__${motyw}.png`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      if (WYNIK_SELEKTOR.length === 0) {
        // Stare zachowanie, bez zmian (zgodność wsteczna) — patrz komentarz
        // przy WYNIK_SELEKTOR.
        await page.waitForTimeout(OSIAD);
      } else {
        // Krótkie osiadnięcie startowe — tylko żeby --klik/--przewin miały
        // czego szukać. Właściwe czekanie NA WYNIK jest PO interakcjach
        // (patrz niżej), bo wynik często wymaga kliknięcia „policz".
        await page.waitForTimeout(300);
      }
      for (const k of KLAWISZE) {
        await page.keyboard.press(k);
        await page.waitForTimeout(120);
      }
      if (KLAWISZE.length > 0) await page.waitForTimeout(400);
      for (const sel of KLIK) {
        const cel = page.locator(sel).first();
        if ((await cel.count()) === 0) {
          klikBrak.push(sel);
          continue;
        }
        await cel.click({ timeout: 5000 }).catch(() => klikBrak.push(sel));
        await page.waitForTimeout(500);
      }
      if (KLIK.length > 0) await page.waitForTimeout(400);
      // Domyślny klik w wiersz — TYLKO gdy operator nie podał własnego `--klik`
      // (patrz komentarz przy DOMYSLNY_KLIK_SELEKTOR). Jawny `--klik` = zero
      // zmiany zachowania względem dotychczasowych wywołań.
      if (KLIK.length === 0 && !BEZ_KLIKA_DOMYSLNEGO) {
        podgladDomyslnyProbowany = true;
        const wiersz = page.locator(DOMYSLNY_KLIK_SELEKTOR).first();
        if ((await wiersz.count()) === 0) {
          podgladDomyslnyBrak = true;
        } else {
          try {
            await wiersz.click({ timeout: 5000 });
            await page.waitForTimeout(500);
          } catch {
            podgladDomyslnyBrak = true;
          }
        }
      }
      for (const sel of PRZEWIN) {
        const trafiony = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          return true;
        }, sel);
        if (!trafiony) przewinBrak.push(sel);
      }
      if (PRZEWIN.length > 0) await page.waitForTimeout(300);
      if (WYNIK_SELEKTOR.length > 0) {
        // Czekaj NA WYNIK zamiast wyłącznie na czas — rdzeń tego bezpiecznika.
        // Selektor, którego nie ma, jest RAPORTOWANY (`wynik: BRAK`), nie
        // wywala skryptu — chcemy zrzut nawet gdy wynik się nie pojawił,
        // żeby było co ocenić i o czym krzyczeć w kontroli pary niżej.
        for (const sel of WYNIK_SELEKTOR) {
          await page
            .waitForSelector(sel, { timeout: 20000, state: 'attached' })
            .catch(() => wynikBrak.push(sel));
        }
        // Domalowanie po dotarciu węzła wyniku (wykresy przez ResizeObserver)
        // — ten sam wzorzec co day233 (linia ~133).
        await page.waitForTimeout(300);
      }
      // Chrome harnessu wycina `uwagi=0` w adresie (patrz komentarz wyżej).
      // Ta reguła zostaje jako PAS BEZPIECZEŃSTWA dla ekranów, które oznaczają
      // własne elementy harnessu atrybutem `data-dev-render-chrome` — robi tak
      // m.in. `dev-render/screens/drd-macierz-oceny.tsx:159`.
      await page.addStyleTag({
        content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }',
      });
      await page.screenshot({ path: plik, fullPage: true });
      const { szer, wys } = await page.evaluate(() => ({
        szer: document.documentElement.scrollWidth,
        wys: document.documentElement.scrollHeight,
      }));
      // Kontrola stanu (opcjonalna) — odczytaj PRAWDĘ z DOM w chwili zrzutu,
      // nie z tego, czy `waitForSelector` się powiódł (te dwie rzeczy mogą się
      // różnić: np. element dojdzie tuż PO timeoucie waitFor, ale ZANIM
      // zrobiliśmy zrzut — wtedy evaluate go złapie, mimo wpisu w wynikBrak).
      let hasResultMarker = null;
      let obrazJasnosc = null;
      if (WYNIK_SELEKTOR.length > 0) {
        hasResultMarker = await page.evaluate(
          (sels) => sels.every((s) => document.querySelector(s) !== null),
          WYNIK_SELEKTOR
        );
        obrazJasnosc = await meanLuma(plik);
        const zapis = paryZapis.get(ekran) || {};
        zapis[motyw] = { hasResultMarker, obrazJasnosc };
        paryZapis.set(ekran, zapis);
      }
      wyniki.push({
        ekran,
        motyw,
        plik,
        szer,
        wys,
        bledy: bledy.length,
        wynikSelektor: WYNIK_SELEKTOR.length > 0 ? WYNIK_SELEKTOR : undefined,
        hasResultMarker,
        obrazJasnosc,
        status: [
          klikBrak.length > 0 ? `klik BRAK: ${klikBrak.join(' ')}` : '',
          przewinBrak.length > 0 ? `przewin BRAK: ${przewinBrak.join(' ')}` : '',
          wynikBrak.length > 0 ? `wynik BRAK: ${wynikBrak.join(' ')}` : '',
        ].filter(Boolean).join(' | ') || 'OK',
        // Poza `status` CELOWO — patrz komentarz przy deklaracji zmiennych:
        // to jest LICZONE/WYPISANE, ale nigdy nie ustawia kodu wyjścia 1.
        podgladDomyslnyProbowany,
        podgladDomyslnyBrak,
      });
    } catch (e) {
      wyniki.push({
        ekran,
        motyw,
        plik: '—',
        szer: 0,
        wys: 0,
        bledy: bledy.length,
        status: `BŁĄD: ${e.message.slice(0, 80)}`,
        podgladDomyslnyProbowany,
        podgladDomyslnyBrak,
      });
    }
    await context.close();
  }
  // Para dla tego ekranu jest kompletna dopiero teraz (po pętli motywów) —
  // sprawdzaj TU, nie w środku pętli motywów wyżej.
  if (WYNIK_SELEKTOR.length > 0) {
    const zapis = paryZapis.get(ekran);
    if (zapis && zapis.light && zapis.dark) {
      const werdykt = checkScreenshotPairState({
        pairName: ekran,
        lightMeanLuma: zapis.light.obrazJasnosc,
        darkMeanLuma: zapis.dark.obrazJasnosc,
        requiresResultMarker: true,
        lightHasResultMarker: zapis.light.hasResultMarker,
        darkHasResultMarker: zapis.dark.hasResultMarker,
      });
      wszystkiePary.push({ ekran, ok: werdykt.ok, reasons: werdykt.reasons });
      if (!werdykt.ok) {
        console.log(`\n★★★ PARA NIE PRZESZŁA KONTROLI STANU: ${ekran} ★★★`);
        for (const powod of werdykt.reasons) console.log(`  ${powod}`);
      }
    }
  }
}

await browser.close();

console.log(`\nZrzuty → ${OUT}\n`);
console.log('ekran                          motyw   status      wys.strony  błędy konsoli');
console.log('─'.repeat(82));
for (const w of wyniki) {
  // Nota o domyślnym kliku jest CELOWO poza `w.status` (nie wpływa na kod
  // wyjścia) — patrz komentarz przy DOMYSLNY_KLIK_SELEKTOR.
  const podgladNota = w.podgladDomyslnyProbowany
    ? w.podgladDomyslnyBrak
      ? ' | podgląd: BRAK (nie znaleziono wiersza do kliknięcia)'
      : ' | podgląd: klik wykonany'
    : '';
  console.log(
    `${w.ekran.padEnd(30)} ${w.motyw.padEnd(7)} ${w.status.padEnd(24)} ${String(w.wys).padStart(9)}  ${w.bledy > 0 ? `★ ${w.bledy}` : '0'}${podgladNota}`
  );
}
const zle = wyniki.filter((w) => w.status !== 'OK').length;
console.log(`\n${wyniki.length - zle}/${wyniki.length} zrzutów wykonanych.`);
if (zle > 0) process.exitCode = 1;

// Podsumowanie domyślnego klika (zadanie 3, dyżur 192) — POLICZONE i
// WYPISANE, nigdy nie ustawia kodu wyjścia (zablokowanie przelotu to osobna
// szkoda — patrz komentarz przy DOMYSLNY_KLIK_SELEKTOR).
if (BEZ_KLIKA_DOMYSLNEGO) {
  console.log(
    `★ DOMYŚLNY KLIK W WIERSZ WYŁĄCZONY (--bez-klika-domyslnego=1) — 0/${wyniki.length} zrzutów próbowało otworzyć podgląd.`
  );
} else {
  const probowane = wyniki.filter((w) => w.podgladDomyslnyProbowany);
  const bezPodgladu = probowane.filter((w) => w.podgladDomyslnyBrak).length;
  console.log(
    `Domyślny klik w wiersz (${DOMYSLNY_KLIK_SELEKTOR}): ${probowane.length - bezPodgladu}/${probowane.length} zrzutów kliknęło wiersz przed zrzutem; ` +
      `${bezPodgladu} sfotografowano BEZ próby otwarcia podglądu (nie znaleziono wiersza do kliknięcia — ekran może nie być listowy, tabela może być pusta).`
  );
}

if (WYNIK_SELEKTOR.length > 0) {
  // Zbiorczy plik obok zrzutów (nie sidecar-per-PNG) — patrz uzasadnienie
  // przy WYNIK_SELEKTOR na górze pliku.
  const plikWynikow = path.join(OUT, `_wynik-kontrola__${FAZA}.json`);
  fs.writeFileSync(
    plikWynikow,
    JSON.stringify({ wynikSelektor: WYNIK_SELEKTOR, wyniki, pary: wszystkiePary }, null, 2)
  );
  const zlePary = wszystkiePary.filter((p) => !p.ok).length;
  console.log(`Zbiorczy plik kontroli stanu → ${plikWynikow}`);
  console.log(`Kontrola stanu (--wynik-selektor): ${wszystkiePary.length - zlePary}/${wszystkiePary.length} par przeszło.`);
  if (zlePary > 0) {
    console.log(`★ ${zlePary} PARA(Y) NIE PRZESZŁY KONTROLI STANU (patrz wyżej) — kod wyjścia 1.`);
    process.exitCode = 1;
  }
} else {
  // NAPRAWA 2026-09-01 (rozszerzone pytanie bezpieczników — "co robi, gdy
  // NIKT GO O POMIAR NIE POPROSIŁ"): `--wynik-selektor` jest OPT-IN (patrz
  // uzasadnienie przy WYNIK_SELEKTOR wyżej — nie chcemy wywalać dziesiątek
  // istniejących wywołań, które go nie podają). Ale do dziś ta ścieżka była
  // CICHA: brak selektora = zero wzmianki w wyjściu, że KSZTAŁT 19 (para
  // zgodna, różne stany) w ogóle nie był sprawdzany. To ten sam kształt co
  // "esbuild niedostepny — pominieto sprawdzenie" czytane jako "przeszło".
  // Cisza ma przestać być cicha: nie blokujemy (exit 0 zostaje), ale mówimy
  // WPROST, ile zrzutów poszło bez kontroli stanu.
  console.log(
    `★ KONTROLA STANU (--wynik-selektor) NIE URUCHOMIONA — 0/${wyniki.length} zrzutów miało sprawdzoną zgodność ` +
      `light/dark wg KSZTAŁTU 19 (para zgodna, różne stany). Oceniono WYŁĄCZNIE różnicą jasności/wymiarami strony. ` +
      `Podaj --wynik-selektor=<css>, jeśli ekran ma pokazywać POLICZONY wynik.`
  );
}
