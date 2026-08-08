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

import { CANON_PREVIEW } from '@/contracts/tableSurface/canon';

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
