/**
 * Locale for Report Builder binary exports (D-46).
 *
 * WHY: the PPTX renderers default to Polish when the caller passes no language
 * (`PptxExportService.defaultOptions.language`, `UnifiedJsonTransformer` line
 * `options.language ?? config.language ?? 'pl'`), so an English report of an
 * English-speaking organization got a Polish date on the title slide while the
 * DOCX export of the very same report — which resolves report → section → 'en'
 * — wrote the English one. Two formatters, one of them without a language.
 *
 * This module is the single place that decides the export locale, in the order
 * the DOCX sibling already used, extended with the DEC-510 identity chain:
 *   explicit request → report language → section language → DEC-510 profile → 'en'.
 * The renderers only know Polish and English, so anything else normalizes away.
 */

import { resolveLocale, type LanguageRequestLike } from '../ai/languagePolicy.js';

export type ExportLocale = 'en' | 'pl';

export function normalizeExportLocale(value: unknown): ExportLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('pl')) return 'pl';
  if (normalized.startsWith('en')) return 'en';
  return null;
}

/**
 * Synchronous part of the chain. Returns `null` when no source decided, so the
 * caller can skip the profile lookup (a database round-trip) entirely.
 */
export function pickExportLocale(sources: {
  explicit?: unknown;
  reportLanguage?: unknown;
  sectionLanguages?: readonly unknown[];
}): ExportLocale | null {
  return (
    normalizeExportLocale(sources.explicit) ??
    normalizeExportLocale(sources.reportLanguage) ??
    normalizeExportLocale(
      (sources.sectionLanguages ?? []).find((language) => normalizeExportLocale(language))
    ) ??
    null
  );
}

export async function resolveReportExportLocale(
  req: LanguageRequestLike | null | undefined,
  input: {
    explicit?: unknown;
    report?: { language?: unknown } | null;
    sections?: readonly { language?: unknown }[] | null;
  }
): Promise<ExportLocale> {
  const decided = pickExportLocale({
    explicit: input.explicit,
    reportLanguage: input.report?.language,
    sectionLanguages: (input.sections ?? []).map((section) => section?.language),
  });
  if (decided) return decided;

  return normalizeExportLocale(await resolveLocale(req, undefined)) ?? 'en';
}
