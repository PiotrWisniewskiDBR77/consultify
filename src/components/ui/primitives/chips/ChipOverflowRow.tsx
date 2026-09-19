/**
 * ChipOverflowRow — KANONICZNY wzorzec przepełnienia rzędu chipów (D-127,
 * Wpis 205, 2026-09-19).
 *
 * Jeden wzorzec dla WSZYSTKICH list zamiast kopi per ekran: kolumna chipów
 * renderuje chipy, które MIESZCZĄ SIĘ W CAŁOŚCI w finalnej szerokości kolumny,
 * a resztę zwija do chipa „+N" (pełna lista w `title`). Nigdy nie tnie chipa w
 * połowie glifa — to jest dokładnie odchylenie, które właściciel odebrał na
 * Ideas („automatyzac…" zamiast „automatyzacja").
 *
 * DLACZEGO „+N", A NIE pomiar rzędu w `columnFit` (Wpis 205, wybór wzorca):
 * pomiar rzędu (option a) tylko ŻĄDA szerszej kolumny, ale `columnFit` i tak
 * ściska wszystkie kolumny, gdy suma przekracza viewport — więc nie gwarantuje
 * `scrollWidth ≤ clientWidth`, a przy okazji pcha szerokość do sufitu typu
 * („rozszerza tabele"). „+N" jest OGRANICZONE: kolumna trzyma swoją szerokość,
 * a treść dostosowuje LICZBĘ chipów do tego, co realnie zostało wyrenderowane.
 * Zmierzone w ideas-i v3: 5/5 komórek `scrollWidth == clientWidth == 145`.
 *
 * Kontrakt: każdy element w `items` musi renderować POJEDYNCZY element DOM i nie
 * kurczyć się (`shrink-0`) — wtedy `measure.children[i].offsetWidth` to szerokość
 * i-tego chipa. Warstwa pomiarowa jest niewidoczna (`invisible absolute`), więc
 * mierzy naturalne szerokości bez zawijania.
 *
 * ŚWIADOMIE bez portalu i bez `overflow-hidden` na RODZICU komórki: chipy to
 * treść, nie popover, a warstwa pomiarowa jest `absolute` wewnątrz własnego
 * `relative` boxa — nie wpływa na sąsiadów.
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { MetaChip } from './MetaChip';

/** Odstęp `gap-1` między chipami w rzędzie (px). */
export const CHIP_ROW_GAP_PX = 4;

/**
 * Ile WIODĄCYCH chipów mieści się W CAŁOŚCI w `avail`, znając naturalną
 * szerokość każdego chipa i szerokość chipa „+N". Czysta funkcja (bez DOM-u) —
 * testowalna i mutowalna bez przeglądarki.
 *
 * Kontrakt (zero uciętych glifów, nigdy chip w połowie):
 *  - wszystkie chipy mieszczą się → zwróć n (bez „+N");
 *  - inaczej → największe k, dla którego k chipów + odstęp + chip „+N" mieszczą
 *    się w `avail`;
 *  - `avail <= 0` (jsdom / przed pomiarem) → zwróć n, tj. pokaż wszystko, żeby
 *    nie zwinąć fałszywie komórki, której nie udało się zmierzyć.
 */
export const fitChipRow = (
  chipWidths: number[],
  plusWidth: number,
  avail: number,
  gap: number
): number => {
  const n = chipWidths.length;
  if (n === 0) return 0;
  if (avail <= 0) return n;

  const allWidth = chipWidths.reduce((a, b) => a + b, 0) + Math.max(0, n - 1) * gap;
  if (allWidth <= avail) return n;

  let k = 0;
  for (let cand = 1; cand <= n - 1; cand++) {
    const w = chipWidths.slice(0, cand).reduce((a, b) => a + b, 0) + cand * gap + plusWidth;
    if (w <= avail) k = cand;
    else break;
  }
  return k;
};

export interface ChipOverflowRowProps {
  /** Zbudowane chipy, w kolejności wyświetlania. Każdy = pojedynczy element DOM. */
  items: React.ReactNode[];
  /** Pełna lista jako `title` boxa (np. `tags.join(', ')`). */
  title?: string;
  /** Etykieta chipa przepełnienia; domyślnie `+<hidden>`. */
  overflowLabel?: (hidden: number) => string;
  className?: string;
}

/**
 * `<ChipOverflowRow>` — kanoniczny rząd chipów z przepełnieniem „+N".
 * Mierzy naturalne szerokości w ukrytej warstwie, renderuje mieszczące się chipy
 * + „+N". `ResizeObserver` przelicza przy zmianie szerokości kolumny.
 */
export const ChipOverflowRow: React.FC<ChipOverflowRowProps> = ({
  items,
  title,
  overflowLabel,
  className,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const n = items.length;
  const [visibleCount, setVisibleCount] = useState(n);

  const recompute = useCallback(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const avail = box.clientWidth;
    const kids = Array.from(measure.children) as HTMLElement[];
    const plusEl = kids[n];
    const chipWidths = kids.slice(0, n).map((el) => el.offsetWidth);
    const plusWidth = plusEl ? plusEl.offsetWidth : 0;
    setVisibleCount(fitChipRow(chipWidths, plusWidth, avail, CHIP_ROW_GAP_PX));
  }, [n]);

  useLayoutEffect(() => {
    recompute();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(box);
    return () => ro.disconnect();
  }, [recompute, items]);

  const label = overflowLabel ?? ((hidden: number) => `+${hidden}`);
  const shown = items.slice(0, visibleCount);
  const hidden = n - shown.length;

  return (
    <div
      ref={boxRef}
      className={`relative flex min-w-0 flex-nowrap items-center justify-start gap-1 overflow-hidden ${className ?? ''}`}
      title={title}
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 flex flex-nowrap items-center gap-1 overflow-hidden"
      >
        {items}
        <MetaChip label={label(n)} className="shrink-0" />
      </div>
      {shown}
      {hidden > 0 ? <MetaChip label={label(hidden)} className="shrink-0" /> : null}
    </div>
  );
};

export default ChipOverflowRow;
