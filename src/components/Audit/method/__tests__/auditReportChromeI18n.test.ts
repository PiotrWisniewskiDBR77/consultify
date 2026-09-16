/**
 * [F5 2026-09-15] Chrom ekranu raportu audytu (`/audit-programs/reports/:reportId`)
 * mieszał języki: tytuł i przycisk powrotu były zaszyte po polsku
 * (`const isPolish = true`), a komunikat błędu przychodził z angielskiego
 * katalogu `apiErrorFallbacks` („The audit item was not found."). Efekt na
 * żywo: „Nie udało się wczytać raportu" + „The audit item was not found." +
 * „Wróć do listy raportów" na jednym ekranie.
 *
 * Ten test pilnuje, że te trzy napisy idą przez i18n (EN first) i mają
 * komplet tłumaczeń PL — a nie że „gdzieś w pliku jest polski string".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const KLUCZE = ['loadFailed', 'backToList', 'notFound'] as const;
const U30_SECTIONS = [
  'executive_summary',
  'scope',
  'methodology',
  'limitations',
  'overall_conclusion',
  'findings_by_severity',
  'findings_by_area',
  'objective_evidence_references',
  'systemic_conclusions',
  'corrective_action_plan',
  'verification_plan',
  'appendices',
  'traceability_matrix',
] as const;

function slownik(lang: 'en' | 'pl'): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), `public/locales/${lang}/translation.json`), 'utf8');
  return (JSON.parse(raw)?.audit?.report ?? {}) as Record<string, string>;
}

describe('[F5] audit report chrome — i18n (EN first)', () => {
  it('widok woła t() dla trzech napisów chromu zamiast zaszytych literałów', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/Audit/method/AuditReportDocumentView.tsx'),
      'utf8'
    );
    expect(src).toContain("t('audit.report.loadFailed', 'Could not load the report')");
    expect(src).toContain("t('audit.report.backToList', 'Back to reports')");
    expect(src).toContain("t('audit.report.notFound', 'The audit report was not found.')");
    expect(src).not.toContain("'Nie udało się wczytać raportu'");
    expect(src).not.toContain("'Wróć do listy raportów'");
    expect(src).not.toContain("'Raport nie został znaleziony.'");
  });

  it('EN i PL mają komplet kluczy audit.report dla chromu', () => {
    const en = slownik('en');
    const pl = slownik('pl');
    for (const k of KLUCZE) {
      expect(String(en[k] ?? '')).not.toBe('');
      expect(String(pl[k] ?? '')).not.toBe('');
      // PL nie może być kopią EN — to był ósmy kształt fałszywego „gotowe".
      expect(pl[k]).not.toBe(en[k]);
    }
  });

  it('U-30: locale drives chrome and both catalogs cover every audit-report section', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/Audit/method/AuditReportDocumentView.tsx'),
      'utf8'
    );
    expect(src).not.toContain('const isPolish = true');
    expect(src).toContain('translation.resolvedLanguage');
    expect(src).toContain('audit.report.viewer.sections.${id}');

    for (const lang of ['en', 'pl'] as const) {
      const raw = JSON.parse(
        readFileSync(resolve(process.cwd(), `public/locales/${lang}/translation.json`), 'utf8')
      );
      const viewer = raw?.audit?.report?.viewer ?? {};
      for (const key of [
        'audits',
        'reports',
        'actions',
        'approve',
        'publish',
        'downloadDocx',
        'downloadPdf',
        'properties',
        'property',
        'value',
      ]) {
        expect(String(viewer[key] ?? ''), `${lang}:${key}`).not.toBe('');
      }
      for (const section of U30_SECTIONS) {
        expect(String(viewer.sections?.[section] ?? ''), `${lang}:sections.${section}`).not.toBe('');
      }
    }
  });
});
