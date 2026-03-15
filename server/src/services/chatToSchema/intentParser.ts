/**
 * IntentParser — regex-first intent classification for chat-to-schema pipeline.
 * Supports EN + PL patterns, extracts entities from natural language.
 */

import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProposalIntent =
  | 'create_base'
  | 'create_table'
  | 'create_tables'
  | 'add_field'
  | 'modify_field'
  | 'remove_field'
  | 'create_view'
  | 'modify_view'
  | 'seed_records'
  | 'describe_schema'
  | 'suggest_improvement';

export interface ParsedIntent {
  intent: ProposalIntent;
  confidence: number;
  entities: Record<string, string>;
  rawInput: string;
}

// ---------------------------------------------------------------------------
// Pattern definitions (EN + PL)
// ---------------------------------------------------------------------------

interface IntentPattern {
  intent: ProposalIntent;
  patterns: RegExp[];
  /** Higher priority wins when multiple patterns match */
  priority: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'create_base',
    patterns: [
      /\b(create|new|setup|build|make)\s+(a\s+)?base\b/i,
      /\b(utwórz|nowa|stwórz|zbuduj)\s+(bazę|baze|bazę danych)\b/i,
    ],
    priority: 10,
  },
  {
    intent: 'create_tables',
    patterns: [
      /\b(crm|project\s+tracker|inventory|multi[- ]?table|several\s+tables|multiple\s+tables)\b/i,
      /\bcreate\s+(\w+\s*,\s*\w+)/i,
      /\b(tables|tabele)\b.*\b(and|i|,)\b/i,
    ],
    priority: 9,
  },
  {
    intent: 'create_table',
    patterns: [
      /\b(create|new|add|build|make)\s+(a\s+)?table\b/i,
      /\b(nowa|utwórz|stwórz|dodaj|zbuduj)\s+(tabelę|tabele|tabela)\b/i,
    ],
    priority: 8,
  },
  {
    intent: 'remove_field',
    patterns: [
      /\b(remove|delete|drop)\s+(a\s+)?(column|field)\b/i,
      /\b(usuń|skasuj|usuń)\s+(pole|kolumnę|kolumne)\b/i,
    ],
    priority: 7,
  },
  {
    intent: 'modify_field',
    patterns: [
      /\b(change|modify|convert|rename|switch|update|alter)\s+(a\s+)?(column|field|type)\b/i,
      /\b(zmień|modyfikuj|konwertuj|przemianuj|zmien)\s+(pole|kolumnę|kolumne|typ)\b/i,
    ],
    priority: 6,
  },
  {
    intent: 'add_field',
    patterns: [
      /\b(add|new|include|insert)\s+(a\s+)?(column|field)\b/i,
      /\b(dodaj)\s+(kolumnę|kolumne|pole|nowe pole)\b/i,
    ],
    priority: 5,
  },
  {
    intent: 'modify_view',
    patterns: [
      /\b(change|modify|update|edit)\s+(a\s+)?(view)\b/i,
      /\b(zmień|modyfikuj)\s+(widok)\b/i,
    ],
    priority: 4,
  },
  {
    intent: 'create_view',
    patterns: [
      /\b(add|create|new)\s+(a\s+)?(view|kanban|calendar|gallery|timeline)\b/i,
      /\b(dodaj|utwórz|nowy)\s+(widok)\b/i,
    ],
    priority: 4,
  },
  {
    intent: 'seed_records',
    patterns: [
      /\b(add\s+rows|seed|sample|populate|fill|insert\s+data|example\s+data|demo\s+data)\b/i,
      /\b(dodaj\s+wiersze|wypełnij|przykładowe\s+dane|dane\s+demo)\b/i,
    ],
    priority: 3,
  },
  {
    intent: 'describe_schema',
    patterns: [
      /\b(what\s+columns|describe|explain|show\s+schema|list\s+fields|what\s+fields)\b/i,
      /\b(opisz|pokaż\s+schemat|jakie\s+kolumny|jakie\s+pola)\b/i,
    ],
    priority: 2,
  },
  {
    intent: 'suggest_improvement',
    patterns: [
      /\b(suggest|improve|recommend|optimize|better|enhance)\b/i,
      /\b(zasugeruj|popraw|ulepsz|zoptymalizuj|rekomenduj)\b/i,
    ],
    priority: 1,
  },
];

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

const QUOTED_STRING_RE = /["'`]([^"'`]+)["'`]/g;
const TABLE_NAME_RE = /\btable\s+(?:called|named)?\s*["'`]?(\w[\w\s]*\w)["'`]?/i;
const FIELD_NAME_RE = /\b(?:column|field)\s+(?:called|named)?\s*["'`]?(\w[\w\s]*\w)["'`]?/i;
const FIELD_TYPE_RE = /\btype\s+(?:to\s+)?["'`]?(\w+)["'`]?/i;

function extractEntities(message: string): Record<string, string> {
  const entities: Record<string, string> = {};

  const quoted: string[] = [];
  let m: RegExpExecArray | null;
  const quotedRe = new RegExp(QUOTED_STRING_RE.source, QUOTED_STRING_RE.flags);
  while ((m = quotedRe.exec(message)) !== null) {
    quoted.push(m[1]);
  }
  if (quoted.length > 0) {
    entities.quotedNames = quoted.join(', ');
  }

  const tableMatch = TABLE_NAME_RE.exec(message);
  if (tableMatch) {
    entities.tableName = tableMatch[1].trim();
  }

  const fieldMatch = FIELD_NAME_RE.exec(message);
  if (fieldMatch) {
    entities.fieldName = fieldMatch[1].trim();
  }

  const typeMatch = FIELD_TYPE_RE.exec(message);
  if (typeMatch) {
    entities.fieldType = typeMatch[1].trim();
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseIntent(
  userMessage: string,
  context?: { tableId?: string; baseId?: string }
): ParsedIntent {
  const trimmed = (userMessage || '').trim();
  if (!trimmed) {
    return {
      intent: 'describe_schema',
      confidence: 0.3,
      entities: {},
      rawInput: userMessage,
    };
  }

  const matches: Array<{ intent: ProposalIntent; priority: number }> = [];

  for (const def of INTENT_PATTERNS) {
    for (const pattern of def.patterns) {
      if (pattern.test(trimmed)) {
        matches.push({ intent: def.intent, priority: def.priority });
        break;
      }
    }
  }

  if (matches.length === 0) {
    logger.debug('[IntentParser] No regex match, falling back to fuzzy', {
      message: trimmed.slice(0, 120),
    });
    return {
      intent: guessFuzzyIntent(trimmed, context),
      confidence: 0.7,
      entities: extractEntities(trimmed),
      rawInput: userMessage,
    };
  }

  matches.sort((a, b) => b.priority - a.priority);
  const best = matches[0];

  return {
    intent: best.intent,
    confidence: 0.92,
    entities: extractEntities(trimmed),
    rawInput: userMessage,
  };
}

/**
 * Fuzzy fallback when no regex matches.
 * Uses simple keyword scoring.
 */
function guessFuzzyIntent(
  message: string,
  context?: { tableId?: string; baseId?: string }
): ProposalIntent {
  const lower = message.toLowerCase();

  if (context?.tableId) {
    if (/field|column|pole|kolumn/i.test(lower)) return 'add_field';
    if (/view|widok/i.test(lower)) return 'create_view';
    if (/row|record|wiersz|rekord/i.test(lower)) return 'seed_records';
  }

  if (/table|tabel/i.test(lower)) return 'create_table';
  if (/base|baz/i.test(lower)) return 'create_base';

  return 'create_table';
}
