/**
 * Scoring engine — wspólne typy dla M18/M19/M20.
 *
 * Każdy scoring zwraca ScoreReport z listą failures (criterion, expected, got)
 * + selfHealHints jakie zmiany w kodzie/prompcie mogą naprawić.
 */

export type Tier = 'Sml' | 'Med' | 'Lrg' | 'Xtr';

export interface ScenarioMeta {
  id: string;
  tier: Tier;
  title: string;
  intent: string;
  context: Record<string, unknown>;
}

export interface Failure {
  criterion: string;
  expected: string;
  got: string;
  category: 'substantive' | 'graphic';
}

export interface ScoreReport {
  scenarioId: string;
  passed: boolean;
  substantivePassed: boolean;
  graphicPassed: boolean;
  failures: Failure[];
  selfHealHints: string[];
  /** Quick numeric score 0-100 (% kryteriów ✓ — informacyjny). */
  scorePct: number;
}

export function emptyReport(scenarioId: string): ScoreReport {
  return {
    scenarioId,
    passed: false,
    substantivePassed: false,
    graphicPassed: false,
    failures: [],
    selfHealHints: [],
    scorePct: 0,
  };
}

export function finalize(report: ScoreReport, totalCriteria: number): ScoreReport {
  const failed = report.failures.length;
  const passed = totalCriteria - failed;
  report.scorePct = totalCriteria > 0 ? Math.round((passed / totalCriteria) * 100) : 0;
  const substantiveFails = report.failures.filter((f) => f.category === 'substantive').length;
  const graphicFails = report.failures.filter((f) => f.category === 'graphic').length;
  report.substantivePassed = substantiveFails === 0;
  report.graphicPassed = graphicFails === 0;
  report.passed = report.substantivePassed && report.graphicPassed;
  return report;
}

// ──────────────────────────────────────────────────────────────
// Mini-DSL: assertion helpers — wrappery wokół `if not X push failure`
// ──────────────────────────────────────────────────────────────

export class ReportBuilder {
  constructor(public readonly report: ScoreReport) {}

  expect(
    pass: boolean,
    criterion: string,
    expected: string,
    got: string,
    category: 'substantive' | 'graphic',
    healHint?: string
  ): this {
    if (!pass) {
      this.report.failures.push({ criterion, expected, got, category });
      if (healHint) this.report.selfHealHints.push(`[${criterion}] ${healHint}`);
    }
    return this;
  }

  /** Zlicz, czy element istnieje w tablicy. */
  expectCount(
    arr: unknown[] | undefined,
    min: number,
    max: number,
    criterion: string,
    category: 'substantive' | 'graphic',
    healHint?: string
  ): this {
    const len = Array.isArray(arr) ? arr.length : 0;
    return this.expect(
      len >= min && len <= max,
      criterion,
      `count in [${min}, ${max}]`,
      String(len),
      category,
      healHint
    );
  }

  /** Sprawdza czy ≥N elementów tablicy spełnia predykat. */
  expectAtLeast<T>(
    arr: T[] | undefined,
    predicate: (item: T) => boolean,
    min: number,
    criterion: string,
    category: 'substantive' | 'graphic',
    healHint?: string
  ): this {
    const matched = Array.isArray(arr) ? arr.filter(predicate).length : 0;
    return this.expect(
      matched >= min,
      criterion,
      `≥${min} matching`,
      String(matched),
      category,
      healHint
    );
  }

  expectContainsCi(
    haystack: string | undefined,
    needles: string[],
    mode: 'any' | 'all',
    criterion: string,
    category: 'substantive' | 'graphic',
    healHint?: string
  ): this {
    const h = String(haystack ?? '').toLowerCase();
    const matchedCount = needles.filter((n) => h.includes(n.toLowerCase())).length;
    const pass = mode === 'any' ? matchedCount >= 1 : matchedCount === needles.length;
    return this.expect(
      pass,
      criterion,
      `contains ${mode} of [${needles.join(', ')}]`,
      `matched ${matchedCount}/${needles.length} in "${(haystack ?? '').slice(0, 80)}"`,
      category,
      healHint
    );
  }
}
