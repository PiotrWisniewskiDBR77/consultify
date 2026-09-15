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
}

function compileMessage(en: string, pl: string): CompiledMessage {
  const source = templateParts(en);
  const polish = templateParts(pl);
  const sourceTokens = source.tokens;
  const polishTokens = polish.tokens;
  if (sourceTokens.length === 0) {
    return { exact: en, pattern: null, polish: pl, polishTokens, sourceTokens };
  }

  let pattern = '^';
  for (let index = 0; index < sourceTokens.length; index += 1) {
    pattern += escapeRegExp(source.staticParts[index]) + '([\\s\\S]+?)';
  }
  pattern += escapeRegExp(source.staticParts.at(-1) ?? '') + '$';
  return { exact: en, pattern: new RegExp(pattern), polish: pl, polishTokens, sourceTokens };
}

const COMPILED = SERVER_PAYLOAD_MESSAGES.filter(({ runtime }) => runtime !== false).map(({ en, pl }) =>
  compileMessage(en, pl)
);

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

function isUntranslatedEnglishProse(value: string): boolean {
  if (value.length < 6 || /^[A-Z0-9_.:-]+$/.test(value)) return false;
  if (/[ąćęłńóśźż]/i.test(value)) return false;
  return /\b(?:the|a|an|is|are|was|were|not|missing|required|failed|invalid|cannot|could|must|found|allowed|error|request|user|organization|project|report|task|operation)\b/i.test(
    value
  );
}

export function localizeServerErrorField(value: string, locale: 'en' | 'pl'): string {
  const localized = localizeServerPayloadText(value, locale);
  if (locale === 'pl' && localized === value && isUntranslatedEnglishProse(value)) {
    return 'Nie udało się wykonać operacji.';
  }
  return localized;
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
