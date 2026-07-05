/**
 * bundleDeckQa (W1.8b) — komponuje DOJRZAŁY gate strukturalny M19 (`validateReport`,
 * RulesEngine) na decku wiązki. To czysty, in-memory odpowiednik
 * presentationQualityGatesService (który wymaga decka w DB) — działa na
 * UnifiedReportJSON zbudowanym z SPINE, bez persystencji.
 *
 * Most: SPINE → spineToUnifiedReport → validateReport → zwięzłe podsumowanie do
 * bundle.quality. Czyste, deterministyczne, fail-soft (null gdy błąd).
 *
 * Decyzja W0.1 = KOMPONUJ dojrzałe studia.
 */
import logger from '../../utils/Logger.js';
import { validateReport } from '../report/pptx/RulesEngine.js';
import { spineToUnifiedReport } from './spineToUnifiedReport.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';

/** Zwięzłe podsumowanie M19 deck-validation dla raportu jakości wiązki. */
export interface BundleDeckQaSummary {
  /** Czy deck przeszedł twardy gate (brak error-violations). */
  valid: boolean;
  errorCount: number;
  warningCount: number;
  /** Pierwsze kilka komunikatów (do podglądu w UI / logach). */
  topViolations: Array<{ rule: string; severity: 'error' | 'warning'; message: string }>;
}

/**
 * Uruchom M19 strukturalny gate na decku wiązki (z SPINE). Zwraca null gdy
 * konwersja/walidacja padnie (fail-soft — nigdy nie rzuca).
 */
export function runBundleDeckQa(spine: BusinessPlanSpine): BundleDeckQaSummary | null {
  try {
    const report = spineToUnifiedReport(spine);
    if (!report.slides.length) return null;
    const result = validateReport(report);
    const errors = result.violations.filter((v) => v.severity === 'error');
    const warnings = result.violations.filter((v) => v.severity === 'warning');
    return {
      valid: result.valid,
      errorCount: errors.length,
      warningCount: warnings.length,
      topViolations: result.violations
        .slice(0, 5)
        .map((v) => ({ rule: v.rule, severity: v.severity, message: v.message })),
    };
  } catch (err) {
    logger.warn(`[bundleDeckQa] M19 validateReport failed (fail-soft): ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
