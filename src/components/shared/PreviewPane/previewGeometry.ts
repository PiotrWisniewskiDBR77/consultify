/**
 * previewGeometry — geometria kontenera preview wyprowadzona z kanonu.
 *
 * ── R03-2 ───────────────────────────────────────────────────────────────────
 *
 * Kontrakt §6 („Kontener i otwieranie"): szerokość `clamp(340px, 28%, 480px)`,
 * gap od tabeli 6 px, brak własnego `border-left`.
 *
 * PO CO OSOBNY MODUŁ. Liczby były wpisane jako literał w dwóch miejscach
 * `TableWithPreviewLayout.tsx`. Dopóki tak jest, „zmiana kanonu" znaczy
 * „znajdź wszystkie literały i nie pomyl się" — a audyt 45 tabel pokazał, że
 * to zawodzi (kebab miał 160 px przy kanonie 220 px przez dokładnie ten wzorzec).
 * Tutaj wartość powstaje z `CANON_PREVIEW`, więc rozjazd jest niewyrażalny.
 *
 * Moduł jest osobny, a nie eksportowany z pliku komponentu, bo nie-komponentowy
 * eksport z pliku komponentu psuje Fast Refresh (`react-refresh/only-export-components`)
 * — ta sama zasada, z której powstał `previewContract.ts`.
 *
 * jsdom NIE parsuje `clamp()` (odrzuca całą deklarację, `style.width` zostaje
 * puste), więc wartości nie da się dowieść przez render. Testy asertują tę
 * stałą; wymiar w pikselach domyka dowód wizualny G3/G4.
 *
 * @module components/shared/PreviewPane/previewGeometry
 */

import { CANON_PREVIEW, CANON_PREVIEW_BLOCK_HEIGHT } from '@/contracts/tableSurface/canon';

/** `clamp(340px, 28%, 480px)` — złożone z kanonu, nie z literału. */
export const PREVIEW_PANE_WIDTH = `clamp(${CANON_PREVIEW.minWidth}px, ${Math.round(
  CANON_PREVIEW.preferredRatio * 100
)}%, ${CANON_PREVIEW.maxWidth}px)`;

/**
 * Klasa odstępu preview ↔ tabela. `gap-1.5` = 0.375rem = 6 px, czyli
 * `CANON_PREVIEW.gapFromTable`. Trzymana tutaj, żeby test mógł porównać
 * deklarowaną klasę z liczbą z kanonu zamiast ufać komentarzowi.
 */
export const PREVIEW_PANE_GAP_CLASS = 'gap-1.5';

/** Odstęp w px, który `PREVIEW_PANE_GAP_CLASS` ma realizować. */
export const PREVIEW_PANE_GAP_PX = CANON_PREVIEW.gapFromTable;

/**
 * ── DLACZEGO STOPKA MA SUFIT (pomiar 2026-09-05, zgłoszenie „preview z tej
 *    tabeli nie jest zgodny ze wzorem", trzeci raz) ─────────────────────────
 *
 * `PreviewPaneShell` układa panel jako `header (shrink-0)` · `body (flex-1)` ·
 * `footer (shrink-0)`. Przy `shrink-0` stopka BIERZE tyle, ile chce, a `flex-1`
 * oddaje resztę — więc im więcej kart w stopce (blok 4 AI + blok 5 Powiązania +
 * blok 6 Akcje + „Co dalej"), tym mniej zostaje na bloki 2-3, które są TREŚCIĄ
 * podglądu.
 *
 * Zmierzone na żywo (Moja Praca → Pomysły → klik w wiersz, 1440×900, jasny):
 *   panel 728 px = nagłówek 64 + **treść 138** + **stopka 500** (69 % panelu).
 * Blok „Szczegóły" ma własną wysokość 264 px, więc w 138-pikselowym okienku
 * (minus karta meta 50 px i padding) zostawał z niego pasek ~70 px: na zrzucie
 * widać nagłówek tabeli właściwości („Właściwość | Wartość") uciety w połowie,
 * bez ani jednego wiersza danych. To jest ta „niezgodność ze wzorem" —
 * `TABLE_AND_PREVIEW_CANON.md` §7.3 pkt 3 (MUST) mówi „bogaty domyślny szablon",
 * a `CANON_PREVIEW_BLOCK_HEIGHT.detailsMin` = 200 px jest TWARDĄ dolną granicą
 * tego bloku. 70 px < 200 px — naruszenie jest arytmetyczne, nie estetyczne.
 *
 * NAPRAWA JEST W POWŁOCE, NIE W EKRANIE. Ta sama powłoka niesie podglądy
 * Zadań, Decyzji, Skrzynki i Pomysłów; łatanie „stopki Pomysłów" dałoby
 * „poprawne w 1 z 4" i odrosłoby przy pierwszej nowej karcie stopki gdziekolwiek
 * indziej. Dlatego sufit stoi tutaj i liczy się z kanonu.
 *
 * BRAK ZMIANY dla paneli, które się mieszczą: sufit jest MAKSIMUM, więc stopka
 * niższa niż sufit renderuje się co do piksela jak dotąd.
 */

/** Nagłówek panelu — `min-h-[64px]` z `PreviewPaneShell` (blok 1). */
export const PREVIEW_HEADER_MIN_PX = 64;

/**
 * Ile pionu musi zostać na bloki 2-3 (meta + Szczegóły) razem z paddingiem
 * kontenera i odstępem między kartami. Wszystkie składniki z kanonu.
 */
export const PREVIEW_BODY_MIN_PX =
  CANON_PREVIEW_BLOCK_HEIGHT.meta +
  CANON_PREVIEW_BLOCK_HEIGHT.detailsMin +
  2 * CANON_PREVIEW.wrapperPadding +
  CANON_PREVIEW.cardGap;

/**
 * Sufit stopki jako wartość CSS.
 *
 * `calc()`, nie `max(200px, …)`: przy `max()` jsdom odrzuca CAŁĄ deklarację
 * (`style` zostaje pusty), więc wartości nie dałoby się dowieść testem — ta sama
 * granica, przez którą `PREVIEW_PANE_WIDTH` (`clamp()`) jest asertowany jako
 * stała, a nie przez render. `calc()` jsdom parsuje, więc sufit ma dowód w DOM.
 *
 * Panel niższy niż `nagłówek + minimum treści` i tak nie mieści kanonu
 * (52+88+200+76+64+60 = 540 px samych bloków), a stopka ma własne
 * `overflow-y-auto`, więc akcje pozostają osiągalne przewinięciem.
 */
export const PREVIEW_FOOTER_MAX_HEIGHT = `calc(100% - ${
  PREVIEW_HEADER_MIN_PX + PREVIEW_BODY_MIN_PX
}px)`;
