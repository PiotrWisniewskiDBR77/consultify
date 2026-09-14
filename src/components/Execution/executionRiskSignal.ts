/**
 * executionRiskSignal — model sygnalizacji ryzyka realizacji (B-E0, DEC-487).
 *
 * DLACZEGO TEN PLIK ISTNIEJE
 * `server/src/services/execution/threeAxisReportService.ts` liczy trzy osie
 * ryzyka (T=czas × Z=zadania × W=wartość) od migracji 913 i wystawia je na
 * `GET /api/report-builder/program-3axis/live`. Konsumentów w
 * `src/components/Execution` miał ZERO — klasyczne „zbudowane, niepodłączone".
 * Ten plik jest CZYSTY (zero React, zero fetch), więc reguły przekładu
 * liczba → poziom → słowo dają się zmierzyć testem jednostkowym, a nie
 * „obejrzeniem ekranu".
 *
 * CZTERY POZIOMY Z TRZECH — SKĄD (nie zgadnięte)
 * Serwis oddaje RAG po progach `>=0.95 GREEN, >=0.85 AMBER, reszta RED`
 * (`threeAxisReportService.ts:161`, identyczne z `evmService.indexRag`).
 * DEC-487 wymaga CZTERECH poziomów, więc nie wymyślamy nowych progów tylko
 * DZIELIMY istniejący RED na pół w 0,70:
 *   ratio >= 0.95            → 0  W normie       (serwerowe GREEN)
 *   0.85 <= ratio < 0.95     → 1  Obserwuj       (serwerowe AMBER)
 *   0.70 <= ratio < 0.85     → 2  Działanie      (górna połowa RED)
 *   ratio < 0.70             → 3  Komitet        (dolna połowa RED)
 *   ratio == null / rag NA   → UNKNOWN (brak danych — JAWNY, nie zielony)
 * Granice 0,95 i 0,85 pozostają DOKŁADNIE te same co na serwerze, więc
 * pastylka nigdy nie zaprzeczy raportowi 3 osi wyliczonemu z tych samych liczb.
 *
 * CZERWIEŃ TYLKO NA POZIOMIE 3 (CLAUDE.md pkt 3 + DEC-487). Poziom 2 to
 * bursztyn o mocniejszym tle, nie crimson. Brak danych = neutralny, NIGDY
 * zielony — „nie wiem" nie jest „w normie".
 *
 * ZAWSZE KOLOR + TEKST + IKONA. Ten model podaje `level`, `labelKey` i
 * `iconId` razem; komponent nie ma prawa wyrenderować samej plamy koloru.
 */

export type ExecutionRiskLevel = 0 | 1 | 2 | 3 | 'UNKNOWN';

export type ExecutionRiskAxisId = 'schedule' | 'impact' | 'promise';

export type ExecutionRiskIconId = 'ok' | 'watch' | 'act' | 'escalate' | 'unknown';

export interface ExecutionRiskAxisRatioSource {
  ratio: number | null;
  rag?: 'GREEN' | 'AMBER' | 'RED' | 'NA' | string | null;
}

/** Wiersz raportu 3 osi w kształcie, w jakim oddaje go trasa `/program-3axis/live`. */
export interface ExecutionRiskReportRowSource {
  initiativeId: string;
  scheduleHealth?: ExecutionRiskAxisRatioSource | null;
  impactGap?: ExecutionRiskAxisRatioSource | null;
  deliveryPromise?: ExecutionRiskAxisRatioSource | null;
}

export interface ExecutionRiskAxis {
  id: ExecutionRiskAxisId;
  level: ExecutionRiskLevel;
  iconId: ExecutionRiskIconId;
  /** Surowy wskaźnik (SPI / W-vs-Z / W-vs-T). `null` = nie policzono. */
  ratio: number | null;
}

export interface ExecutionRiskSignal {
  initiativeId: string;
  axes: readonly [ExecutionRiskAxis, ExecutionRiskAxis, ExecutionRiskAxis];
  /** Najgorsza ze zmierzonych osi. `UNKNOWN` dopiero gdy ŻADNA nie ma danych. */
  worst: ExecutionRiskLevel;
  worstIconId: ExecutionRiskIconId;
  /** Ile osi udało się zmierzyć (0..3) — jawność braku danych. */
  measuredAxes: number;
}

export const EXECUTION_RISK_AXIS_ORDER: readonly ExecutionRiskAxisId[] = [
  'schedule',
  'impact',
  'promise',
];

/** Progi 0,95 i 0,85 są kopią serwera; 0,70 dzieli serwerowe RED na 2 i 3. */
export const EXECUTION_RISK_THRESHOLDS = {
  inTolerance: 0.95,
  watch: 0.85,
  act: 0.7,
} as const;

const ICON_BY_LEVEL: Record<string, ExecutionRiskIconId> = {
  '0': 'ok',
  '1': 'watch',
  '2': 'act',
  '3': 'escalate',
  UNKNOWN: 'unknown',
};

export function executionRiskIconId(level: ExecutionRiskLevel): ExecutionRiskIconId {
  return ICON_BY_LEVEL[String(level)] ?? 'unknown';
}

/**
 * Przekład jednego wskaźnika na poziom. `rag: 'NA'` jest traktowane jak brak
 * danych nawet wtedy, gdy z jakiegoś powodu przyszła liczba — serwer ustawia
 * NA wyłącznie wtedy, gdy nie miał z czego liczyć.
 */
export function executionRiskLevelFromRatio(
  source: ExecutionRiskAxisRatioSource | null | undefined
): ExecutionRiskLevel {
  if (!source) return 'UNKNOWN';
  if (typeof source.rag === 'string' && source.rag.toUpperCase() === 'NA') return 'UNKNOWN';
  const ratio = source.ratio;
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return 'UNKNOWN';
  if (ratio >= EXECUTION_RISK_THRESHOLDS.inTolerance) return 0;
  if (ratio >= EXECUTION_RISK_THRESHOLDS.watch) return 1;
  if (ratio >= EXECUTION_RISK_THRESHOLDS.act) return 2;
  return 3;
}

const LEVEL_RANK: Record<string, number> = { '0': 0, '1': 1, '2': 2, '3': 3 };

/**
 * Najgorsza ze ZMIERZONYCH osi. Brak danych NIE podbija ani nie obniża wyniku —
 * jest raportowany osobno przez `measuredAxes`, żeby „2 z 3 osi" było widoczne
 * zamiast udawać pełny pomiar.
 */
export function worstExecutionRiskLevel(
  levels: readonly ExecutionRiskLevel[]
): ExecutionRiskLevel {
  let worst: ExecutionRiskLevel = 'UNKNOWN';
  for (const level of levels) {
    if (level === 'UNKNOWN') continue;
    if (worst === 'UNKNOWN' || LEVEL_RANK[String(level)] > LEVEL_RANK[String(worst)]) {
      worst = level;
    }
  }
  return worst;
}

function axis(id: ExecutionRiskAxisId, source: ExecutionRiskAxisRatioSource | null | undefined) {
  const level = executionRiskLevelFromRatio(source);
  return {
    id,
    level,
    iconId: executionRiskIconId(level),
    ratio: typeof source?.ratio === 'number' && Number.isFinite(source.ratio) ? source.ratio : null,
  } satisfies ExecutionRiskAxis;
}

export function buildExecutionRiskSignal(row: ExecutionRiskReportRowSource): ExecutionRiskSignal {
  const axes = [
    axis('schedule', row.scheduleHealth),
    axis('impact', row.impactGap),
    axis('promise', row.deliveryPromise),
  ] as const;
  const worst = worstExecutionRiskLevel(axes.map((entry) => entry.level));
  return {
    initiativeId: row.initiativeId,
    axes,
    worst,
    worstIconId: executionRiskIconId(worst),
    measuredAxes: axes.filter((entry) => entry.level !== 'UNKNOWN').length,
  };
}

/** Mapa inicjatywa → sygnał. Wiersze bez `initiativeId` są pomijane. */
export function buildExecutionRiskSignalMap(
  rows: readonly ExecutionRiskReportRowSource[] | null | undefined
): Map<string, ExecutionRiskSignal> {
  const map = new Map<string, ExecutionRiskSignal>();
  for (const row of rows ?? []) {
    const id = String(row?.initiativeId ?? '').trim();
    if (!id) continue;
    map.set(id, buildExecutionRiskSignal({ ...row, initiativeId: id }));
  }
  return map;
}
