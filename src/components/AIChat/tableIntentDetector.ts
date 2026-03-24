/**
 * Detects if a chat message is a table creation/modification intent.
 * Returns true if the message matches known table-related patterns.
 */

const TABLE_INTENT_PATTERNS = [
  // EN patterns
  /\b(create|build|make|generate|set\s*up)\s+(a\s+)?(table|spreadsheet|database|tracker|board)\b/i,
  /\b(table|spreadsheet)\s+(for|to|with)\b/i,
  /\bneed\s+(a\s+)?(table|spreadsheet|tracker)\b/i,
  // PL patterns
  /\b(stwórz|utwórz|zbuduj|zrób|przygotuj|wygeneruj)\s+(mi\s+)?(tabelę|tabele|arkusz|bazę|tracker)\b/i,
  /\b(tabel[eęa]|arkusz)\s+(do|dla|z|ze)\b/i,
  /\bpotrzebuję\s+(tabel[eęi]|arkusz[a]?)\b/i,
  /\b(dodaj|zmień|usuń|modyfikuj)\s+(kolumnę|pole|widok|rekord)\b/i,
  /\b(add|modify|change|remove|delete)\s+(column|field|view|record)\b/i,
];

export function detectTableIntent(message: string): boolean {
  return TABLE_INTENT_PATTERNS.some(pattern => pattern.test(message));
}
