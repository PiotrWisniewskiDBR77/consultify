/**
 * Detects if a chat message is a table creation/modification intent.
 * Returns true if the message matches known table-related patterns.
 *
 * Also discriminates between Table Builder (structured data / tracker)
 * and Excele (workbook / Excel file / financial model) intents.
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
  // Planning/ops table intents
  /\b(risk\s*register|decision\s*log|action\s*tracker|kanban\s*table|status\s*matrix)\b/i,
  /\b(rejestr\s*ryzyk|dziennik\s*decyzji|tracker\s*zadań|tablica\s*zadań|macierz\s*status[uó])\b/i,
];

const EXCELE_INTENT_PATTERNS = [
  // EN — workbook/excel/multi-sheet/financial model
  /\b(create|build|make|generate|prepare)\s+(a\s+)?(workbook|excel\s*file|excel\s*spreadsheet|multi[- ]?sheet)\b/i,
  /\bfinancial\s+(model|plan|forecast|projection)\b/i,
  /\bbudget\s*(plan|spreadsheet|template|model)?\b/i,
  /\b(p&l|profit\s*(and|&)\s*loss|balance\s*sheet|cash\s*flow)\b/i,
  /\b(xlsx|\.xlsx)\b/i,
  /\bcross[- ]?sheet\s+(ref|formula|link)/i,
  // PL — skoroszyt/arkusz Excel/model finansowy
  /\b(stwórz|utwórz|zbuduj|zrób|przygotuj|wygeneruj)\s+(mi\s+)?(skoroszyt|plik\s*excel|arkusz\s*excel)\b/i,
  /\bmodel\s+(finansowy|budżetowy)\b/i,
  /\b(budżet|prognoza|rachunek\s*zysków)\b/i,
];

export function detectTableIntent(message: string): boolean {
  return TABLE_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Detects if message targets P23 Excele (workbook generation) rather than Table Builder.
 * Excele handles multi-sheet Excel workbooks with formulas; Table Builder handles
 * structured data tables and trackers.
 */
export function detectExceleIntent(message: string): boolean {
  return EXCELE_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}
