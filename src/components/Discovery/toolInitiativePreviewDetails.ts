/**
 * T19 — canonical preview Details for `activeTab === 'initiatives'`.
 *
 * The row passed here is `init` inside `DiscoveryToolsHub.tsx`'s
 * `renderPreview` — either the live `selectedInitiative` (typed
 * `FullInitiativeData` in that file) or `item._fullData`, both shaped like
 * `FullInitiativeData`: `{ id, name, title?, description?, summary?, status,
 * priority?, axis?, ownerBusiness?, ownerExecution?, plannedStartDate?,
 * plannedEndDate?, sourceType?, sourceId?, ... }`.
 *
 * SCOPE DECISION: the whitelist below is short, structured METADATA (owner,
 * dates, axis, priority, source) — deliberately NOT `summary`/`description`.
 * Those two free-text fields are what `InitiativePreviewV3Body` (a frozen,
 * shared component used by three hubs — Discovery, InitiativesHub, Portfolio
 * Analysis) already renders as its own built-in Details block. This packet
 * cannot touch that file, so duplicating its exact prose would either (a)
 * show the same sentence twice, or (b) require feeding it a substitute
 * `summary`, which would silently change what its own Copy / Copy as
 * Markdown / Copy for Slack actions produce — a handler-behavior change this
 * packet is explicitly forbidden from making. Surfacing a DIFFERENT set of
 * persisted facts (ownership, timeline, source lineage) instead of the prose
 * blurb keeps this block additive and unambiguous rather than a rival copy of
 * existing text.
 */

export type ToolInitiativePreviewDetailsLanguage = 'pl' | 'en';

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

/**
 * Composes an owner's display name from ONLY its two known string subfields —
 * never stringifies the owner object wholesale. The composed string still
 * passes through `normalizeFact` afterward (defense in depth: a poisoned
 * `firstName`/`lastName` gets the same JSON/HTML/credential screening as any
 * other fact).
 */
const composeOwnerName = (owner: unknown): string => {
  if (!owner || typeof owner !== 'object') return '';
  const record = owner as Record<string, unknown>;
  const first = typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const last = typeof record.lastName === 'string' ? record.lastName.trim() : '';
  return [first, last].filter(Boolean).join(' ');
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

/** Builds canonical Initiative Details from a strict persisted metadata whitelist. */
export const buildToolInitiativePreviewDetails = (
  row: Record<string, unknown> | null | undefined,
  language: ToolInitiativePreviewDetailsLanguage
): string => {
  if (!row) return '';
  const isPolish = language === 'pl';
  const name = normalizeFact(row.name) || normalizeFact(row.title);
  const ownerBusinessName = composeOwnerName(row.ownerBusiness);
  const ownerExecutionName = composeOwnerName(row.ownerExecution);

  const facts: Fact[] = isPolish
    ? [
        {
          value: name,
          present: (v) => `Nazwa inicjatywy: ${v}.`,
          missing: 'Nazwa inicjatywy nie została zapisana.',
        },
        {
          value: normalizeFact(row.status),
          present: (v) => `Status: ${v}.`,
          missing: 'Status inicjatywy nie został zapisany.',
        },
        {
          value: normalizeFact(row.priority),
          present: (v) => `Priorytet: ${v}.`,
          missing: 'Priorytet nie został zapisany.',
        },
        {
          value: normalizeFact(row.axis),
          present: (v) => `Oś: ${v}.`,
          missing: 'Oś inicjatywy nie została zapisana.',
        },
        {
          value: normalizeFact(ownerBusinessName),
          present: (v) => `Właściciel biznesowy: ${v}.`,
          missing: 'Właściciel biznesowy nie został zapisany.',
        },
        {
          value: normalizeFact(ownerExecutionName),
          present: (v) => `Właściciel realizacji: ${v}.`,
          missing: 'Właściciel realizacji nie został zapisany.',
        },
        {
          value: normalizeFact(row.plannedStartDate),
          present: (v) => `Planowany start: ${v}.`,
          missing: 'Planowana data startu nie została zapisana.',
        },
        {
          value: normalizeFact(row.plannedEndDate),
          present: (v) => `Planowane zakończenie: ${v}.`,
          missing: 'Planowana data zakończenia nie została zapisana.',
        },
        {
          value: normalizeFact(row.sourceType),
          present: (v) => `Typ źródła: ${v}.`,
          missing: 'Typ źródła inicjatywy nie został zapisany.',
        },
        {
          value: normalizeFact(row.sourceId),
          present: (v) => `Identyfikator źródła: ${v}.`,
          missing: 'Identyfikator źródła nie został zapisany.',
        },
      ]
    : [
        {
          value: name,
          present: (v) => `Initiative name: ${v}.`,
          missing: 'The initiative name was not persisted.',
        },
        {
          value: normalizeFact(row.status),
          present: (v) => `Status: ${v}.`,
          missing: 'The initiative status was not persisted.',
        },
        {
          value: normalizeFact(row.priority),
          present: (v) => `Priority: ${v}.`,
          missing: 'The priority was not persisted.',
        },
        {
          value: normalizeFact(row.axis),
          present: (v) => `Axis: ${v}.`,
          missing: 'The initiative axis was not persisted.',
        },
        {
          value: normalizeFact(ownerBusinessName),
          present: (v) => `Business owner: ${v}.`,
          missing: 'The business owner was not persisted.',
        },
        {
          value: normalizeFact(ownerExecutionName),
          present: (v) => `Execution owner: ${v}.`,
          missing: 'The execution owner was not persisted.',
        },
        {
          value: normalizeFact(row.plannedStartDate),
          present: (v) => `Planned start: ${v}.`,
          missing: 'The planned start date was not persisted.',
        },
        {
          value: normalizeFact(row.plannedEndDate),
          present: (v) => `Planned end: ${v}.`,
          missing: 'The planned end date was not persisted.',
        },
        {
          value: normalizeFact(row.sourceType),
          present: (v) => `Source type: ${v}.`,
          missing: 'The initiative source type was not persisted.',
        },
        {
          value: normalizeFact(row.sourceId),
          present: (v) => `Source identifier: ${v}.`,
          missing: 'The initiative source identifier was not persisted.',
        },
      ];

  const available = facts.filter((fact) => fact.value);
  if (!available.length) return '';
  const missing = facts.filter((fact) => !fact.value);
  const scope = isPolish
    ? 'Sekcja Szczegóły pokazuje wyłącznie fakty zapisane dla wybranej inicjatywy. Brakujące wartości pozostają niedostępne i nie są uzupełniane z innych rekordów. Zakres tekstu odpowiada zapisanym danym źródłowym. Każde widoczne zdanie odnosi się do pola wybranej inicjatywy, a komunikaty o braku wskazują luki w tym samym zapisanym rekordzie. Interfejs nie wyprowadza wartości z domyślnych etykiet ani bieżącej daty. Opis nie rozszerza zakresu rekordu.'
    : 'The Details section shows only facts persisted for the selected initiative. Missing values remain unavailable and are not inferred from other records. The displayed scope matches the source data. Each sentence maps to a field on the selected initiative, while unavailable labels identify gaps in that same persisted record. The interface derives no value from display defaults or the current time. The description does not extend beyond the record scope.';
  return capWords(
    [
      ...available.map((fact) => fact.present(fact.value)),
      ...missing.map((fact) => fact.missing),
      scope,
    ].join(' ')
  );
};
