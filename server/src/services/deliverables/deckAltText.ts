/**
 * deckAltText — W14.1: deterministyczny alt-text dla wizualizacji slajdów (a11y).
 *
 * Każdy element wizualny (wykres bar/RAG/mekko/harvey, obraz) dostaje opisowy
 * tekst alternatywny WYPROWADZONY Z DANYCH — nie generyczne „wykres", lecz
 * „Przychód rośnie z 2,4 do 8,8 mln w 3 lata". Buduje dostępność dla czytników
 * ekranu (PPTX altText / PDF-UA / tagged-PDF) i jest reużywalny przez 3 renderery.
 *
 * Deterministyczny, bez LLM, fail-soft (brak/niepełne dane → krótki opis rodzajowy).
 *
 * SSOT: DELIVERABLES_GENERATORS_SPEC §a11y. Komponuje z chart-specami (W7.5).
 */

// Kształty chart-speców (zbieżne z DeckPlanSlide['chartSpec']).
type BarSeriesSpec = { type: 'bar_series'; labels: string[]; series: Array<{ name: string; values: number[] }> };
type RagSpec = { type: 'rag'; items: Array<{ label: string; status: 'green' | 'amber' | 'red' }> };
type MarimekkoSpec = { type: 'marimekko'; columns: Array<{ label: string; segments: Array<{ name: string; value: number }> }> };
type HarveySpec = { type: 'harvey_balls'; rows: Array<{ label: string; level: number }> };
type AnyChartSpec = BarSeriesSpec | RagSpec | MarimekkoSpec | HarveySpec | null | undefined;

const RAG_PL: Record<string, string> = { green: 'zielony', amber: 'żółty', red: 'czerwony' };
const HARVEY_PL: Record<number, string> = { 0: 'brak', 1: 'niski', 2: 'średni', 3: 'wysoki', 4: 'pełny' };

/** Zwięzłe formatowanie liczby do alt-textu (bez waluty, separatory PL). */
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toLocaleString('pl-PL');
  if (abs >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/** Alt-text dla wykresu słupkowego: zakres trajektorii pierwszej serii + liczba serii. */
function altBarSeries(spec: BarSeriesSpec): string {
  const series = spec.series ?? [];
  if (series.length === 0 || (spec.labels ?? []).length === 0) return 'Wykres słupkowy.';
  const main = series[0];
  const vals = main.values ?? [];
  const first = vals[0];
  const last = vals[vals.length - 1];
  const trend = first != null && last != null
    ? (last > first ? 'rosnący' : last < first ? 'malejący' : 'stabilny')
    : 'mieszany';
  const range = first != null && last != null
    ? ` od ${fmtNum(first)} do ${fmtNum(last)}`
    : '';
  const seriesNote = series.length > 1 ? `, ${series.length} serie` : '';
  return `Wykres słupkowy „${main.name}" — trend ${trend}${range} w ${spec.labels.length} okresach${seriesNote}.`;
}

/** Alt-text dla RAG: rozkład statusów. */
function altRag(spec: RagSpec): string {
  const items = spec.items ?? [];
  if (items.length === 0) return 'Lista statusów RAG.';
  const counts = { green: 0, amber: 0, red: 0 } as Record<string, number>;
  for (const it of items) counts[it.status] = (counts[it.status] ?? 0) + 1;
  const parts = (['red', 'amber', 'green'] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${RAG_PL[s]}`);
  return `Ocena RAG ${items.length} pozycji: ${parts.join(', ')}.`;
}

/** Alt-text dla marimekko: kolumny + dominujący segment. */
function altMarimekko(spec: MarimekkoSpec): string {
  const cols = spec.columns ?? [];
  if (cols.length === 0) return 'Wykres marimekko.';
  const colNames = cols.map((c) => c.label).join(', ');
  // największy segment ogółem
  let top: { name: string; value: number } | null = null;
  for (const c of cols) for (const s of c.segments ?? []) {
    if (!top || s.value > top.value) top = { name: s.name, value: s.value };
  }
  const topNote = top ? ` Największy udział: „${top.name}".` : '';
  return `Wykres marimekko, ${cols.length} kolumny (${colNames}).${topNote}`;
}

/** Alt-text dla harvey-balls: poziomy per wiersz. */
function altHarvey(spec: HarveySpec): string {
  const rows = spec.rows ?? [];
  if (rows.length === 0) return 'Ocena harvey-balls.';
  const parts = rows.slice(0, 6).map((r) => {
    const lvl = Math.max(0, Math.min(4, Math.round(r.level || 0)));
    return `${r.label}: ${HARVEY_PL[lvl]}`;
  });
  return `Ocena dojrzałości (harvey-balls): ${parts.join('; ')}.`;
}

/**
 * Alt-text dla dowolnego chart-spec (fail-soft → '' gdy brak specu).
 * To główne API konsumowane przez renderery przy ustawianiu altText na kształcie.
 */
export function chartAltText(spec: AnyChartSpec): string {
  if (!spec) return '';
  switch (spec.type) {
    case 'bar_series': return altBarSeries(spec);
    case 'rag': return altRag(spec);
    case 'marimekko': return altMarimekko(spec);
    case 'harvey_balls': return altHarvey(spec);
    default: return '';
  }
}

/**
 * Alt-text dla obrazu stockowego na slajdzie — z tytułu/tezy (obraz jest
 * dekoracyjny/ilustracyjny, więc opis kontekstowy zamiast treści pikseli).
 */
export function imageAltText(opts: { title?: string | null; keyMessage?: string | null }): string {
  const t = (opts.title ?? '').trim();
  const k = (opts.keyMessage ?? '').trim();
  if (t && k) return `Ilustracja do „${t}": ${k}`.slice(0, 240);
  if (t) return `Ilustracja do „${t}".`.slice(0, 240);
  if (k) return `Ilustracja: ${k}`.slice(0, 240);
  return 'Ilustracja dekoracyjna.';
}

/**
 * Buduje altText dla całego slajdu (tytuł + ewentualny wykres) — dla tagged-PDF
 * reading-order / altText na grupie. Łączy tytuł z opisem wizualizacji.
 */
export function slideAltText(opts: {
  title?: string | null;
  keyMessage?: string | null;
  chartSpec?: AnyChartSpec;
  hasImage?: boolean;
}): string {
  const parts: string[] = [];
  const t = (opts.title ?? '').trim();
  if (t) parts.push(t);
  const chart = chartAltText(opts.chartSpec);
  if (chart) parts.push(chart);
  else if (opts.hasImage) parts.push(imageAltText(opts));
  else {
    const k = (opts.keyMessage ?? '').trim();
    if (k) parts.push(k);
  }
  return parts.join('. ').slice(0, 500) || 'Slajd prezentacji.';
}
