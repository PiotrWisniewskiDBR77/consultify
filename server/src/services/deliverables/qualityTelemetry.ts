/**
 * qualityTelemetry — W10.2: agregacja scorecardów (W10.1) na poziomie organizacji.
 *
 * Pojedynczy `bundle.quality.scorecard` mówi „czy TEN materiał jest dobry". Ta
 * warstwa zwija WIELE materiałów w obraz jakości organizacji w czasie: średni wynik,
 * rozkład ocen A-F, % przechodzących, najczęstsze problemy (do priorytetyzacji
 * napraw systemowych) oraz trend (ostatnie vs wcześniejsze).
 *
 * Czysta, testowalna BEZ DB (endpoint karmi ją wierszami). Deterministyczna, fail-soft.
 *
 * SSOT: M17 plan W10 (telemetria jakości + first-run seeding).
 */

import type { QualityGrade, QualityScorecard } from './bundleQualityScorecard.js';

// ── Wejście: minimalny rekord materiału (z DB lub testu) ─────────────────────
export interface TelemetryRecord {
  /** Scorecard materiału (lub null gdy brak). */
  scorecard: Pick<QualityScorecard, 'overall' | 'grade' | 'capped' | 'topIssues'> | null;
  /** Znacznik czasu utworzenia (ISO lub epoch ms) — do trendu. */
  createdAt: string | number;
}

export interface QualityTelemetry {
  /** Liczba materiałów z dostępnym scorecardem. */
  count: number;
  /** Średni wynik 0-100 (0 gdy brak danych). */
  averageScore: number;
  /** Mediana wyniku. */
  medianScore: number;
  /** Rozkład ocen A-F (liczności). */
  gradeDistribution: Record<QualityGrade, number>;
  /** Udział materiałów z capem (krytyczna wada) 0..1. */
  cappedRate: number;
  /** % „dobrych" (ocena A/B) 0..1. */
  goodRate: number;
  /** Najczęstsze top-issues (problem → liczność), zejście malejące, max 10. */
  topRecurringIssues: Array<{ issue: string; count: number }>;
  /** Trend: średnia ostatniej połowy − średnia wcześniejszej (dodatni = poprawa). */
  trendDelta: number;
}

const EMPTY_GRADES: Record<QualityGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };

function toMs(t: string | number): number {
  if (typeof t === 'number') return t;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/** Normalizuje issue do klucza grupującego (ucina liczby/szczegóły → wzorzec). */
function issueKey(issue: string): string {
  // grupuj po kodzie AP-xx / DR-xx / prefiksie do dwukropka, inaczej całość skrócona
  const code = issue.match(/\b(AP-\d{2}|DR-\d{2}|M19)\b/);
  if (code) return code[1];
  const colon = issue.indexOf(':');
  if (colon > 0 && colon < 40) return issue.slice(0, colon).trim();
  return issue.slice(0, 48).trim();
}

/**
 * Agreguje rekordy telemetryczne w obraz jakości organizacji.
 * Materiały bez scorecardu są pomijane (nie liczone). Trend liczony chronologicznie.
 */
export function aggregateQualityTelemetry(records: TelemetryRecord[]): QualityTelemetry {
  const empty: QualityTelemetry = {
    count: 0, averageScore: 0, medianScore: 0,
    gradeDistribution: { ...EMPTY_GRADES }, cappedRate: 0, goodRate: 0,
    topRecurringIssues: [], trendDelta: 0,
  };
  if (!Array.isArray(records) || records.length === 0) return empty;

  const withScore = records.filter((r) => r.scorecard != null);
  if (withScore.length === 0) return empty;

  const grades: Record<QualityGrade, number> = { ...EMPTY_GRADES };
  const scores: number[] = [];
  let cappedCount = 0;
  const issueCounts = new Map<string, { issue: string; count: number }>();

  for (const r of withScore) {
    const sc = r.scorecard!;
    scores.push(sc.overall);
    if (sc.grade in grades) grades[sc.grade]++;
    if (sc.capped) cappedCount++;
    for (const issue of sc.topIssues ?? []) {
      const key = issueKey(issue);
      const existing = issueCounts.get(key);
      if (existing) existing.count++;
      else issueCounts.set(key, { issue: key, count: 1 });
    }
  }

  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const goodCount = grades.A + grades.B;

  // trend: posortuj chronologicznie, porównaj średnią drugiej połowy z pierwszą
  const chrono = [...withScore].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  const half = Math.floor(chrono.length / 2);
  let trendDelta = 0;
  if (chrono.length >= 2 && half > 0) {
    const older = chrono.slice(0, half).map((r) => r.scorecard!.overall);
    const recent = chrono.slice(half).map((r) => r.scorecard!.overall);
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    trendDelta = Math.round(avgRecent - avgOlder);
  }

  const topRecurringIssues = [...issueCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    count: withScore.length,
    averageScore,
    medianScore: median(scores),
    gradeDistribution: grades,
    cappedRate: Math.round((cappedCount / withScore.length) * 100) / 100,
    goodRate: Math.round((goodCount / withScore.length) * 100) / 100,
    topRecurringIssues,
    trendDelta,
  };
}

/**
 * Buduje rekordy telemetryczne z surowych wierszy DB (`quality_json` + `created_at`).
 * Fail-soft per wiersz (zły JSON → scorecard null).
 */
export function recordsFromRows(
  rows: Array<{ quality_json?: unknown; created_at?: string | number }>,
): TelemetryRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const sc = (r.quality_json as { scorecard?: QualityScorecard } | null)?.scorecard ?? null;
    return {
      scorecard: sc
        ? { overall: sc.overall, grade: sc.grade, capped: sc.capped, topIssues: sc.topIssues ?? [] }
        : null,
      createdAt: r.created_at ?? 0,
    };
  });
}
