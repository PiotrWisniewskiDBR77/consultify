import type { ToolSessionPreviewDetails } from './ToolSessionPreviewV3';

export type ToolSessionDetailsLanguage = 'pl' | 'en';

const DETAILS_MAX_WORDS = 140;
const DETAILS_MAX_FACTS = 12;
const DETAILS_MAX_VALUE_CHARS = 160;
const BLOCKED_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'credential',
  'apikey',
  'privatekey',
  'accesskey',
  'authheader',
  'authentication',
  'bearer',
  'clientsecret',
  'sessionkey',
] as const;
const BEARER_VALUE = /\bbearer\s+[a-z\d._~+/=-]+/i;
const JWT_VALUE = /\beyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+\b/i;
const CREDENTIAL_ASSIGNMENT =
  /\b(?:api[\s_-]*key|private[\s_-]*key|access[\s_-]*key|auth[\s_-]*header|authentication|authorization|client[\s_-]*secret|session[\s_-]*key|password|secret|token|cookie|credential)\s*[:=]\s*\S+/i;

const normalizeKeyPath = (path: string): string => path.toLowerCase().replace(/[^a-z0-9]/g, '');

const isBlockedKeyPath = (path: string): boolean => {
  const normalized = normalizeKeyPath(path);
  return BLOCKED_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
};

const containsCredentialValue = (value: string): boolean =>
  BEARER_VALUE.test(value) || JWT_VALUE.test(value) || CREDENTIAL_ASSIGNMENT.test(value);

const sanitizeDetailText = (value: unknown, maxChars = DETAILS_MAX_VALUE_CHARS): string => {
  const withoutControlCharacters = Array.from(String(value ?? ''))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127 ? character : ' ';
    })
    .join('');
  const text = withoutControlCharacters
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || containsCredentialValue(text)) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
};

const humanizeFactKey = (path: string): string =>
  path
    .split('.')
    .filter((part) => !/^\d+$/.test(part))
    .at(-1)
    ?.replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim() ?? '';

const looksLikeSerializedContainer = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

type NormalizedScalar =
  | { kind: 'scalar'; value: string }
  | { kind: 'container'; value: Record<string, unknown> | unknown[] }
  | { kind: 'drop' };

const normalizeScalar = (value: unknown, maxChars = DETAILS_MAX_VALUE_CHARS): NormalizedScalar => {
  if (typeof value === 'string' && looksLikeSerializedContainer(value)) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) return { kind: 'drop' };
      return { kind: 'container', value: parsed as Record<string, unknown> | unknown[] };
    } catch {
      return { kind: 'drop' };
    }
  }

  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return { kind: 'drop' };
  }
  const safeValue = sanitizeDetailText(value, maxChars);
  return safeValue ? { kind: 'scalar', value: safeValue } : { kind: 'drop' };
};

const collectScalarFacts = (
  value: unknown,
  path = '',
  facts: Array<{ key: string; value: string }> = [],
  depth = 0
): Array<{ key: string; value: string }> => {
  if (facts.length >= DETAILS_MAX_FACTS || depth > 3 || value == null || isBlockedKeyPath(path)) {
    return facts;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const key = humanizeFactKey(path);
    const normalized = normalizeScalar(value);
    if (normalized.kind === 'container') {
      return collectScalarFacts(normalized.value, path, facts, depth + 1);
    }
    if (key && normalized.kind === 'scalar') facts.push({ key, value: normalized.value });
    return facts;
  }

  if (Array.isArray(value)) {
    const scalarValues = value
      .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
      .flatMap((item) => {
        const normalized = normalizeScalar(item, 60);
        return normalized.kind === 'scalar' ? [normalized.value] : [];
      })
      .slice(0, 5);
    const key = humanizeFactKey(path);
    if (key && scalarValues.length) facts.push({ key, value: scalarValues.join(', ') });
    value.slice(0, 8).forEach((item, index) => {
      if (
        (typeof item === 'object' && item !== null) ||
        (typeof item === 'string' && looksLikeSerializedContainer(item))
      ) {
        collectScalarFacts(item, `${path}.${index}`, facts, depth + 1);
      }
    });
    return facts;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .forEach(([key, nested]) => {
        collectScalarFacts(nested, path ? `${path}.${key}` : key, facts, depth + 1);
      });
  }
  return facts;
};

const capDetailsWords = (text: string): string => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= DETAILS_MAX_WORDS
    ? text
    : `${words.slice(0, DETAILS_MAX_WORDS).join(' ')}…`;
};

/** Builds factual Details copy from persisted session fields only. */
export const buildToolSessionDetails = (
  details: ToolSessionPreviewDetails | null | undefined,
  language: ToolSessionDetailsLanguage
): string => {
  if (!details) return '';

  const isPolish = language === 'pl';
  const sentences: string[] = [];
  const addFact = (label: string, value: unknown, suffix = '') => {
    const normalized = normalizeScalar(value);
    if (normalized.kind === 'scalar') {
      sentences.push(`${label}: ${normalized.value}${suffix}.`);
    }
  };

  addFact(isPolish ? 'Sesja' : 'Session', details.name);
  addFact(isPolish ? 'Typ narzędzia' : 'Tool type', details.toolType);
  addFact(isPolish ? 'Status' : 'Status', details.status);
  if (details.progress != null) addFact(isPolish ? 'Postęp' : 'Progress', details.progress, '%');
  if (details.confidenceAvg != null) {
    addFact(isPolish ? 'Poziom pewności' : 'Confidence level', details.confidenceAvg);
  }
  addFact(isPolish ? 'Utworzono' : 'Created', details.createdAt);
  addFact(isPolish ? 'Zaktualizowano' : 'Updated', details.updatedAt);

  const answerFacts = collectScalarFacts(details.answers);
  const contextFacts = collectScalarFacts(details.contextSnapshot).slice(
    0,
    DETAILS_MAX_FACTS - answerFacts.length
  );
  const appendFacts = (facts: Array<{ key: string; value: string }>, prefix: string) => {
    facts.forEach((fact) => {
      const key = sanitizeDetailText(fact.key, 50);
      if (key && fact.value) sentences.push(`${prefix} — ${key}: ${fact.value}.`);
    });
  };

  appendFacts(answerFacts, isPolish ? 'Odpowiedź' : 'Answer');
  appendFacts(contextFacts, isPolish ? 'Kontekst' : 'Context');

  return capDetailsWords(sentences.join(' '));
};
