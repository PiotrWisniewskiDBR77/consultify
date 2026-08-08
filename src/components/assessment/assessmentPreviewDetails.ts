export type AssessmentPreviewDetailsLanguage = 'pl' | 'en';

const MAX_WORDS = 140;
const CREDENTIAL_VALUE =
  /\b(?:bearer\s+\S+|eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+|(?:(?:api|private|access|session)[\s_-]*key|auth[\s_-]*header|authentication|authorization|client[\s_-]*secret|password|secret|token|cookie|credential)\s*[:=]\s*\S+)/i;

const normalizeFact = (value: unknown, maxChars = 500): string => {
  if (value == null) return '';
  const source = value instanceof Date ? value.toISOString() : String(value);
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return '';
  const text = trimmed
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || CREDENTIAL_VALUE.test(text)) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
};

type PersistedFact = {
  value: string;
  present: (value: string) => string;
  missing: string;
};

const capWords = (text: string): string => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= MAX_WORDS ? text : `${words.slice(0, MAX_WORDS).join(' ')}…`;
};

/** Builds factual list-preview prose from a strict persisted-field whitelist. */
export const buildAssessmentPreviewDetails = (
  selectedRow: Record<string, unknown> | null | undefined,
  language: AssessmentPreviewDetailsLanguage
): string => {
  if (!selectedRow) return '';
  const isPolish = language === 'pl';
  const framework = normalizeFact(selectedRow.framework ?? selectedRow.type, 160);
  const facts: PersistedFact[] = isPolish
    ? [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Ocena: ${value}.`,
          missing: 'Nazwa oceny nie została zapisana w wybranym rekordzie.',
        },
        {
          value: framework,
          present: (value) => `Metodyka: ${value}.`,
          missing: 'Metodyka oceny nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'Status oceny nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.progress, 80),
          present: (value) => `Postęp: ${value}%.`,
          missing: 'Postęp oceny nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.overallScore, 80),
          present: (value) => `Wynik ogólny: ${value}.`,
          missing: 'Wynik ogólny nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.description, 700),
          present: (value) => `Opis: ${value}.`,
          missing: 'Opis oceny nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.createdAt, 160),
          present: (value) => `Utworzono: ${value}.`,
          missing: 'Data utworzenia nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Zaktualizowano: ${value}.`,
          missing: 'Data aktualizacji nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Autor: ${value}.`,
          missing: 'Autor oceny nie został zapisany w wybranym rekordzie.',
        },
      ]
    : [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Assessment: ${value}.`,
          missing: 'The assessment name was not persisted in the selected record.',
        },
        {
          value: framework,
          present: (value) => `Framework: ${value}.`,
          missing: 'The assessment framework was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'The assessment status was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.progress, 80),
          present: (value) => `Progress: ${value}%.`,
          missing: 'Assessment progress was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.overallScore, 80),
          present: (value) => `Overall score: ${value}.`,
          missing: 'The overall score was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.description, 700),
          present: (value) => `Description: ${value}.`,
          missing: 'An assessment description was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.createdAt, 160),
          present: (value) => `Created: ${value}.`,
          missing: 'The creation date was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Updated: ${value}.`,
          missing: 'The update date was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Author: ${value}.`,
          missing: 'The assessment author was not persisted in the selected record.',
        },
      ];

  if (!facts.some((fact) => fact.value)) return '';
  const fieldSentences = facts.map((fact) =>
    fact.value ? fact.present(fact.value) : fact.missing
  );
  const scopeNote = isPolish
    ? 'Ta sekcja Szczegóły zawiera wyłącznie fakty zapisane dla wybranej oceny. Pola bez zapisanych wartości pozostają jawnie niedostępne w interfejsie i nie są uzupełniane na podstawie innych rekordów. Zakres tekstu odpowiada dostępnemu rekordowi.'
    : 'This Details section contains only facts persisted for the selected assessment. Fields without stored values remain explicitly unavailable in the interface and are not inferred from other records. The displayed scope therefore matches the available source row.';
  return capWords([...fieldSentences, scopeNote].join(' '));
};

/**
 * T23-PREVIEW-P25: Builds factual Reports-preview prose from a strict
 * persisted-field whitelist, mirroring `buildAssessmentPreviewDetails`.
 * `progress` is intentionally excluded — for report rows it is a UI-side
 * proxy derived from `status` (see AssessmentHub's `reports` data mapping),
 * not a persisted field, so listing it here as a "fact" would fabricate one.
 */
export const buildAssessmentReportPreviewDetails = (
  selectedRow: Record<string, unknown> | null | undefined,
  language: AssessmentPreviewDetailsLanguage
): string => {
  if (!selectedRow) return '';
  const isPolish = language === 'pl';
  const facts: PersistedFact[] = isPolish
    ? [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Raport: ${value}.`,
          missing: 'Nazwa raportu nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.framework, 160),
          present: (value) => `Metodyka: ${value}.`,
          missing: 'Metodyka raportu nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'Status raportu nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.assessmentName, 160),
          present: (value) => `Ocena źródłowa: ${value}.`,
          missing: 'Raport nie ma zapisanej oceny źródłowej w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Zaktualizowano: ${value}.`,
          missing: 'Data aktualizacji nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Autor: ${value}.`,
          missing: 'Autor raportu nie został zapisany w wybranym rekordzie.',
        },
      ]
    : [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Report: ${value}.`,
          missing: 'The report name was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.framework, 160),
          present: (value) => `Framework: ${value}.`,
          missing: 'The report framework was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'The report status was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.assessmentName, 160),
          present: (value) => `Source assessment: ${value}.`,
          missing: 'No source assessment was persisted for the selected record.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Updated: ${value}.`,
          missing: 'The update date was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Author: ${value}.`,
          missing: 'The report author was not persisted in the selected record.',
        },
      ];

  if (!facts.some((fact) => fact.value)) return '';
  const fieldSentences = facts.map((fact) =>
    fact.value ? fact.present(fact.value) : fact.missing
  );
  const scopeNote = isPolish
    ? 'Ta sekcja Szczegóły zawiera wyłącznie fakty zapisane dla wybranego raportu. Pola bez zapisanych wartości pozostają jawnie niedostępne w interfejsie i nie są uzupełniane na podstawie innych rekordów. Zakres tekstu odpowiada dostępnemu rekordowi.'
    : 'This Details section contains only facts persisted for the selected report. Fields without stored values remain explicitly unavailable in the interface and are not inferred from other records. The displayed scope therefore matches the available source row.';
  return capWords([...fieldSentences, scopeNote].join(' '));
};

/**
 * T24-PREVIEW-P25: Builds factual Initiatives-preview prose from a strict
 * persisted-field whitelist, mirroring `buildAssessmentReportPreviewDetails`.
 * `progress` is intentionally excluded — for initiative rows it is a fixed
 * `100` constant (see AssessmentHub's `initiatives` data mapping), not a
 * persisted field, so listing it here as a "fact" would fabricate one.
 * `priority`/`impact` are included: AssessmentHub's mapping already resolves
 * them to a persisted value or an explicit `'medium'` default before this
 * function ever sees the row, so by the time they arrive here they are
 * ordinary strings, not something this function invents.
 */
export const buildAssessmentInitiativePreviewDetails = (
  selectedRow: Record<string, unknown> | null | undefined,
  language: AssessmentPreviewDetailsLanguage
): string => {
  if (!selectedRow) return '';
  const isPolish = language === 'pl';
  const facts: PersistedFact[] = isPolish
    ? [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Inicjatywa: ${value}.`,
          missing: 'Nazwa inicjatywy nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.framework, 160),
          present: (value) => `Metodyka: ${value}.`,
          missing: 'Metodyka inicjatywy nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'Status inicjatywy nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.priority, 80),
          present: (value) => `Priorytet: ${value}.`,
          missing: 'Priorytet nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.impact, 80),
          present: (value) => `Wpływ: ${value}.`,
          missing: 'Wpływ nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.sourceReport, 160),
          present: (value) => `Raport źródłowy: ${value}.`,
          missing: 'Inicjatywa nie ma zapisanego raportu źródłowego w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Zaktualizowano: ${value}.`,
          missing: 'Data aktualizacji nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Autor: ${value}.`,
          missing: 'Autor inicjatywy nie został zapisany w wybranym rekordzie.',
        },
      ]
    : [
        {
          value: normalizeFact(selectedRow.name, 160),
          present: (value) => `Initiative: ${value}.`,
          missing: 'The initiative name was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.framework, 160),
          present: (value) => `Framework: ${value}.`,
          missing: 'The initiative framework was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.status, 160),
          present: (value) => `Status: ${value}.`,
          missing: 'The initiative status was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.priority, 80),
          present: (value) => `Priority: ${value}.`,
          missing: 'Priority was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.impact, 80),
          present: (value) => `Impact: ${value}.`,
          missing: 'Impact was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.sourceReport, 160),
          present: (value) => `Source report: ${value}.`,
          missing: 'No source report was persisted for the selected record.',
        },
        {
          value: normalizeFact(selectedRow.updatedAt, 160),
          present: (value) => `Updated: ${value}.`,
          missing: 'The update date was not persisted in the selected record.',
        },
        {
          value: normalizeFact(selectedRow.createdBy, 160),
          present: (value) => `Author: ${value}.`,
          missing: 'The initiative author was not persisted in the selected record.',
        },
      ];

  if (!facts.some((fact) => fact.value)) return '';
  const fieldSentences = facts.map((fact) =>
    fact.value ? fact.present(fact.value) : fact.missing
  );
  const scopeNote = isPolish
    ? 'Ta sekcja Szczegóły zawiera wyłącznie fakty zapisane dla wybranej inicjatywy. Pola bez zapisanych wartości pozostają jawnie niedostępne w interfejsie i nie są uzupełniane na podstawie innych rekordów. Zakres tekstu odpowiada dostępnemu rekordowi.'
    : 'This Details section contains only facts persisted for the selected initiative. Fields without stored values remain explicitly unavailable in the interface and are not inferred from other records. The displayed scope therefore matches the available source row.';
  return capWords([...fieldSentences, scopeNote].join(' '));
};
