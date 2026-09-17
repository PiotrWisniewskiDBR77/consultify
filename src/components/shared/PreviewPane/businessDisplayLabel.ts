/**
 * Presentation-only label resolver for governed preview surfaces.
 *
 * Technical identifiers remain useful for audit/deep links, but must not become
 * the primary user copy. We only translate identifiers with an explicit,
 * product-owned dictionary entry. Unknown identifiers fail closed instead of
 * becoming a plausible but potentially false business name.
 */

import { tlumaczPozaHookiem } from '@/utils/tlumaczPozaHookiem';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TECHNICAL_PREFIX_PATTERN =
  /^(?:aco|ie|initiative|execution|case|task|decision|scenario|allocation|signal|intervention|report|project)(?:[-_:])/i;
const GENERATED_SUFFIX_PATTERN = /(?:[-_:](?:[0-9]{6,}|[0-9a-f]{8,}))$/i;

export const KNOWN_ROLE_DISPLAY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'operations-owner': 'Właściciel operacyjny',
  'execution-manager': 'Menedżer realizacji',
  'intervention-authority': 'Osoba zatwierdzająca interwencję',
  'report-approver': 'Osoba zatwierdzająca raport',
  'resource-manager': 'Menedżer zasobów',
});

export type BusinessDisplayLabelInput = {
  displayName?: unknown;
  title?: unknown;
  rawId?: unknown;
  fallback?: string;
  restricted?: boolean;
};

const nonEmptyText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const isTechnicalIdentifier = (value: unknown): boolean => {
  const text = nonEmptyText(value);
  if (!text) return false;
  return (
    UUID_PATTERN.test(text) ||
    TECHNICAL_PREFIX_PATTERN.test(text) ||
    GENERATED_SUFFIX_PATTERN.test(text)
  );
};

export const resolveBusinessDisplayLabel = ({
  displayName,
  title,
  rawId,
  fallback = 'Unknown',
  restricted = false,
}: BusinessDisplayLabelInput): string => {
  if (restricted) return 'Restricted';

  for (const candidate of [displayName, title]) {
    const text = nonEmptyText(candidate);
    if (text && !isTechnicalIdentifier(text)) return text;
  }

  const identifier = nonEmptyText(rawId);
  if (identifier) {
    const knownRole = KNOWN_ROLE_DISPLAY_LABELS[identifier.toLowerCase()];
    if (knownRole) return knownRole;
  }

  return fallback;
};

/**
 * Kindy z parą EN/PL w `public/locales/{en,pl}/translation.json`
 * (`sharedComponents.relationKind.*`) — wartość żyje w locale, nie w kodzie.
 * `RELATION_KIND_LABELS` poniżej to zastany dług PL sprzed DEC-461: w tej
 * naprawie dopisujemy tylko kind, którego realnie używa podgląd (Wpis 70 P2),
 * reszty mapy i samego fallbacku nie ruszamy.
 */
const RELATION_KIND_I18N: Readonly<Record<string, { klucz: string; en: string }>> = Object.freeze({
  project: { klucz: 'sharedComponents.relationKind.project', en: 'Linked project' },
});

const RELATION_KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  initiative: 'Powiązana inicjatywa',
  execution: 'Powiązana realizacja',
  case: 'Powiązana realizacja',
  task: 'Powiązane zadanie',
  decision: 'Powiązana decyzja',
  portfolio: 'Powiązany scenariusz portfela',
  plan: 'Powiązany plan',
  capacity: 'Powiązane obciążenie',
  signal: 'Powiązany sygnał',
  intervention: 'Powiązana interwencja',
  report: 'Powiązany raport',
  source: 'Powiązane źródło',
});

export const relationFallbackLabel = (type?: string): string => {
  const kind = String(type ?? '').toLowerCase();
  const para = RELATION_KIND_I18N[kind];
  if (para) return tlumaczPozaHookiem(para.klucz, para.en);
  return RELATION_KIND_LABELS[kind] ?? 'Powiązany rekord';
};

/** Detects an identifier even when a screen prefixes it, e.g. `Realizacja · <uuid>`. */
export const containsTechnicalIdentifier = (value: unknown): boolean => {
  const text = nonEmptyText(value);
  if (!text) return false;
  if (isTechnicalIdentifier(text)) return true;
  return text
    .split(/\s*(?:·|:|@|\|)\s*/)
    .some((part) => isTechnicalIdentifier(part.replace(/^v(?=\d)/i, '')));
};
