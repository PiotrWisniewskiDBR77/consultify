import type { PortfolioInitiative } from '../../types';

export type InitiativePreviewDetailsLanguage = 'pl' | 'en';

const MAX_WORDS = 140;
const CREDENTIAL_VALUE =
  /\b(?:bearer\s+\S+|eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+|(?:(?:api|private|access|session)[\s_-]*key|auth[\s_-]*header|authentication|authorization|client[\s_-]*secret|password|secret|token|cookie|credential)\s*[:=]\s*\S+)/i;

const normalizeStringFact = (value: unknown, maxChars = 500): string => {
  if (value == null || typeof value === 'object') return '';
  const trimmed = String(value).trim();
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

const ownerName = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const owner = value as { firstName?: unknown; lastName?: unknown };
  return [normalizeStringFact(owner.firstName, 80), normalizeStringFact(owner.lastName, 80)]
    .filter(Boolean)
    .join(' ');
};

const dependencyNames = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeStringFact(item, 100))
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
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

/** Builds table-preview Details from a strict PortfolioInitiative field whitelist. */
export const buildInitiativePreviewDetails = (
  row: Partial<PortfolioInitiative> | Record<string, unknown> | null | undefined,
  language: InitiativePreviewDetailsLanguage
): string => {
  if (!row) return '';
  const source = row as Record<string, unknown>;
  const isPolish = language === 'pl';
  const name = normalizeStringFact(source.name) || normalizeStringFact(source.title);
  const summary = normalizeStringFact(source.summary, 600);
  const description = normalizeStringFact(source.description, 700);
  const dependencies = dependencyNames(source.dependencies);
  const businessOwner = ownerName(source.ownerBusiness);
  const executionOwner = ownerName(source.ownerExecution);
  const facts: Fact[] = isPolish
    ? [
        {
          value: name,
          present: (v) => `Inicjatywa: ${v}.`,
          missing: 'Nazwa inicjatywy nie została zapisana.',
        },
        {
          value: summary,
          present: (v) => `Podsumowanie: ${v}.`,
          missing: 'Podsumowanie inicjatywy nie zostało zapisane.',
        },
        {
          value: description,
          present: (v) => `Opis: ${v}.`,
          missing: 'Opis inicjatywy nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.axis),
          present: (v) => `Oś: ${v}.`,
          missing: 'Oś inicjatywy nie została zapisana.',
        },
        {
          value: normalizeStringFact(source.status),
          present: (v) => `Status: ${v}.`,
          missing: 'Status inicjatywy nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.priority),
          present: (v) => `Priorytet: ${v}.`,
          missing: 'Priorytet inicjatywy nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.progress),
          present: (v) => `Postęp: ${v}%.`,
          missing: 'Postęp inicjatywy nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.plannedStartDate),
          present: (v) => `Planowany start: ${v}.`,
          missing: 'Planowana data startu nie została zapisana.',
        },
        {
          value: normalizeStringFact(source.plannedEndDate),
          present: (v) => `Planowany koniec: ${v}.`,
          missing: 'Planowana data końca nie została zapisana.',
        },
        {
          value: businessOwner,
          present: (v) => `Właściciel biznesowy: ${v}.`,
          missing: 'Właściciel biznesowy nie został zapisany.',
        },
        {
          value: executionOwner,
          present: (v) => `Właściciel wykonawczy: ${v}.`,
          missing: 'Właściciel wykonawczy nie został zapisany.',
        },
        {
          value: dependencies,
          present: (v) => `Zależności: ${v}.`,
          missing: 'Zależności inicjatywy nie zostały zapisane.',
        },
        {
          value: normalizeStringFact(source.budget),
          present: (v) => `Budżet: ${v}.`,
          missing: 'Budżet inicjatywy nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.expectedRoi),
          present: (v) => `Oczekiwany ROI: ${v}.`,
          missing: 'Oczekiwany ROI nie został zapisany.',
        },
        {
          value: normalizeStringFact(source.createdAt),
          present: (v) => `Utworzono: ${v}.`,
          missing: 'Data utworzenia nie została zapisana.',
        },
        {
          value: normalizeStringFact(source.updatedAt),
          present: (v) => `Zaktualizowano: ${v}.`,
          missing: 'Data aktualizacji nie została zapisana.',
        },
      ]
    : [
        {
          value: name,
          present: (v) => `Initiative: ${v}.`,
          missing: 'The initiative name was not persisted.',
        },
        {
          value: summary,
          present: (v) => `Summary: ${v}.`,
          missing: 'The initiative summary was not persisted.',
        },
        {
          value: description,
          present: (v) => `Description: ${v}.`,
          missing: 'The initiative description was not persisted.',
        },
        {
          value: normalizeStringFact(source.axis),
          present: (v) => `Axis: ${v}.`,
          missing: 'The initiative axis was not persisted.',
        },
        {
          value: normalizeStringFact(source.status),
          present: (v) => `Status: ${v}.`,
          missing: 'The initiative status was not persisted.',
        },
        {
          value: normalizeStringFact(source.priority),
          present: (v) => `Priority: ${v}.`,
          missing: 'The initiative priority was not persisted.',
        },
        {
          value: normalizeStringFact(source.progress),
          present: (v) => `Progress: ${v}%.`,
          missing: 'Initiative progress was not persisted.',
        },
        {
          value: normalizeStringFact(source.plannedStartDate),
          present: (v) => `Planned start: ${v}.`,
          missing: 'The planned start date was not persisted.',
        },
        {
          value: normalizeStringFact(source.plannedEndDate),
          present: (v) => `Planned end: ${v}.`,
          missing: 'The planned end date was not persisted.',
        },
        {
          value: businessOwner,
          present: (v) => `Business owner: ${v}.`,
          missing: 'The business owner was not persisted.',
        },
        {
          value: executionOwner,
          present: (v) => `Execution owner: ${v}.`,
          missing: 'The execution owner was not persisted.',
        },
        {
          value: dependencies,
          present: (v) => `Dependencies: ${v}.`,
          missing: 'Initiative dependencies were not persisted.',
        },
        {
          value: normalizeStringFact(source.budget),
          present: (v) => `Budget: ${v}.`,
          missing: 'The initiative budget was not persisted.',
        },
        {
          value: normalizeStringFact(source.expectedRoi),
          present: (v) => `Expected ROI: ${v}.`,
          missing: 'Expected ROI was not persisted.',
        },
        {
          value: normalizeStringFact(source.createdAt),
          present: (v) => `Created: ${v}.`,
          missing: 'The creation date was not persisted.',
        },
        {
          value: normalizeStringFact(source.updatedAt),
          present: (v) => `Updated: ${v}.`,
          missing: 'The update date was not persisted.',
        },
      ];

  const available = facts.filter((fact) => fact.value);
  if (!available.length) return '';
  const missing = facts.filter((fact) => !fact.value);
  const scope = isPolish
    ? 'Szczegóły pokazują wyłącznie fakty zapisane dla wybranej inicjatywy. Brakujące wartości pozostają niedostępne i nie są uzupełniane na podstawie innych rekordów.'
    : 'Details show only facts persisted for the selected initiative. Missing values remain unavailable and are not inferred from other records.';
  return capWords(
    [
      ...available.map((fact) => fact.present(fact.value)),
      ...missing.map((fact) => fact.missing),
      scope,
    ].join(' ')
  );
};
