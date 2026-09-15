import type { Request } from 'express';

import { SERVER_PAYLOAD_MESSAGES } from './serverPayloadMessages/index.js';
import { resolveServerErrorLocale } from './serverErrorMessages.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TemplateParts {
  staticParts: string[];
  tokens: string[];
}

function templateParts(value: string): TemplateParts {
  const staticParts: string[] = [];
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf('${', cursor);
    if (start < 0) break;
    let depth = 1;
    let end = start + 2;
    while (end < value.length && depth > 0) {
      if (value[end] === '{') depth += 1;
      else if (value[end] === '}') depth -= 1;
      end += 1;
    }
    if (depth !== 0) break;
    staticParts.push(value.slice(cursor, start));
    tokens.push(value.slice(start, end));
    cursor = end;
  }
  staticParts.push(value.slice(cursor));
  return { staticParts, tokens };
}

interface CompiledMessage {
  exact: string;
  pattern: RegExp | null;
  polish: string;
  polishTokens: string[];
  sourceTokens: string[];
  specificity: number;
}

function compileMessage(en: string, pl: string): CompiledMessage {
  const source = templateParts(en);
  const polish = templateParts(pl);
  const sourceTokens = source.tokens;
  const polishTokens = polish.tokens;
  if (sourceTokens.length === 0) {
    return { exact: en, pattern: null, polish: pl, polishTokens, sourceTokens, specificity: en.length };
  }

  let pattern = '^';
  for (let index = 0; index < sourceTokens.length; index += 1) {
    pattern += escapeRegExp(source.staticParts[index]) + '([\\s\\S]+?)';
  }
  pattern += escapeRegExp(source.staticParts.at(-1) ?? '') + '$';
  return {
    exact: en,
    pattern: new RegExp(pattern),
    polish: pl,
    polishTokens,
    sourceTokens,
    specificity: source.staticParts.reduce((total, part) => total + part.length, 0),
  };
}

const COMPILED = SERVER_PAYLOAD_MESSAGES.filter(({ runtime }) => runtime !== false)
  .map(({ en, pl }) => compileMessage(en, pl))
  .sort((left, right) => Number(Boolean(left.pattern)) - Number(Boolean(right.pattern)) || right.specificity - left.specificity);

export function localizeServerPayloadText(value: string, locale: 'en' | 'pl'): string {
  if (locale === 'en') return value;

  for (const message of COMPILED) {
    if (!message.pattern) {
      if (value === message.exact) return message.polish;
      continue;
    }
    const matched = message.pattern.exec(value);
    if (!matched || message.sourceTokens.length !== message.polishTokens.length) continue;
    const values = new Map(message.sourceTokens.map((token, index) => [token, matched[index + 1]]));
    const polish = templateParts(message.polish);
    let result = '';
    for (let index = 0; index < polish.tokens.length; index += 1) {
      result += polish.staticParts[index] + (values.get(polish.tokens[index]) ?? polish.tokens[index]);
    }
    return result + (polish.staticParts.at(-1) ?? '');
  }
  return value;
}

const ERROR_PHRASE_TRANSLATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bmeeting execution\b/gi, 'wykonanie spotkania'],
  [/\bsimulation engine\b/gi, 'silnik symulacji'],
  [/\borganization id\b/gi, 'identyfikator organizacji'],
  [/\borganizationId\b/g, 'organizationId'],
  [/\bnot found\b/gi, 'nie znaleziono'],
  [/\bis unavailable\b/gi, 'jest niedostępny'],
  [/\bunavailable\b/gi, 'niedostępny'],
  [/\bmissing required\b/gi, 'brak wymaganych'],
  [/\brequires\b/gi, 'wymaga'],
  [/\brequired\b/gi, 'wymagany'],
  [/\bmust be\b/gi, 'musi być'],
  [/\bcannot\b/gi, 'nie można'],
  [/\bcould not\b/gi, 'nie udało się'],
  [/\bfailed to\b/gi, 'nie udało się'],
  [/\bfailed\b/gi, 'niepowodzenie'],
  [/\binvalid\b/gi, 'nieprawidłowy'],
  [/\bunknown\b/gi, 'nieznany'],
  [/\btitle\b/gi, 'tytuł'],
  [/\band\b/gi, 'i'],
  [/\bstatus\b/gi, 'status'],
  [/\btask\b/gi, 'zadanie'],
  [/\bproject\b/gi, 'projekt'],
  [/\breport\b/gi, 'raport'],
  [/\buser\b/gi, 'użytkownik'],
  [/\boperation\b/gi, 'operacja'],
  [/\brequest\b/gi, 'żądanie'],
  [/\bfield\b/gi, 'pole'],
  [/\bvalue\b/gi, 'wartość'],
  [/\btype\b/gi, 'typ'],
];

function localizeUncataloguedError(value: string): string {
  let result = value;
  for (const [pattern, replacement] of ERROR_PHRASE_TRANSLATIONS) {
    result = result.replace(pattern, replacement);
  }
  // Preserve the full diagnostic when no safe lexical rule applies. The
  // Polish label makes locale explicit without collapsing distinct domain
  // errors into one lossy sentence; stable identifiers/placeholders survive.
  return result === value ? `Błąd operacji: ${value}` : result;
}

export function localizeServerErrorField(value: string, locale: 'en' | 'pl'): string {
  const localized = localizeServerPayloadText(value, locale);
  return locale === 'pl' && localized === value ? localizeUncataloguedError(value) : localized;
}

function localizePayload(value: unknown, locale: 'en' | 'pl'): unknown {
  if (Array.isArray(value)) return value.map((item) => localizePayload(item, locale));
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const source = value as Record<string, unknown>;
  const localized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    localized[key] =
      (key === 'message' || key === 'error') && typeof item === 'string'
        ? localizeServerErrorField(item, locale)
        : localizePayload(item, locale);
  }
  return localized;
}

export function localizeServerPayload(value: unknown, req: Request): unknown {
  const locale = resolveServerErrorLocale(req);
  return locale === 'en' ? value : localizePayload(value, locale);
}
