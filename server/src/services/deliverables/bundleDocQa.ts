/**
 * bundleDocQa (W1.8a) — komponuje DOJRZAŁY silnik M18 Document Studio QA
 * (`runDocumentQa`, 10-kategorii: brand/language/completeness/sources/methodology/
 * executive/risk/data/format/export) na raporcie wiązki.
 *
 * Most: bundle.doc (content-like z generateDocumentContent) → DocumentSchema
 * (przez contentToDocumentSchema) → runDocumentQa → zwięzłe podsumowanie do
 * bundle.quality. Czyste, in-memory, fail-soft (null gdy doc pusty / błąd).
 *
 * Decyzja W0.1 = KOMPONUJ dojrzałe studia (nie buduj 4. stosu QA).
 */
import logger from '../../utils/Logger.js';
import { runDocumentQa } from '../documentStudio/documentQaService.js';
import type { DocumentQaCategory } from '../documentStudio/documentStudioTypes.js';
import { contentToDocumentSchema } from './bundleExportRuntime.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';

/** Zwięzłe podsumowanie M18 QA dla raportu jakości wiązki. */
export interface BundleDocQaSummary {
  anyBlocking: boolean;
  /** Średnia z ocen kategorii (0..100). */
  overallScore: number;
  /** Kategorie które blokują (score < próg). */
  blockingCategories: DocumentQaCategory[];
  /** Ocena per kategoria (do podglądu w UI). */
  categoryScores: Partial<Record<DocumentQaCategory, number>>;
  /** Łączna liczba findingów high-severity. */
  highFindings: number;
}

interface GenContentLike {
  sections?: Array<{
    heading?: string;
    title?: string;
    blocks: Array<{ blockId?: string; type: string; content: unknown }>;
  }>;
}

/**
 * Uruchom M18 document-QA na raporcie wiązki. Zwraca null gdy doc pusty/niepełny
 * lub gdy konwersja/QA padnie (fail-soft — nigdy nie rzuca).
 */
export function runBundleDocQa(doc: unknown, spine: BusinessPlanSpine): BundleDocQaSummary | null {
  try {
    const content = doc as GenContentLike | null;
    if (!content?.sections?.length) return null;

    const schema = contentToDocumentSchema(content as never, spine);
    const report = runDocumentQa(schema);

    const categoryScores: Partial<Record<DocumentQaCategory, number>> = {};
    const blockingCategories: DocumentQaCategory[] = [];
    let scoreSum = 0;
    let highFindings = 0;
    for (const cat of report.categories) {
      categoryScores[cat.category] = cat.score;
      scoreSum += cat.score;
      if (cat.blocking) blockingCategories.push(cat.category);
      highFindings += cat.findings.filter((f) => f.severity === 'high').length;
    }
    const overallScore = report.categories.length
      ? Math.round(scoreSum / report.categories.length)
      : 0;

    return {
      anyBlocking: report.anyBlocking,
      overallScore,
      blockingCategories,
      categoryScores,
      highFindings,
    };
  } catch (err) {
    logger.warn(
      `[bundleDocQa] M18 QA failed (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
