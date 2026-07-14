/**
 * advancedCharts — W7.5: think-cell komplet — marimekko (mekko) + harvey-balls.
 *
 * Pure layout math (testowalna BEZ pptxgenjs). Renderery (PPTX/web) konsumują
 * wyliczone prostokąty/wypełnienia. Dwa wykresy, których brakowało do kompletu
 * think-cell (waterfall/2×2/RAG już są w kodzie):
 *
 *   • MARIMEKKO  — kolumny o ZMIENNEJ szerokości (∝ udział kategorii) ze stosem
 *                  segmentów w pionie (∝ udział pod-wartości). Klasyk „udział rynku
 *                  wg segmentu × gracza".
 *   • HARVEY-BALLS — jakościowa ocena 0..4 (ćwiartki koła) — dojrzałość/spełnienie
 *                  kryterium w macierzach oceny.
 *
 * Wszystkie współrzędne ZNORMALIZOWANE 0..1 (renderer skaluje do swojej kanwy).
 * Deterministyczne, fail-soft (puste/zerowe wejście → pusty layout, nie rzuca).
 */

// ── Marimekko ────────────────────────────────────────────────────────────────

/** Specyfikacja mekko: kolumny (kategorie) × segmenty (serie) z wartościami. */
export interface MarimekkoSpec {
  /** Kategorie = kolumny. Szerokość kolumny ∝ sumie jej segmentów. */
  columns: Array<{
    label: string;
    segments: Array<{ name: string; value: number }>;
  }>;
}

/** Wyliczony prostokąt segmentu (znormalizowany 0..1, origin top-left). */
export interface MarimekkoRect {
  columnLabel: string;
  segmentName: string;
  value: number;
  x: number; // lewa krawędź
  y: number; // górna krawędź
  w: number; // szerokość (∝ udział kolumny)
  h: number; // wysokość (∝ udział segmentu w kolumnie)
  /** Udział segmentu w CAŁOŚCI (do etykiet %). */
  shareOfTotal: number;
}

export interface MarimekkoLayout {
  rects: MarimekkoRect[];
  /** Suma wszystkich wartości (0 gdy puste). */
  total: number;
  /** Granice kolumn na osi X (do etykiet osi). */
  columnBounds: Array<{ label: string; x: number; w: number; total: number }>;
}

/**
 * Wylicza layout marimekko. Szerokość kolumny = udział sumy kolumny w sumie ogólnej;
 * wysokość segmentu = udział wartości segmentu w sumie kolumny. Gutter opcjonalny
 * (ujmowany ze świateł między kolumnami, równomiernie).
 */
export function computeMarimekkoLayout(
  spec: MarimekkoSpec,
  opts?: { columnGutter?: number }
): MarimekkoLayout {
  const empty: MarimekkoLayout = { rects: [], total: 0, columnBounds: [] };
  if (!spec || !Array.isArray(spec.columns) || spec.columns.length === 0) return empty;

  const gutter = Math.max(0, Math.min(opts?.columnGutter ?? 0, 0.05));
  const colTotals = spec.columns.map((c) =>
    (c.segments ?? []).reduce((s, seg) => s + Math.max(0, seg.value || 0), 0)
  );
  const total = colTotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return empty;

  const nCols = spec.columns.length;
  const totalGutter = gutter * Math.max(0, nCols - 1);
  const usableWidth = Math.max(0, 1 - totalGutter);

  const rects: MarimekkoRect[] = [];
  const columnBounds: MarimekkoLayout['columnBounds'] = [];
  let cursorX = 0;

  spec.columns.forEach((col, ci) => {
    const colTotal = colTotals[ci];
    const colW = (colTotal / total) * usableWidth;
    columnBounds.push({ label: col.label, x: cursorX, w: colW, total: colTotal });

    if (colTotal > 0) {
      let cursorY = 0;
      for (const seg of col.segments ?? []) {
        const v = Math.max(0, seg.value || 0);
        if (v <= 0) continue;
        const segH = v / colTotal; // pełna wysokość kolumny = 1
        rects.push({
          columnLabel: col.label,
          segmentName: seg.name,
          value: v,
          x: cursorX,
          y: cursorY,
          w: colW,
          h: segH,
          shareOfTotal: v / total,
        });
        cursorY += segH;
      }
    }
    cursorX += colW + (ci < nCols - 1 ? gutter : 0);
  });

  return { rects, total, columnBounds };
}

// ── Harvey balls ─────────────────────────────────────────────────────────────

/** Poziom wypełnienia harvey-balla: 0 (pusty) .. 4 (pełny). */
export type HarveyLevel = 0 | 1 | 2 | 3 | 4;

export interface HarveyBallSpec {
  /** Wiersze oceny: etykieta + poziom 0..4. */
  rows: Array<{ label: string; level: number; note?: string }>;
}

export interface HarveyBall {
  label: string;
  level: HarveyLevel;
  /** Ułamek wypełnienia 0..1 (level/4) — do renderowania łuku/wycinka. */
  fillFraction: number;
  /** Tekstowy opis poziomu (PL) — fallback dostępnościowy / alt-text. */
  fillLabel: string;
  note?: string;
}

const HARVEY_LABELS_PL: Record<HarveyLevel, string> = {
  0: 'brak',
  1: 'niski',
  2: 'średni',
  3: 'wysoki',
  4: 'pełny',
};

/** Klampuje dowolną liczbę do poziomu 0..4 (round, fail-soft). */
export function toHarveyLevel(value: number): HarveyLevel {
  if (!Number.isFinite(value)) return 0;
  const r = Math.round(value);
  return Math.max(0, Math.min(4, r)) as HarveyLevel;
}

/** Mapuje spec → wyliczone harvey-balls (poziom, ułamek, etykieta dostępności). */
export function computeHarveyBalls(spec: HarveyBallSpec): HarveyBall[] {
  if (!spec || !Array.isArray(spec.rows)) return [];
  return spec.rows.map((row) => {
    const level = toHarveyLevel(row.level);
    return {
      label: row.label,
      level,
      fillFraction: level / 4,
      fillLabel: HARVEY_LABELS_PL[level],
      note: row.note,
    };
  });
}
