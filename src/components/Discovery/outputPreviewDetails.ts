export type OutputPreviewDetailsLanguage = 'pl' | 'en';

const MAX_WORDS = 140;
const CREDENTIAL_VALUE =
  /\b(?:bearer\s+\S+|eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+|(?:(?:api|private|access|session)[\s_-]*key|auth[\s_-]*header|authentication|authorization|client[\s_-]*secret|password|secret|token|cookie|credential)\s*[:=]\s*\S+)/i;

const normalizeFact = (value: unknown, maxChars = 500): string => {
  if (value == null) return '';
  const source =
    value instanceof Date ? value.toISOString() : typeof value === 'object' ? '' : String(value);
  const trimmed = source.trim();
  if (
    !trimmed ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    /[<>]/.test(trimmed) ||
    CREDENTIAL_VALUE.test(trimmed)
  ) {
    return '';
  }
  const text = trimmed.replace(/\s+/g, ' ');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
};

type Fact = {
  value: string;
  present: (value: string) => string;
  missing: string;
};

const capWords = (text: string): string => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= MAX_WORDS ? text : `${words.slice(0, MAX_WORDS).join(' ')}…`;
};

/** Builds canonical output Details from a strict persisted OutputItem whitelist. */
export const buildOutputPreviewDetails = (
  row: Record<string, unknown> | null | undefined,
  language: OutputPreviewDetailsLanguage
): string => {
  if (!row) return '';
  const isPolish = language === 'pl';
  const facts: Fact[] = isPolish
    ? [
        {
          value: normalizeFact(row.name),
          present: (v) => `Nazwa: ${v}.`,
          missing: 'Nazwa outputu nie została zapisana.',
        },
        {
          value: normalizeFact(row.outputKind),
          present: (v) => `Typ outputu: ${v}.`,
          missing: 'Typ outputu nie został zapisany.',
        },
        {
          value: normalizeFact(row.status),
          present: (v) => `Status: ${v}.`,
          missing: 'Status outputu nie został zapisany.',
        },
        {
          value: normalizeFact(row.createdAt),
          present: (v) => `Utworzono: ${v}.`,
          missing: 'Data utworzenia nie została zapisana.',
        },
        {
          value: normalizeFact(row.updatedAt),
          present: (v) => `Zaktualizowano: ${v}.`,
          missing: 'Data aktualizacji nie została zapisana.',
        },
        {
          value: normalizeFact(row.projectId),
          present: (v) => `Projekt: ${v}.`,
          missing: 'Powiązany projekt nie został zapisany.',
        },
        {
          value: normalizeFact(row.sourceType),
          present: (v) => `Typ źródła: ${v}.`,
          missing: 'Typ źródła nie został zapisany.',
        },
        {
          value: normalizeFact(row.sourceId),
          present: (v) => `Identyfikator źródła: ${v}.`,
          missing: 'Identyfikator źródła nie został zapisany.',
        },
        {
          value: normalizeFact(row.id),
          present: (v) => `Identyfikator outputu: ${v}.`,
          missing: 'Identyfikator outputu nie został zapisany.',
        },
      ]
    : [
        {
          value: normalizeFact(row.name),
          present: (v) => `Name: ${v}.`,
          missing: 'The output name was not persisted.',
        },
        {
          value: normalizeFact(row.outputKind),
          present: (v) => `Output type: ${v}.`,
          missing: 'The output type was not persisted.',
        },
        {
          value: normalizeFact(row.status),
          present: (v) => `Status: ${v}.`,
          missing: 'The output status was not persisted.',
        },
        {
          value: normalizeFact(row.createdAt),
          present: (v) => `Created: ${v}.`,
          missing: 'The creation date was not persisted.',
        },
        {
          value: normalizeFact(row.updatedAt),
          present: (v) => `Updated: ${v}.`,
          missing: 'The update date was not persisted.',
        },
        {
          value: normalizeFact(row.projectId),
          present: (v) => `Project: ${v}.`,
          missing: 'A related project was not persisted.',
        },
        {
          value: normalizeFact(row.sourceType),
          present: (v) => `Source type: ${v}.`,
          missing: 'The source type was not persisted.',
        },
        {
          value: normalizeFact(row.sourceId),
          present: (v) => `Source identifier: ${v}.`,
          missing: 'The source identifier was not persisted.',
        },
        {
          value: normalizeFact(row.id),
          present: (v) => `Output identifier: ${v}.`,
          missing: 'The output identifier was not persisted.',
        },
      ];

  const available = facts.filter((fact) => fact.value);
  if (!available.length) return '';
  const missing = facts.filter((fact) => !fact.value);
  const scope = isPolish
    ? 'Sekcja Szczegóły pokazuje wyłącznie fakty zapisane dla wybranego outputu. Brakujące wartości pozostają niedostępne i nie są uzupełniane z innych rekordów. Zakres tekstu odpowiada zapisanym danym źródłowym. Każde widoczne zdanie odnosi się do pola wybranego wiersza, a komunikaty o braku wskazują luki w tym samym zapisanym rekordzie. Interfejs nie wyprowadza wartości z domyślnych etykiet ani bieżącej daty. Opis nie rozszerza zakresu rekordu.'
    : 'The Details section shows only facts persisted for the selected output. Missing values remain unavailable and are not inferred from other records. The displayed scope matches the source data. Each sentence maps to a field on the selected row, while unavailable labels identify gaps in that same persisted record. The interface derives no value from display defaults or the current time.';
  return capWords(
    [
      ...available.map((fact) => fact.present(fact.value)),
      ...missing.map((fact) => fact.missing),
      scope,
    ].join(' ')
  );
};
